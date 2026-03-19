/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        nayba: {
          white: '#FFFFFF',
          bg: '#F7F7F7',
          terra: '#C4674A',
          forest: '#1A3C34',
          'near-black': '#222222',
          lavender: '#C8B8F0',
          peach: '#F5C4A0',
          pink: '#F4A8C0',
        },
      },
    },
  },
  plugins: [],
};
