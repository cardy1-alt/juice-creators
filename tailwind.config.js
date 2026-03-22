/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Nunito', 'sans-serif'],
        sans: ['Figtree', 'sans-serif'],
      },
      colors: {
        nayba: {
          white: '#F7F3EE',
          bg: '#F7F3EE',
          terra: '#DE4E0C',
          'terra-hover': '#C44509',
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
