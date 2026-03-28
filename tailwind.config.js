/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
          sans: ['Inter', 'sans-serif'],
          display: ['Space Grotesk', 'sans-serif'],
          mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
          drupal: {
              blue: '#00598E',
              light: '#0678BE',
              dark: '#003C65'
          },
          cyber: {
              cyan: '#00F0FF',
              blue: '#0057FF',
              dark: '#0A0E17',
              card: '#111827'
          }
      },
      backgroundImage: {
          'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%231E293B' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E\")",
      },
      animation: {
          'float': 'float 6s ease-in-out infinite',
          'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
          float: {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-10px)' },
          },
          pulseGlow: {
              '0%, 100%': { opacity: 1, filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.5))' },
              '50%': { opacity: .7, filter: 'drop-shadow(0 0 2px rgba(0, 240, 255, 0.2))' },
          },
          slideInRight: {
              '0%': { transform: 'translateX(100%)', opacity: 0 },
              '100%': { transform: 'translateX(0)', opacity: 1 },
          }
      }
    }
  },
  plugins: [],
}
