/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand & Design System v1.0 — deep navy + signal cyan
        navy: {
          DEFAULT: '#0C0B2E', // Deep Navy — surfaces, headers, primary text on light
          light: '#1C1B5E', // Indigo — hover on navy, secondary emphasis
          dark: '#07061C', // deepest navy
          900: '#15143F', // raised navy panel
        },
        indigo: {
          DEFAULT: '#1C1B5E',
        },
        // Signal Cyan — the single hero accent (replaces the old gold)
        cyan: {
          DEFAULT: '#1FC6EE',
          light: '#5BD8F4',
          dark: '#1FA8D0', // Cyan 600 — accent text on light, active states
          tint: '#EEF7FB', // Cyan 50 — soft accent backgrounds
        },
        cream: {
          DEFAULT: '#E7E5DF',
          light: '#F2F1EC',
        },
        slatebrand: '#5B6075', // Slate 500 — muted supporting text
      },
      fontFamily: {
        // Inter explains, Anton shouts, Barlow Condensed labels.
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Anton', 'Inter', 'system-ui', 'sans-serif'],
        label: ['"Barlow Condensed"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 12px 30px -12px rgba(31,168,208,.5)', // cyan halo for cyan surfaces
        lift: '0 6px 14px -4px rgba(0,0,0,.18)',
        float: '0 12px 30px -12px rgba(0,0,0,.3)',
      },
    },
  },
  plugins: [],
};
