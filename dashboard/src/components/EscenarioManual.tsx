import { useEffect, useRef, useState } from 'react'
import { pedirSugerencia } from '../api/cliente'
import type { Evaluacion, SolicitudSugerencia } from '../api/contrato'
import { campo, downYDistancia } from '../lib/formato'
import { banda, EQUIPOS, zona } from '../lib/futbol'
import Campo from './Campo'
import Marcador from './Marcador'
import PanelLectura from './PanelLectura'
import Sala from './Sala'

// Casos rápidos. El estado que se indica se comprobó con el modelo de Leo; la cifra la calcula siempre la API.
const CASOS: { nombre: string; nota: string; s: SolicitudSugerencia }[] = [
  { nombre: '3.ª y 2 · Propia 33', nota: 'Caso Brady', s: { down: 3, yardas: 2, yardas_a_goal: 67 } },
  { nombre: '3.ª y 6 · Propia 35', nota: 'Media', s: { down: 3, yardas: 6, yardas_a_goal: 65 } },
  { nombre: '3.ª y 12 · Rival 18', nota: 'Zona roja', s: { down: 3, yardas: 12, yardas_a_goal: 18 } },
  { nombre: '3.ª y 30 · Propia 30', nota: 'Sin soporte', s: { down: 3, yardas: 30, yardas_a_goal: 70 } },
  { nombre: '3.ª y 2 · solo TB', nota: 'Sin soporte', s: { down: 3, yardas: 2, yardas_a_goal: 67, equipo: 'TB' } },
  { nombre: '4.ª y 1 · Rival 40', nota: 'Fuera de alcance', s: { down: 4, yardas: 1, yardas_a_goal: 40 } },
]

const igual = (a: SolicitudSugerencia, b: SolicitudSugerencia) =>
  a.down === b.down && a.yardas === b.yardas && a.yardas_a_goal === b.yardas_a_goal && (a.equipo ?? '') === (b.equipo ?? '')

