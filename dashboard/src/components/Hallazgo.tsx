import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { Intervalo, Resumen } from '../api/contrato'
import { miles, pct, pp } from '../lib/formato'
import Intervalos, { type FilaIntervalo } from './Intervalos'

const BANDAS = ['1–3', '4–6', '7+']
const sobreCero = (ic: Intervalo | null | undefined) => !!ic && ic[0] > 0

interface Fila { id: string; banda: string; mitad: 'Desarrollo' | 'Confirmación'; tasa: number; ic95: Intervalo | null; exitos: number; n: number; partidos: number }

function GraficoDistancia({ filas }: { filas: Fila[] }) {
  const porId = new Map(filas.map((f) => [f.id, f]))
  const Etiqueta = ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const f = porId.get(payload.value)
    if (!f) return null
    const conf = f.mitad === 'Confirmación'
    return (
      <g transform={`translate(${x - 6},${y})`}>
        {!conf && <text textAnchor="end" y={-14} fill="#ECEAE1" fontSize={16} fontWeight={800}>3.ª y {f.banda} yd</text>}
        <text textAnchor="end" y={5} fill={conf ? '#ECEAE1' : '#A9B3AD'} fontSize={13} fontWeight={conf ? 700 : 400} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {f.mitad} · {f.exitos} de {f.n} · {f.partidos} part.
        </text>
      </g>
    )
  }
  const Valor = ({ x, y, width, height, index }: { x: number; y: number; width: number; height: number; index: number }) => (
    <text x={x + width + 6} y={y + height / 2} dominantBaseline="central" fill="#ECEAE1" fontSize={14} fontWeight={700} style={{ fontVariantNumeric: 'tabular-nums' }}>{pct(filas[index]?.tasa, 1)}</text>
  )
  return (
    <div role="img" aria-label={'Conversión por distancia. ' + filas.map((f) => `${f.banda} yd ${f.mitad}: ${f.exitos} de ${f.n}, ${pct(f.tasa, 1)}`).join('; ')} style={{ height: 40 + filas.length * 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} layout="vertical" margin={{ top: 6, right: 56, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => pct(v)} tick={{ fill: '#A9B3AD', fontSize: 12 }} stroke="#2A3530" />
          <YAxis type="category" dataKey="id" width={250} tick={Etiqueta as never} tickLine={false} axisLine={false} />
          <Bar dataKey="tasa" isAnimationActive={false} radius={[0, 2, 2, 0]} label={Valor as never}>
            {filas.map((f) => <Cell key={f.id} fill={f.mitad === 'Confirmación' ? '#ECEAE1' : '#56635C'} />)}
          </Bar>
          {filas.map((f) => f.ic95 && (
            <ReferenceLine key={`ic-${f.id}`} segment={[{ x: f.ic95[0], y: f.id }, { x: f.ic95[1], y: f.id }]} stroke="#F5C518" strokeWidth={2.5} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** «Qué obtuvimos»: hallazgo confirmado, contraste que no permite recomendar formación y valor del tracking. */
export default function Hallazgo({ r, verCaso }: { r: Resumen; verCaso: () => void }) {
  const { desarrollo: d, confirmacion: c } = r.mitades
  const filas: Fila[] = BANDAS.flatMap((b) =>
    ([['Desarrollo', d], ['Confirmación', c]] as const).flatMap(([mitad, m]) => {
      const x = m.por_distancia[b]
      return x ? [{ id: `${b}-${mitad}`, banda: b, mitad, tasa: x.tasa, ic95: x.ic95, exitos: x.exitos, n: x.n, partidos: x.partidos }] : []
    }),
  )
  const contrastes: FilaIntervalo[] = [
    { etiqueta: 'Corta − larga · desarrollo', detalle: '1–3 yd menos 7+ yd', valor: d.corta_menos_larga.diferencia, ic95: d.corta_menos_larga.ic95, tenue: true },
    { etiqueta: 'Corta − larga · confirmación', detalle: '1–3 yd menos 7+ yd', valor: c.corta_menos_larga.diferencia, ic95: c.corta_menos_larga.ic95 },
    { etiqueta: 'EMPTY − SHOTGUN · desarrollo', detalle: `ajustado · ${d.empty_menos_shotgun_ajustado.n} jug. · ${d.empty_menos_shotgun_ajustado.estratos} estratos`, valor: d.empty_menos_shotgun_ajustado.diferencia, ic95: d.empty_menos_shotgun_ajustado.ic95, tenue: true },
    { etiqueta: 'EMPTY − SHOTGUN · confirmación', detalle: `ajustado · ${c.empty_menos_shotgun_ajustado.n} jug. · ${c.empty_menos_shotgun_ajustado.estratos} estratos`, valor: c.empty_menos_shotgun_ajustado.diferencia, ic95: c.empty_menos_shotgun_ajustado.ic95 },
  ]
  const repiteDistancia = sobreCero(d.corta_menos_larga.ic95) && sobreCero(c.corta_menos_larga.ic95)
  const formacionSeSostiene = sobreCero(d.empty_menos_shotgun_ajustado.ic95) && sobreCero(c.empty_menos_shotgun_ajustado.ic95)
  const t = r.tracking

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <span className={`inline-block rounded border-2 px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${repiteDistancia ? 'border-pronostico text-pronostico' : 'border-tiza-2 text-tiza-2'}`}>
          {repiteDistancia ? '✓ Se repite en partidos reservados' : 'No confirmado'}
        </span>
        <h2 className="text-3xl font-bold leading-tight">{r.titular}</h2>
        <p className="text-tiza-2">
          Confirmación: {c.por_distancia['1–3']?.exitos} de {c.por_distancia['1–3']?.n} en 1–3 yd frente a {c.por_distancia['7+']?.exitos} de {c.por_distancia['7+']?.n} en 7+ yd
          · <b className="text-tiza cifra">{pp(c.corta_menos_larga.diferencia)}</b> ({c.corta_menos_larga.ic95 ? `IC 95 % ${pp(c.corta_menos_larga.ic95[0])} a ${pp(c.corta_menos_larga.ic95[1])}` : 'IC no disponible'}) en {c.partidos} partidos.
        </p>
        <div className="panel p-3">
          <div className="mb-1 flex justify-between"><span className="rotulo">Conversión en tercer down por distancia</span><span className="text-xs text-tiza-2">línea amarilla = IC 95 %</span></div>
          <GraficoDistancia filas={filas} />
        </div>
        <button className="boton-linea" onClick={verCaso}>▶︎ Ver una jugada reservada en el film room</button>
      </div>

      <div className="space-y-4">
        <div className="panel p-3">
          <div className="mb-2 flex justify-between"><span className="rotulo">Contrastes en puntos porcentuales</span><span className="text-xs text-tiza-2">verde = IC por encima de 0</span></div>
          <Intervalos filas={contrastes} limite={0.4} />
          <p className="mt-2 text-sm">
            {formacionSeSostiene
              ? 'EMPTY supera a SHOTGUN con IC por encima de 0 en ambas mitades.'
              : 'Formación: el intervalo de EMPTY − SHOTGUN incluye 0 en al menos una mitad. La app muestra la comparación y deja la elección al coach.'}
          </p>
        </div>
        {t.ic95_mejora && t.mejora_con_posiciones != null && (
          <div className="panel p-3">
            <span className="rotulo">Tracking al snap · ¿la alineación defensiva añade información?</span>
            <p className="mt-1 text-sm">
              Separación del QB al defensor más cercano. Mejora de Brier sobre el modelo por distancia:{' '}
              <b className="cifra">{t.mejora_con_posiciones >= 0 ? '+' : '−'}{Math.abs(t.mejora_con_posiciones).toFixed(5)}</b>{' '}
              <span className="cifra text-tiza-2">(IC 95 % {t.ic95_mejora[0].toFixed(5)} a {t.ic95_mejora[1].toFixed(5)})</span> en {miles(t.n_confirmacion)} jugadas de confirmación.
            </p>
            <p className="mt-1 text-sm font-semibold">
              {t.ic95_mejora[0] <= 0 && t.ic95_mejora[1] >= 0 ? 'El intervalo incluye 0: la señal aporta poco y el pronóstico sigue siendo por situación.' : 'El intervalo excluye 0.'}
            </p>
          </div>
        )}
        <div className="panel p-3">
          <span className="rotulo">Explicaciones alternativas</span>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{r.alternativas.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      </div>
    </div>
  )
}
