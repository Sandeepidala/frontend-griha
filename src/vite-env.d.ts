/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API root. Leave unset to run in demo mode, with an in-browser backend (see lib/dataMode). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
