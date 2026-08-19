import type { Plugin } from 'vite';

/**
 * Strict Content-Security-Policy for production builds.
 * Dev is intentionally left untouched (Vite HMR needs inline styles/websockets).
 */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' is required for the bundled sql.js WASM (SQLite) to
  // compile in the packaged app — Chromium blocks WebAssembly under a strict
  // script-src without it.
  "script-src 'self' 'wasm-unsafe-eval'",
  // 'unsafe-inline' styles: html2canvas/jsPDF inject <style> elements at runtime
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join('; ');

export function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: {'http-equiv': 'Content-Security-Policy', content: PRODUCTION_CSP},
            injectTo: 'head-prepend'
          }
        ]
      };
    }
  };
}
