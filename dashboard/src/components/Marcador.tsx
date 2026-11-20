import type { Jugada, Situacion } from '../api/contrato'
import { campo, distanciaTexto, ordinalCuarto, ordinalDown } from '../lib/formato'

interface Props {
  situacion: Situacion
  origen: 'Replay histórico' | 'Escenario manual'
  jugada?: Jugada | null
  /** Formación y QB solo se muestran desde la alineación. */
  mostrarAlineacion?: boolean
}

function Equipo({ abbr, puntos, posesion, local }: { abbr: string; puntos: number; posesion: boolean; local: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 ${posesion ? 'bg-tiza text-sala' : ''}`}>
      <div className="leading-none">
        <div className="marcador text-2xl font-bold tracking-wide">{abbr}</div>
        <div className={`text-[0.65rem] font-bold uppercase tracking-widest ${posesion ? 'text-sala/70' : 'text-tiza-2'}`}>
          {local ? 'Local' : 'Visita'}{posesion ? ' · ataca ▸' : ''}
        </div>
      </div>
      <div className="marcador text-4xl font-bold">{puntos}</div>
    </div>
  )
}

/** Marcador de transmisión: equipos, cuarto, reloj y el down y distancia como cifra dominante. */
export default function Marcador({ situacion, origen, jugada, mostrarAlineacion }: Props) {
  const goal = situacion.yardas >= situacion.yardas_a_goal
  return (
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-md border border-borde bg-pizarra">
      {jugada ? (
        <div className="flex items-stretch divide-x divide-borde border-r border-borde">
          <Equipo abbr={jugada.visita} puntos={jugada.puntos_visita} posesion={jugada.equipo === jugada.visita} local={false} />
          <Equipo abbr={jugada.local} puntos={jugada.puntos_local} posesion={jugada.equipo === jugada.local} local />
          <div className="flex flex-col justify-center px-4 leading-tight">
            <span className="marcador text-3xl font-bold">{jugada.reloj}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-tiza-2">{ordinalCuarto(jugada.cuarto)}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-center border-r border-borde px-4 py-2 text-sm text-tiza-2">
          <span className="rotulo">Sin partido</span>
          <span>Reloj y marcador no entran en este modelo</span>
        </div>
      )}

      <div className="flex items-center gap-4 bg-primero px-5 text-sala">
        <span className="marcador text-[3.4rem] font-bold leading-none" aria-label={`${ordinalDown(situacion.down)} y ${goal ? 'gol' : situacion.yardas}`}>
          {ordinalDown(situacion.down)}<span className="mx-2 text-[2.2rem] opacity-70">y</span>{distanciaTexto(situacion)}
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2">
        <div>
          <div className="rotulo">Balón en</div>
          <div className="marcador text-2xl font-bold">{campo(situacion.yardas_a_goal)}</div>
        </div>
        <div>
          <div className="rotulo">A la end zone</div>
          <div className="marcador text-2xl font-bold">{situacion.yardas_a_goal} yd</div>
        </div>
        {jugada && (
          <div>
            <div className="rotulo">Formación · QB</div>
            <div className="marcador text-xl font-bold">
              {mostrarAlineacion ? <>{jugada.formacion ?? '—'} <span className="font-sans text-base font-normal text-tiza-2">· {jugada.mariscal ?? '—'}</span></> : <span className="text-tiza-2">En la alineación</span>}
            </div>
          </div>
        )}
        <span className="ml-auto rounded border border-tiza-2 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-tiza-2">{origen}</span>
      </div>
    </div>
  )
}
