/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel Decorative', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        parchment: {
          DEFAULT: '#FBF7EF',
          light: '#F8F1E3',
        },
        sand: '#F0E4CC',
        gold: '#E9C46A',
        'gold-dark': '#D4AF37',
        ink: '#2E2A25',
        bark: '#533F31',
        sage: '#A8B5A0',
        rose: '#C86B6B',
      },
      boxShadow: {
        parchment: '0 2px 0 rgba(46,42,37,0.2), 0 10px 20px rgba(46,42,37,0.08)',
        insetSoft: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.05)',
      },
      borderRadius: {
        '2xl': '1rem',
        card: '0.75rem',
      },
      keyframes: {
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        bob: 'bob 2s ease-in-out infinite',
        pulseSoft: 'pulseSoft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

