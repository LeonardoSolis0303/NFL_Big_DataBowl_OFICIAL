import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { OpcionFormacion } from '../api/contrato'
import { pct } from '../lib/formato'

interface Props {
  opciones: OpcionFormacion[]
  referencia: { tasa: number; etiqueta: string } | null
  recomendada: string | null
}

/** Frecuencia observada por formación, escala fija 0–100 %, IC 95 % como segmento y conteo escrito junto a cada barra. */
export default function GraficoFormaciones({ opciones, referencia, recomendada }: Props) {
  const porNombre = new Map(opciones.map((o) => [o.formacion, o]))
  const alto = 34 + opciones.length * 62
  const desc = opciones.map((o) => `${o.formacion}: ${o.exitos} de ${o.n} (${pct(o.tasa)}), ${o.partidos} partidos`).join('; ')

  const Etiqueta = ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const o = porNombre.get(payload.value)
    if (!o) return null
    const rec = o.formacion === recomendada
    return (
      <g transform={`translate(${x - 6},${y})`}>
        <text textAnchor="end" y={-3} fill={rec ? '#5FD08A' : '#ECEAE1'} fontSize={15} fontWeight={800}>{rec ? '✓ ' : ''}{o.formacion}</text>
        <text textAnchor="end" y={14} fill="#A9B3AD" fontSize={13} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {o.exitos} de {o.n} · {o.partidos} part.
        </text>
      </g>
    )
  }
  const Valor = ({ x, y, width, height, index }: { x: number; y: number; width: number; height: number; index: number }) => (
    <text x={x + width + 6} y={y + height / 2} dominantBaseline="central" fill="#ECEAE1" fontSize={14} fontWeight={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {pct(opciones[index]?.tasa)}
    </text>
  )

  return (
    <div role="img" aria-label={`Frecuencia observada por formación. ${desc}`} style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={opciones} layout="vertical" margin={{ top: 18, right: 46, bottom: 0, left: 0 }} barCategoryGap={14}>
          <XAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => pct(v)} tick={{ fill: '#A9B3AD', fontSize: 12 }} stroke="#2A3530" />
          <YAxis type="category" dataKey="formacion" width={118} tick={Etiqueta as never} tickLine={false} axisLine={false} />
          {referencia && (
            <ReferenceLine x={referencia.tasa} stroke="#ECEAE1" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: `${referencia.etiqueta} ${pct(referencia.tasa)}`, position: 'top', fill: '#ECEAE1', fontSize: 12, fontWeight: 700 }} />
          )}
          <Bar dataKey="tasa" isAnimationActive={false} radius={[0, 2, 2, 0]} label={Valor as never}>
            {opciones.map((o) => <Cell key={o.formacion} fill={o.formacion === recomendada ? '#5FD08A' : '#6F7C75'} />)}
          </Bar>
          {opciones.map((o) => o.ic95 && (
            <ReferenceLine key={`ic-${o.formacion}`} segment={[{ x: o.ic95[0], y: o.formacion }, { x: o.ic95[1], y: o.formacion }]} stroke="#ECEAE1" strokeWidth={2.5} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
