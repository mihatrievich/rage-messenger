/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        'rage-bg': '#0b0b0f',
        'rage-bg-secondary': '#14141a',
        'rage-primary': '#7a3cff',
        'rage-primary-hover': '#a970ff',
        'rage-text': '#ffffff',
        'rage-text-secondary': '#b9b9c9',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #7a3cff, 0 0 10px #7a3cff' },
          '100%': { boxShadow: '0 0 10px #a970ff, 0 0 20px #a970ff' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