export default function EscenarioManual() {
  const [s, setS] = useState<SolicitudSugerencia>(CASOS[0].s)
  const [yardasTexto, setYardasTexto] = useState(String(CASOS[0].s.yardas))
  const [e, setE] = useState<Evaluacion | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [cargando, setCargando] = useState(false)
  const [activo, setActivo] = useState(false) // tras la primera evaluación, la lectura sigue a cada cambio
  const pedido = useRef(0)

  const yardasValidas = /^\d{1,2}$/.test(yardasTexto) && Number(yardasTexto) >= 1 && Number(yardasTexto) <= 99

  async function evaluar(sol = s) {
    if (!yardasValidas) return
    const id = ++pedido.current
    setCargando(true); setError(null)
    try {
      const r = await pedirSugerencia(sol)
      if (id === pedido.current) { setE(r); setActivo(true) }
    } catch (err) {
      if (id === pedido.current) { setE(null); setError(err as Error) }
    } finally {
      if (id === pedido.current) setCargando(false)
    }
  }

  useEffect(() => {
    if (!activo) return
    const t = window.setTimeout(() => evaluar(s), 300)
    return () => window.clearTimeout(t)
  }, [s]) // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = (p: Partial<SolicitudSugerencia>) => setS((v) => ({ ...v, ...p }))
  const ponerYardas = (txt: string) => {
    setYardasTexto(txt)
    if (/^\d{1,2}$/.test(txt) && Number(txt) >= 1) cambiar({ yardas: Number(txt) })
  }
  const desdePropia = 100 - s.yardas_a_goal // 1–99 desde la propia end zone

  const formulario = (
    <form className="panel grid gap-4 p-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.3fr)_auto]" onSubmit={(ev) => { ev.preventDefault(); evaluar() }} noValidate>
      <fieldset>
        <legend className="rotulo">Down</legend>
        <div className="mt-1 inline-flex overflow-hidden rounded border-2 border-borde" role="group">
          {[1, 2, 3, 4].map((d) => (
            <button type="button" key={d} aria-pressed={s.down === d} onClick={() => cambiar({ down: d })}
              className={`marcador w-11 py-1.5 text-xl font-bold ${s.down === d ? 'bg-tiza text-sala' : 'text-tiza-2 hover:text-tiza'}`}>{d}.ª</button>
          ))}
        </div>
        <p className="mt-1 text-xs text-tiza-2">La v1 cubre tercer down.</p>
      </fieldset>

      <div>
        <label className="rotulo" htmlFor="yardas">Yardas por ganar</label>
        <div className="mt-1 flex items-center gap-2">
          <button type="button" className="control" aria-label="Una yarda menos" onClick={() => ponerYardas(String(Math.max(1, s.yardas - 1)))}>−</button>
          <input id="yardas" className="entrada w-16 text-center text-xl font-bold" inputMode="numeric" value={yardasTexto}
            onChange={(ev) => ponerYardas(ev.target.value.trim())} aria-invalid={!yardasValidas} aria-describedby="yardas-ayuda" />
          <button type="button" className="control" aria-label="Una yarda más" onClick={() => ponerYardas(String(Math.min(99, s.yardas + 1)))}>+</button>
        </div>
        <p id="yardas-ayuda" className={`mt-1 text-xs ${yardasValidas ? 'text-tiza-2' : 'text-alerta'}`}>
          {yardasValidas ? `Banda del modelo: ${banda(s.yardas)} yd` : 'Entero de 1 a 99.'}
        </p>
      </div>

      <div>
        <label className="rotulo" htmlFor="campo">Balón en · {campo(s.yardas_a_goal)}</label>
        <input id="campo" type="range" min={1} max={99} value={desdePropia} className="mt-3 w-full accent-primero"
          onChange={(ev) => cambiar({ yardas_a_goal: 100 - Number(ev.target.value) })}
          aria-valuetext={`${campo(s.yardas_a_goal)}, ${s.yardas_a_goal} yardas a la end zone`} />
        <div className="flex justify-between text-[0.7rem] text-tiza-2"><span>Propia end zone</span><span>Medio campo</span><span>End zone rival</span></div>
        <p className="text-xs text-tiza-2">{s.yardas_a_goal} yd a la end zone · zona del modelo: {zona(s.yardas_a_goal)}</p>
      </div>

      <div className="flex flex-col justify-between gap-2">
        <label className="block">
          <span className="rotulo">Equipo</span>
          <select className="entrada mt-1" value={s.equipo ?? ''} onChange={(ev) => cambiar({ equipo: ev.target.value || undefined })}>
            <option value="">Toda la liga</option>
            {EQUIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="submit" className="boton-primario" disabled={!yardasValidas || cargando}>Evaluar situación</button>
      </div>
    </form>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rotulo mr-1">Cargar caso</span>
        {CASOS.map((c) => (
          <button key={c.nombre} className={`boton-linea py-1 text-sm ${igual(c.s, s) ? '!border-tiza' : ''}`} aria-pressed={igual(c.s, s)}
            onClick={() => { setS(c.s); setYardasTexto(String(c.s.yardas)); evaluar(c.s) }}>
            <span className="cifra">{c.nombre}</span><span className="text-xs font-normal text-tiza-2">{c.nota}</span>
          </button>
        ))}
      </div>
      <Sala
        marcador={<Marcador situacion={s} origen="Escenario manual" />}
        campo={<Campo situacion={s} fotograma={null} nota="Escenario manual · sin tracking: no se dibujan jugadores" />}
        debajo={formulario}
        panel={
          <PanelLectura
            evaluacion={e}
            cargando={cargando}
            error={error}
            reintentar={() => evaluar()}
            vacio={`Ajusta la situación (${downYDistancia(s)}) y pulsa «Evaluar situación».`}
          />
        }
      />
    </div>
  )
}
