import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // This must match your GitHub repository name for project pages
  // Site will be served from: https://kimamov.github.io/react-threejs-model-viewer-demo/
  base: '/react-threejs-model-viewer-demo/',
  plugins: [react()],
  build: {
    // Output to docs so GitHub Pages can serve from the /docs folder on main
    outDir: 'docs',
    emptyOutDir: true,
  },
})

