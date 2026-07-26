/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        ink: {
          950: '#05060a',
          900: '#0b0d14',
          850: '#0f1220',
          800: '#12162a',
        },
        surface: {
          0: '#ffffff',
          1: '#f8fafc',
          2: '#f1f5f9',
          d0: '#05060a',
          d1: '#0b0d14',
          d2: '#0f1220',
          d3: '#12162a',
        },
        urgent: {
          low:      '#22c55e',
          medium:   '#f59e0b',
          high:     '#ef4444',
          critical: '#7c3aed',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'sos-pulse':  'sosPulse 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        sosPulse: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.55)' },
          '70%': { transform: 'scale(1.03)', boxShadow: '0 0 0 18px rgba(239, 68, 68, 0)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
        },
      },
    },
  },
  plugins: [],
};
