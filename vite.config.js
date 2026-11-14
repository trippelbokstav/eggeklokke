import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the built files work inside the iOS app (Capacitor)
  base: './',
  server: {
    host: true // expose on the local network, so the iPhone can open it
  }
});
