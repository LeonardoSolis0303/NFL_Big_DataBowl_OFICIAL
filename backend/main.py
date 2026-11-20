"""FastAPI entry point for the event host. Model is built offline."""
import os
from pathlib import Path
def cargar_env():
    f = Path(__file__).resolve().parent.parent / ".env"
    if f.exists():
        for linea in f.read_text(encoding="utf-8-sig").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
cargar_env()

from functools import lru_cache
import json
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from . import ai_coach
from .decision import estimate

app = FastAPI(title="NFL UNAM · Decisiones en tercer down", version="1.0")
MODEL = Path(__file__).resolve().with_name("modelo.json")


@lru_cache(maxsize=1)
def bundle():
    try:
        data = json.loads(MODEL.read_text(encoding="utf-8"))
        for key in ("resumen","coef","coef_boot","celdas","jugadas","equipos"):
            if key not in data:
                raise ValueError("modelo incompleto")
        return data
    except (OSError, ValueError) as error:
        raise HTTPException(503, "Modelo ausente o dañado. Regenerar con python -m backend.build --data data.") from error


class Situation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    down: Annotated[int, Field(strict=True, ge=1, le=4)]
    yardas: Annotated[int, Field(strict=True, ge=1, le=100)]
    yardas_a_goal: Annotated[int, Field(strict=True, ge=1, le=99)]
    equipo: Annotated[str, Field(pattern=r"^[A-Z]{2,3}$")] | None = None


@app.get("/health")
def health():
    return {"status":"ok"}


@app.get("/api/resumen")
def resumen():
    return bundle()["resumen"]


@app.post("/api/sugerencia")
def sugerencia(s: Situation):
    return estimate(bundle(), s.down, s.yardas, s.yardas_a_goal, s.equipo)


@app.get("/api/jugadas/{game_id}/{play_id}")
def jugada(game_id:int, play_id:int, revelar:bool=False):
    model=bundle()
    row=model["jugadas"].get(f"{game_id}/{play_id}")
    if row is None:
        raise HTTPException(404,"Jugada fuera del catálogo de replay. Consultar ejemplos en api/resumen.")
    s=row["situacion"]
    return {**row,"secuencia_observada":row.get("secuencia_observada") if revelar else None,"desenlace":row["desenlace"] if revelar else None,
            "evaluacion":estimate(model,s["down"],s["yardas"],s["yardas_a_goal"])}


class CoachQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    situacion: Situation
    pregunta: Annotated[str, Field(min_length=3, max_length=500)]


@app.post("/api/coach-ia")
def coach_ia(q: CoachQuestion):
    """Interpreta con Bedrock la misma evaluación que devuelve api/sugerencia. El cliente no envía cifras."""
    s = q.situacion
    model = bundle()
    evaluacion = estimate(model, s.down, s.yardas, s.yardas_a_goal, s.equipo)
    situacion = dict(down=s.down, yardas=s.yardas, yardas_a_goal=s.yardas_a_goal)
    status, body = ai_coach.responder(q.pregunta.strip(), situacion, evaluacion, model["resumen"]["tracking"])
    return JSONResponse(body, status_code=status)
