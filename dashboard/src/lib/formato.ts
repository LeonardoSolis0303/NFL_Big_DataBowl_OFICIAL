import type { Intervalo, Situacion } from '../api/contrato'

/** 0–1 → «58 %». Multiplica por 100 una sola vez. */
export const pct = (v: number | null | undefined, dec = 0) => (v == null ? '—' : `${(v * 100).toFixed(dec)} %`)

/** 0–1 → «+11.7 pp». */
export const pp = (v: number | null | undefined, dec = 1) =>
  v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v * 100).toFixed(dec)} pp`

export const icPct = (ic: Intervalo | null | undefined, dec = 0) =>
  ic ? `IC 95 % ${pct(ic[0], dec)} a ${pct(ic[1], dec)}` : 'IC no disponible'
export const icPp = (ic: Intervalo | null | undefined, dec = 1) => (ic ? `IC 95 % ${pp(ic[0], dec)} a ${pp(ic[1], dec)}` : 'IC no disponible')

export const miles = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-MX'))

export const ordinalDown = (d: number) => `${d}.ª`
export function ordinalCuarto(c: number) {
  if (c >= 5) return 'Tiempo extra'
  return `${c}.${c === 1 || c === 3 ? 'er' : 'º'} cuarto`
}

/** yardas a la zona de anotación → «Propia 33» · «Medio campo» · «Rival 25». */
export function campo(yardasAGoal: number) {
  if (yardasAGoal === 50) return 'Medio campo'
  return yardasAGoal > 50 ? `Propia ${100 - yardasAGoal}` : `Rival ${yardasAGoal}`
}

export const distanciaTexto = (s: Situacion) => (s.yardas >= s.yardas_a_goal ? 'gol' : String(s.yardas))
export const downYDistancia = (s: Situacion) => `${ordinalDown(s.down)} y ${distanciaTexto(s)}`

const ZONAS: Record<string, string> = { propio: 'campo propio', rival: 'campo rival', roja: 'zona roja' }
export const zonaTexto = (z: string | undefined) => (z ? ZONAS[z] ?? z : '—')

export const PASE: Record<string, string> = { C: 'Completo', I: 'Incompleto', IN: 'Interceptado', S: 'Sack', R: 'Scramble' }
