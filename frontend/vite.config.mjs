import {defineConfig} from 'vite';
import {resolve} from 'path';
import react from '@vitejs/plugin-react';

console.log(">>> VITE CONFIG LOADED <<<");

export default defineConfig({
    base: '/',
    plugins: [react()],
    server: {
        port: 3000, // You can use the same port as CRA
        open: false, // Opens the browser automatically. Set to false (avoid errors when containerized in docker)
        host: true, // needed for docker
        watch: {usePolling: true}, // needed for hot reload when using docker
        minify: false, // to avoid issues with production builds
    },
    build: {
        outDir: "build",
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                whatsapp: resolve(__dirname, 'whatsapp/index.html'),
            },
        },
    },
});