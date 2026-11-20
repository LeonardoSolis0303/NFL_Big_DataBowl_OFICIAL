/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de la presentación Al Huddle (Al-Huddle-Presentacion.html).
        sala: '#111713',
        pizarra: '#1B241E',
        borde: '#3B483E',
        tiza: '#F5F4E7',
        'tiza-2': '#B6C4B9',
        lima: '#DFF66F',
        cesped: '#233D32',
        golpeo: '#B8DEFF', // línea de scrimmage
        primero: '#E4FA6B', // línea por ganar (punteada)
        ofensiva: '#F9F4DF',
        defensa: '#8DC5E5',
        pronostico: '#DFF66F',
        alerta: '#FF8A7A',
      },
      fontFamily: {
        sans: ['system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'],
        marcador: ['system-ui', '"Segoe UI"', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
