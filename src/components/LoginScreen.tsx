import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Warning } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';

interface FieldErrors {
  email?: string;
  password?: string;
}

/**
 * Solo accesso: la registrazione autonoma non esiste piu' nemmeno come codice.
 *
 * Prima il percorso di iscrizione era soltanto nascosto (il link "Registrati"
 * era stato rimosso, ma `signUp` restava cablato). Gli account li crea
 * l'amministratore da "Manage Users", che passa da
 * POST /api/tenants/<id>/members.
 */
export function LoginScreen() {
  const { signIn, requestPasswordReset, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /**
   * Recupero password. Non esisteva alcun percorso: chi dimenticava la
   * password restava fuori definitivamente, perche' non c'era ne' un link di
   * reimpostazione ne' un modo per l'amministratore di assegnarne una nuova.
   */
  const [recuperoInviato, setRecuperoInviato] = useState(false);
  const [inviandoRecupero, setInviandoRecupero] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!email.trim()) {
      errors.email = "L'email è obbligatoria";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Inserisci un indirizzo email valido';
    }

    if (!password) {
      errors.password = 'La password è obbligatoria';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await signIn(email.trim(), password);
      if (result.error) {
        setFormError(result.error);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Si è verificato un errore imprevisto');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setFieldErrors({ email: "Inserisci la tua email, poi richiedi il ripristino" });
      return;
    }

    setInviandoRecupero(true);
    setFormError(null);
    try {
      const result = await requestPasswordReset(email.trim());
      if (result.error) {
        setFormError(result.error);
        return;
      }
      // Messaggio identico che l'indirizzo esista o no: dire "questa email non
      // esiste" permetterebbe a chiunque di scoprire chi ha un account.
      setRecuperoInviato(true);
    } finally {
      setInviandoRecupero(false);
    }
  };

  const visibleError = formError ?? error;

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">TaskFlow</h1>
          <p className="text-muted-foreground text-sm">
            Gestisci il lavoro del tuo team
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Accedi</CardTitle>
            <CardDescription>
              Inserisci le tue credenziali per continuare.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {visibleError && (
                <Alert variant="destructive">
                  <Warning weight="fill" />
                  <AlertTitle>Operazione non riuscita</AlertTitle>
                  <AlertDescription>{visibleError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@azienda.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  disabled={submitting}
                />
                {fieldErrors.email && (
                  <p className="text-destructive text-sm">{fieldErrors.email}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  disabled={submitting}
                />
                {fieldErrors.password && (
                  <p className="text-destructive text-sm">{fieldErrors.password}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Accesso in corso...' : 'Accedi'}
              </Button>

              {recuperoInviato ? (
                <p className="text-muted-foreground text-center text-sm">
                  Se l'indirizzo corrisponde a un account, riceverai un link per
                  reimpostare la password. Controlla anche lo spam.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={inviandoRecupero || submitting}
                  className="text-muted-foreground hover:text-foreground text-center text-sm underline underline-offset-4"
                >
                  {inviandoRecupero ? 'Invio in corso...' : 'Password dimenticata?'}
                </button>
              )}
            </form>
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-muted-foreground text-center text-sm">
              Gli account sono creati dall'amministratore.
              <br />
              Se non riesci ad accedere, contattalo.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
