/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f2f2fb',
          100: '#e1e0f6',
          200: '#c8c6ed',
          300: '#a7a4e3',
          400: '#8885da',
          500: '#6967ce',
          600: '#5654c2',
          700: '#4644a8',
          800: '#3a388c',
          900: '#2f2d73',
        },
        accent: {
          50: '#e8f6ff',
          100: '#cce9fd',
          400: '#4db4f6',
          500: '#1e9ff2',
          600: '#1684d6',
          700: '#0f6cb3',
        },
        ink: {
          900: '#2b335e',
          700: '#404e67',
          500: '#6b6f82',
        }
      },
      fontFamily: {
        sans: ['Muli', 'sans-serif'],
        display: ['Comfortaa', 'cursive'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        soft: '0 2px 10px 0 rgba(0,0,0,.08)',
        lift: '0 8px 25px -8px rgba(105,103,206,.35)',
      }
    },
  },
  plugins: [],
}
