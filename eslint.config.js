// Configurazione ESLint mancante: `npm run lint` falliva con "ESLint couldn't
// find an eslint.config.(js|mjs|cjs) file". Lo script era in package.json e le
// dipendenze installate, ma il file non e' mai esistito — quindi il progetto
// non e' mai stato analizzato una sola volta.
//
// Le regole restano volutamente vicine ai default di typescript-eslint: lo
// scopo e' che il comando funzioni e intercetti gli errori veri, non
// riformattare migliaia di righe esistenti al primo avvio.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    // Artefatti di build e dipendenze: analizzarli produce solo rumore.
    // `.vercel/output` contiene il bundle generato da `vercel dev`/`build`:
    // codice minificato che produceva da solo 5.000 errori senza alcun valore.
    ignores: [
      'dist/**',
      'node_modules/**',
      'supabase/**',
      '.vercel/**',
      'packages/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Le variabili con prefisso _ sono deliberatamente inutilizzate
      // (parametri di callback, destrutturazioni parziali).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` e' ancora diffuso nel codice ereditato dal template: segnalarlo
      // come errore renderebbe il comando inutilizzabile fin da subito.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Script di servizio: JavaScript puro eseguito da Node.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  }
);
