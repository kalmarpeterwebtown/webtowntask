/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Webtown brand green
        primary: {
          50:  '#f0fdf4',
          100: '#dcfce9',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16b632', // Webtown primary green
          700: '#119128',
          800: '#0e701f',
          900: '#0b5518',
        },
        // Webtown dark navy
        navy: {
          50:  '#e8ecf0',
          100: '#c5cfd8',
          200: '#9aafc0',
          300: '#6e8fa8',
          400: '#4d7490',
          500: '#2c5978',
          600: '#1a3a52',
          700: '#112a3d',
          800: '#0d1f2d', // main dark bg
          900: '#080f18',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'pill': '9999px',
      },
    },
  },
  plugins: [],
}
