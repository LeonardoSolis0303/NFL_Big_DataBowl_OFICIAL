# Al Huddle

**Apoyo a decisiones ofensivas en tercer down de pase · NFL Big Data Bowl UNAM 2026**

Al Huddle le da al coach ofensivo una lectura rápida de una tercera oportunidad de pase. Muestra cuál es la probabilidad estimada de alcanzar la distancia, cuántas jugadas comparables la respaldan y qué pasó realmente en jugadas observadas con tracking. Si no hay evidencia suficiente, la herramienta lo dice y no inventa un número.

| Pregunta del coach | Qué responde Al Huddle |
|---|---|
| ¿Qué tan difícil es esta tercera? | Probabilidad modelada con IC 95% a partir de down, distancia y zona del campo |
| ¿Cuánta evidencia hay? | Frecuencia observada, jugadas y partidos de la celda histórica |
| ¿Alguna formación rindió mejor? | Comparación EMPTY vs. SHOTGUN con su incertidumbre; sin recomendación si no está confirmada |
| ¿Cómo se vio una jugada real? | Replay con coordenadas de tracking; el resultado queda oculto hasta revelarlo |

## El problema

En tercer down la ofensiva conserva la serie o, casi siempre, despeja o intenta gol de campo. Antes de la llamada, el coach conoce la distancia, la posición en el campo, el reloj y el marcador. Lo que no siempre tiene a mano es una referencia honesta: qué tan seguido se convierte esa situación en la liga, con qué muestra y con qué margen de error.

Al Huddle aporta esa referencia. No elige la jugada por el coach.

## Nuestra solución

1. **Análisis previo a la jugada.** Un modelo logístico estima la probabilidad de alcanzar la distancia con información disponible antes del snap. Junto al pronóstico se muestran la frecuencia histórica de situaciones parecidas y el contraste entre formaciones.
2. **Exploración de jugadas históricas.** Cinco jugadas reservadas se reproducen cuadro por cuadro con las posiciones reales de los 22 jugadores y del balón. El pronóstico se calcula sin conocer el desenlace, y el resultado solo se entrega cuando el usuario lo pide.

## Dataset

