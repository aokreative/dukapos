/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fresh emerald + warm gold — Kenyan brand sensibility (per master
        // prompt). #166534 stays the primary anchor (favicon, admin, website),
        // but the scale is richer and the mids more vibrant so the UI feels
        // alive rather than flat.
        brand: {
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#a6f0c2',
          300: '#6ee0a0',
          400: '#2fc878',
          500: '#12a355',
          600: '#166534', // primary anchor
          700: '#12532c',
          800: '#0e3f23',
          900: '#0a1f14',
        },
        gold: {
          300: '#f7d97a',
          400: '#f2c94c',
          500: '#e0b13a',
          600: '#bd9022',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,31,20,.04), 0 4px 16px -8px rgba(10,31,20,.10)',
        lift: '0 4px 20px -6px rgba(10,31,20,.18)',
      },
    },
  },
  plugins: [],
}
