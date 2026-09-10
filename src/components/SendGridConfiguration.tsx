import { useEffect, useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
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
  const { t } = useTranslation();
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
      t('Removed an API key saved by the previous version: keys live only on the server.')
    );
    // `t` non entra fra le dipendenze: cambia a ogni cambio di lingua e
    // rieseguirebbe la bonifica (con il suo avviso) senza motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.apiKey, config?.fromEmail, setConfig]);

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error(t('Enter an address to send the test to'));
      return;
    }

    if (!organization?.id) {
      toast.error(t('comune.nessunaOrganizzazione'));
      return;
    }

    setTesting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error(t('comune.sessioneScaduta'));
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
          subject: t('TaskFlow — test email'),
          textContent: t(
            'This is a test email sent by TaskFlow. If you are reading it, the server-side setup works.'
          ),
          htmlContent:
            '<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6">' +
            `<h2>${t('TaskFlow — test email')}</h2>` +
            `<p>${t('If you are reading this message, server-side email delivery works.')}</p>` +
            '</div>',
          provider: config?.provider,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(
          t('Sending failed: {reason}', {
            reason: payload?.error ?? `HTTP ${response.status}`,
          })
        );
        return;
      }

      toast.success(t('Test email sent to {address}', { address: testEmail.trim() }));
    } catch (e) {
      toast.error(t(e instanceof Error ? e.message : 'Network error'));
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
          <h2 className="text-2xl font-bold">{t('Email delivery')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('Delivery provider and test send')}
          </p>
        </div>
      </div>

      <Alert>
        <Info weight="fill" />
        {/* I nomi delle variabili passano come segnaposto invece di stare in
            <code> dentro la frase: cosi' ogni lingua resta una frase sola e
            puo' spostarli dove la sua sintassi li vuole. */}
        <AlertDescription>
          {t(
            'The API key and the sender address are configured on the server only, in the project environment variables ({keyVariables}, {fromVariable}).',
            { keyVariables: 'RESEND_API_KEY / SENDGRID_API_KEY', fromVariable: 'EMAIL_FROM' }
          )}{' '}
          {t(
            'Do not enter them here: they would be stored in clear text in the organisation database and loaded into the browser of anyone who opens the application.'
          )}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Preferred provider')}</CardTitle>
          <CardDescription>
            {t(
              'Used when the matching key is configured on the server; otherwise the available one is chosen automatically.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="provider">{t('Provider')}</Label>
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
                <SelectItem value="resend">{t('Resend')}</SelectItem>
                <SelectItem value="sendgrid">{t('SendGrid')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Test send')}</CardTitle>
          <CardDescription>
            {t(
              'The recipient must be a member of this organisation: the endpoint rejects external addresses, so that it cannot become a relay for the verified domain.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder={t('colleague@company.com')}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={testing}
            />
            <Button onClick={handleSendTestEmail} disabled={testing || !testEmail.trim()}>
              <PaperPlaneTilt className="mr-2 h-4 w-4" weight="fill" />
              {testing ? t('Sending…') : t('Send test')}
            </Button>
          </div>
          {/* Il grassetto su "manager" e' caduto: tenerlo avrebbe spezzato la
              frase in tre pezzi da tradurre separatamente, e in tedesco o
              francese quei pezzi non stanno nello stesso ordine. */}
          <p className="text-muted-foreground mt-3 text-sm">
            {t('You need the manager role or higher.')}{' '}
            {/* Il nome della sezione passa da t(): e' tradotto anche lui, e
                nella frase deve comparire come l'utente lo vede nel menu. */}
            {t('Actual delivery outcomes are shown in "{section}".', {
              section: t('Email Analytics'),
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
