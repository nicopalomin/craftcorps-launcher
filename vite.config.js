import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './',
    define: {
        '__APP_VERSION__': JSON.stringify(packageJson.version),
    },
})
