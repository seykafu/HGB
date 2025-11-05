/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cinzel"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        parchment: {
          50: '#FBF7EF',
          100: '#F8F1E3',
          200: '#F0E4CC',
        },
        sand: {
          200: '#EAD9B8',
          300: '#D8C3A5',
        },
        gold: {
          400: '#E9C46A',
          500: '#D4AF37',
        },
        ink: {
          700: '#2E2A25',
          900: '#1E1B18',
        },
        bark: {
          600: '#6B4F3B',
          700: '#533F31',
        },
        sage: {
          200: '#C5D1C8',
        },
        rose: {
          400: '#C86B6B',
        },
      },
      boxShadow: {
        parchment: '0 2px 0 rgba(46,42,37,0.2), 0 10px 20px rgba(46,42,37,0.08)',
        insetSoft: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.05)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        card: '18px',
      },
      keyframes: {
        bob: {
          '0%,100%': { transform: 'translateY(-1px)' },
          '50%': { transform: 'translateY(1px)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
      },
      animation: {
        bob: 'bob 2.5s ease-in-out infinite',
        pulseSoft: 'pulseSoft 2s ease-in-out infinite',
      },
    },
  },
  darkMode: ['class'],
  plugins: [],
}
