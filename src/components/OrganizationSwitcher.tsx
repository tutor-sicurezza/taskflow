import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Buildings, Plus } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { createOrganization } from '@/lib/orgMembers';
import { toast } from 'sonner';

/**
 * Selettore dell'organizzazione attiva, con creazione per gli amministratori.
 *
 * Dopo la chiusura dell'auto-creazione al primo accesso (che regalava uno
 * spazio di lavoro a chiunque si registrasse) non restava alcun modo di aprire
 * una seconda organizzazione se non scrivendo SQL a mano. E anche creandola,
 * l'applicazione ne caricava una qualsiasi, senza modo di scegliere.
 *
 * Il selettore compare solo quando c'e' davvero qualcosa fra cui scegliere:
 * con una sola organizzazione sarebbe un menu a una voce.
 */
export function OrganizationSwitcher() {
  const { organization, organizations, orgRole, switchOrganization } = useAuth();
  const [dialogAperto, setDialogAperto] = useState(false);
  const [nome, setNome] = useState('');
  const [creando, setCreando] = useState(false);

  const puoCreare = orgRole === 'owner' || orgRole === 'admin';
  const piuOrganizzazioni = organizations.length > 1;

  if (!organization || (!piuOrganizzazioni && !puoCreare)) return null;

  const handleCreate = async () => {
    setCreando(true);
    try {
      const creata = await createOrganization(nome);
      toast.success(`Organizzazione "${creata.name}" creata`);
      setNome('');
      setDialogAperto(false);
      // Ricarica: le appartenenze si rileggono all'avvio, e l'utente deve
      // poter passare subito alla nuova organizzazione.
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Creazione fallita');
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {piuOrganizzazioni && (
        <Select value={organization.id} onValueChange={switchOrganization}>
          <SelectTrigger className="w-[220px]" aria-label="Organizzazione attiva">
            <Buildings className="mr-2 h-4 w-4" weight="duotone" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {puoCreare && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogAperto(true)}
          title="Crea una nuova organizzazione"
          aria-label="Crea una nuova organizzazione"
        >
          <Plus className="h-4 w-4" weight="bold" />
        </Button>
      )}

      <Dialog open={dialogAperto} onOpenChange={setDialogAperto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova organizzazione</DialogTitle>
            <DialogDescription>
              Diventerai il proprietario del nuovo spazio di lavoro, che parte
              vuoto. I dati dell'organizzazione attuale non vengono toccati.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="nome-organizzazione">Nome</Label>
            <Input
              id="nome-organizzazione"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Sede di Milano"
              disabled={creando}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAperto(false)} disabled={creando}>
              Annulla
            </Button>
            <Button onClick={handleCreate} disabled={creando || !nome.trim()}>
              {creando ? 'Creazione...' : 'Crea organizzazione'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
