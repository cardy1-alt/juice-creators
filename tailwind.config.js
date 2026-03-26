/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Corben', 'serif'],
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        nayba: {
          shell:   '#F6F3EE',
          card:    '#EDE8DF',
          border:  '#E5DFD4',
          ink:     '#222222',
          terra:   '#C4674A',
          'terra-hover': '#A8573E',
          forest: '#1A3C34',
          ochre: '#E8A020',
          peach: '#F5C4A0',
          'near-black': '#222222',
          white: '#F6F3EE',
          bg: '#F6F3EE',
          card: '#EDE8DF',
          'card-border': '#E5DFD4',
        },
      },
      borderRadius: {
        'pill': '999px',
        'card': '16px',
        'card-sm': '12px',
      },
      borderWidth: {
        '1.5': '1.5px',
      },
    },
  },
  plugins: [],
};