Los datos son los del [evento regional del NFL Big Data Bowl](https://github.com/ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data), commit `85da22e`. El tracking proviene de NFL Next Gen Stats y el scouting de Pro Football Focus, según la documentación de ese repositorio.

| Archivo | Filas | Llave | Uso |
|---|---|---|---|
| games.csv | 122 partidos | gameId | Local, visitante, semana |
| plays.csv | 8,557 jugadas | gameId + playId | Situación, formación y resultado |
| players.csv | 1,679 jugadores | nflId | Nombre del pasador |
| pffScoutingData.csv | 188,254 registros | gameId + playId + nflId | Identificar al pasador (`pff_role = "Pass"`) |
| tracking_[gameId].csv | 8,314,178 filas, 122 archivos | + frameId | Distancia QB-defensor al snap y replays |

La muestra cubre la temporada 2021, semanas 1 a 8, con 32 equipos. Todas las jugadas son de pase (*dropbacks*: C, I, IN, S, R). Las carreras de diseño, los despejes y los goles de campo no aparecen en el dataset.

- **Datos tabulares:** sostienen la cohorte, el pronóstico, las frecuencias y las formaciones.
- **Tracking:** sirve para la variable espacial al snap y para dibujar los replays.

**Cohorte de análisis**

| Paso | Jugadas |
|---|---|
| Jugadas en plays.csv | 8,557 |
| Fuera de tercer down | −6,163 |
| Con falta registrada, `penaltyYards`, «no play» o «penalty» en la descripción | −271 |
| Distancia no positiva o campo/resultado inválido | 0 |
| **Cohorte final** | **2,123 terceras de pase en 122 partidos** |

El criterio de faltas es conservador y también excluye faltas declinadas. Composición de la cohorte:

- **Resultado del pase:** 1,051 completos, 690 incompletos, 205 sacks, 115 scrambles y 62 intercepciones.
- **Formación:** 1,627 SHOTGUN, 405 EMPTY y 91 en otras formaciones.

## Metodología

**Resultado.** Hay éxito si `playResult ≥ yardsToGo` y el pase no fue interceptado. La app lo rotula «alcanzó la distancia». Es una aproximación por yardas y no el primer down oficial (ver Limitaciones). Sacks y scrambles se conservan en la muestra.

**Variables previas al snap.** El modelo usa down (solo terceros), yardas por ganar y yardas a la zona de anotación. Con ellas se definen las bandas de distancia (1–3, 4–6, 7+) y las zonas del campo:

| Zona | Yardas a la zona de anotación |
|---|---|
| Propio campo | 50 o más |
| Campo rival | 21 a 49 |
| Zona roja | 20 o menos |

No se usan como predictores la presión o la cobertura de PFF, el receptor elegido, el lanzamiento ni el desenlace.

**Partición.** Los 122 `gameId` se permutan con NumPy y semilla 2021. Hay 61 partidos de *desarrollo* (1,026 jugadas) y 61 de *confirmación* (1,097). Las listas exactas están en `GET api/resumen`. Los modelos se ajustan solo en desarrollo.

> **Advertencia.** Las tasas brutas por formación se exploraron en ambas mitades antes de fijar los contrastes. La confirmación es una partición por partidos reservada para medir, pero **no es una validación prospectiva independiente**. Los contrastes ajustados necesitarían datos nuevos para confirmarse en sentido estricto.

**Pronóstico.** Es una regresión logística sobre `log(1 + yardas)` más indicadores de campo rival y zona roja. Tiene penalización L2 = 1 en los coeficientes, el intercepto sin penalizar y se ajusta por Newton-Raphson con NumPy. El IC 95% del pronóstico sale de 500 reajustes con remuestreo de partidos de desarrollo.

Solo se emite pronóstico si la celda banda × zona tiene al menos 20 jugadas, de 5 partidos o más, y contiene la distancia exacta consultada. Si no, la respuesta es `sin_soporte`.

**Modelos comparados.** Se comparan cuatro modelos sobre las mismas jugadas de confirmación: constante, distancia, distancia + zona y distancia + zona + `defendersInBox`.

**Métricas e intervalos.** La métrica es el Brier = promedio de (p − y)²; menor es mejor. Los IC 95% son percentiles de 3,000 remuestreos de partidos completos dentro de cada mitad. Las comparaciones son pareadas: usan los mismos partidos remuestreados para ambas alternativas. Los IC de Brier son condicionales a las predicciones ya ajustadas. También se revisa la calibración en cuatro rangos de probabilidad.

**Formaciones.** El contraste EMPTY − SHOTGUN se calcula dentro de estratos equipo × banda × zona que tengan al menos 2 jugadas por formación. Cada estrato pesa n_EMPTY·n_SHOTGUN/(n_EMPTY + n_SHOTGUN). Como sensibilidad, se repite con la distancia exacta en lugar de la banda.

**Distancia QB-defensor.** En el cuadro `ball_snap` se mide la distancia euclídea mínima, en yardas, del pasador a cualquiera de los 11 defensores. El snap es válido si cumple todo esto:

- Un único `ball_snap` en la jugada.
- 22 jugadores con identidad única, 11 de ellos defensores.
- El pasador identificado por PFF.
- Coordenadas y dirección válidas.

Hubo 2,120 snaps válidos de 2,123. Se compara la logística por distancia contra la misma logística más esa separación. En desarrollo se usan predicciones fuera de pliegue (5 pliegues por partido) y en confirmación el ajuste de desarrollo.

## Resultados principales

Las cifras salen de la mitad de **confirmación** salvo que se indique otra cosa. Se leen en `GET api/resumen`.

**1. La distancia pendiente separa la dificultad.** Es el hallazgo confirmado.

| Distancia | Desarrollo | Confirmación |
|---|---|---|
| 1–3 yd | 119/206 · 57.8% [50.3, 64.7] | 116/213 (59 partidos) · 54.5% [47.4, 61.7] |
| 4–6 yd | 120/283 · 42.4% [36.8, 48.1] | 141/325 (60) · 43.4% [37.5, 49.2] |
| 7+ yd | 154/537 · 28.7% [24.7, 32.8] | 161/559 (61) · 28.8% [25.4, 32.2] |
| **Corta − larga** | **+29.1 pp [21.2, 36.7]** | **+25.7 pp [17.6, 33.8]** |

**2. Brier de los modelos** (1,097 jugadas, 61 partidos)

| Modelo | Brier [IC 95%] |
|---|---|
| Constante | 0.2359 [0.2298, 0.2417] |
| Distancia | **0.2210** [0.2126, 0.2293] |
| Distancia + zona (el que sirve la app) | 0.2222 [0.2138, 0.2303] |
| Distancia + zona + defensores en la caja | 0.2224 [0.2141, 0.2307] |

- La distancia mejora a la constante en 0.0149 [0.0074, 0.0228].
- Los defensores en la caja no aportan: −0.0002 [−0.0009, +0.0004].
- La zona tampoco mejora el Brier. Se mantiene como control situacional para que la referencia distinga campo propio y zona roja.

**3. EMPTY vs. SHOTGUN: diferencia sin confirmar.**

| Contraste ajustado (EMPTY − SHOTGUN) | Desarrollo | Confirmación |
|---|---|---|
| Por banda | +2.2 pp [−6.8, +15.1] · 91 vs. 216 jugadas | +11.7 pp [−0.7, +23.1] · 119 vs. 253 |
| Por distancia exacta | +4.8 pp [−63.7, +59.1] · 17 jugadas | +29.7 pp [−17.9, +70.3] · 28 jugadas |

Todos los intervalos incluyen el cero. Por eso la API devuelve `recomendacion: null`: es un resultado correcto, no un dato faltante. Personal, quarterback, rival y marcador pueden influir en qué formación se elige.

**4. La distancia QB-defensor al snap no mejora el pronóstico.**

| Mitad | Mejora de Brier (base − ampliado) |
|---|---|
| Desarrollo (1,026 jugadas, fuera de pliegue) | −0.000053 [−0.000389, +0.000277] |
| Confirmación (1,094 jugadas) | +0.000067 [−0.000283, +0.000419] |

La señal no repite su dirección entre mitades y su efecto es despreciable. Una explicación posible es que la separación inicial refleje sobre todo la profundidad del QB (shotgun o bajo el centro) y no la presión que llega después.

**5. Ejemplo `2021090900/97`** (mitad de confirmación). TB vs. DAL, 1.er cuarto, 13:33, 0-0. Tom Brady, 3.ª y 2 en su propia 33, en SHOTGUN.

| Concepto | Valor | Qué significa |
|---|---|---|
| Probabilidad modelada | **57.6%** [49.6, 64.9] | Estimación del modelo para exactamente 3.ª y 2 en campo propio |
| Frecuencia observada | **58/113 = 51.3%** (52 partidos) [41.2, 60.8] | Todas las terceras de 1–3 yd en campo propio, mitad de desarrollo |
| Opciones en esa celda | EMPTY 10/22 · SHOTGUN 39/78 | Frecuencias por formación (desarrollo) |
| Contraste global | +11.7 pp [−0.7, +23.1] | Promedio de liga en 41 estratos; no describe esta jugada |
| Resultado individual | Incompleto, 0 yd | «T.Brady pass incomplete deep right to C.Godwin.» |

Un resultado individual no confirma ni refuta una probabilidad de 57.6%.

## Características de la aplicación

**Verificado en el backend:**
- **Simulador de situación:** `POST api/sugerencia` con down, yardas y yardas a la zona de anotación. Devuelve pronóstico, frecuencia histórica, opciones por formación y contraste.
- **Evidencia:** cada respuesta incluye n, partidos, éxitos, IC y un `evidencia_id` de la celda usada.
- **Replays:** cinco jugadas reservadas, una por tipo de resultado (C, I, IN, S, R), con 33 a 71 cuadros cada una. Llevan coordenadas normalizadas para que la ofensiva ataque hacia la derecha.
- **Revelación del resultado:** sin `?revelar=true`, `desenlace` y `secuencia_observada` llegan en `null`. El pronóstico es idéntico antes y después de revelar.
- **Sin soporte:** la API distingue entre `sin_soporte` (HTTP 200 con un `motivo` legible) y un dato inválido (422). Una jugada fuera del catálogo da 404 y un modelo ausente da 503. Ejemplo: la 3.ª y 32 del replay `2021090900/2330` cae fuera de soporte.

**Dashboard React:** en desarrollo en la rama `evento/frontend`. Esta sección se completará cuando esté integrado y comprobado.

## Cómo ejecutar el proyecto

El stack es fijo: Python 3.12.12, FastAPI 0.115.14, pandas 2.2.3, NumPy 2.1.3, Node 22.23.1, React 18.3.1, Vite 5.4.21, Tailwind 3.4.19 y Recharts 3.10.1. No hay dependencias adicionales.

El backend sirve un modelo precalculado (`backend/modelo.json`): no necesita CSV, red ni credenciales.

**Linux / macOS** (comprobado en Arch Linux):
```bash
sh .hackathon/setup.sh                                   # instala todo dentro del proyecto
sh .hackathon/setup.sh --check                           # verifica el stack
.venv/bin/python -m unittest discover -s tests -v        # 8 pruebas
.venv/bin/python -m uvicorn backend.main:app --port 8000 # API; documentación en http://localhost:8000/docs

export PATH="$PWD/.hackathon/.tools/node/bin:$PATH"      # Node portátil del instalador
cd dashboard && npm run dev                              # http://localhost:5173
```

**Windows (PowerShell).** Son las rutas equivalentes que define el instalador; no se comprobaron en esta laptop.
```powershell
.\.hackathon\setup.cmd
.\.hackathon\setup.cmd --check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --port 8000
$env:PATH = "$PWD\.hackathon\.tools\node;$env:PATH"; cd dashboard; npm run dev
```

Abrir `http://localhost:...`, no `127.0.0.1`. En desarrollo, Vite debe redirigir `/api` al puerto 8000 (configuración en `dashboard/vite.config.ts`). El dashboard llama siempre con rutas relativas (`fetch('api/resumen')`) para funcionar bajo la subruta del hosting.

**API**

| Ruta | Respuesta |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `GET api/resumen` | Auditoría, exclusiones, mitades, contrastes, Brier, calibración, tracking y catálogo de replays |
| `POST api/sugerencia` | `{"down":3,"yardas":2,"yardas_a_goal":67}` (opcional `"equipo":"TB"`) |
| `GET api/jugadas/{gameId}/{playId}` | Situación, snap y pronóstico; `?revelar=true` añade desenlace y cuadros |

El contrato detallado está en `docs/BACKEND_OFICIAL.md` y en `ejemplo_para_pablo.json`.

**Regenerar el modelo desde los datos originales.** Hacerlo en una copia de análisis: `--entregar` incluye todo `data/` en el ZIP, y el tracking pesa unos 850 MB.
```bash
# Colocar games.csv, plays.csv, players.csv y pffScoutingData.csv en data/
.venv/bin/python tools/extraer_tracking.py                 # descarga y verifica los 122 archivos de tracking en data/tracking/
OPENBLAS_NUM_THREADS=1 .venv/bin/python -m backend.build --data data --out /tmp/modelo.json
```
Sin `--out`, el generador reemplaza `backend/modelo.json`. Las huellas SHA-256 de los CSV tabulares quedan registradas en `api/resumen → auditoria`.

**Comprobado:** con los cuatro CSV tabulares regenerados, el resumen, los coeficientes, las celdas y las jugadas son idénticos al artefacto distribuido. Los replays y snaps recalculados con el tracking oficial de los dos partidos usados en los ejemplos también coinciden.

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `backend/main.py` | API FastAPI y validación de entradas (Pydantic) |
| `backend/decision.py` | Pronóstico, reglas de soporte y respuesta al coach |
| `backend/build.py` | Auditoría, cohorte, partición, modelos, bootstrap y artefacto |
| `backend/tracking.py`, `tracking_audit.py` | Distancia al snap, inventario de eventos y replays |
| `backend/modelo.json` | Modelo precalculado que sirve la API |
| `tests/` | Pruebas de conteos, contrato, soporte, errores y replay |
| `tools/` | Descargador de tracking y manifiesto con tamaños y hashes |
| `docs/` | Notas técnicas del backend y del tracking |
| `dashboard/` | Aplicación React (rama `evento/frontend`) |
| `data/` | Datos locales; no se versionan |
| `.hackathon/` | Instalador y empaquetado oficiales del evento |

## Limitaciones

- **Datos observacionales, sin inferencia causal.** Las diferencias describen asociaciones históricas. Una formación puede coincidir con mejores receptores, rivales más débiles o un marcador favorable.
- **Incertidumbre.** El contraste EMPTY − SHOTGUN y la variable QB-defensor tienen intervalos que incluyen el cero. Solo el efecto de la distancia pendiente se sostiene en ambas mitades.
- **Validación limitada.** La confirmación se separó por partidos, pero sus tasas brutas por formación se exploraron antes de fijar los contrastes (ver Metodología).
- **Alcanzar la distancia no es el primer down oficial.** El indicador no distingue fumbles posteriores ni primeros downs por castigo; la cohorte tiene 6 éxitos con fumble en la descripción.
- **Muestra.** Son 8 semanas de una sola temporada y solo jugadas de pase, así que no compara carrera, despeje o gol de campo.
  - El filtro por equipo casi nunca tiene soporte (1 de 243 celdas).
  - Las celdas de 7+ yardas tienen huecos de distancia, que se responden como `sin_soporte`.
- **Replays ilustrativos.** Los cinco casos se eligieron por tipo de desenlace y provienen de solo dos partidos (`2021090900` y `2021091200`). Ilustran el método; no representan a la liga.
- **Generalización.** No se evaluó en otras temporadas ni en tiempo real. El modo de uso es «escenario manual» o «replay histórico», no una alimentación en vivo.

## Créditos y reproducibilidad

- **Datos:** NFL Big Data Bowl, evento regional (NFL Next Gen Stats y Pro Football Focus), según su repositorio público.
- **Plantilla y empaquetado:** la organización del evento proporcionó `.hackathon/`, la estructura del proyecto y las reglas del stack.
- **Equipo:** Leo, análisis, API e integración. Pablo, dashboard.
- **Tecnologías:** Python, FastAPI, Pydantic, pandas, NumPy, React, Vite, TypeScript, Tailwind CSS y Recharts.
- **Reproducibilidad:**
  - Las semillas son fijas: 2021 para la partición, 2022 y 2023 para los remuestreos.
  - Los hashes de las entradas se registran en el artefacto.
  - El manifiesto `tools/manifest.json` fija los 122 archivos de tracking.
  - Las pruebas automáticas comprueban conteos y contrato.
