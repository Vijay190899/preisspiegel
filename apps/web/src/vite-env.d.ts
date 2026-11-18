/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set on deployed builds. */
  readonly VITE_CONVEX_URL?: string
  /** The deployed address, e.g. `https://preisspiegel.vercel.app`, for share links. */
  readonly VITE_SITE_URL?: string
  /** Written by `convex dev` in local development. */
  readonly CONVEX_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
