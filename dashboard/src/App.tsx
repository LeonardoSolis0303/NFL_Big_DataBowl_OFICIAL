import { useEffect, useMemo, useState } from 'react'
import { ErrorApi, modoEjemplo, obtenerJugada, obtenerResumen, pedirSugerencia } from './api/cliente'
import type { Evaluacion, Intervalo, Jugada, Resumen, SolicitudSugerencia } from './api/contrato'
import { zonaTexto } from './lib/formato'
import { desdeSnap } from './lib/futbol'
import Campo from './components/Campo'
import EscenarioManual from './components/EscenarioManual'
import { ErrorVisible } from './components/Estados'
import FilmRoom from './components/FilmRoom'
import Hallazgo from './components/Hallazgo'
import Metodo from './components/Metodo'

// Jugada de portada: Tampa Bay vs. Dallas, 3.ª y 2 desde la propia 33. Las cifras se piden a la API.
const PORTADA = { gameId: 2021090900, playId: 97 }
const SOLICITUD: SolicitudSugerencia = { down: 3, yardas: 2, yardas_a_goal: 67 }
const clave = (g: number, p: number) => `${g}/${p}`

const p2 = (v: number) => `${(v * 100).toFixed(2)}%`
const ic2 = (ic: Intervalo | null | undefined) => (ic ? `IC 95% · ${p2(ic[0])}–${p2(ic[1])}` : 'IC 95% no disponible')
const DOWN = ['', 'Primera', 'Segunda', 'Tercera', 'Cuarta']
const YARDAS = ['', 'Una yarda', 'Dos yardas', 'Tres yardas', 'Cuatro yardas', 'Cinco yardas']
const desde = (g: number) => (g > 50 ? `desde su propia yarda ${100 - g}` : g === 50 ? 'desde medio campo' : `desde la yarda ${g} rival`)

