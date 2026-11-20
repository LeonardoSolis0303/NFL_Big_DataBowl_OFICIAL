import { useCallback, useEffect, useState } from 'react'
import { nombreEvento, type Fotograma } from '../lib/futbol'

export const prefiereMenosMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Estado de reproducción: avanza un cuadro observado cada 100 ms (10 cuadros/s). No interpola posiciones. */
export function useReproduccion(n: number) {
  const [i, setI] = useState(0)
  const [play, setPlay] = useState(false)
  const [velocidad, setVelocidad] = useState(1)

  useEffect(() => { setI(0); setPlay(false) }, [n])
  useEffect(() => {
    if (!play) return
    if (i >= n - 1) { setPlay(false); return }
    const t = window.setTimeout(() => setI(i + 1), 100 / velocidad)
    return () => window.clearTimeout(t)
  }, [play, i, n, velocidad])

  const ir = useCallback((v: number) => { setPlay(false); setI(Math.max(0, Math.min(n - 1, v))) }, [n])
  const alternar = useCallback(() => {
    setI((v) => (v >= n - 1 ? 0 : v))
    setPlay((p) => !p)
  }, [n])
  return { i, play, velocidad, setVelocidad, ir, alternar, setPlay, setI }
}

interface Props {
  fotogramas: Fotograma[]
  r: ReturnType<typeof useReproduccion>
  frameSnap: number | null
  rastros: boolean
  setRastros: (v: boolean) => void
}

export default function Reproductor({ fotogramas, r, frameSnap, rastros, setRastros }: Props) {
  const n = fotogramas.length
  const f = fotogramas[r.i]
  const t = f && frameSnap != null ? (f.frameId - frameSnap) / 10 : null
  const marcas = fotogramas
    .map((x, idx) => ({ idx, ev: x.eventos.filter((e) => e !== 'None') }))
    .filter((m) => m.ev.length > 0)

  const teclas = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' && e.key !== ' ') return
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); r.alternar() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); r.ir(r.i + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); r.ir(r.i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); r.ir(0) }
    else if (e.key === 'End') { e.preventDefault(); r.ir(n - 1) }
  }

  return (
    <div className="space-y-2" onKeyDown={teclas} role="group" aria-label="Controles de reproducción · espacio reproduce o pausa, flechas avanzan un cuadro">
      <div className="relative h-6" aria-hidden>
        {marcas.map((m) => (
          <span key={m.idx} className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[0.7rem] font-bold uppercase tracking-wider text-primero" style={{ left: `${(m.idx / Math.max(1, n - 1)) * 100}%` }}>
            {m.ev.map(nombreEvento).join(' · ')}
            <span className="mx-auto block h-2 w-px bg-primero" />
          </span>
        ))}
      </div>
      <input
        type="range" min={0} max={Math.max(0, n - 1)} value={r.i}
        onChange={(e) => r.ir(Number(e.target.value))}
        className="w-full accent-primero" aria-label="Cuadro"
        aria-valuetext={f ? `Cuadro ${f.frameId} de ${fotogramas[n - 1]?.frameId}` : undefined}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className="control" onClick={() => r.ir(0)} title="Reiniciar (Inicio)" aria-label="Reiniciar">⏮</button>
        <button className="control" onClick={() => r.ir(r.i - 1)} title="Cuadro anterior (←)" aria-label="Cuadro anterior">◀︎</button>
        <button className="control w-32 whitespace-nowrap font-bold" onClick={r.alternar} title="Reproducir o pausar (espacio)">
          {r.play ? '❚❚ Pausa' : '▶︎ Reproducir'}
        </button>
        <button className="control" onClick={() => r.ir(r.i + 1)} title="Cuadro siguiente (→)" aria-label="Cuadro siguiente">▶︎</button>
        <button className="control" onClick={() => r.ir(n - 1)} title="Último cuadro (Fin)" aria-label="Último cuadro">⏭</button>
        <button className="control px-3 text-sm" onClick={() => r.setVelocidad(r.velocidad === 1 ? 0.5 : 1)} aria-label={`Velocidad ${r.velocidad}x`}>
          {r.velocidad === 1 ? '1×' : '½×'}
        </button>
        <label className="ml-1 flex items-center gap-2 text-sm text-tiza-2">
          <input type="checkbox" checked={rastros} onChange={(e) => setRastros(e.target.checked)} className="h-4 w-4 accent-primero" />
          Rastros
        </label>
        <span className="ml-auto marcador text-sm text-tiza-2" aria-live="off">
          {f ? <>Cuadro <b className="text-tiza">{f.frameId}</b>/{fotogramas[n - 1]?.frameId}{t != null && <> · <b className="text-tiza">{t >= 0 ? '+' : '−'}{Math.abs(t).toFixed(1)} s</b> desde el snap</>}</> : 'Sin cuadros'}
        </span>
      </div>
    </div>
  )
}
