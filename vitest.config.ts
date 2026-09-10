import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  test: {
    // jsdom serve alla sanificazione: DOMPurify lavora sul DOM.
    environment: 'jsdom',
    // Anche api/: le rotte contengono la composizione delle email, che e'
    // logica vera e non solo trasporto. I file sotto `api/_lib/` non
    // diventano funzioni su Vercel (il trattino basso li esclude dal
    // routing), quindi un test li' accanto non finisce in produzione.
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
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
