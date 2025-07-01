import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/',
    plugins: [react()],
    server: {
        port: 3000, // You can use the same port as CRA
        open: false, // Opens the browser automatically. Set to false (avoid errors when containerized in docker)
        host: true, // needed for docker
        watch: {usePolling: true}, // needed for hot reload when using docker
    },
    build: {
        outDir: "build",
        chunkSizeWarningLimit: 2000,
    },
});