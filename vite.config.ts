import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
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
  ],
  // Vite si legherebbe al solo loopback IPv6 ([::1]), mentre `vercel dev` fa da
  // proxy verso 127.0.0.1: ogni richiesta non-api rispondeva 500. Loopback
  // esplicito su IPv4, raggiungibile solo dalla macchina.
  server: {
    host: '127.0.0.1',
    port: devPort,
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
