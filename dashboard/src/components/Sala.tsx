import type { ReactNode } from 'react'

/** Disposición de la sala de video: campo protagonista a la izquierda, lectura del coach a la derecha. */
export default function Sala({ marcador, campo, debajo, panel }: { marcador: ReactNode; campo: ReactNode; debajo: ReactNode; panel: ReactNode }) {
  return (
    <div className="space-y-3">
      {marcador}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25.5rem]">
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-md border border-borde bg-[#1E4A2B] p-1">{campo}</div>
          {debajo}
        </div>
        <aside className="panel min-w-0 self-start p-4" aria-label="Lectura del coach">{panel}</aside>
      </div>
    </div>
  )
}

export function Pasos({ actual }: { actual: 0 | 1 | 2 }) {
  const pasos = ['Llamada', 'Alineación y snap', 'Resultado']
  return (
    <ol className="flex items-center gap-1 text-sm" aria-label="Pasos del replay">
      {pasos.map((p, i) => (
        <li key={p} className="flex items-center gap-1" aria-current={i === actual ? 'step' : undefined}>
          <span className={`rounded px-2 py-0.5 font-bold ${i === actual ? 'bg-tiza text-sala' : i < actual ? 'text-tiza' : 'text-tiza-2'}`}>
            {i < actual ? '✓' : i + 1} {p}
          </span>
          {i < pasos.length - 1 && <span className="text-tiza-2" aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  )
}
