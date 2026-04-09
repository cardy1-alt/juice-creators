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
          card:     'var(--stone)',
          border:   'rgba(0,0,0,0.08)',
          'terra-light': 'rgba(196,103,74,0.08)',
          'ink-45': 'rgba(0,0,0,0.45)',
          success:  '#0F6E56',
          neutral:  '#6B7280',
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
