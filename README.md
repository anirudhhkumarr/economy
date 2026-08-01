# US Economy Pulse

Static single-page dashboard (GitHub Pages). Macro series are fetched at **build time** into `public/data/macro.json` — no backend, proxy, or Worker at runtime.

```bash
npm install
npm run data    # refresh public/data/macro.json
npm run dev
npm run build   # data + vite (single-file dist/)
```
