import { useEffect, useState } from 'react';
import { useKV } from '@/hooks/useKV';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Envelope, PaperPlaneTilt, Info } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Configurazione dell'invio email, riscritta su cio' che il server fa davvero.
 *
 * Il pannello precedente chiedeva all'amministratore di incollare qui la
 * chiave API del provider e l'indirizzo mittente. Nessuno dei due valori
 * veniva mai usato:
 *
 *   - api/email/send.ts legge la chiave dalle variabili d'ambiente
 *     (RESEND_API_KEY / SENDGRID_API_KEY) e il mittente da EMAIL_FROM;
 *     `body.from` e' deliberatamente ignorato, altrimenti l'endpoint sarebbe
 *     un relay autenticato per spedire a nome del dominio verificato;
 *   - la chiave finiva in app_state, cioe' in chiaro in una riga leggibile da
 *     TUTTI i membri dell'organizzazione via PostgREST, e veniva caricata nel
 *     browser di chiunque aprisse l'app;
 *   - il pulsante "Test connection" chiamava api.sendgrid.com dal browser:
 *     bloccato dal CORS, quindi rispondeva sempre "Network error" anche con
 *     una chiave valida;
 *   - il test di invio non mandava l'header Authorization e passava
 *     `tenantId: 'test-tenant'`, quindi otteneva 401/403 in ogni caso.
 *
 * Restano quindi solo le cose vere: la scelta del provider preferito (che
 * l'endpoint accetta) e un invio di prova fatto come si deve.
 */

interface EmailConfig {
  provider: 'sendgrid' | 'resend';
  /** Chiave legacy: presente solo nei dati salvati dal vecchio pannello. */
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
}

export function SendGridConfiguration() {
  const { organization } = useAuth();
  const [config, setConfig] = useKV<EmailConfig>('sendgrid-config', {
    provider: 'resend',
  });

  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  /**
   * Bonifica dei dati salvati dal vecchio pannello: se in app_state c'e'
   * ancora una chiave API, va tolta. E' un segreto in chiaro leggibile da
   * ogni membro dell'organizzazione, e non serve a nulla — il server usa le
   * proprie variabili d'ambiente.
   */
  useEffect(() => {
    if (!config?.apiKey && !config?.fromEmail) return;

    setConfig((current) => ({
      provider: current?.provider ?? 'resend',
    }));
    toast.info(
      'Rimossa dalla configurazione una chiave API salvata dalla versione precedente: le chiavi vivono solo lato server.'
    );
  }, [config?.apiKey, config?.fromEmail, setConfig]);

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Indica un indirizzo a cui inviare la prova');
      return;
    }

    if (!organization?.id) {
      toast.error('Nessuna organizzazione attiva');
      return;
    }

    setTesting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error('Sessione scaduta, accedi di nuovo');
        return;
      }

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Mancava: senza questo header l'endpoint rispondeva 401 sempre.
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          // Prima era la stringa 'test-tenant', che non e' un'organizzazione
          // esistente: 403 garantito.
          tenantId: organization.id,
          to: testEmail.trim(),
          subject: 'TaskFlow — email di prova',
          textContent:
            'Questa e\' un\'email di prova inviata da TaskFlow. Se la stai leggendo, la configurazione lato server funziona.',
          htmlContent:
            '<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6">' +
            '<h2>TaskFlow — email di prova</h2>' +
            '<p>Se stai leggendo questo messaggio, la configurazione di invio lato server funziona.</p>' +
            '</div>',
          provider: config?.provider,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(`Invio fallito: ${payload?.error ?? `HTTP ${response.status}`}`);
        return;
      }

      toast.success(`Email di prova inviata a ${testEmail.trim()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore di rete');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-2">
          <Envelope size={24} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Invio email</h2>
          <p className="text-muted-foreground text-sm">
            Provider di consegna e prova di invio
          </p>
        </div>
      </div>

      <Alert>
        <Info weight="fill" />
        <AlertDescription>
          Chiave API e indirizzo mittente si configurano <strong>solo lato server</strong>,
          nelle variabili d'ambiente del progetto (<code>RESEND_API_KEY</code> o{' '}
          <code>SENDGRID_API_KEY</code>, <code>EMAIL_FROM</code>). Non vanno inserite
          qui: finirebbero in chiaro nel database dell'organizzazione e nel browser
          di chiunque apra l'applicazione.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provider preferito</CardTitle>
          <CardDescription>
            Usato se sul server e' configurata la chiave corrispondente; altrimenti
            viene scelto automaticamente quello disponibile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={config?.provider ?? 'resend'}
              onValueChange={(value: 'sendgrid' | 'resend') =>
                setConfig((current) => ({ ...current, provider: value }))
              }
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invio di prova</CardTitle>
          <CardDescription>
            Il destinatario deve essere un membro di questa organizzazione:
            l'endpoint rifiuta gli indirizzi esterni, per non trasformarsi in un
            relay a nome del dominio verificato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="collega@azienda.it"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={testing}
            />
            <Button onClick={handleSendTestEmail} disabled={testing || !testEmail.trim()}>
              <PaperPlaneTilt className="mr-2 h-4 w-4" weight="fill" />
              {testing ? 'Invio…' : 'Invia prova'}
            </Button>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            Serve il ruolo <strong>manager</strong> o superiore. Gli esiti di consegna
            reali sono in "Email Analytics".
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
