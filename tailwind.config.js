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
          white: '#F7F6F3',
          bg: '#F7F6F3',
          terra: '#D4470C',
          'terra-hover': '#B93D0A',
          forest: '#1A4A2E',
          ochre: '#E8A020',
          'near-black': '#2C2420',
          card: '#EDE8DC',
          'card-border': '#DDD8CC',
          sage: '#E8EEE7',
          'dusty-blue': '#E4EAED',
          peach: '#F2E8E0',
        },
      },
      borderRadius: {
        'pill': '999px',
        'card': '16px',
      },
      borderWidth: {
        '1.5': '1.5px',
      },
    },
  },
  plugins: [],
};
