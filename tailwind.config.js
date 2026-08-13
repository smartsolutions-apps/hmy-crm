/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Cairo', 'system-ui', 'sans-serif'],
        ar: ['Cairo', 'Inter', 'sans-serif'],
      },
      colors: {
        gold: {
          50: '#fbf8f1', 100: '#f5edda', 200: '#ead8b0', 300: '#dcbd7e',
          400: '#cfa055', 500: '#c08a3e', 600: '#a66f33', 700: '#89552c',
          800: '#70452a', 900: '#5d3a26',
        },
        ink: {
          50: '#f6f6f7', 100: '#e2e3e6', 200: '#c5c7cd', 300: '#a0a3ac',
          400: '#7b7f8a', 500: '#61646f', 600: '#4c4f58', 700: '#3e4048',
          800: '#2b2d33', 900: '#1a1b20', 950: '#111216',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)',
      },
    },
  },
  plugins: [],
}
