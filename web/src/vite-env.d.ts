/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PIN_SAL: string
  /** Solo para los archivos de prueba, no lo usa la app. */
  readonly VITE_PIN_PRUEBA: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
