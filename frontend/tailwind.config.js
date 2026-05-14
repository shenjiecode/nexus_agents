/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0A0A0F',
          'dark-lighter': '#1E1E2E',
          'dark-card': '#151520',
          cyan: '#00D9FF',
          'cyan-glow': 'rgba(0, 217, 255, 0.3)',
          purple: '#8B5CF6',
          'purple-glow': 'rgba(139, 92, 246, 0.3)',
          white: '#FFFFFF',
          muted: '#94A3B8',
          error: '#EF4444',
          'error-glow': 'rgba(239, 68, 68, 0.3)',
          success: '#10B981',
          'success-glow': 'rgba(16, 185, 129, 0.3)',
          warning: '#F59E0B',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'cyber-glow': '0 0 20px rgba(0, 217, 255, 0.3)',
        'cyber-glow-hover': '0 0 30px rgba(0, 217, 255, 0.5)',
        'purple-glow': '0 0 20px rgba(139, 92, 246, 0.3)',
        'error-glow': '0 0 20px rgba(239, 68, 68, 0.3)',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 217, 255, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(0, 217, 255, 0.6)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(135deg, #0A0A0F 0%, #1E1E2E 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(0, 217, 255, 0.05) 0%, transparent 100%)',
      }
    },
  },
  plugins: [],
}
