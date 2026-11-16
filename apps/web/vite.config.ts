import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  // `convex dev` writes the deployment URL into the backend package's
  // `.env.local` as CONVEX_URL. Read it from there so there is one source.
  // Only names with these prefixes reach the browser bundle.
  envDir: '../../services/backend',
  envPrefix: ['VITE_', 'CONVEX_URL'],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
})
