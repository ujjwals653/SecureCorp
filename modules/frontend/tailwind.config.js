/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Space Grotesk'", "'DM Sans'", "Inter", "system-ui", "sans-serif"],
        mono: ["'Space Grotesk'", "ui-monospace", "monospace"],
      },
      colors: {
        purple: {
          DEFAULT: '#5A1FE0',
          dark: '#4f19ce',
          light: '#EDE7FC',
          50: '#f5f0ff',
          100: '#EDE7FC',
          200: '#ddd0fa',
          300: '#c5aaf6',
          400: '#a87bf0',
          500: '#8b55e8',
          600: '#5A1FE0',
          700: '#4f19ce',
          800: '#3d12a8',
          900: '#2f0d88',
        },
        ink: '#111113',
        panel: '#F4F4F5',
        body: '#6B6B73',
        muted: '#A0A0A8',
        line: '#E5E5E8',
        surface: '#ffffff',
        // Status colors (light-themed)
        success: {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          text: '#166534',
          icon: '#16a34a',
        },
        warning: {
          bg: '#fffbeb',
          border: '#fde68a',
          text: '#92400e',
          icon: '#d97706',
        },
        error: {
          bg: '#fff5f5',
          border: '#fecaca',
          text: '#991b1b',
          icon: '#E5484D',
        },
        info: {
          bg: '#eff6ff',
          border: '#bfdbfe',
          text: '#1e40af',
          icon: '#3b82f6',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '8px',
        xl: '11px',
        '2xl': '14px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(17,17,19,0.06)',
        DEFAULT: '0 2px 8px rgba(17,17,19,0.08)',
        md: '0 4px 14px rgba(17,17,19,0.08)',
        lg: '0 8px 24px rgba(17,17,19,0.10)',
        purple: '0 4px 16px rgba(90,31,224,0.18)',
      },
    },
  },
  plugins: [],
}
