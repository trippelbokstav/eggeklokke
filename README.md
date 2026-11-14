# Eggklokke

Test rig for the Store O workflow: web app (Vite) → iOS app (Capacitor) → iPhone.

## Commands

```bash
npm install          # first time, and after pulling new dependencies
npm run dev          # dev server, open the Network URL in Safari on the iPhone
npm run build        # build to dist/
npm run ios          # build + sync to Xcode + open Xcode (requires Xcode)
```

## First iOS setup (once, after Xcode is installed)

```bash
npx cap add ios
npm run ios
```

App ID: `no.storeo.eggeklokke`
