import { useEffect, useMemo, useState } from 'react'
import { obtenerJugada } from '../api/cliente'
import type { Jugada } from '../api/contrato'
import { PASE } from '../lib/formato'
import { desdeSecuencia, desdeSnap, type Fotograma } from '../lib/futbol'
import Campo from './Campo'
import { ErrorVisible } from './Estados'
import Reproductor, { prefiereMenosMovimiento, useReproduccion } from './Reproductor'

const esPase = (e: string) => e === 'pass_forward' || e === 'autoevent_passforward'

interface Props {
  jugada: Jugada
  /** Cambia cuando el usuario pulsa «Ver la jugada» en la portada: inicia el replay. */
  arranque: number
}

export default function FilmRoom({ jugada, arranque }: Props) {
  const [revelada, setRevelada] = useState<Jugada | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [cargando, setCargando] = useState(false)
  const [mostrar, setMostrar] = useState(false)
  const [rastros, setRastros] = useState(false)
  const [auto, setAuto] = useState(false)

  const fotogramas: Fotograma[] = useMemo(() => {
    if (revelada?.secuencia_observada?.length) return revelada.secuencia_observada.map(desdeSecuencia)
    if (jugada.cuadros?.length) return [desdeSnap(jugada.cuadros[0])]
    return []
  }, [revelada, jugada])
  const r = useReproduccion(fotogramas.length)
  const enSecuencia = !!revelada?.secuencia_observada?.length
  const iSnap = fotogramas.findIndex((f) => f.eventos.includes('ball_snap'))
  // Lanzamiento: el evento manual pass_forward; el automático solo si falta el manual.
  const iManual = fotogramas.findIndex((f) => f.eventos.includes('pass_forward'))
  const iPase = iManual >= 0 ? iManual : fotogramas.findIndex((f) => f.eventos.some(esPase))

  // Va después de useReproduccion, cuyo efecto reinicia el índice cuando cambia el número de cuadros.
  useEffect(() => {
    if (!auto || !enSecuencia) return
    setAuto(false)
    if (prefiereMenosMovimiento()) r.ir(Math.max(0, iSnap))
    else { r.setI(0); r.setPlay(true) }
  }, [auto, enSecuencia]) // eslint-disable-line react-hooks/exhaustive-deps

  async function iniciar() {
    if (revelada) { r.setI(0); r.setPlay(!prefiereMenosMovimiento()); return }
    setCargando(true); setError(null)
    try {
      // La secuencia y el desenlace llegan juntos; el desenlace se guarda pero no se muestra hasta «Revelar resultado».
      const j = await obtenerJugada(jugada.gameId, jugada.playId, true)
      setRevelada(j); setAuto(true)
    } catch (e) { setError(e as Error) } finally { setCargando(false) }
  }
  useEffect(() => { if (arranque > 0) iniciar() }, [arranque]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = jugada.situacion
  const n = fotogramas.length
  const d = revelada?.desenlace ?? null

  return (
    <article className="border-b border-borde pb-6 pt-3.5">
      <p className="k">Jugada {jugada.playId} · Q{jugada.cuarto} · {jugada.reloj}</p>
      <h3 className="text-2xl font-bold">{jugada.equipo} vs. {jugada.defensa} · {s.down}.ª y {s.yardas}</h3>
      <p className="text-tiza-2">
        {jugada.mariscal ?? 'Mariscal no registrado'} · {s.yardas_a_goal} yardas al gol · {enSecuencia ? `${n} cuadros` : revelada ? 'sin secuencia observada' : 'secuencia sin cargar'}
      </p>

      <div className="my-2 flex flex-wrap gap-3">
        {!enSecuencia && (
          <button className="accion" onClick={iniciar} disabled={cargando}>{cargando ? 'Cargando secuencia…' : '▶ Iniciar replay'}</button>
        )}
        {enSecuencia && iSnap >= 0 && <button className="boton-linea" onClick={() => r.ir(iSnap)}>Snap</button>}
        {enSecuencia && iPase >= 0 && <button className="boton-linea" onClick={() => r.ir(iPase)}>Lanzamiento</button>}
      </div>
      {error && <ErrorVisible error={error} reintentar={iniciar} />}

      <figure>
        <Campo
          situacion={s}
          fotograma={fotogramas[r.i] ?? null}
          historial={enSecuencia ? fotogramas.slice(0, r.i + 1) : undefined}
          mostrarRastros={rastros}
          ofensiva={jugada.equipo}
          defensiva={jugada.defensa}
          nota={n === 0 ? 'Sin cuadros observados para esta jugada' : undefined}
        />
        <figcaption className="mt-1.5 text-[13px] text-tiza-2">
          {n > 0 ? `Cuadro ${r.i + 1} de ${n}` : 'Sin cuadros'}
          {fotogramas[r.i] && ` (frameId ${fotogramas[r.i].frameId})`} · Círculos {jugada.equipo} / cuadros {jugada.defensa} · Línea azul de scrimmage / línea punteada por ganar.
          {!enSecuencia && n > 0 && ' Cuadro del snap; la secuencia completa se carga al iniciar el replay.'}
        </figcaption>
      </figure>

      {enSecuencia && <div className="mt-3"><Reproductor fotogramas={fotogramas} r={r} frameSnap={iSnap >= 0 ? fotogramas[iSnap].frameId : null} rastros={rastros} setRastros={setRastros} /></div>}
      {revelada && !enSecuencia && <p className="mt-2 text-sm text-alerta">La API no devolvió secuencia observada para esta jugada.</p>}

      <div className="mt-4 border-b border-borde py-3" aria-live="polite">
        {!mostrar ? (
          <button className="font-semibold text-lima underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-tiza-2 disabled:no-underline" onClick={() => setMostrar(true)} disabled={!revelada}>
            ▸ Revelar resultado de la jugada{!revelada && ' (inicia el replay primero)'}
          </button>
        ) : d ? (
          <div className="space-y-1">
            <p className={`text-xl font-bold ${d.alcanzo_distancia ? 'text-lima' : 'text-alerta'}`}>
              {d.alcanzo_distancia ? 'Consiguió el primer down' : 'Se quedó corta de la línea por ganar'} · {d.yardas} yardas.
            </p>
            <p className="text-sm text-tiza-2">Pase: {PASE[d.pase] ?? d.pase}. {d.descripcion}</p>
            <p className="text-xs text-tiza-2">Una sola jugada no confirma ni refuta una probabilidad.</p>
          </div>
        ) : (
          <p className="text-sm text-alerta">La respuesta de la API no incluye el desenlace de esta jugada.</p>
        )}
      </div>
    </article>
  )
}
