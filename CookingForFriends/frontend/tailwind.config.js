/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cooking: {
          50: '#fef7ee',
          100: '#fdead7',
          200: '#fad2ae',
          300: '#f6b27a',
          400: '#f18a44',
          500: '#ed6d1f',
          600: '#de5315',
          700: '#b83d13',
          800: '#933218',
          900: '#772b16',
        },
      },
    },
  },
  plugins: [],
}
