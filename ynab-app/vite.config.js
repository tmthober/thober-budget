import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' faz o build funcionar em qualquer subpasta do GitHub Pages
// (ex: usuario.github.io/orcamento-familiar/) sem precisar configurar nada.
export default defineConfig({
  plugins: [react()],
  base: './',
})
