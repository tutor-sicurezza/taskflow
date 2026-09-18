import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkle, Copy, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  comandiInstallazione,
  comandoCli,
  frasePerMcp,
  promptPerTask,
} from '@/lib/promptClaude';
import type { Task } from '@/lib/types';

/**
 * «Esegui con Claude»: prepara il lavoro, non lo lancia.
 *
 * La differenza e' scritta anche a schermo, perche' il bottone promette un
 * verbo che una pagina web non puo' mantenere: **nessun sito puo' avviare un
 * programma sul computer di chi lo guarda**, ed e' una delle ragioni per cui
 * un browser si puo' usare senza paura. Far credere il contrario qui
 * significherebbe solo spostare la delusione di tre secondi piu' avanti.
 *
 * Quello che si puo' fare sono due cose, e ci sono entrambe:
 *
 *  - il **connettore MCP**, che e' la strada buona: Claude Desktop legge le
 *    attivita' da solo e ci riscrive sopra, senza che nessuno copi niente;
 *  - il **testo pronto**, per chi usa Claude nel browser o non ha ancora
 *    installato il connettore. Non e' un ripiego: per quelle persone e' la
 *    risposta completa.
 *
 * L'ordine delle schede e' questo e non l'opposto: chi arriva qui la prima
 * volta vuole fare la cosa adesso, non installare qualcosa.
 */

interface EseguiConClaudeProps {
  task: Task;
  /*
    Tutti i task, per distinguere i bloccanti ancora aperti da quelli gia'
    chiusi. Senza, l'avviso "aspetta che se ne chiudano altre N" contava anche
    i legami storici e diceva a Claude una cosa non vera.
  */
  tuttiITask?: Task[];
}

function Copiabile({
  etichetta,
  valore,
  monospazio = false,
}: {
  etichetta: string;
  valore: string;
  monospazio?: boolean;
}) {
  const { t } = useTranslation();
  const [copiato, setCopiato] = useState(false);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(valore);
      setCopiato(true);
      // Torna com'era: un segno di spunta permanente farebbe credere, al
      // secondo passaggio, di aver gia' copiato quando non e' vero.
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      // `clipboard` non c'e' senza HTTPS, e in un iframe puo' essere negata.
      // Si dice, invece di non fare niente in silenzio: il testo resta
      // selezionabile a mano.
      toast.error(t('Could not copy. Select the text and copy it manually.'));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{etichetta}</span>
        <Button size="sm" variant="outline" onClick={copia}>
          {copiato ? (
            <Check className="mr-2 h-4 w-4" weight="bold" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copiato ? t('Copied') : t('Copy')}
        </Button>
      </div>
      <pre
        className={`max-h-64 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap ${
          monospazio ? 'font-mono' : ''
        }`}
      >
        {valore}
      </pre>
    </div>
  );
}

export function EseguiConClaude({ task, tuttiITask }: EseguiConClaudeProps) {
  /*
    L'organizzazione si prende da qui, non da una prop.

    Era una prop, e nessuno gliela passava: la riga "Organization:" nel testo
    non e' mai comparsa a nessuno. Presa dal contesto non si puo' dimenticare
    di passarla, che e' esattamente il modo in cui era andata persa.

    `organizations` serve per sapere se indicarla nel comando: conta solo per
    chi ne ha piu' di una. Vedi `comandoCli`.
  */
  const { organization, organizations } = useAuth();
  const organizzazione = organization?.name ?? null;
  /*
    Nel COMANDO va l'identificativo, non il nome: i nomi non sono unici (solo
    lo slug lo e') e soprattutto li scrive chi amministra l'organizzazione,
    quindi non sono un testo che si possa incollare dentro qualcosa da
    eseguire. Vedi `comandoCli`. Il nome resta nel testo per Claude, dove non
    viene eseguito niente.
  */
  const idOrganizzazione = organization?.id ?? null;
  const piuOrganizzazioni = (organizations?.length ?? 0) > 1;
  const { t } = useTranslation();
  const [aperto, setAperto] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAperto(true)}>
        <Sparkle className="mr-2 h-4 w-4" weight="fill" />
        {t('Work on this with Claude')}
      </Button>

      <Dialog open={aperto} onOpenChange={setAperto}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t('Work on this with Claude')}</DialogTitle>
            <DialogDescription>
              {t(
                'This page prepares the work; it cannot start a program on your computer. Pick how you want to hand it over.'
              )}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="testo">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="testo">{t('Ready-made prompt')}</TabsTrigger>
              <TabsTrigger value="connettore">{t('Connector (MCP)')}</TabsTrigger>
            </TabsList>

            <TabsContent value="testo" className="space-y-4 pt-4">
              <Copiabile
                etichetta={t('Paste this into Claude')}
                valore={promptPerTask(task, { organizzazione, t, tuttiITask })}
              />
              <Copiabile
                etichetta={t('And when you are done, from the terminal')}
                valore={comandoCli(
                  task,
                  'completata',
                  piuOrganizzazioni ? idOrganizzazione : null
                )}
                monospazio
              />
              <p className="text-xs text-muted-foreground">
                {t('Comments are deliberately left out: they may name colleagues.')}
              </p>
            </TabsContent>

            <TabsContent value="connettore" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                {t(
                  'With the connector installed, Claude Desktop reads your tasks and writes back the result. It acts with your own permissions: it cannot do anything you could not do here.'
                )}
              </p>
              <Copiabile
                etichetta={t('Install once, from the repository')}
                valore={comandiInstallazione(
                  piuOrganizzazioni ? idOrganizzazione : null
                )}
                monospazio
              />
              <Copiabile
                etichetta={t('Then just ask Claude')}
                valore={frasePerMcp(task, t)}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
