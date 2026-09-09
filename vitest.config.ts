import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  test: {
    // jsdom serve alla sanificazione: DOMPurify lavora sul DOM.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Valori fittizi: il client Supabase viene costruito all'import di
    // parecchi moduli e senza queste variabili lancia, impedendo il
    // caricamento dei test. Nessun test tocca la rete, quindi non
    // corrispondono ad alcun progetto reale.
    env: {
      VITE_SUPABASE_URL: 'https://progetto-di-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'chiave-anon-di-test',
    },
  },
});
