// Contrato REAL del backend de Leo (origin/evento/backend f801975, docs/BACKEND_OFICIAL.md).
// Escalas: probabilidades, tasas e IC en 0–1; la interfaz las convierte a % una sola vez.
// Diferencias en 0–1; la interfaz las muestra en puntos porcentuales (pp). `null` = dato ausente.

export type Intervalo = [number, number]

/** POST /api/sugerencia. Pydantic estricto: enteros, sin campos extra (si no, 422). */
export interface SolicitudSugerencia {
  down: number // 1–4
  yardas: number // 1–100, yardas por ganar
  yardas_a_goal: number // 1–99
  equipo?: string // abreviatura opcional (2–3 mayúsculas); filtra muestras, no el pronóstico
}

export interface Conteo {
  n: number
  partidos: number
  exitos: number
  tasa: number
  ic95: Intervalo | null // null si el grupo tiene menos de dos partidos
}

export interface OpcionFormacion extends Conteo {
  formacion: string
}

export interface ContrasteFormaciones {
  ambito: string // p. ej. «global ajustado en confirmación»: no es específico del escenario
  n: number
  estratos: number
  opciones: Record<string, { n: number; partidos: number; tasa: number; ic95: Intervalo | null }>
  diferencia: number // EMPTY − SHOTGUN (resumen.mitades.*.empty_menos_shotgun_ajustado)
  ic95: Intervalo | null
}

/** Respuesta de POST /api/sugerencia y campo `evaluacion` de la jugada. */
export interface Evaluacion {
  estado: 'referencia' | 'sin_soporte' | (string & {})
  recomendacion: string | { formacion?: string } | null // null: el contraste no justifica una llamada preferida
  motivo: string
  pronostico: { p: number; ic95: Intervalo | null; modelo: string } | null
  grupo?: Conteo
  opciones: OpcionFormacion[]
  distancia?: string // banda: «1–3», «4–6», «7+»
  zona?: string // «propio», «rival», «roja»
  equipo_filtro?: string | null
  evidencia_id?: string
  fuente_muestra?: string // «desarrollo»
  contraste_formaciones?: ContrasteFormaciones
  lectura?: string
}

export interface Situacion {
  down: number
  yardas: number
  yardas_a_goal: number
}

export interface JugadorSnap {
  nflId: number
  equipo: string
  x: number
  y: number
}

/** Cuadro del snap (sin revelar). Ya normalizado: la ofensiva avanza hacia la derecha. */
export interface CuadroSnap {
  frameId: number
  evento: string
  direccion: string
  jugadores: JugadorSnap[]
}

/** [nflId, equipo, x, y] */
export type JugadorSecuencia = [number, string, number, number]

/** Cuadro de la secuencia observada (solo con ?revelar=true). */
export interface CuadroSecuencia {
  frameId: number
  eventos: string[]
  balon: [number, number] | null
  jugadores: JugadorSecuencia[]
}

export interface Desenlace {
  yardas: number
  alcanzo_distancia: boolean
  pase: string // C completo · I incompleto · IN intercepción · S sack · R scramble
  descripcion: string
}

/** GET /api/jugadas/{gameId}/{playId}[?revelar=true] */
export interface Jugada {
  gameId: number
  playId: number
  mitad: string
  situacion: Situacion
  equipo: string // ofensiva
  defensa: string
  formacion: string | null
  mariscal: string | null
  cuarto: number
  reloj: string
  local: string
  visita: string
  puntos_local: number
  puntos_visita: number
  desenlace: Desenlace | null // null hasta revelar
  cuadros: CuadroSnap[] | null
  secuencia_observada: CuadroSecuencia[] | null // null hasta revelar
  evaluacion: Evaluacion
}

export interface ConteoDistancia extends Conteo {}

export interface Mitad {
  n: number
  partidos: number
  exitos: number
  tasa: number
  ic95: Intervalo | null
  gameIds: number[]
  por_distancia: Record<string, ConteoDistancia>
  formaciones: Record<string, Conteo & { ventaja: number; ic95_ventaja: Intervalo | null }>
  corta_menos_larga: { diferencia: number; ic95: Intervalo | null }
  empty_menos_shotgun_ajustado: Omit<ContrasteFormaciones, 'ambito'>
  sensibilidad_distancia_exacta: Omit<ContrasteFormaciones, 'ambito'>
  final_cerrado_exploratorio: Conteo & { criterio: string }
}

export interface Auditoria {
  filas: number
  columnas: number
  claves: string[]
  duplicados: number
  nulos: Record<string, number>
  sha256: string
}

/** GET /api/resumen */
export interface Resumen {
  fuente: string
  unidad: string
  objetivo: string
  auditoria: Record<string, Auditoria | Record<string, number>>
  exclusiones: Record<string, number>
  mitades: { desarrollo: Mitad; confirmacion: Mitad }
  modelos: {
    desarrollo: number
    n: number
    partidos: number
    metricas: Record<string, { brier?: number; mejora?: number; ic95: Intervalo | null }>
    calibracion: { rango: Intervalo; p_media: number; n: number; partidos: number; exitos: number; tasa: number; ic95: Intervalo | null }[]
  }
  tracking: {
    estado: string
    inventario?: Record<string, number>
    n_desarrollo?: number
    n_confirmacion?: number
    sin_snap_valido?: number
    partidos_confirmacion?: number
    desarrollo_oof?: { n: number; partidos: number; mejora: number; ic95: Intervalo | null }
    brier_distancia?: { valor: number; ic95: Intervalo | null }
    brier_posiciones?: { valor: number; ic95: Intervalo | null }
    mejora_con_posiciones?: number
    ic95_mejora?: Intervalo | null
  }
  titular: string
  alternativas: string[]
  ejemplos: { gameId: number; playId: number; mitad: string }[]
}
