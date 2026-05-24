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
          /* CP2077 aggressive palette */
          yellow: '#FCEE0A',
          'yellow-glow': 'rgba(252, 238, 10, 0.3)',
          red: '#FF2A6D',
          'red-glow': 'rgba(255, 2, 107, 0.3)',
          magenta: '#FF00FF',
          'magenta-glow': 'rgba(255, 0, 255, 0.3)',
          'deep-blue': '#1A1A2E',
          midnight: '#16213E',
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
        'cyber-glow-intense': '0 0 5px rgba(0, 217, 255, 0.3), 0 0 10px rgba(0, 217, 255, 0.3), 0 0 20px rgba(0, 217, 255, 0.2), 0 0 40px rgba(0, 217, 255, 0.1)',
        'purple-glow': '0 0 20px rgba(139, 92, 246, 0.3)',
        'error-glow': '0 0 20px rgba(239, 68, 68, 0.3)',
        'yellow-glow': '0 0 5px rgba(252, 238, 10, 0.3), 0 0 10px rgba(252, 238, 10, 0.3), 0 0 20px rgba(252, 238, 10, 0.2)',
        'red-glow': '0 0 5px rgba(255, 2, 107, 0.3), 0 0 10px rgba(255, 2, 107, 0.3), 0 0 20px rgba(255, 2, 107, 0.2)',
        'magenta-glow': '0 0 5px rgba(255, 0, 255, 0.3), 0 0 10px rgba(255, 0, 255, 0.3), 0 0 20px rgba(255, 0, 255, 0.2)',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
        'glitch-skew': 'glitch-skew 1s infinite linear alternate-reverse',
        'crt-flicker': 'crt-flicker 0.15s infinite',
        'skyline-pulse': 'skyline-pulse 4s ease-in-out infinite',
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(135deg, #0A0A0F 0%, #1E1E2E 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(0, 217, 255, 0.05) 0%, transparent 100%)',
        'warning-stripe': 'repeating-linear-gradient(45deg, #FCEE0A 0, #FCEE0A 10px, #0A0A0F 10px, #0A0A0F 20px)',
      }
    },
  },
  plugins: [],
}
