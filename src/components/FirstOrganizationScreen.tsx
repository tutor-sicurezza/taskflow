import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Warning } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { createOrganization } from '@/lib/orgMembers';

/**
 * Schermata per chi ha un account ma nessuna organizzazione.
 *
 * Due situazioni diverse, con esiti opposti:
 *
 *   - PRIMO AVVIO di un'installazione nuova. La registrazione pubblica e'
 *     chiusa, quindi il primo utente lo crea l'operatore dal dashboard
 *     Supabase; una volta entrato pero' non apparteneva a nulla e l'unico
 *     comando disponibile era "Esci". L'installazione era un vicolo cieco:
 *     l'organizzazione si poteva creare solo scrivendo SQL a mano. Qui puo'
 *     crearla, e ne diventa proprietario.
 *
 *   - UTENTE RIMOSSO da un amministratore. Si trova nella stessa condizione
 *     ("non appartengo a nulla") ma non deve poter rientrare creandosi uno
 *     spazio proprio su questa installazione. A distinguerli e' il server:
 *     concede la creazione solo se l'istanza e' ancora vuota (primo avvio) o
 *     se chi chiede e' gia' amministratore altrove. Il messaggio qui sotto
 *     copre entrambi i casi senza promettere nulla, e il rifiuto del server
 *     viene mostrato cosi' com'e'.
 */
export function FirstOrganizationScreen() {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [nome, setNome] = useState('');
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const handleCreate = async () => {
    setErrore(null);
    setCreando(true);
    try {
      await createOrganization(nome);
      window.location.reload();
    } catch (e) {
      setErrore(t(e instanceof Error ? e.message : 'org.creazioneFallita'));
      setCreando(false);
    }
  };

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">TaskFlow</h1>
          <p className="text-muted-foreground text-sm">{t('org.nessuna')}</p>
          <div className="mt-4 flex justify-center">
            <LanguageSwitcher compatto />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('org.creaTitolo')}</CardTitle>
            <CardDescription>{t('org.creaDescrizione')}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {errore && (
              <Alert variant="destructive">
                <Warning weight="fill" />
                <AlertDescription>{errore}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="nome-prima-organizzazione">{t('org.nome')}</Label>
              <Input
                id="nome-prima-organizzazione"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Acme S.r.l."
                disabled={creando}
              />
            </div>

            <Button onClick={handleCreate} disabled={creando || !nome.trim()}>
              {creando ? t('org.creazione') : t('org.crea')}
            </Button>

            <button
              type="button"
              onClick={() => { void signOut(); }}
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
            >
              {t('comune.esci')}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
