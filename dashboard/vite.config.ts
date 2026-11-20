import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' para que el build funcione desde cualquier ruta (el hosting publica en /evento/equipo/)
// En desarrollo, /api va al Uvicorn local; el código del dashboard siempre usa rutas relativas ('api/...').
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
