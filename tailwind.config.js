/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep forest green + gold — Kenyan brand sensibility (per master prompt).
        brand: {
          50: '#effaf3',
          100: '#d8f2e1',
          200: '#b3e5c6',
          300: '#80d0a4',
          400: '#48b47c',
          500: '#22935c',
          600: '#166534', // primary
          700: '#125a2f',
          800: '#0f4425',
          900: '#0b1f16',
        },
        gold: {
          400: '#f0c14b',
          500: '#d4af37',
          600: '#b8912a',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
