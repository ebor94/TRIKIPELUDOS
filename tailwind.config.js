/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // RNF-8: paleta Halloween/otoñal. Texto blanco solo sobre 700+ (contraste AA).
        calabaza: {
          50: '#FFF4EB', 100: '#FFE3CC', 200: '#FFC499', 300: '#FFA366', 400: '#F98A3C',
          500: '#E8711A', 600: '#C75A0E', 700: '#9E460C', 800: '#76340B', 900: '#4F2308'
        },
        morado: {
          50: '#F4EEFA', 100: '#E2D3F1', 200: '#C5A6E3', 300: '#A57AD2', 400: '#8552BE',
          500: '#6B3AA4', 600: '#5B2A86', 700: '#47206A', 800: '#33174D', 900: '#200E31'
        },
        crema: { DEFAULT: '#FFF6E6', 100: '#FFFBF3' }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Pantalla pública (diseño del evento)
        nombre: ['Fredoka', 'Inter', 'system-ui', 'sans-serif'],
        cartel: ['"Lilita One"', 'Inter', 'system-ui', 'sans-serif']
      },
      minHeight: { tactil: '44px' },
      minWidth: { tactil: '44px' }
    }
  },
  plugins: []
}
