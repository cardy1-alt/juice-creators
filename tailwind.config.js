/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Instrument Sans', 'sans-serif'],
      },
      colors: {
        nayba: {
          shell:   '#F7F7F5',
          card:    '#FFFFFF',
          border:  '#E8E3DC',
          ink:     '#222222',
          terra:   '#C4674A',
          'terra-light': 'rgba(196,103,74,0.08)',
          'ink-60': 'rgba(34,34,34,0.60)',
          'ink-35': 'rgba(34,34,34,0.35)',
          'ink-10': 'rgba(34,34,34,0.10)',
          success: '#2D7A4F',
          neutral: '#6B7280',
        },
      },
      borderRadius: {
        'pill': '999px',
        'card': '12px',
        'sm': '8px',
        'input': '8px',
      },
    },
  },
  plugins: [],
};
