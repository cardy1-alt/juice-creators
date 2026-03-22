/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Figtree', 'sans-serif'],
        sans: ['Figtree', 'sans-serif'],
      },
      colors: {
        nayba: {
          white: '#FFFDF8',
          bg: '#FFFDF8',
          terra: '#CB4A2F',
          'terra-hover': '#B5422A',
          forest: '#1A4A2E',
          ochre: '#E8A020',
          'near-black': '#1A1A1A',
          card: '#FFFFFF',
          'card-border': '#E0E0E0',
          lavender: '#C8B8F0',
          peach: '#F5C4A0',
          pink: '#F4A8C0',
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
