import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  LINGUA_PREDEFINITA,
  caricaDizionario,
  linguaIniziale,
  richiedeCaricamento,
  traduci,
  type ChiaveTraduzione,
  type Lingua,
} from '@/lib/i18n';

interface LanguageContextValue {
  lingua: Lingua;
  impostaLingua: (lingua: Lingua) => void;
  t: (chiave: ChiaveTraduzione, parametri?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Lingua dell'interfaccia.
 *
 * Sta sopra all'autenticazione di proposito: le schermate di accesso, di
 * recupero password e di account disattivato devono essere tradotte anche
 * quando non esiste ancora un utente. Per lo stesso motivo la scelta va in
 * localStorage e non in `user_state`, che e' leggibile solo dopo il login.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lingua, setLingua] = useState<Lingua>(() => linguaIniziale());

  // All'avvio con una lingua a caricamento differito non c'e' ancora nulla a
  // schermo: mostrare l'interfaccia subito significherebbe farla comparire in
  // inglese e poi riscriverla. Meglio trattenerla per il tempo di un import
  // locale. Per italiano e inglese il dizionario e' gia' in memoria, quindi si
  // parte pronti e non si perde un solo fotogramma.
  const [pronta, setPronta] = useState(() => !richiedeCaricamento(linguaIniziale()));

  // Identifica l'ultima lingua richiesta: con due cambi ravvicinati le due
  // promesse possono risolversi in ordine inverso, e senza questo controllo
  // vincerebbe la scelta piu' vecchia.
  const richiestaCorrente = useRef<Lingua>(lingua);

  useEffect(() => {
    if (pronta) return;

    let vivo = true;
    void caricaDizionario(lingua).then(() => {
      // `caricaDizionario` non lancia: se la rete ha fallito si prosegue
      // comunque, con il ripiego, invece di lasciare una schermata bianca.
      if (vivo) setPronta(true);
    });

    return () => {
      vivo = false;
    };
    // Solo all'avvio: i cambi lingua successivi passano da `impostaLingua`,
    // che carica prima di commutare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const impostaLingua = useCallback((prossima: Lingua) => {
    richiestaCorrente.current = prossima;

    try {
      window.localStorage.setItem('taskflow.lingua', prossima);
    } catch {
      // Scelta non memorizzabile: resta valida per questa sessione.
    }

    // A lingua gia' disponibile si commuta nello stesso ciclo di rendering:
    // nessun await, nessun ritardo percepibile per italiano e inglese.
    if (!richiedeCaricamento(prossima)) {
      setLingua(prossima);
      return;
    }

    // Altrimenti si resta sulla lingua attuale finche' il dizionario non e'
    // arrivato: l'utente vede il testo di prima, mai un lampo di inglese.
    void caricaDizionario(prossima).then(() => {
      if (richiestaCorrente.current === prossima) setLingua(prossima);
    });
  }, []);

  const valore = useMemo<LanguageContextValue>(
    () => ({
      lingua,
      impostaLingua,
      t: (chiave, parametri) => traduci(lingua, chiave, parametri),
    }),
    [lingua, impostaLingua]
  );

  // Nessun indicatore di attesa: il dizionario e' un file locale servito con
  // il resto dell'applicazione, e un riquadro di caricamento lampeggiante
  // sarebbe piu' fastidioso dei pochi millisecondi che dura.
  if (!pronta) return null;

  return <LanguageContext.Provider value={valore}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);

  // Senza provider si torna alla lingua predefinita invece di lanciare: un
  // componente usato fuori dall'albero principale (un test, una schermata di
  // errore) deve comunque riuscire a mostrare del testo.
  if (!ctx) {
    return {
      lingua: LINGUA_PREDEFINITA,
      impostaLingua: () => {},
      t: (chiave: ChiaveTraduzione, parametri?: Record<string, string | number>) =>
        traduci(LINGUA_PREDEFINITA, chiave, parametri),
    };
  }

  return ctx;
}
