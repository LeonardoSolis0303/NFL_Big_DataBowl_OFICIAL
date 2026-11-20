// Cliente de la API. Rutas SIEMPRE relativas y sin diagonal inicial: la app se publica en una subruta.
import type { Evaluacion, Jugada, Resumen, SolicitudSugerencia } from './contrato'

export type TipoError = 'red' | 'entrada' | 'no_encontrado' | 'servicio'

export class ErrorApi extends Error {
  constructor(public tipo: TipoError, public ruta: string, public detalle: string) {
    super(detalle)
  }
}

let usarEjemplo = new URLSearchParams(window.location.search).get('ejemplo') === '1'
export const modoEjemplo = () => usarEjemplo
export const activarEjemplo = (v: boolean) => { usarEjemplo = v }

function detalleFastApi(cuerpo: unknown): string | null {
  const d = (cuerpo as { detail?: unknown })?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((e) => `${(e.loc ?? []).slice(1).join('.') || 'petición'}: ${e.msg}`).join(' · ')
  return null
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let r: Response
  try {
    r = await fetch(ruta, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new ErrorApi('red', ruta, 'Sin conexión con el servidor de análisis.')
  }
  let cuerpo: unknown = null
  try { cuerpo = await r.json() } catch { /* sin JSON */ }
  if (!r.ok) {
    const det = detalleFastApi(cuerpo) ?? `HTTP ${r.status}`
    const tipo: TipoError = r.status === 422 ? 'entrada' : r.status === 404 ? 'no_encontrado' : 'servicio'
    throw new ErrorApi(tipo, ruta, `${det} (HTTP ${r.status})`)
  }
  if (cuerpo == null) throw new ErrorApi('servicio', ruta, 'La respuesta no es JSON válido.')
  return cuerpo as T
}

// ---------- Datos de ejemplo: ejemplo_para_pablo.json de Leo (una jugada, sin desenlace ni secuencia) ----------
async function ejemplo(): Promise<Jugada> {
  const m = await import('../mock/ejemplo_para_pablo.json')
  return structuredClone(m.default) as unknown as Jugada
}
const espera = (ms = 200) => new Promise((ok) => setTimeout(ok, ms))

export async function obtenerResumen(): Promise<Resumen> {
  if (usarEjemplo) {
    await espera()
    throw new ErrorApi('servicio', 'api/resumen', 'El resumen no está incluido en los datos de ejemplo.')
  }
  return pedir<Resumen>('api/resumen')
}

export async function pedirSugerencia(s: SolicitudSugerencia): Promise<Evaluacion> {
  // Solo los campos del contrato: el backend rechaza campos extra con 422.
  const cuerpo: SolicitudSugerencia = { down: s.down, yardas: s.yardas, yardas_a_goal: s.yardas_a_goal }
  if (s.equipo) cuerpo.equipo = s.equipo
  if (usarEjemplo) {
    await espera()
    const j = await ejemplo()
    const k = j.situacion
    if (cuerpo.equipo || k.down !== cuerpo.down || k.yardas !== cuerpo.yardas || k.yardas_a_goal !== cuerpo.yardas_a_goal)
      throw new ErrorApi('servicio', 'api/sugerencia', 'Los datos de ejemplo solo cubren 3.ª y 2 en propia 33, sin filtro de equipo.')
    return j.evaluacion
  }
  return pedir<Evaluacion>('api/sugerencia', { method: 'POST', body: JSON.stringify(cuerpo) })
}

export async function obtenerJugada(gameId: number, playId: number, revelar = false): Promise<Jugada> {
  if (usarEjemplo) {
    await espera()
    const j = await ejemplo()
    if (j.gameId !== gameId || j.playId !== playId) throw new ErrorApi('no_encontrado', 'api/jugadas', 'Jugada fuera de los datos de ejemplo.')
    return j // el ejemplo no trae desenlace ni secuencia, aunque se pida revelar
  }
  return pedir<Jugada>(`api/jugadas/${gameId}/${playId}${revelar ? '?revelar=true' : ''}`)
}

/** Catálogo de replays: en la API viene en resumen.ejemplos. */
export async function catalogo(resumen: Resumen | null): Promise<{ gameId: number; playId: number }[]> {
  if (usarEjemplo) {
    const j = await ejemplo()
    return [{ gameId: j.gameId, playId: j.playId }]
  }
  if (!resumen) throw new ErrorApi('servicio', 'api/resumen', 'Sin resumen no hay catálogo de replays.')
  return resumen.ejemplos.map(({ gameId, playId }) => ({ gameId, playId }))
}
