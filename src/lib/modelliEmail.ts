/**
 * I modelli email predefiniti, per l'interfaccia.
 *
 * Il generatore vero sta in `api/_lib/`, non qui, perche' lo usa anche la rotta
 * di invio: il server deve poter comporre esattamente lo stesso messaggio che
 * l'utente vede nell'editor. Tenerne due copie avrebbe significato che
 * l'anteprima e l'email spedita potevano divergere senza che nessuno se ne
 * accorgesse.
 *
 * Questo file resta come punto d'ingresso per `src`, cosi' i componenti non
 * risalgono a mano fuori dalla loro cartella.
 */
export {
  modelliPredefiniti,
  modelloPredefinito,
  tipiNotifica,
  type LinguaModello,
  type ModelloGenerato,
  type TipoNotifica,
} from '../../api/_lib/modelliEmail';
