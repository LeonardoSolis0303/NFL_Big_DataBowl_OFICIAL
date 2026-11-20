# Backend para el coach · NFL 2021, semanas 1–8

## Kiro de Leo · integrar y ejecutar

Trabaja en la carpeta que creó el instalador, rama evento/backend. Compara los fuentes de este paquete con los archivos actuales, integra backend/, tests/test_backend.py y esta guía conservando cambios concurrentes. La muestra ejemplo_para_pablo.json es para el relevo. El modelo precalculado backend/modelo.json forma parte del despliegue y permite arrancar sin acceso de red ni escrituras en el servidor. Los CSV son necesarios para regenerarlo. Conserva el README del equipo en la raíz y deja la revisión, commit, push y PR a Kiro. El ZIP de este backend es para integración. Genera el paquete oficial de AWS desde la aplicación completa.

Desde la raíz del proyecto instalado en Arch:

~~~bash
sh .hackathon/setup.sh --check
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m uvicorn backend.main:app --port 8000
~~~

Para repetir el análisis, coloca games.csv, players.csv, plays.csv (también admite plays(1).csv) y pffScoutingData.csv en data/ y ejecuta:

~~~bash
OPENBLAS_NUM_THREADS=1 .venv/bin/python -m backend.build --data data
~~~

El generador verifica claves y relaciones, guarda huellas SHA-256 de los CSV y reemplaza el JSON completo al finalizar. Reinicia Uvicorn después de regenerarlo. El proceso de servicio carga el archivo una vez. Para Pablo en PowerShell el intérprete equivalente es .\.venv\Scripts\python.exe. En la integración con Vite, usa proxy de desarrollo de /api al puerto 8000, base './' y rutas de petición relativas.

## Contrato para Pablo

| Petición | Uso |
|---|---|
| GET /health | Respuesta de la plantilla {"status":"ok"}. |
| GET /api/resumen | Campo titular, auditoría con nulos y huellas, exclusiones, mitades, contrastes, Brier, calibración, alternativas explicativas, disponibilidad de tracking y catálogo de ejemplos. |
| POST /api/sugerencia | JSON con down, yardas, yardas_a_goal y opcionalmente equipo (abreviatura). Pronóstico previo por distancia y zona, grupos históricos de desarrollo, contraste global de formaciones en confirmación. El filtro de equipo cambia las muestras mostradas; el pronóstico sigue siendo de liga. |
| GET /api/jugadas/{gameId}/{playId} | Un replay del catálogo en resumen.ejemplos. Desenlace oculto por defecto. Añadir ?revelar=true para mostrarlo. Se ofrece el primer ejemplo por tipo de resultado en partidos reservados y el caso de Brady. Este catálogo está seleccionado por desenlace y sirve para ilustrar. |

**Petición de ejemplo**: {"down":3,"yardas":2,"yardas_a_goal":67}. En la jugada 2021090900/97, TB se encuentra en su propia yarda 33. Para ese contexto el modelo devuelve p=0.5763, con IC de la probabilidad media [0.4957, 0.6489]. El grupo de referencia agrupa distancias 1–3 en campo propio, 58 éxitos de 113 jugadas en 52 partidos, IC 95% [41.2%, 60.8%]. Mostrar por separado ambos números. La frecuencia histórica por formación está en opciones. La diferencia ajustada global está identificada por ámbito; no la atribuyas al escenario individual. En porcentajes multiplica por 100 una sola vez.

**Estados:** referencia indica que se puede estimar el contexto. recomendacion=null indica que el contraste disponible no justifica una llamada preferida. sin_soporte indica al usuario el motivo, por ejemplo un down fuera del alcance o solo unos pocos partidos en el grupo. Parámetros inválidos y predictores ajenos al contrato reciben 422. Una jugada fuera del catálogo recibe 404; si falta el modelo, los endpoints de datos devuelven 503. Con cuadros=null se puede mostrar la situación y el resultado verificado; el dibujo de trayectorias exige posiciones reales.

## Qué encontró el análisis

La unidad es una jugada de pase llamada, incluidos incompletos, sacks, scrambles e intercepciones. Los datos contienen 122 partidos, 8,557 jugadas, 1,679 jugadores y 188,254 registros PFF. Cada jugada enlaza exactamente 22 jugadores PFF y un pasador identificado. La clave es (gameId, playId). La unión de pasador y datos del partido mantiene una fila por jugada.

De las 2,394 terceras oportunidades, excluimos 271 por indicadores de castigo o anulación. Se revisan las tres columnas de faltas, penaltyYards y la descripción. Es un criterio conservador que también puede excluir faltas declinadas. Exigimos distancia positiva, resultado de pase reconocido, campo identificable y distancia alcanzable. Quedaron 2,123 jugadas. El criterio más amplio de faltas difiere del recuento preliminar basado solo en foulName1. Definición operativa de éxito: playResult >= yardsToGo sin intercepción. Un fumble posterior a alcanzar la distancia podría distinguir este indicador del primer down oficial; tampoco contamos primeros downs administrativos. La muestra está condicionada a jugadas de pase.

| Distancia | Desarrollo · éxitos/n (partidos) · IC 95% | Confirmación · éxitos/n (partidos) · IC 95% |
|---|---|---|
| 1–3 | 119/206 (59) · 57.8% [50.3, 64.7] | 116/213 (59) · 54.5% [47.4, 61.7] |
| 4–6 | 120/283 (61) · 42.4% [36.8, 48.1] | 141/325 (60) · 43.4% [37.5, 49.2] |
| 7+ | 154/537 (61) · 28.7% [24.7, 32.8] | 161/559 (61) · 28.8% [25.4, 32.2] |

