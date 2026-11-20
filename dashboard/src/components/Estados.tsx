import type { ErrorApi } from '../api/cliente'

const TITULOS: Record<string, string> = {
  red: 'No pudimos conectar con el análisis',
  servicio: 'El servicio de análisis falló',
  entrada: 'Entrada no válida para la API',
  no_encontrado: 'No encontrado',
}

/** Banner rojo visible. No se muestran cifras viejas junto a un error. */
export function ErrorVisible({ error, reintentar }: { error: ErrorApi | Error; reintentar?: () => void }) {
  const tipo = (error as ErrorApi).tipo ?? 'servicio'
  return (
    <div role="alert" className="rounded-md border-2 border-alerta bg-alerta/10 p-3">
      <p className="font-bold text-alerta">✕ {TITULOS[tipo] ?? TITULOS.servicio}</p>
      <p className="mt-0.5 text-sm">{error.message}</p>
      {reintentar && <button className="boton-linea mt-2 py-1 text-sm" onClick={reintentar}>Reintentar</button>}
    </div>
  )
}

/** Rótulos distintos para los tres tipos de cifra. */
export function TipoCifra({ tipo }: { tipo: 'pronostico' | 'frecuencia' | 'resultado' }) {
  if (tipo === 'pronostico') return <span className="rotulo !text-pronostico">◷ Pronóstico</span>
  if (tipo === 'frecuencia') return <span className="rotulo">▤ Frecuencia observada</span>
  return <span className="rotulo !text-primero">● Resultado de esta jugada</span>
}
