import type { Auditoria, Resumen } from '../api/contrato'
import { icPct, miles, pct } from '../lib/formato'

const n5 = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(5))
const esAuditoria = (v: unknown): v is Auditoria => !!v && typeof v === 'object' && 'filas' in (v as object)
const MODELOS: Record<string, string> = {
  constante: 'Constante',
  distancia: 'Distancia',
  distancia_y_zona: 'Distancia y zona (en uso)',
  distancia_zona_caja: 'Distancia, zona y defensores en la caja',
}

function Tabla({ cabeza, filas }: { cabeza: string[]; filas: (string | number)[][] }) {
  return (
    <table className="w-full text-sm cifra">
      <thead className="text-left text-tiza-2"><tr>{cabeza.map((c, i) => <th key={c} className={`py-1 pr-2 font-semibold ${i > 0 ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
      <tbody className="divide-y divide-borde">
        {filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} className={`py-1 pr-2 ${j > 0 ? 'text-right' : ''}`}>{v}</td>)}</tr>)}
      </tbody>
    </table>
  )
}

/** «Cómo lo obtuvimos»: cada cifra del tablero se puede seguir hasta la salida del análisis (api/resumen). */
export default function Metodo({ r }: { r: Resumen }) {
  const archivos = Object.entries(r.auditoria).filter(([, v]) => esAuditoria(v)) as [string, Auditoria][]
  const cobertura = r.auditoria.cobertura as Record<string, number> | undefined
  const { desarrollo: d, confirmacion: c } = r.mitades
  const t = r.tracking
  return (
    <details className="panel p-4">
      <summary className="cursor-pointer text-xl font-bold">Ver datos, cohorte, modelos y validación</summary>
      <div className="mt-4 grid gap-6 text-sm lg:grid-cols-2">
        <div className="space-y-4">
          <p><b>Fuente:</b> {r.fuente}. <b>Unidad:</b> {r.unidad}. <b>Éxito:</b> {r.objetivo}</p>
          <div>
            <h3 className="rotulo mb-1">Archivos auditados</h3>
            <Tabla cabeza={['Archivo', 'Filas', 'Columnas', 'Llave', 'Duplicados', 'Columnas con nulos', 'SHA-256']}
              filas={archivos.map(([k, a]) => [`${k}.csv`, miles(a.filas), a.columnas, a.claves.join(' + '), a.duplicados, Object.keys(a.nulos).length, a.sha256.slice(0, 10) + '…'])} />
            {cobertura && <p className="mt-1 text-tiza-2">Jugadas sin pasador: {cobertura.sin_pasador} · sin 22 roles PFF: {cobertura.sin_22_roles}</p>}
          </div>
          <div>
            <h3 className="rotulo mb-1">Cohorte y exclusiones</h3>
            <Tabla cabeza={['Motivo', 'Jugadas']} filas={Object.entries(r.exclusiones).map(([k, v]) => [k.replace(/_/g, ' '), miles(v)])} />
          </div>
          <div>
            <h3 className="rotulo mb-1">Partición por partido</h3>
            <Tabla cabeza={['Mitad', 'Partidos', 'Jugadas', 'Éxitos', 'Tasa', 'IC 95 %']}
              filas={[['Desarrollo', d.partidos, miles(d.n), d.exitos, pct(d.tasa, 1), icPct(d.ic95, 1).replace('IC 95 % ', '')], ['Confirmación', c.partidos, miles(c.n), c.exitos, pct(c.tasa, 1), icPct(c.ic95, 1).replace('IC 95 % ', '')]]} />
            <p className="mt-1 text-tiza-2">Los gameId de cada mitad vienen en la API; ningún partido está en ambas.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="rotulo mb-1">Brier en confirmación ({miles(r.modelos.n)} jugadas, {r.modelos.partidos} partidos · menor es mejor)</h3>
            <Tabla cabeza={['Modelo', 'Brier', 'IC 95 %']}
              filas={Object.entries(r.modelos.metricas).filter(([, m]) => m.brier != null).map(([k, m]) => [MODELOS[k] ?? k, n5(m.brier), m.ic95 ? `${n5(m.ic95[0])} a ${n5(m.ic95[1])}` : '—'])} />
            <p className="mt-1 text-tiza-2">
              Mejora por distancia frente a la constante: {n5(r.modelos.metricas.valor_distancia?.mejora)} · por defensores en la caja: {n5(r.modelos.metricas.valor_caja?.mejora)}
              {r.modelos.metricas.valor_caja?.ic95 ? ` (IC ${n5(r.modelos.metricas.valor_caja.ic95[0])} a ${n5(r.modelos.metricas.valor_caja.ic95[1])})` : ''}
            </p>
          </div>
          <div>
            <h3 className="rotulo mb-1">Calibración</h3>
            <Tabla cabeza={['Rango de p', 'p media', 'Observado', 'Jugadas']}
              filas={r.modelos.calibracion.map((k) => [`${pct(k.rango[0])}–${pct(k.rango[1])}`, pct(k.p_media, 1), `${pct(k.tasa, 1)} (${k.exitos} de ${k.n})`, k.n])} />
          </div>
          <div>
            <h3 className="rotulo mb-1">Tracking · {t.estado}</h3>
            <p>
              {miles(t.inventario?.archivos)} archivos, {miles(t.inventario?.filas)} observaciones. Snaps válidos: {miles(t.n_desarrollo)} en desarrollo y {miles(t.n_confirmacion)} en confirmación; {t.sin_snap_valido} sin snap válido.
              Brier por distancia {n5(t.brier_distancia?.valor)} frente a {n5(t.brier_posiciones?.valor)} con separación QB–defensor.
              En desarrollo, fuera de pliegue: {n5(t.desarrollo_oof?.mejora)}.
            </p>
          </div>
          <div>
            <h3 className="rotulo mb-1">Exploratorio · no entra en el titular ni en las sugerencias</h3>
            <p>
              {c.final_cerrado_exploratorio.criterio}: {d.final_cerrado_exploratorio.exitos} de {d.final_cerrado_exploratorio.n} en desarrollo ({pct(d.final_cerrado_exploratorio.tasa, 1)})
              y {c.final_cerrado_exploratorio.exitos} de {c.final_cerrado_exploratorio.n} en confirmación ({pct(c.final_cerrado_exploratorio.tasa, 1)}).
            </p>
          </div>
        </div>
      </div>
    </details>
  )
}