export default function App() {
  const [sug, setSug] = useState<Evaluacion | null>(null)
  const [errSug, setErrSug] = useState<Error | null>(null)
  const [portada, setPortada] = useState<Jugada | null>(null)
  const [errPortada, setErrPortada] = useState<Error | null>(null)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [errResumen, setErrResumen] = useState<Error | null>(null)
  const [otras, setOtras] = useState<Record<string, Jugada>>({})
  const [sel, setSel] = useState(clave(PORTADA.gameId, PORTADA.playId))
  const [errSel, setErrSel] = useState<Error | null>(null)
  const [arranque, setArranque] = useState(0)

  const cargarSug = () => { setErrSug(null); setSug(null); pedirSugerencia(SOLICITUD).then(setSug).catch(setErrSug) }
  const cargarPortada = () => { setErrPortada(null); obtenerJugada(PORTADA.gameId, PORTADA.playId).then(setPortada).catch(setErrPortada) }
  const cargarResumen = () => { setErrResumen(null); obtenerResumen().then(setResumen).catch(setErrResumen) }
  useEffect(() => { cargarSug(); cargarPortada(); cargarResumen() }, [])

  // Catálogo del film room: resumen.ejemplos. Las etiquetas usan solo datos previos a la jugada.
  useEffect(() => {
    if (!resumen) return
    resumen.ejemplos
      .filter((e) => !(e.gameId === PORTADA.gameId && e.playId === PORTADA.playId))
      .forEach((e) => obtenerJugada(e.gameId, e.playId).then((j) => setOtras((o) => ({ ...o, [clave(j.gameId, j.playId)]: j }))).catch(() => {}))
  }, [resumen])

  const catalogo = useMemo(() => {
    const ks = [clave(PORTADA.gameId, PORTADA.playId), ...(resumen?.ejemplos ?? []).map((e) => clave(e.gameId, e.playId))]
    return [...new Set(ks)]
  }, [resumen])
  const jugadaDe = (k: string) => (k === clave(PORTADA.gameId, PORTADA.playId) ? portada : otras[k] ?? null)
  const actual = jugadaDe(sel)

  const elegir = (k: string) => {
    setSel(k); setErrSel(null)
    if (!jugadaDe(k)) {
      const [g, p] = k.split('/').map(Number)
      obtenerJugada(g, p).then((j) => setOtras((o) => ({ ...o, [k]: j }))).catch(setErrSel)
    }
  }
  const verJugada = () => {
    setSel(clave(PORTADA.gameId, PORTADA.playId))
    if (!portada) cargarPortada()
    setArranque((a) => a + 1)
    document.getElementById('archivo')?.scrollIntoView({ behavior: 'smooth' })
  }

  const sinConexion = [errSug, errPortada, errResumen].some((e) => e instanceof ErrorApi && e.tipo === 'red')
  const snap = portada?.cuadros?.[0] ? desdeSnap(portada.cuadros[0]) : null
  const sit = portada?.situacion ?? { down: SOLICITUD.down, yardas: SOLICITUD.yardas, yardas_a_goal: SOLICITUD.yardas_a_goal }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-5 border-b border-borde px-[4%] py-4">
        <strong className="text-[26px] font-bold italic leading-none">AL HUDDLE</strong>
        <span className={`k ${sinConexion ? 'text-alerta' : ''}`} role="status">
          {modoEjemplo() ? 'Datos de ejemplo' : sinConexion ? 'Sin conexión con la API' : sug || portada ? 'API conectada' : 'Conectando…'}
        </span>
        <nav className="flex gap-3 sm:ml-auto">
          <a href="#archivo">Film room</a>
          <a href="#consulta">Situaciones</a>
          <a href="#metodo">Método</a>
        </nav>
      </header>

      <main className="mx-auto max-w-[1160px] px-[4%]">
        {/* Portada */}
        <div className="grid items-center gap-6 py-8 md:grid-cols-[1fr_1.22fr]">
          <div>
            <div className="k">{portada ? `${portada.equipo} vs. ${portada.defensa} · ${String(portada.gameId).slice(0, 4)}` : 'Cargando jugada…'}</div>
            <h1 className="titular my-3">{YARDAS[sit.yardas] ?? `${sit.yardas} yardas`}.<br /><em className="text-lima">¿Convierte?</em></h1>
            <p>
              {portada ? `${portada.mariscal ?? 'El mariscal'} recibe en ${DOWN[sit.down]?.toLowerCase() ?? `${sit.down}.ª`} y ${sit.yardas} ${desde(sit.yardas_a_goal)}. ` : ''}
              Antes de revelar el resultado, estima qué tan probable es que el pase consiga un primer down.
            </p>
            <button className="accion mt-3" onClick={verJugada}>Ver la jugada →</button>
            {errPortada && <div className="mt-3"><ErrorVisible error={errPortada} reintentar={cargarPortada} /></div>}
          </div>
          <figure>
            <Campo
              situacion={sit}
              fotograma={snap}
              ofensiva={portada?.equipo}
              defensiva={portada?.defensa}
              nota={!portada ? (errPortada ? 'Jugada no disponible' : 'Cargando…') : !snap ? 'Sin cuadro de snap' : undefined}
            />
            <figcaption className="mt-1.5 text-[13px] text-tiza-2">
              {snap ? `Snap · frameId ${snap.frameId}. ` : ''}Círculos {portada?.equipo ?? 'ofensiva'}, cuadros {portada?.defensa ?? 'defensa'}. La línea azul es la de scrimmage y la punteada indica la distancia por ganar.
            </figcaption>
          </figure>
        </div>

        {/* Pronóstico > intervalo > muestra */}
        {errSug ? (
          <ErrorVisible error={errSug} reintentar={cargarSug} />
        ) : !sug ? (
          <p className="border-y border-borde bg-pizarra p-4 text-tiza-2">Calculando el pronóstico con la API…</p>
        ) : (
          <div className="grid border-y border-borde bg-pizarra md:grid-cols-3">
            <div className="p-4">
              Pronóstico de conversión
              {sug.pronostico ? (
                <><b className="stat text-lima">{p2(sug.pronostico.p)}</b><small className="text-tiza-2">{ic2(sug.pronostico.ic95)}</small></>
              ) : (
                <><b className="stat text-tiza-2">—</b><small className="text-alerta">Sin pronóstico ({sug.estado}). {sug.motivo}</small></>
              )}
            </div>
            <div className="p-4">
              Conversiones comparables
              {sug.grupo ? (
                <><b className="stat">{sug.grupo.exitos} / {sug.grupo.n}</b><small className="text-tiza-2">{p2(sug.grupo.tasa)} · {ic2(sug.grupo.ic95)}</small></>
              ) : (
                <><b className="stat text-tiza-2">—</b><small className="text-alerta">La API no devolvió muestra comparable.</small></>
              )}
            </div>
            <div className="p-4">
              Partidos de referencia
              <b className="stat">{sug.grupo?.partidos ?? '—'}</b>
              <small className="text-tiza-2">
                {DOWN[SOLICITUD.down]} y {sug.distancia ?? '?'} en {zonaTexto(sug.zona)}{sug.fuente_muestra ? ` · ${sug.fuente_muestra}` : ''}
              </small>
            </div>
          </div>
        )}
        {sug?.lectura && <p className="mt-2 text-sm text-tiza-2">{sug.lectura}</p>}

        {/* Film room */}
        <section id="archivo" className="scroll-mt-3 pb-3 pt-8">
          <div className="k">Film room</div>
          <h2 className="subtitulo my-2">Lee la jugada cuadro a cuadro.</h2>
          <p>Reproduce, pausa o avanza con las flechas. Cada imagen muestra las coordenadas observadas en una décima de segundo. Abre el desenlace cuando quieras contrastarlo con tu lectura.</p>
          <div className="my-3 flex flex-wrap gap-2">
            {catalogo.map((k) => {
              const j = jugadaDe(k)
              const etiqueta = j ? `${j.equipo} vs. ${j.defensa} · ${j.playId}` : `Jugada ${k.split('/')[1]}`
              return (
                <button key={k} className={k === sel ? 'accion' : 'boton-linea'} aria-pressed={k === sel} onClick={() => elegir(k)}>{etiqueta}</button>
              )
            })}
          </div>
          {errResumen && <p className="text-sm text-alerta">Catálogo incompleto: no se pudo leer api/resumen ({errResumen.message}).</p>}
          {errSel && <ErrorVisible error={errSel} reintentar={() => elegir(sel)} />}
          {actual ? (
            <FilmRoom key={sel} jugada={actual} arranque={sel === clave(PORTADA.gameId, PORTADA.playId) ? arranque : 0} />
          ) : (
            !errSel && !(sel === clave(PORTADA.gameId, PORTADA.playId) && errPortada) && <p className="text-tiza-2">Cargando jugada…</p>
          )}
          {sel === clave(PORTADA.gameId, PORTADA.playId) && errPortada && <ErrorVisible error={errPortada} reintentar={cargarPortada} />}
        </section>

        {/* Consulta */}
        <section id="consulta" className="scroll-mt-3 pb-3 pt-8">
          <div className="k">Referencia de liga</div>
          <h2 className="subtitulo my-2">Consulta otra situación.</h2>
          <EscenarioManual />
        </section>

        {/* Método */}
        <section id="metodo" className="scroll-mt-3 pb-3 pt-8">
          <div className="k">Evidencia</div>
          <h2 className="subtitulo my-2">¿Qué se repitió en otros partidos?</h2>
          {errResumen ? (
            <ErrorVisible error={errResumen} reintentar={cargarResumen} />
          ) : !resumen ? (
            <p className="text-tiza-2">Cargando el resumen de la API…</p>
          ) : (
            <div className="space-y-8">
              <Hallazgo r={resumen} verCaso={() => document.getElementById('archivo')?.scrollIntoView({ behavior: 'smooth' })} />
              <Metodo r={resumen} />
            </div>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-[1160px] px-[4%] py-8 text-tiza-2">
        Al Huddle · NFL Big Data Bowl UNAM{resumen?.fuente ? ` · ${resumen.fuente}` : ''}
      </footer>
    </div>
  )
}
