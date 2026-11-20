from unittest import TestCase
from fastapi.testclient import TestClient
from backend.main import app


class OfficialTrackingReplay(TestCase):
    def test_release_only_after_reveal(self):
        client = TestClient(app)
        path = "/api/jugadas/2021090900/97"
        prior = client.get(path).json()
        after = client.get(path, params={"revelar": True}).json()
        self.assertIsNone(prior["secuencia_observada"])
        self.assertEqual(prior["evaluacion"], after["evaluacion"])
        if not after.get("secuencia_observada"):
            self.skipTest("Modelo reconstruido sin el tracking de este partido")
        seq = after["secuencia_observada"]
        self.assertEqual([s["frameId"] for s in seq], list(range(1,44)))
        self.assertEqual(next(s["frameId"] for s in seq if "pass_forward" in s["eventos"]), 40)
        self.assertEqual(prior["cuadros"][0]["frameId"], 6)
        self.assertEqual(len(seq[5]["jugadores"]), 22)
        self.assertEqual(len(seq[5]["balon"]), 2)
