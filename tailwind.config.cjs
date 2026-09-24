/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-page)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        'surface-3': 'var(--color-surface-3)',
        'surface-3-hover': 'var(--color-surface-3-hover)',
        line: 'var(--color-line)',
        'line-subtle': 'var(--color-line-subtle)',
        fg: 'var(--color-fg)',
        'fg-muted': 'var(--color-fg-muted)',
        'fg-subtle': 'var(--color-fg-subtle)',
        'accent-soft': 'var(--color-accent-soft)',
        'success-soft': 'var(--color-success-soft)',
        'danger-soft': 'var(--color-danger-soft)',
        ink: 'var(--color-ink)',
        'ink-soft': 'var(--color-ink-soft)',
        mist: 'var(--color-mist)',
        'mist-soft': 'var(--color-mist-soft)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        success: 'var(--color-success)',
        'success-hover': 'var(--color-success-hover)',
        danger: 'var(--color-danger)',
        'danger-hover': 'var(--color-danger-hover)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
