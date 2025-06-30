import 'dotenv/config'; // ⬅️ loads .env/.env.production into process.env
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {sentryVitePlugin} from '@sentry/vite-plugin'

export default defineConfig({
    base: '/',
    plugins: [
        react(),
        sentryVitePlugin({
            org: 'esn-politecnico-milano',
            project: 'javascript-react',
            /* eslint-env node */
            authToken: process.env.SENTRY_AUTH_TOKEN,
            // Uploads source maps and sets debug flag automatically
        }),],
    server: {
        port: 3000, // You can use the same port as CRA
        open: false, // Opens the browser automatically. Set to false to avoid errors when containerized in docker
        host: true, // needed for docker
        watch: {usePolling: true}, // needed for hot reload when using docker
    },
    build: {
        outDir: "build",
        sourcemap: true,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        return id.toString().split('node_modules/')[1].split('/')[0].toString();
                    }
                }
            }
        }
    },
});