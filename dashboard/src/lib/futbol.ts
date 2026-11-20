// Geometría del campo y reglas de agrupación. Copian las reglas de backend/decision.py para rotular,
// nunca para calcular cifras: los números siempre vienen de la API.
import type { CuadroSecuencia, CuadroSnap, Situacion } from '../api/contrato'

export const LARGO = 120 // yd, incluye ambas zonas de anotación
export const ANCHO = 160 / 3 // 53.33 yd
export const HASH_Y = [ANCHO / 2 - 3.083, ANCHO / 2 + 3.083] // marcas NFL: 18 ft 6 in entre hashes

/** La ofensiva ataca hacia la derecha: la goal line rival está en x = 110. */
export const xGolpeo = (s: Situacion) => 110 - s.yardas_a_goal
/** Línea por ganar; en goal-to-go se ajusta a la goal line. */
export const xPrimerDown = (s: Situacion) => Math.min(110, xGolpeo(s) + s.yardas)

export const banda = (yardas: number) => (yardas <= 3 ? '1–3' : yardas <= 6 ? '4–6' : '7+')
export const zona = (goal: number) => (goal <= 20 ? 'roja' : goal < 50 ? 'rival' : 'propio')

/** Abreviaturas de los 32 equipos de la muestra (bundle.equipos del modelo). */
export const EQUIPOS = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LA', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS']

/** Cuadro normalizado para dibujar: solo posiciones observadas. */
export interface Fotograma {
  frameId: number
  eventos: string[]
  balon: [number, number] | null
  jugadores: { nflId: number; equipo: string; x: number; y: number }[]
}

export const desdeSnap = (c: CuadroSnap): Fotograma => ({
  frameId: c.frameId,
  eventos: c.evento ? [c.evento] : [],
  balon: null,
  jugadores: c.jugadores.map((j) => ({ ...j })),
})

export const desdeSecuencia = (c: CuadroSecuencia): Fotograma => ({
  frameId: c.frameId,
  eventos: c.eventos ?? [],
  balon: c.balon,
  jugadores: c.jugadores.map(([nflId, equipo, x, y]) => ({ nflId, equipo, x, y })),
})

const EVENTOS: Record<string, string> = {
  ball_snap: 'Snap',
  pass_forward: 'Pase',
  autoevent_passforward: 'Pase (auto)',
  pass_arrived: 'Llegada',
  qb_sack: 'Sack',
  pass_outcome_caught: 'Atrapado',
  pass_outcome_incomplete: 'Incompleto',
  pass_outcome_interception: 'Intercepción',
  run: 'Scramble',
  out_of_bounds: 'Fuera',
  tackle: 'Tacleada',
  line_set: 'Alineados',
  man_in_motion: 'Motion',
}
export const nombreEvento = (e: string) => EVENTOS[e] ?? e.replace(/_/g, ' ')