La diferencia corta menos larga fue +29.1 puntos en desarrollo [21.2, 36.7] y +25.7 en confirmación [17.6, 33.8]. Las rutas elegidas y la respuesta defensiva también pueden variar con la distancia.

El contraste EMPTY menos SHOTGUN dentro del mismo equipo, banda de distancia y zona fue +2.2 puntos [-6.8, 15.1] en desarrollo (91 EMPTY, 216 SHOTGUN) y +11.7 [-0.7, 23.1] en confirmación (119 EMPTY, 253 SHOTGUN). La comparación por distancia exacta retiene solo 28 jugadas en confirmación y da +29.7 puntos [-17.9, 70.3]. El personal, el rival y el marcador pueden influir en la selección de formación. Los intervalos admiten cero. En la aplicación se conserva la comparación histórica y se deja la elección al coach.

Un subconjunto exploratorio de presión situacional (cuarto periodo, últimos cinco minutos, diferencia de marcador de hasta ocho puntos) contiene 26/58 éxitos en 26 partidos en desarrollo, 44.8% [31.8, 60.3], y 23/50 en 22 partidos en confirmación, 46.0% [34.4, 57.8]. No se entrenó un modelo especial para finales cerrados. La presión física sobre el mariscal es otra variable.

## Cómo reproducir e interpretar los modelos

- Ordenar los 122 gameId, permutarlos con NumPy y semilla 2021, destinar los primeros 61 a desarrollo y los restantes a confirmación. Las listas exactas figuran en la API. Se conservaron las mitades del diagnóstico anterior: ya se habían visto tasas brutas por formación en ambas. Los contrastes ajustados y de final cerrado necesitan una nueva muestra para validación prospectiva.
- Usar log(1+yardas) en una regresión logística, con intercepto sin penalizar y penalización L2 de 1 sobre los coeficientes (log-verosimilitud sumada). Para controlar zona en la expectativa, añadir indicadores de lado rival y zona roja. Campo propio incluye la mitad del campo, zona roja incluye las últimas 20 yardas. La ventaja individual es éxito menos probabilidad base calculada con down fijo, distancia y zona; en desarrollo se obtienen predicciones fuera de pliegue (cinco pliegues por partido), en confirmación se usa el ajuste completo de desarrollo. La API devuelve los promedios por formación con IC.
- Para la comparación ajustada, retener estratos equipo × banda × zona con al menos dos observaciones por formación. Ponderar la diferencia de tasas por n_EMPTY × n_SHOTGUN / (n_EMPTY + n_SHOTGUN). Repetir con yardas exactas. Los pesos disminuyen cuando una formación está poco representada. Los estratos comparables pueden cambiar entre mitades; la estimación describe su propia población de solapamiento.
- IC percentiles al 95% con 3,000 remuestreos de partidos dentro de cada mitad. Las comparaciones usan los mismos partidos remuestreados para ambas alternativas y vuelven a calcular pesos. La elegibilidad inicial de cada estrato queda fija; una celda sin una de las alternativas en un remuestreo aporta peso cero. Los IC de rendimiento y de ventaja son condicionales a las predicciones ajustadas. En la pantalla de pronóstico se reajusta el modelo en 500 remuestreos de partidos de desarrollo para estimar incertidumbre de la media. Las tasas por grupo con menos de dos partidos llevan IC nulo. Solo se emite pronóstico si la banda y zona del filtro tienen 20 jugadas de 5 partidos y contienen la distancia exacta consultada.
- Brier medio por jugada = promedio de (p−y)². Sobre las mismas 1,097 jugadas de 61 partidos, la constante dio 0.23585 [0.22977, 0.24172], distancia 0.22095 [0.21256, 0.22930], distancia y zona 0.22217 [0.21383, 0.23028]. La mejora pareada de distancia sobre la constante fue 0.01490 [0.00742, 0.02277]. La zona se conserva como control situacional en la referencia. Añadir defendersInBox a distancia y zona dio 0.22241 [0.21409, 0.23068]; la mejora de −0.00024 [−0.00094, 0.00043] no aporta evidencia de una mejora predictiva. El conteo en la caja no contiene la geometría del campo. Las etiquetas posteriores de PFF, el desenlace y la identidad del receptor elegido quedan fuera de los predictores.
- Al regenerar únicamente con los cuatro CSV tabulares, el estado del tracking es pendiente. El artefacto distribuido sí incorpora el tracking oficial. Para calcular geometría real, poner tracking_<gameId>.csv en data/tracking/ y regenerar. Se busca un frame ball_snap único por jugada y se recuperan todos sus jugadores, incluido el pasador verificado con PFF. Exigir 22 identidades únicas, 11 defensores, QB, dirección y coordenadas válidas. En juegos cubiertos estimar distancia euclídea al defensor más cercano y comparar distancia pendiente sola frente a distancia pendiente más esa separación, con idéntica cohorte por modelo y diferencia de Brier pareada. Informar cobertura y archivos ausentes. La evaluación empírica y la cobertura con los 122 CSV oficiales se detallan en TRACKING.md. La instantánea de replay normaliza jugadas hacia la derecha; solo dibuja jugadores observados.
- La declaración de trabajo del equipo y el README de entrega corresponden a los participantes. La comprobación de este paquete incluye pruebas de regresión, rutas HTTP reales y regeneración idéntica del JSON en el entorno de análisis. El verificador oficial del stack se ejecuta en la carpeta instalada de la laptop del evento.
