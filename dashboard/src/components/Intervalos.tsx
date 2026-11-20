import type { Intervalo } from '../api/contrato'
import { icPp, pp } from '../lib/formato'

export interface FilaIntervalo {
  etiqueta: string
  detalle?: string
  valor: number // diferencia 0–1
  ic95: Intervalo | null
  tenue?: boolean
}

/** Gráfico de intervalos en puntos porcentuales con línea en cero. Punto = estimación; línea = IC 95 %. */
export default function Intervalos({ filas, limite }: { filas: FilaIntervalo[]; limite?: number }) {
  const max = limite ?? Math.max(0.1, ...filas.flatMap((f) => (f.ic95 ? f.ic95.map(Math.abs) : [Math.abs(f.valor)])))
  const tope = Math.ceil(max * 10) / 10 // múltiplo de 10 pp
  const x = (v: number) => ((v + tope) / (2 * tope)) * 100 // % del ancho
  const ticks = [-tope, -tope / 2, 0, tope / 2, tope]
  return (
    <div className="space-y-1.5">
      {filas.map((f) => {
        const cruza = f.ic95 ? f.ic95[0] <= 0 && f.ic95[1] >= 0 : true
        return (
          <div key={f.etiqueta} className={`grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,9.5rem)] items-center gap-3 ${f.tenue ? 'opacity-70' : ''}`}>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{f.etiqueta}</div>
              {f.detalle && <div className="text-xs text-tiza-2">{f.detalle}</div>}
            </div>
            <div className="relative h-7 w-full" role="img" aria-label={`${f.etiqueta}: ${pp(f.valor)}, ${icPp(f.ic95)}`}>
              <span className="absolute inset-y-0 w-px bg-tiza-2" style={{ left: `${x(0)}%` }} />
              {f.ic95 && (
                <span className={`absolute top-1/2 h-[3px] -translate-y-1/2 rounded ${cruza ? 'bg-tiza-2' : 'bg-pronostico'}`}
                  style={{ left: `${x(Math.max(-tope, f.ic95[0]))}%`, width: `${x(Math.min(tope, f.ic95[1])) - x(Math.max(-tope, f.ic95[0]))}%` }} />
              )}
              <span className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${cruza ? 'bg-tiza' : 'bg-pronostico'}`} style={{ left: `${x(f.valor)}%` }} />
            </div>
            <div className="cifra text-right leading-tight">
              <div className="text-sm font-bold">{pp(f.valor)}</div>
              <div className="text-xs text-tiza-2">{f.ic95 ? `${pp(f.ic95[0])} a ${pp(f.ic95[1])}` : 'IC no disponible'}</div>
            </div>
          </div>
        )
      })}
      <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,9.5rem)] gap-3 text-[0.7rem] text-tiza-2 cifra">
        <span />
        <div className="flex justify-between">{ticks.map((t) => <span key={t}>{t === 0 ? '0' : pp(t, 0)}</span>)}</div>
        <span className="text-right">IC 95 %</span>
      </div>
    </div>
  )
}
