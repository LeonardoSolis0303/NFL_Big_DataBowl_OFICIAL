from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
import pandas as pd
from fastapi.testclient import TestClient

from backend import main
from backend.build import compare, GameBootstrap
from backend.tracking import snap_data

client = TestClient(main.app)
CASE = "/api/jugadas/2021090900/97"
INPUT = {"down": 3, "yardas": 2, "yardas_a_goal": 67}


class BackendTests(TestCase):
    def test_health_and_counts(self):
        assert client.get("/health").json() == {"status":"ok"}
        r = client.get("/api/resumen").json()
        dev, conf = (r["mitades"][k] for k in ("desarrollo","confirmacion"))
        assert len(set(dev["gameIds"]) | set(conf["gameIds"])) == 122
        assert set(dev["gameIds"]).isdisjoint(conf["gameIds"])
        assert (dev["n"], conf["n"]) == (1026,1097)
        assert sum(r["exclusiones"].values()) + dev["n"] + conf["n"] == 8557
        assert conf["por_distancia"]["7+"]["exitos"] == 161


    def test_replay_boundary_and_manual_parity(self):
        play = client.get(CASE).json()
        assert play["mitad"] == "confirmacion" and play["desenlace"] is None
        assert play["evaluacion"] == client.post("/api/sugerencia", json=INPUT).json()
        assert play["evaluacion"]["recomendacion"] is None
        self.assertAlmostEqual(play["evaluacion"]["pronostico"]["p"], .57626626, places=6)
        reveal = client.get(CASE,params={"revelar":"true"}).json()
        assert reveal["desenlace"]["yardas"] == 0
        assert play["evaluacion"] == reveal["evaluacion"]
        for example in client.get("/api/resumen").json()["ejemplos"]:
            assert client.get(f"/api/jugadas/{example['gameId']}/{example['playId']}").status_code == 200


    def test_no_support(self):
        for update in ({"down":1}, {"yardas":90}, {"equipo":"XYZ"}):
            assert client.post("/api/sugerencia",json=INPUT | update).json()["estado"] == "sin_soporte"


    def test_invalid_and_unknown(self):
        for patch in ({"yardas":0},{"passResult":"C"},{"yardas":True}):
            assert client.post("/api/sugerencia",json=INPUT | patch).status_code == 422
        assert client.get("/api/jugadas/1/1").status_code == 404


    def test_missing_artifact(self):
        self.enterContext(patch.object(main,"MODEL",Path(self.enterContext(TemporaryDirectory()))/"missing.json"))
        main.bundle.cache_clear()
        assert client.get("/api/resumen").status_code == 503
        main.bundle.cache_clear()


    def test_matched_estimand(self):
        q=pd.DataFrame({"gameId":[1,2,1,2],"team":["A"]*4,"hit":[1,1,0,0],
                        "offenseFormation":["EMPTY","EMPTY","SHOTGUN","SHOTGUN"]})
        assert compare(q,GameBootstrap([1,2],123),["team"])["diferencia"] == 1
        assert compare(q.iloc[:3],GameBootstrap([1,2],123),["team"])["diferencia"] is None


    def test_tracking_only_uses_snap(self):
        tmp_path=Path(self.enterContext(TemporaryDirectory()))
        cohort=pd.DataFrame([dict(gameId=1,playId=2,nflId=1,possessionTeam="A",defensiveTeam="B")])
        rows=[]
        for f in (1,2):
            for i in range(22):
                rows.append(dict(gameId=1,playId=2,nflId=i+1,frameId=f,
                                 event="ball_snap" if f==1 and i==0 else "other",
                                 team="A" if i<11 else "B",playDirection="left",
                                 x=50 if i<11 else 50+(5 if f==1 else 1),y=15))
        pd.DataFrame(rows).to_csv(tmp_path/"tracking_1.csv",index=False)
        d,frames,missing=snap_data(tmp_path,cohort,{(1,2)})
        assert d[(1,2)] == 5 and not missing
        assert len(frames[(1,2)][0]["jugadores"]) == 22
        assert frames[(1,2)][0]["jugadores"][0]["x"] == 70
