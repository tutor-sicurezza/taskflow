import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  LINGUA_PREDEFINITA,
  linguaIniziale,
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

  const impostaLingua = useCallback((prossima: Lingua) => {
    setLingua(prossima);
    try {
      window.localStorage.setItem('taskflow.lingua', prossima);
    } catch {
      // Scelta non memorizzabile: resta valida per questa sessione.
    }
  }, []);

  const valore = useMemo<LanguageContextValue>(
    () => ({
      lingua,
      impostaLingua,
      t: (chiave, parametri) => traduci(lingua, chiave, parametri),
    }),
    [lingua, impostaLingua]
  );

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
