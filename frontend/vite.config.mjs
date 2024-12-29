import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000, // You can use the same port as CRA
        open: true, // Opens the browser automatically
    },
    build: {
        outDir: "build", // Ensures compatibility with CRA's build directory
    },
});