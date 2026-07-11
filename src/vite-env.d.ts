/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Build date, injected at build time (see vite.config.ts). Lets the app show
 *  which version it's running so a stale cache is easy to spot. */
declare const __APP_BUILD__: string
