"""Inferences use only the frozen development model and pre-call inputs."""
import numpy as np

OPTIONS = ("EMPTY", "SHOTGUN")
ZONES = ("propio", "rival", "roja")


def band(yards):
    return "1–3" if yards <= 3 else "4–6" if yards <= 6 else "7+"


def zone(goal):
    return "roja" if goal <= 20 else "rival" if goal < 50 else "propio"


def features(yards, goals):
    x = np.log1p(np.asarray(yards, dtype=float))
    goals = np.asarray(goals)
    return np.column_stack((np.ones_like(x), x, goals <= 20, (goals > 20) & (goals < 50)))


def logistic(value):
    return 1 / (1 + np.exp(-np.clip(value, -35, 35)))


def estimate(bundle, down, yards, goal, team=None):
    empty = dict(estado="sin_soporte", recomendacion=None, pronostico=None, opciones=[])
    if down != 3 or yards > goal:
        return dict(empty, motivo="Se necesita un tercer down y una línea por ganar alcanzable.")
    if team and team not in bundle["equipos"]:
        return dict(empty, motivo="Equipo fuera de la muestra.")
    key = f"{team or '*'}|{band(yards)}|{zone(goal)}"
    item = bundle["celdas"].get(key)
    if not item or yards not in item["distancias"] or item["grupo"]["n"] < 20 or item["grupo"]["partidos"] < 5:
        return dict(empty, motivo="La referencia requiere la distancia observada, 20 jugadas y 5 partidos en esta celda.")
    x = features([yards], [goal])[0]
    pred = float(logistic(x @ bundle["coef"]))
    draws = logistic(np.asarray(bundle["coef_boot"]) @ x)
    return dict(estado="referencia", recomendacion=None,
                motivo="El modelo estima la tasa de la liga en esta situación. Las opciones muestran evidencia histórica de desarrollo.",
                pronostico=dict(p=pred, ic95=np.quantile(draws,[.025,.975]).tolist(), modelo="distancia_y_zona"),
                grupo=item["grupo"], opciones=item["opciones"], distancia=band(yards), zona=zone(goal),
                equipo_filtro=team, evidencia_id=key, fuente_muestra="desarrollo",
                contraste_formaciones={"ambito":"global ajustado en confirmación",
                    **bundle["resumen"]["mitades"]["confirmacion"]["empty_menos_shotgun_ajustado"]},
                lectura="Usar la referencia para preparar esta distancia. El contraste histórico entre formaciones no permite priorizar una llamada.")
