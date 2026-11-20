import type { ErrorApi } from '../api/cliente'
import type { Evaluacion } from '../api/contrato'
import { icPct, pct, zonaTexto } from '../lib/formato'
import { ErrorVisible, TipoCifra } from './Estados'
import GraficoFormaciones from './GraficoFormaciones'
import Intervalos from './Intervalos'

interface Props {
  evaluacion: Evaluacion | null
  cargando: boolean
  error: ErrorApi | Error | null
  reintentar?: () => void
  /** Hora en que quedó registrado el pronóstico (replay). */
  registrado?: string | null
  vacio: string
}

const nombreRecomendacion = (r: Evaluacion['recomendacion']) => (r == null ? null : typeof r === 'string' ? r : r.formacion ?? null)

/** Lectura del coach: estado, pronóstico, frecuencia observada, formaciones y contraste, cada cifra con su conteo. */
export default function PanelLectura({ evaluacion: e, cargando, error, reintentar, registrado, vacio }: Props) {
  if (error) return <ErrorVisible error={error} reintentar={reintentar} />
  if (!e) return <p className="text-tiza-2" aria-live="polite">{cargando ? 'Calculando…' : vacio}</p>

  const rec = nombreRecomendacion(e.recomendacion)
  const sinSoporte = e.estado === 'sin_soporte'
  const otras = e.grupo ? e.grupo.n - e.opciones.reduce((a, o) => a + o.n, 0) : 0
  const c = e.contraste_formaciones

  return (
    <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-45' : ''}`} aria-live="polite" aria-busy={cargando}>
      {cargando && <p className="rotulo !text-primero">Actualizando…</p>}

      <header>
        {sinSoporte ? (
          <>
            <span className="inline-block rounded border-2 border-tiza-2 px-2 py-0.5 text-xs font-bold uppercase tracking-widest">⊘ Sin soporte</span>
            <h3 className="mt-2 text-2xl font-bold leading-tight">La herramienta se abstiene</h3>
            <p className="mt-1 text-tiza-2">{e.motivo}</p>
          </>
        ) : (
          <>
            <span className={`inline-block rounded border-2 px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${rec ? 'border-pronostico text-pronostico' : 'border-tiza text-tiza'}`}>
              {rec ? '✓ Recomendación' : e.estado === 'referencia' ? '◎ Referencia' : e.estado}
            </span>
            <h3 className="mt-2 text-2xl font-bold leading-tight">{rec ? `Llevar ${rec} al huddle` : 'Sin formación recomendada'}</h3>
            {e.lectura && <p className="mt-1 text-tiza-2">{e.lectura}</p>}
          </>
        )}
      </header>

      {e.pronostico && (
        <section className="border-t border-borde pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <TipoCifra tipo="pronostico" />
            {registrado && <span className="text-xs text-tiza-2">registrado {registrado}, antes de revelar</span>}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="marcador text-6xl font-bold leading-none text-pronostico">{pct(e.pronostico.p)}</span>
            <span className="cifra text-sm">{icPct(e.pronostico.ic95)}<br /><span className="text-tiza-2">de conversión · tasa media de la liga</span></span>
          </div>
          <p className="mt-1 text-xs text-tiza-2">Modelo «{e.pronostico.modelo.replace(/_/g, ' ')}». Solo usa down, distancia y zona.</p>
        </section>
      )}

      {e.grupo && (
        <section className="border-t border-borde pt-3">
          <TipoCifra tipo="frecuencia" />
          <p className="mt-1 cifra">
            <span className="marcador text-3xl font-bold">{e.grupo.exitos} de {e.grupo.n}</span>
            <span className="ml-2 text-lg font-semibold">{pct(e.grupo.tasa)}</span>
            <span className="ml-2 text-sm text-tiza-2">{e.grupo.partidos} partidos · {icPct(e.grupo.ic95)}</span>
          </p>
          <p className="text-xs text-tiza-2">
            Terceras de {e.distancia} yd en {zonaTexto(e.zona)} · muestra de {e.fuente_muestra ?? '—'}
            {e.equipo_filtro ? ` · solo ${e.equipo_filtro} (el pronóstico sigue siendo de liga)` : ' · toda la liga'}
          </p>
        </section>
      )}

      {e.opciones.length > 0 && (
        <section className="border-t border-borde pt-3">
          <div className="flex items-baseline justify-between">
            <span className="rotulo">Formaciones en ese grupo</span>
            <span className="text-xs text-tiza-2">frecuencia observada · línea = IC 95 %</span>
          </div>
          <GraficoFormaciones opciones={e.opciones} recomendada={rec} referencia={e.grupo ? { tasa: e.grupo.tasa, etiqueta: 'Grupo' } : null} />
          {otras > 0 && <p className="text-xs text-tiza-2">{otras} jugadas del grupo usaron otras formaciones y no se comparan.</p>}
        </section>
      )}

      {c && (
        <section className="border-t border-borde pt-3">
          <span className="rotulo">Contraste entre formaciones</span>
          <div className="mt-2">
            <Intervalos filas={[{ etiqueta: 'EMPTY − SHOTGUN', detalle: `${c.n} jugadas · ${c.estratos} estratos`, valor: c.diferencia, ic95: c.ic95 }]} limite={0.3} />
          </div>
          <p className="mt-1 text-xs text-tiza-2">
            Ámbito: {c.ambito}. No es específico de esta situación.
            {c.ic95 && c.ic95[0] <= 0 && c.ic95[1] >= 0 ? ' El intervalo incluye 0.' : ''}
          </p>
        </section>
      )}

      {e.evidencia_id && <p className="text-[0.7rem] text-tiza-2">Evidencia: <code>{e.evidencia_id}</code></p>}
    </div>
  )
}
