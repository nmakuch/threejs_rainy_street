import { defineConfig } from "vite"
import glsl from 'vite-plugin-glsl'
import restart from 'vite-plugin-restart'

export default defineConfig({
  // config options
  root: 'src/',
  publicDir: '../static/',
  base: './',
  server:
  {
    host: "0.0.0.0", // Open to local network and display URL
    open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST')
  },
  build:
  {
    outDir: '../dist', // Output in the dist/ folder
    emptyOutDir: true, // Empty the folder first
    sourcemap: true // Add sourcemap
  },
  plugins:
    [
      restart({ restart: ['../static/**',] }), // Restart server on static file change
      glsl() // Handle shader files
    ]
})