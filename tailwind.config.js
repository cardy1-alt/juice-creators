/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Instrument Sans', 'sans-serif'],
        serif: ['Instrument Serif', 'serif'],
      },
      colors: {
        nayba: {
          shell:   '#F7F6F3',
          card:    '#FFFFFF',
          border:  'rgba(0,0,0,0.08)',
          ink:     '#1C1917',
          terra:   '#C4674A',
          'terra-light': 'rgba(196,103,74,0.08)',
          'ink-60': 'rgba(0,0,0,0.6)',
          'ink-45': 'rgba(0,0,0,0.45)',
          'ink-35': 'rgba(0,0,0,0.35)',
          'ink-08': 'rgba(0,0,0,0.08)',
          success: '#0F6E56',
          neutral: '#6B7280',
        },
      },
      borderRadius: {
        'pill': '999px',
        'card': '10px',
        'sm': '8px',
        'input': '8px',
        'button': '6px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06)',
        'fab': '0 2px 8px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
};
