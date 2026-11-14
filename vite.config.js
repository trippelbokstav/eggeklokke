import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the built files work inside the iOS app (Capacitor)
  base: './',
  build: {
    // Rapier (physics) ships its WebAssembly inside the JS, so the bundle is big. Fine for an app.
    chunkSizeWarningLimit: 6000
  },
  server: {
    host: true // expose on the local network, so the iPhone can open it
  }
});
