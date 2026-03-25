/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Corben', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        nayba: {
          shell:   '#F8F6F1',
          card:    '#F0ECE4',
          border:  '#E4DDD4',
          ink:     '#28201A',
          terra:   '#C4674A',
          /* REVIEW: Legacy colour aliases — remove once Chunks 2-7 migrate all components */
          white: '#F8F6F1',
          bg: '#F8F6F1',
          'terra-hover': '#A8573E',
          forest: '#1A4A2E',
          ochre: '#E8A020',
          'near-black': '#28201A',
          card: '#F0ECE4',
          'card-border': '#E4DDD4',
          sage: '#E8EEE7',
          'dusty-blue': '#E4EAED',
          peach: '#F2E8E0',
          butter: '#EDE8D0',
        },
      },
      borderRadius: {
        'pill': '999px',
        'card': '20px',
        'card-sm': '14px',
      },
      borderWidth: {
        '1.5': '1.5px',
      },
    },
  },
  plugins: [],
};
