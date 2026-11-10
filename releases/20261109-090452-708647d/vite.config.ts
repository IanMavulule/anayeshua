import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const mediaProxy = {
  '/api': { target: 'http://localhost:8787' },
  '/media': { target: 'http://localhost:8787' },
  '/uploads': { target: 'http://localhost:8787' },
}

export default defineConfig({
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true },
  // Porta fixa: o link do site tem de ser sempre o mesmo. Se 5173 estiver
  // ocupada o Vite falha de imediato em vez de desviar para 5174.
  server: { port: 5173, strictPort: true, proxy: mediaProxy },
  preview: { proxy: mediaProxy },
  plugins: [react()],
  // O leitor (Video.js) só é importado quando se abre uma aula; sem isto o Vite
  // descobre-o tarde, volta a optimizar as dependências e a página fica com duas
  // cópias do React ("Invalid hook call") e deixa de mostrar a aula.
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-compiler-runtime',
      '@videojs/react/video',
      '@videojs/react/i18n',
      '@videojs/react/media/hlsjs-video',
    ],
  },
})
