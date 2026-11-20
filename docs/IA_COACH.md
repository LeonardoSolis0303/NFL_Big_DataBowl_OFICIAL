# Al Huddle AI Coach · contrato para el dashboard

El asistente explica en español la evidencia que ya calculó el backend. **No calcula probabilidades.** El servidor obtiene la evaluación con la misma función que `POST api/sugerencia` y le envía a Amazon Bedrock solo un resumen compacto, de unos 1,400 caracteres. Ese resumen contiene la situación, el pronóstico, la frecuencia, las opciones por formación, el contraste global y la lectura del tracking. Nunca incluye desenlaces ni cuadros, así que la IA no puede revelar un resultado oculto.

- Llamada: Bedrock Converse con `boto3`, temperatura 0.2, máximo 400 tokens y timeout de lectura de 20 s.
- Modelo: `BEDROCK_MODEL_ID`; si no está definido, `us.amazon.nova-pro-v1:0`. Región: `AWS_REGION`; si no está definida, `us-east-1`.
- Cada pregunta es independiente: el servidor no guarda historial.
- Si Bedrock falla, los endpoints estadísticos siguen funcionando.

## Petición

`POST api/coach-ia` (ruta relativa, sin diagonal inicial)

```json
{
  "situacion": { "down": 3, "yardas": 2, "yardas_a_goal": 67 },
  "pregunta": "¿Qué significa este 57.6%?"
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `situacion` | objeto | Mismo esquema que `api/sugerencia`: `down` 1–4, `yardas` 1–100, `yardas_a_goal` 1–99, `equipo` opcional |
| `pregunta` | string | 3 a 500 caracteres |

Cualquier campo extra, por ejemplo cifras enviadas por el cliente, se rechaza con 422.

## Respuesta correcta (HTTP 200)

```json
{
  "estado": "ok",
  "respuesta": "El modelo estima 57.6% (IC 95% 49.6%–64.9%)...",
  "proveedor": "amazon-bedrock",
  "modelo": "us.amazon.nova-pro-v1:0",
  "fuente": "backend-estadistico",
  "estado_evidencia": "referencia",
  "evidencia_id": "*|1–3|propio",
  "evidencia": { "situacion": "...", "pronostico_modelo": "...", "frecuencia_observada": "...", "...": "..." },
  "cifras_no_respaldadas": [],
  "latencia_ms": 1830
}
```

- `estado_evidencia`: `"referencia"` o `"sin_soporte"`. En `sin_soporte` la IA explica por qué se abstiene.
- `evidencia`: el texto exacto que recibió el modelo. Sirve para un enlace «Ver datos usados».
- `cifras_no_respaldadas`: números de la respuesta que no aparecen en la evidencia. Si la lista no está vacía, conviene mostrar un aviso discreto («Verifica las cifras con el panel de evidencia»).

## Errores

| HTTP | `estado` | Qué mostrar |
|---|---|---|
| 422 | (FastAPI `detail[]`) | Pregunta vacía o demasiado larga, o situación inválida |
| 503 | `ia_no_disponible` | `motivo` y el `codigo` (`sin_credenciales`, `AccessDeniedException`, `ExpiredTokenException`, `ReadTimeoutError`...). Las estadísticas de la pantalla siguen siendo válidas |
| 502 | `ia_no_disponible` | Respuesta vacía del modelo |
| Red | — | «No se pudo contactar al servidor» |

Las respuestas 503 y 502 también traen `evidencia`, así que el panel puede mostrar los datos aunque la IA falle.

## Experiencia sugerida

- Botón «Pregúntale al Coach IA» junto a la evaluación actual. Al abrirlo, el panel envía la `situacion` que está en pantalla.
- Preguntas sugeridas:
  - «¿Qué significa este 57.6%?» (con el porcentaje de la evaluación en pantalla)
  - «¿Por qué no recomiendas una formación?»
  - «¿Qué tan confiable es este pronóstico?»
  - «¿Qué aprendimos del tracking?»
- Indicador «Generando respuesta…» mientras la petición está en curso. Desactivar el envío durante ese tiempo; Bedrock tarda unos segundos.
- Conversación breve: mostrar las últimas preguntas y respuestas en el cliente. Cada petición es independiente.
- Atribución visible bajo cada respuesta: «Generado con Amazon Bedrock · `modelo` · basado en el análisis de Al Huddle».
- Si `estado` es `ia_no_disponible`, el panel muestra el motivo y el resto de la app sigue funcionando.

## Prueba real

Con credenciales temporales cargadas en la terminal o en `.env` (este archivo no se versiona ni entra al ZIP):

```bash
.venv/bin/python tools/probar_bedrock.py
```

El script verifica la identidad AWS, lista los perfiles Nova visibles y hace una llamada real con el caso 3.ª y 2 en la propia 33. Revisa que la respuesta cite 57.6%, 49.6–64.9%, 58 de 113 y 52 partidos sin recomendar una formación. Termina con código 0 solo si todo pasa.
