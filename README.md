# Griha frontend

React + TypeScript + Vite app for designing homes: projects dashboard, 2D/3D multi-floor plan editor and drawing sheets.

## Data modes

The app talks to the FastAPI backend at `VITE_API_BASE_URL`. **When that variable is unset, it runs in demo mode**: an
in-browser backend (`src/lib/demoBackend`) answers the same API routes and keeps its data in the browser's localStorage.
Demo mode starts with the demo account `sandeep.gowda@movingwalls.com` / `griha1234` and three example projects, and every
new account (email, Google/Facebook/Apple, SSO or phone) gets its own copy of them. Data is per browser.

```bash
npm run dev        # uses the backend in .env (copy .env.example)
npm run dev:demo   # demo mode, no backend needed
```

Production builds (`npm run build`, and so Vercel/Netlify) use the deployed backend from `.env.production`
(`https://griha-backend.vercel.app/api/v1`). To deploy in demo mode instead, set `VITE_API_BASE_URL` to an empty value in the
hosting dashboard, which overrides the file.

## Deploying to Netlify

`netlify.toml` has the build settings and the rewrite that lets browser routes like `/projects/<id>` load on refresh.
Connect this repo in Netlify and deploy; it uses the backend from `.env.production`. Add the Netlify URL to the
backend's `CORS_ORIGINS`, or set `VITE_API_BASE_URL` empty in Site configuration → Environment variables for demo mode.

## Deploying to Vercel

`vercel.json` rewrites every path to `index.html`, so browser routes like `/projects/<id>` load on refresh. Import the repo
with the Vite preset; it uses the backend from `.env.production` (a `VITE_API_BASE_URL` set in the Vercel dashboard wins).

---

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
