import { useState, type FormEvent } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Warning } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';

/**
 * Schermata di reimpostazione, mostrata quando si arriva dal link di recupero.
 *
 * Supabase apre quel link come una sessione a tutti gli effetti: senza questa
 * schermata l'utente entrerebbe direttamente nell'applicazione senza che gli
 * venga mai chiesta una nuova password, e il link ricevuto per email
 * diventerebbe di fatto una credenziale permanente.
 */
export function SetNewPasswordScreen() {
  const { setPassword, signOut } = useAuth();
  const { t } = useTranslation();

  const [password, setPasswordValue] = useState('');
  const [conferma, setConferma] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrore(null);

    if (password.length < 8) {
      setErrore(t('password.troppoCorta'));
      return;
    }

    if (password !== conferma) {
      setErrore(t('password.nonCoincidono'));
      return;
    }

    setSalvando(true);
    try {
      const result = await setPassword(password);
      if (result.error) setErrore(result.error);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">TaskFlow</h1>
          <p className="text-muted-foreground text-sm">{t('password.sottotitolo')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('password.titolo')}</CardTitle>
            <CardDescription>
              {t('password.descrizione')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {errore && (
                <Alert variant="destructive">
                  <Warning weight="fill" />
                  <AlertTitle>{t('login.operazioneFallita')}</AlertTitle>
                  <AlertDescription>{errore}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="nuova-password">{t('password.nuova')}</Label>
                <Input
                  id="nuova-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  disabled={salvando}
                />
                <p className="text-muted-foreground text-xs">{t('password.minimo')}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="conferma-password">{t('password.ripeti')}</Label>
                <Input
                  id="conferma-password"
                  type="password"
                  autoComplete="new-password"
                  value={conferma}
                  onChange={(e) => setConferma(e.target.value)}
                  disabled={salvando}
                />
              </div>

              <Button type="submit" className="w-full" disabled={salvando}>
                {salvando ? t('password.salvataggio') : t('password.salva')}
              </Button>

              <button
                type="button"
                onClick={() => { void signOut(); }}
                className="text-muted-foreground hover:text-foreground text-center text-sm underline underline-offset-4"
              >
                {t('password.annullaEsci')}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
