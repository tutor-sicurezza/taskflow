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

  const [password, setPasswordValue] = useState('');
  const [conferma, setConferma] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrore(null);

    if (password.length < 8) {
      setErrore('La password deve contenere almeno 8 caratteri');
      return;
    }

    if (password !== conferma) {
      setErrore('Le due password non coincidono');
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
          <p className="text-muted-foreground text-sm">Scegli una nuova password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Nuova password</CardTitle>
            <CardDescription>
              Imposta la password che userai d'ora in poi per accedere.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {errore && (
                <Alert variant="destructive">
                  <Warning weight="fill" />
                  <AlertTitle>Operazione non riuscita</AlertTitle>
                  <AlertDescription>{errore}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="nuova-password">Nuova password</Label>
                <Input
                  id="nuova-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  disabled={salvando}
                />
                <p className="text-muted-foreground text-xs">Almeno 8 caratteri.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="conferma-password">Ripeti la password</Label>
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
                {salvando ? 'Salvataggio...' : 'Salva la nuova password'}
              </Button>

              <button
                type="button"
                onClick={() => { void signOut(); }}
                className="text-muted-foreground hover:text-foreground text-center text-sm underline underline-offset-4"
              >
                Annulla ed esci
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
