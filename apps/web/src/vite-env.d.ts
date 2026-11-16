/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set on deployed builds. */
  readonly VITE_CONVEX_URL?: string
  /** Written by `convex dev` in local development. */
  readonly CONVEX_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
