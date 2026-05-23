import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist-sidebar-test',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                sidebar: resolve(__dirname, 'src/pages/sidebar/main.tsx'),
            },
            output: {
                entryFileNames: '[name].js',
            },
        },
    },
});
