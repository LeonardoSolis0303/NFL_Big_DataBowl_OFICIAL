import { memo, useMemo } from 'react'
import type { Situacion } from '../api/contrato'
import { ANCHO, HASH_Y, LARGO, xGolpeo, xPrimerDown, type Fotograma } from '../lib/futbol'

interface Props {
  situacion: Situacion
  /** Cuadro observado a dibujar. null = no se dibuja ningún jugador (nunca se inventan posiciones). */
  fotograma: Fotograma | null
  /** Cuadros observados hasta el actual, para rastros. */
  historial?: Fotograma[]
  mostrarRastros?: boolean
  ofensiva?: string
  defensiva?: string
  nota?: string
  /** Tramo del campo a mostrar, en yardas [x0, x1]. Por defecto, el campo completo. */
  ventana?: [number, number]
}

// Coordenadas de tracking: y medida desde una banda. En SVG la y crece hacia abajo; invertimos para la vista clásica.
const sy = (y: number) => ANCHO - y
const M = { arriba: 5, abajo: 4.5 }

const Lineas = memo(function Lineas() {
  const yardas = Array.from({ length: 21 }, (_, i) => 10 + i * 5)
  const ticks = Array.from({ length: 99 }, (_, i) => 11 + i).filter((x) => x % 5 !== 0)
  const numeros = [10, 20, 30, 40, 50, 40, 30, 20, 10]
  return (
    <g>
      <rect x={0} y={0} width={LARGO} height={ANCHO} fill="#233D32" />
      <rect x={0} y={0} width={10} height={ANCHO} fill="#1D3329" />
      <rect x={110} y={0} width={10} height={ANCHO} fill="#1D3329" />
      {yardas.map((x) => (
        <line key={x} x1={x} x2={x} y1={0} y2={ANCHO} stroke={x === 10 || x === 110 ? '#C4D4C0' : '#6B8371'} strokeWidth={x === 10 || x === 110 ? 0.25 : 0.12} />
      ))}
      {ticks.map((x) => (
        <g key={x} stroke="#94A38C" strokeWidth={0.08}>
          <line x1={x} x2={x} y1={sy(HASH_Y[0]) - 0.2} y2={sy(HASH_Y[0]) + 0.2} />
          <line x1={x} x2={x} y1={sy(HASH_Y[1]) - 0.2} y2={sy(HASH_Y[1]) + 0.2} />
        </g>
      ))}
      {numeros.map((n, i) => (
        <text key={i} x={20 + i * 10} y={ANCHO + 3.2} fill="#D5E0CE" fontFamily="monospace" fontSize={1.8} textAnchor="middle">{n}</text>
      ))}
      <line x1={0} x2={LARGO} y1={0} y2={0} stroke="#C4D4C0" strokeWidth={0.12} />
      <line x1={0} x2={LARGO} y1={ANCHO} y2={ANCHO} stroke="#C4D4C0" strokeWidth={0.12} />
    </g>
  )
})

