/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/*
  I tipi dei moduli virtuali di Vite.

  `virtual:pwa-register` non esiste come file: lo genera il plugin al momento
  della compilazione. Senza questa riga TypeScript non lo trova, perche' cerca
  un modulo su disco che non c'e' e non ci sara' mai.
*/
