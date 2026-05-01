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
        // Sidebar — always dark navy (never changes with theme)
        sidebar: {
          DEFAULT: '#1A2238',
          deep:    '#131A2C',
          text:    '#F1F5F9',
          muted:   '#94A3B8',
          row:     '#232E4A',
          active:  '#2D3A5F',
          line:    '#2A3656',
        },
        // Chat surface (dark-mode variants)
        surface: {
          DEFAULT: '#1A2238',
          chat:    '#0E1626',
          panel:   '#111827',
          hover:   '#1E293B',
          input:   '#1E293B',
        },
        // Primary accent — Telegram blue
        accent: {
          DEFAULT: '#2563EB',
          hover:   '#1D4ED8',
          soft:    '#EFF6FF',
        },
        // Message bubbles (dark mode values)
        bubble: {
          own:   '#1E3A5F',
          other: '#1F2937',
        },
        // MTL brand colors
        mtl: {
          navy:  '#1a3a6b',
          cyan:  '#29aee8',
          red:   '#EF3F1A',
          ocean: '#0d1b2a',
          deep:  '#0a1e33',
          steel: '#132338',
          slate: '#1a3050',
          mist:  '#d4e4f7',
        },
      },
      fontFamily: {
        sans:    ['Noto Sans KR', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Noto Sans KR', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