/** Un solo componente para cualquier cuadro observado. Ofensiva atacando hacia la derecha. */
export default function Campo({ situacion, fotograma, historial, mostrarRastros, ofensiva, defensiva, nota, ventana }: Props) {
  const xg = xGolpeo(situacion)
  const xp = xPrimerDown(situacion)
  const ofe = fotograma?.jugadores.filter((j) => j.equipo === ofensiva) ?? []
  const def = fotograma?.jugadores.filter((j) => j.equipo !== ofensiva) ?? []
  const [x0, x1] = ventana ?? [-1.5, LARGO + 1.5]

  const rastros = useMemo(() => {
    if (!mostrarRastros || !historial?.length) return null
    const porId = new Map<number, { equipo: string; pts: string[] }>()
    for (const f of historial) for (const j of f.jugadores) {
      const r = porId.get(j.nflId) ?? { equipo: j.equipo, pts: [] }
      r.pts.push(`${j.x.toFixed(2)},${sy(j.y).toFixed(2)}`)
      porId.set(j.nflId, r)
    }
    return [...porId.entries()]
  }, [historial, mostrarRastros])

  const rastroBalon = useMemo(
    () => historial?.filter((f) => f.balon).map((f) => `${f.balon![0].toFixed(2)},${sy(f.balon![1]).toFixed(2)}`).join(' ') ?? '',
    [historial],
  )

  const desc = `Campo. ${ofensiva ?? 'La ofensiva'} ataca hacia la derecha. Línea de scrimmage en la yarda ${Math.round(xg - 10)} del campo; línea por ganar a ${situacion.yardas} yardas.` +
    (fotograma ? ` Cuadro ${fotograma.frameId}: ${ofe.length} jugadores de ${ofensiva ?? 'la ofensiva'} (círculos), ${def.length} de ${defensiva ?? 'la defensa'} (cuadros)${fotograma.balon ? ' y balón' : ''}.` : ' Sin jugadores dibujados.')

  return (
    <svg viewBox={`${x0} ${-M.arriba} ${x1 - x0} ${ANCHO + M.arriba + M.abajo}`} className="block w-full select-none rounded-md bg-cesped" role="img" aria-label={desc}>
      <Lineas />

      <line x1={xg} x2={xg} y1={-0.5} y2={ANCHO + 0.5} stroke="#B8DEFF" strokeWidth={0.4} />
      <line x1={xp} x2={xp} y1={-0.5} y2={ANCHO + 0.5} stroke="#E4FA6B" strokeWidth={0.4} strokeDasharray="1 0.7" />
      <g fontSize={1.7} fontWeight={700} fontFamily="monospace" textAnchor="middle">
        <text x={xg} y={-1.6} fill="#B8DEFF">SCRIMMAGE</text>
        <text x={xp} y={-3.4} fill="#E4FA6B">{xp >= 110 ? 'GOAL LINE' : `POR GANAR · ${situacion.yardas} YD`}</text>
      </g>

      {rastros?.map(([id, r]) => (
        <polyline key={id} points={r.pts.join(' ')} fill="none" stroke={r.equipo === ofensiva ? '#F9F4DF' : '#8DC5E5'} strokeOpacity={0.3} strokeWidth={0.15} />
      ))}
      {rastroBalon && <polyline points={rastroBalon} fill="none" stroke="#FFAD54" strokeOpacity={0.8} strokeWidth={0.2} strokeDasharray="0.6 0.4" />}

      {/* Ofensiva: círculos · Defensa: cuadros (como en la presentación) */}
      {ofe.map((j) => (
        <circle key={j.nflId} cx={j.x} cy={sy(j.y)} r={0.75} fill="#F9F4DF" stroke="#17251D" strokeWidth={0.12}>
          <title>{`${j.equipo} · nflId ${j.nflId}`}</title>
        </circle>
      ))}
      {def.map((j) => (
        <rect key={j.nflId} x={j.x - 0.65} y={sy(j.y) - 0.65} width={1.3} height={1.3} fill="#8DC5E5" stroke="#17251D" strokeWidth={0.12}>
          <title>{`${j.equipo} · nflId ${j.nflId}`}</title>
        </rect>
      ))}
      {fotograma?.balon && (
        <ellipse cx={fotograma.balon[0]} cy={sy(fotograma.balon[1])} rx={0.65} ry={0.4} fill="#FFAD54" stroke="#352914" strokeWidth={0.1} />
      )}

      {nota && (
        <g>
          <rect x={(x0 + x1) / 2 - 22} y={ANCHO / 2 - 2.5} width={44} height={5} rx={0.6} fill="#111713" fillOpacity={0.8} />
          <text x={(x0 + x1) / 2} y={ANCHO / 2} fontSize={1.8} textAnchor="middle" dominantBaseline="central" fill="#F5F4E7">{nota}</text>
        </g>
      )}
    </svg>
  )
}
