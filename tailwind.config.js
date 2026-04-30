/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // WhatsApp Web 다크모드 기준 팔레트
        surface: {
          DEFAULT: '#111b21',
          chat:    '#0b141a',
          panel:   '#202c33',
          hover:   '#2a3942',
          input:   '#2a3942',
        },
        accent: {
          DEFAULT: '#00a884',
          hover:   '#017561',
        },
        bubble: {
          own:   '#005c4b',
          other: '#202c33',
        },
        // MTL 브랜드 컬러
        mtl: {
          navy:  '#1a3a6b',
          cyan:  '#29aee8',
          red:   '#e84b35',
          ocean: '#0d1b2a',
          deep:  '#0a1e33',
          steel: '#132338',
          slate: '#1a3050',
          mist:  '#d4e4f7',
        },
      },
      fontFamily: {
        sans:    ['Barlow', 'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif'],
        display: ['Barlow Condensed', 'Apple SD Gothic Neo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
