import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    base: './',
    server: {
        port: 51173,
        strictPort: true,
    },
    define: {
        '__APP_VERSION__': JSON.stringify(packageJson.version),
    },
})
