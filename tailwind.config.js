/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['"Crimson Pro"', 'serif'],
      },
      colors: {
        nayba: {
          forest: '#1A3C34',
          cream: '#FAF8F2',
          terracotta: '#C4674A',
          sage: '#E8EDE8',
          charcoal: '#2C2C2C',
        },
      },
    },
  },
  plugins: [],
};
