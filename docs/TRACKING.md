# Tracking oficial · decisiones para el coach y el replay

Se descargaron los 122 CSV del commit 85da22eeff2f1d5be106faa9dfe06a1205f2defd. Se comprobaron tamaño y hash Git de cada archivo. Son 849,839,895 bytes, 8,314,178 observaciones y 8,557 jugadas; no hay duplicados en gameId, playId, frameId y nflId (el balón tiene ID nulo). Archivos y hashes están en tools/manifest.json.

## Qué dice el contraste
Sobre los terceros downs elegibles del análisis previo se localizaron 2,120 snaps válidos de 2,123. Un snap válido exige evento ball_snap único, identidad del pasador PFF, 22 jugadores, 11 defensores, coordenadas y dirección utilizables. La variable geométrica es la mínima distancia euclídea en yardas del QB a cualquiera de los 11 defensores en ese cuadro. Aplicamos los mismos filtros y partición por partido que en el backend anterior. Comparamos la regresión logística por distancia pendiente con la misma especificación más separación. Se incluyeron sacks y scrambles elegibles. La salida es alcanzar las yardas pendientes sin intercepción. Un Brier menor es mejor.

- Desarrollo: 1,026 jugadas de 61 partidos. Predicciones fuera de pliegue por partido. Mejora de Brier (base menos ampliado) −0.000053, IC 95% [−0.000389, +0.000277].
- Confirmación: 1,094 jugadas de los otros 61 partidos. Base 0.221361 [0.212893, 0.229711]; ampliado 0.221294 [0.212855, 0.229703]. Mejora +0.000067, IC 95% [−0.000283, +0.000419]. IC por 3,000 remuestreos pareados de partidos, condicionados a las predicciones. Tres jugadas de confirmación no pasaron el filtro del snap.
- La señal no repite dirección y los intervalos admiten cero. Mantener el pronóstico por situación en producción. Una explicación es que la distancia inicial al defensor también refleja la profundidad de la formación del QB; el desplazamiento posterior y los bloqueos cambian la presión efectiva. El resultado se refiere solo a esta variable, cohorte y modelo.

## Qué dibujar
Hay ball_snap explícito en 8,532 jugadas, pass_forward en 7,547 y pass_arrived en 367. Son conteos por jugada, según la etiqueta literal de evento. Los finales también se contrastan con plays.csv. La cobertura de llegada exige cuidado si se estudia separación en la recepción.

GET api/jugadas/2021090900/97 devuelve el snap normalizado y la situación. Al solicitar ?revelar=true, secuencia_observada contiene 43 cuadros medidos. Cada cuadro tiene frameId, eventos, balon=[x,y] cuando está disponible y jugadores=[[nflId,equipo,x,y],...]. La ofensiva avanza hacia la derecha. Snap en 6; pass_forward en 40. El evento automático en 38 tiene etiqueta diferente. Reproducir a 10 cuadros/s, detener en el 43 y mostrar el resultado tabular. No hay evento de llegada en esta jugada. Los cinco casos del catálogo tienen secuencias, y la API sigue separando pronóstico y revelado.

## Integración para Kiro
Usar este paquete en lugar del ZIP inicial de backend. Integrar los módulos, backend/modelo.json, las pruebas, docs y tools conservando otros cambios del equipo. El modelo distribuido incluye los resultados de los 122 partidos y cinco replays. Para servirlo no hace falta descargar los CSV crudos ni recalcular. En Arch, desde la raíz del proyecto instalado:

~~~bash
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m uvicorn backend.main:app --port 8000
~~~

Solo para reproducir desde cero, colocar games.csv, players.csv, plays.csv y pffScoutingData.csv en data/. El descargador usa curl y la biblioteca estándar de Python, verifica cada blob del manifiesto y reutiliza archivos válidos. Ejecutar desde la raíz:

~~~bash
.venv/bin/python tools/extraer_tracking.py
OPENBLAS_NUM_THREADS=1 .venv/bin/python -m backend.build --data data
~~~

En Windows, usar .\.venv\Scripts\python.exe. Para la entrega, revisar el contenido del ZIP generado por el instalador: el dataset local pesa ~850 MB. Una copia instalada destinada al despliegue puede servir el modelo precalculado y replays; conservar los originales en la copia de análisis y respetar las indicaciones de los organizadores. Confirmar --check y --entregar en la laptop integrada.
