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
import { useTranslation } from '@/contexts/LanguageContext';
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
  const { t } = useTranslation();
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
      toast.success(t('org.creata', { nome: creata.name }));
      setNome('');
      setDialogAperto(false);
      // Ricarica: le appartenenze si rileggono all'avvio, e l'utente deve
      // poter passare subito alla nuova organizzazione.
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('org.creazioneFallita'));
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {piuOrganizzazioni && (
        <Select value={organization.id} onValueChange={switchOrganization}>
          <SelectTrigger className="w-[220px]" aria-label={t('org.attiva')}>
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
          title={t('org.creaNuova')}
          aria-label={t('org.creaNuova')}
        >
          <Plus className="h-4 w-4" weight="bold" />
        </Button>
      )}

      <Dialog open={dialogAperto} onOpenChange={setDialogAperto}>
        {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
            tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
            la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
            non scorre perche' l'elemento e' fuori dal flusso. */}
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('org.nuovaTitolo')}</DialogTitle>
            <DialogDescription>{t('org.nuovaDescrizione')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="nome-organizzazione">{t('org.nome')}</Label>
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
              {t('comune.annulla')}
            </Button>
            <Button onClick={handleCreate} disabled={creando || !nome.trim()}>
              {creando ? t('org.creazione') : t('org.crea')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
