import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
// Il runtime GitHub Spark non e' piu' importato: nessuna riga di src/ usa
// piu' `window.spark`. Restava solo a fare rumore — a ogni caricamento
// chiedeva /_spark/user e /_spark/loaded, che su Vercel sono 404, e mandava
// un postMessage alla finestra padre. I plugin Vite di Spark restano: quelli
// servono al build (proxy delle icone e porta del dev server).

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import { LanguageProvider, useTranslation } from './contexts/LanguageContext.tsx'
import { LoginScreen } from './components/LoginScreen.tsx'
import { SetNewPasswordScreen } from './components/SetNewPasswordScreen.tsx'
import { FirstOrganizationScreen } from './components/FirstOrganizationScreen.tsx'

// Un solo foglio: main.css importa a sua volta theme.css e index.css.
// Importarli anche qui li faceva emettere una seconda volta.
import "./main.css"

/**
 * Finche' la sessione non e' risolta mostriamo un caricamento; senza sessione
 * si mostra il login. App non viene montata prima che esistano utente e
 * organizzazione, cosi' useKV ha sempre uno scope valido su cui lavorare.
 */
function AuthGate() {
  const { session, profile, organization, loading, error, recovering, signOut } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">{t('comune.caricamento')}</div>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  // Arrivo dal link di recupero: prima di qualunque altra cosa si sceglie la
  // nuova password. Il controllo sta qui, prima dei gate su stato e
  // organizzazione, perche' deve valere anche per chi e' disattivato o non
  // appartiene (piu') a un'organizzazione: sono comunque padroni del proprio
  // account e devono poterne cambiare la password.
  if (recovering) return <SetNewPasswordScreen />

  // Account disattivato: "disattiva utente" nell'interfaccia non impediva
  // nulla: la persona continuava ad accedere e a vedere tutto, perche' lo
  // stato era solo un'etichetta nell'elenco. Ora e' un vero blocco.
  if (profile?.status === 'inactive') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <p className="font-medium">{t('account.disattivato')}</p>
          <p className="text-muted-foreground text-sm">{t('account.disattivatoDescrizione')}</p>
          <button
            type="button"
            onClick={() => { void signOut() }}
            className="text-sm underline underline-offset-4"
          >
            {t('comune.esci')}
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-2 text-center">
          <p className="font-medium text-destructive">{t('comune.inizializzazioneFallita')}</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    )
  }

  /**
   * Nessuna organizzazione: o e' il primo avvio dell'installazione, o
   * l'account e' stato rimosso da un amministratore. La schermata offre di
   * crearne una; a decidere se e' lecito e' il server, non il client.
   *
   * Prima qui c'era solo un messaggio con il pulsante "Esci": per chi
   * installava il progetto da zero era un vicolo cieco, perche' con la
   * registrazione pubblica chiusa la prima organizzazione si poteva creare
   * soltanto scrivendo SQL a mano.
   */
  if (!organization) return <FirstOrganizationScreen />

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <LanguageProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </LanguageProvider>
  </ErrorBoundary>
)
