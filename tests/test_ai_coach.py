"""Pruebas del AI Coach con Bedrock simulado. No llaman a AWS."""
import os
from unittest import TestCase
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError, NoCredentialsError, ReadTimeoutError
from fastapi.testclient import TestClient

from backend import ai_coach
from backend.main import app

client = TestClient(app)
URL = "/api/coach-ia"
BRADY = {"situacion": {"down": 3, "yardas": 2, "yardas_a_goal": 67}, "pregunta": "¿Qué tan favorable es esta situación?"}
TEXTO = ("El modelo estima 57.6% (IC 95% 49.6%–64.9%). En la historia se vieron 58 de 113 jugadas en 52 partidos. "
         "La evidencia no permite priorizar una formación.")


def fake_bedrock(texto=TEXTO, error=None):
    fake = MagicMock()
    if error:
        fake.converse.side_effect = error
    else:
        fake.converse.return_value = {"output": {"message": {"role": "assistant", "content": [{"text": texto}]}}}
    return fake


class CoachIA(TestCase):
    def call(self, fake, body=BRADY):
        with patch.object(ai_coach.boto3, "client", return_value=fake) as factory:
            r = client.post(URL, json=body)
        return r, factory

    def test_evidencia_del_backend_llega_al_modelo(self):
        fake = fake_bedrock()
        with patch.dict(os.environ, {"BEDROCK_MODEL_ID": "modelo-de-prueba"}):
            r, factory = self.call(fake)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["estado"] == "ok" and body["proveedor"] == "amazon-bedrock" and body["modelo"] == "modelo-de-prueba"
        assert body["fuente"] == "backend-estadistico" and body["cifras_no_respaldadas"] == []
        assert factory.call_args.kwargs["region_name"] == ai_coach.region()
        kwargs = fake.converse.call_args.kwargs
        assert kwargs["modelId"] == "modelo-de-prueba"
        assert kwargs["inferenceConfig"]["temperature"] <= 0.3 and kwargs["inferenceConfig"]["maxTokens"] <= 500
        prompt = kwargs["messages"][0]["content"][0]["text"]
        for cifra in ("57.6%", "49.6%–64.9%", "58 de 113", "52 partidos", '"recomendacion": null', "incluye el cero"):
            assert cifra in prompt, cifra
        assert len(prompt) < 3000
        # Sin desenlaces ni cuadros: el modelo no puede revelar resultados
        assert "incomplete" not in prompt.lower() and "desenlace" not in prompt and "jugadores" not in prompt
        assert body["evidencia"] == ai_coach.evidencia(BRADY["situacion"], client.post("/api/sugerencia", json=BRADY["situacion"]).json(),
                                                       client.get("/api/resumen").json()["tracking"])

    def test_cliente_no_puede_inyectar_cifras(self):
        for extra in ({"pronostico": 0.99}, {"evidencia": "90%"}):
            assert client.post(URL, json=BRADY | extra).status_code == 422
        assert client.post(URL, json={**BRADY, "situacion": {**BRADY["situacion"], "p": 0.9}}).status_code == 422

    def test_pregunta_validada(self):
        for pregunta in ("", "a", "x" * 501):
            assert client.post(URL, json=BRADY | {"pregunta": pregunta}).status_code == 422

    def test_sin_soporte_se_comunica(self):
        fake = fake_bedrock("No hay soporte suficiente para esta situación.")
        r, _ = self.call(fake, {"situacion": {"down": 3, "yardas": 32, "yardas_a_goal": 43}, "pregunta": "¿Qué probabilidad tengo?"})
        assert r.status_code == 200 and r.json()["estado_evidencia"] == "sin_soporte"
        prompt = fake.converse.call_args.kwargs["messages"][0]["content"][0]["text"]
        assert '"estado": "sin_soporte"' in prompt and "pronostico_modelo" not in prompt

    def test_fallos_de_aws_no_rompen_la_api(self):
        denied = ClientError({"Error": {"Code": "AccessDeniedException", "Message": "x"}}, "Converse")
        expired = ClientError({"Error": {"Code": "ExpiredTokenException", "Message": "x"}}, "Converse")
        timeout = ReadTimeoutError(endpoint_url="https://bedrock")
        for error, codigo in ((NoCredentialsError(), "sin_credenciales"), (denied, "AccessDeniedException"),
                              (expired, "ExpiredTokenException"), (timeout, "ReadTimeoutError")):
            r, _ = self.call(fake_bedrock(error=error))
            assert r.status_code == 503 and r.json()["estado"] == "ia_no_disponible" and r.json()["codigo"] == codigo
            assert r.json()["evidencia"]["pronostico_modelo"].startswith("57.6%")
        assert client.post("/api/sugerencia", json=BRADY["situacion"]).status_code == 200
        assert client.get("/health").json() == {"status": "ok"}

    def test_detecta_cifras_inventadas(self):
        r, _ = self.call(fake_bedrock("Con SHOTGUN la probabilidad sube a 71.3%."))
        assert "71.3" in r.json()["cifras_no_respaldadas"]
