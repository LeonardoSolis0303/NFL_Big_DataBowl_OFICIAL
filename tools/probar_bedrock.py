"""Prueba real de Bedrock para Al Huddle AI Coach. Ejecutar desde la raíz, con credenciales ya cargadas en la terminal:

    .venv/bin/python tools/probar_bedrock.py              (Linux/macOS)
    .\\.venv\\Scripts\\python.exe tools\\probar_bedrock.py   (Windows)

No imprime credenciales. Termina con código 0 solo si la respuesta real pasa los controles.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import boto3  # noqa: E402
from botocore.exceptions import BotoCoreError, ClientError  # noqa: E402

from backend import ai_coach  # noqa: E402
from backend.main import bundle  # noqa: E402  (también carga .env si existe)
from backend.decision import estimate  # noqa: E402

region, modelo = ai_coach.region(), ai_coach.modelo_id()
print(f"Región {region} · modelo {modelo}")

try:
    arn = boto3.client("sts", region_name=region).get_caller_identity()["Arn"]
    print("1. Identidad AWS: OK ·", re.sub(r"::\d{12}:", "::************:", arn))
except (ClientError, BotoCoreError) as e:
    print("1. Identidad AWS: FALLA ·", getattr(e, "response", {}).get("Error", {}).get("Code", type(e).__name__))
    sys.exit(1)

try:
    perfiles = boto3.client("bedrock", region_name=region).list_inference_profiles(maxResults=100)["inferenceProfileSummaries"]
    nova = sorted(p["inferenceProfileId"] for p in perfiles if "nova" in p["inferenceProfileId"])
    print(f"2. Perfiles de inferencia Nova visibles: {nova or 'ninguno'}")
except (ClientError, BotoCoreError) as e:
    print("2. Perfiles: no listables (se prueba directo) ·", getattr(e, "response", {}).get("Error", {}).get("Code", type(e).__name__))

model = bundle()
situacion = dict(down=3, yardas=2, yardas_a_goal=67)
evaluacion = estimate(model, 3, 2, 67)
pregunta = "Tengo tercera y dos en mi yarda 33. ¿Qué tan favorable es la situación?"
status, body = ai_coach.responder(pregunta, situacion, evaluacion, model["resumen"]["tracking"])
if status != 200:
    print(f"3. Converse: FALLA · HTTP {status} · {body['codigo']} · {body['motivo']}")
    sys.exit(1)
texto = body["respuesta"]
print(f"3. Converse: OK · {body['latencia_ms']} ms\n\n{texto}\n")

controles = {
    "pronóstico 57.6": "57.6" in texto or "57,6" in texto,
    "IC 49.6–64.9": all(x in texto.replace(",", ".") for x in ("49.6", "64.9")),
    "58 de 113": "58" in texto and "113" in texto,
    "52 partidos": "52" in texto,
    "sin cifras inventadas": not body["cifras_no_respaldadas"],
    "sin formación recomendada": not re.search(r"(recomiendo|recomendable|conviene|mejor opción|elige|usa)\s+(la\s+)?(formación\s+)?(EMPTY|SHOTGUN)", texto, re.I),
}
for nombre, ok in controles.items():
    print(f"   {'OK ' if ok else 'NO '} {nombre}")
if body["cifras_no_respaldadas"]:
    print("   cifras no respaldadas:", body["cifras_no_respaldadas"])
sys.exit(0 if all(controles.values()) else 2)
