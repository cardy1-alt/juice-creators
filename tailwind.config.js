/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        hornbill: ['Hornbill', 'Georgia', 'serif'],
        sans: ['Instrument Sans', 'sans-serif'],
      },
      colors: {
        nayba: {
          // New palette tokens
          chalk:    'var(--chalk)',
          stone:    'var(--stone)',
          terra:    'var(--terra)',
          sage:     'var(--sage)',
          violet:   'var(--violet)',
          baltic:   'var(--baltic)',
          mist:     'var(--golden-mist)',
          ink:      'var(--ink)',
          'ink-60': 'var(--ink-60)',
          'ink-35': 'var(--ink-35)',
          'ink-08': 'var(--ink-08)',
          // Aliases — keep so existing Tailwind classes don't break
          shell:    'var(--chalk)',
          card:     '#FFFFFF',
          border:   'rgba(42,32,24,0.10)',
          'terra-light': 'rgba(217,95,59,0.08)',
          'ink-45': 'rgba(42,32,24,0.45)',
          success:  '#0F6E56',
          neutral:  'rgba(42,32,24,0.45)',
        },
      },
      borderRadius: {
        'pill': '999px',
        'card': '12px',
        'sm': '10px',
        'input': '10px',
        'button': '8px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(42,32,24,0.08)',
        'fab': '0 4px 16px rgba(42,32,24,0.12)',
      },
    },
  },
  plugins: [],
};
