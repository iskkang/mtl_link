import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: true, // 로컬 네트워크 IP에 바인딩 — 모바일이 같은 WiFi에서 접속 가능
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
});
