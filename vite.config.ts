import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// `vercel dev` sceglie una porta e la passa in PORT, poi aspetta che qualcuno
// si metta in ascolto li'. Senza rispettarla, muore con
// "Detecting port <n> timed out". Senza PORT si resta sui 5000 di sempre.
const devPort = Number(process.env.PORT) || 5000

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    /*
      L'applicazione installabile sul computer.

      Perche' un service worker generato e non scritto a mano: il rischio vero
      di una PWA non e' non funzionare, e' funzionare TROPPO bene. Un service
      worker che conserva `index.html` senza una strategia di aggiornamento
      inchioda le persone a una versione vecchia finche' non svuotano la cache
      del browser — e loro non sanno di doverlo fare. `autoUpdate` con Workbox
      ripulisce le versioni superate a ogni pubblicazione, che e' esattamente la
      parte difficile da azzeccare scrivendolo a mano.

      Cosa NON viene conservato, ed e' la scelta piu' importante qui: le
      chiamate a Supabase e a /api. Sono i dati veri, cambiano di continuo e li
      scrivono anche i colleghi; servirne una copia vecchia significherebbe
      mostrare un elenco di attivita' che non esiste piu'. In cache va solo il
      guscio dell'applicazione — codice, stile, icone, caratteri — che e'
      immutabile per costruzione perche' ha l'impronta nel nome.

      Di conseguenza, senza rete l'applicazione si APRE ma non ha dati: mostra
      la sua schermata di errore invece di una pagina bianca del browser. E'
      onesto, ed e' tutto cio' che si puo' promettere finche' i dati stanno solo
      sul server.
    */
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone/favicon-32.png', 'icone/icona-apple-180.png', 'icone/taskflow.svg'],
      manifest: {
        name: 'TaskFlow',
        short_name: 'TaskFlow',
        description: 'Gestisci il lavoro del tuo team',
        // La lingua predefinita del prodotto e' l'italiano, e il manifesto e'
        // l'unico posto in cui non si puo' scegliere a runtime.
        lang: 'it',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#00657a',
        background_color: '#fcfcfc',
        categories: ['productivity', 'business'],
        icons: [
          { src: '/icone/icona-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icone/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Le maskable sono file distinti e non lo stesso file con due scopi:
          // dichiarare "any maskable" sulla stessa immagine costringe il
          // sistema a ritagliare un disegno che arriva fino al bordo.
          { src: '/icone/icona-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icone/icona-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Attività',
            short_name: 'Attività',
            description: 'Vai direttamente all’elenco delle attività',
            url: '/?vista=tasks',
            icons: [{ src: '/icone/icona-192.png', sizes: '192x192' }],
          },
          {
            name: 'Calendario',
            short_name: 'Calendario',
            description: 'Apri il calendario delle scadenze',
            url: '/?vista=calendario',
            icons: [{ src: '/icone/icona-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Il pezzo delle icone da solo sfiora i 400 kB: senza alzare il tetto
        // resterebbe fuori dalla cache proprio il file piu' pesante.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Una navigazione verso /api non deve MAI ricevere index.html: sono
        // funzioni serverless, e servire loro il guscio dell'applicazione
        // trasformerebbe un errore leggibile in un HTML senza senso.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // I caratteri di Google: immutabili, e sono la prima cosa che manca
            // a rete lenta — il testo salta da un carattere all'altro.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'caratteri',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Gli avatar generati: cambiano solo se cambia la persona.
            urlPattern: /^https:\/\/api\.dicebear\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'avatar',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // I dati veri non si conservano MAI: vedi il commento sopra.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // Spento in sviluppo: un service worker in mezzo al ricaricamento a
        // caldo serve file vecchi e fa perdere ore a cercare un difetto che
        // non esiste.
        enabled: false,
      },
    }),
  ],
  // Vite si legherebbe al solo loopback IPv6 ([::1]), mentre `vercel dev` fa da
  // proxy verso 127.0.0.1: ogni richiesta non-api rispondeva 500. Loopback
  // esplicito su IPv4, raggiungibile solo dalla macchina.
  server: {
    host: '127.0.0.1',
    port: devPort,
  },
  build: {
    rollupOptions: {
      output: {
        /*
          Le icone in un pezzo loro.

          `@phosphor-icons/react` pesa 360 kB per le 119 icone che usiamo: ogni
          icona porta con se' i sei tratti (thin, light, regular, bold, fill,
          duotone) anche quando ne usiamo uno solo. Non si puo' alleggerire
          senza cambiare libreria — gli import per singola icona arrivano agli
          stessi file.

          Separarla non toglie quei byte, ma li stacca dal resto: l'impronta di
          questo pezzo cambia solo quando cambiano le icone, quindi dopo la
          prima visita resta nella cache del browser attraverso le
          pubblicazioni successive, mentre il pezzo principale — quello che
          cambia a ogni modifica — scende da 1619 a 1271 kB.
        */
        manualChunks(id) {
          if (id.includes('@phosphor-icons')) return 'icone';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
