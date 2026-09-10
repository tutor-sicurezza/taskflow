import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/contexts/LanguageContext';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect, useRef } from 'react';
import { Clock, Circle, CircleHalf, CheckCircle, ChatCircle, ClockCounterClockwise, User, Calendar, Flag, FileText, ArrowsLeftRight, PaperPlaneTilt, File, FilePdf, FileImage, FileDoc, UploadSimple, DownloadSimple, Trash, Paperclip, PencilSimple, X, ShieldCheck, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { StatoApprovazione } from '@/components/StatoApprovazione';
import { AzioniApprovazione } from '@/components/AzioniApprovazione';
import { StatoBlocco } from '@/components/StatoBlocco';
import { ElencoSottoattivita } from '@/components/ElencoSottoattivita';
import { sottoattivitaValide } from '@/lib/sottoattivita';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Task, Employee, TaskActivity, TaskAttachment, Sottoattivita } from '@/lib/types';
import { cn } from '@/lib/utils';
import { tempoRelativo } from '@/lib/tempoRelativo';
import { Sanitizer } from '@/lib/sanitization';
import { candidatiMenzione, completaMenzione, menzioneInCorso } from '@/lib/menzioni';
import { toast } from 'sonner';
import { eInRitardo, scadenzaFormattata } from '@/lib/scadenze';

/**
 * Stato e priorita' sono salvati nel registro attivita' come valori grezzi
 * ('in-progress', 'high'): qui tornano a essere la chiave inglese che i
 * dizionari conoscono, invece di finire a schermo cosi' come sono.
 */
/*
  I valori arrivano dalla cronologia salvata, dove sono scritti con lo SPAZIO:
  chi registra l'attivita' fa `status.replace('-', ' ')` prima di scriverli.
  Con le sole chiavi col trattino la mappa mancava due stati su tre, e la
  cronologia diceva "da not started a Completato" — meta' tradotta e meta' no.
  Ci sono entrambe le forme perche' nel database esistono righe vecchie di
  tutte e due i tipi, e nessuna delle due si puo' riscrivere all'indietro.
*/
const ETICHETTA_STATO: Record<string, string> = {
  'completed': 'Completed',
  'in-progress': 'In Progress',
  'in progress': 'In Progress',
  'not-started': 'Not Started',
  'not started': 'Not Started',
  'blocked': 'Blocked',
};

const ETICHETTA_PRIORITA: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface TaskDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  employees: Employee[];
  currentUser: { id: string; name: string; avatar: string } | null;
  /*
    L'utente COMPLETO, non la sua versione ridotta: per decidere chi puo'
    approvare servono i permessi, e `currentUser` qui porta solo nome e
    avatar per firmare i commenti.
  */
  currentEmployee?: Employee | null;
  onApprovaTask?: (task: Task) => void;
  /** Tutti i task: servono a dire CHI blocca questo, non solo che e' bloccato. */
  tuttiITask?: Task[];
  onAggiornaSottoattivita?: (taskId: string, passi: Sottoattivita[]) => void;
  onApriTask?: (taskId: string) => void;
  onRifiutaTask?: (task: Task, motivo: string) => void;
  onAddComment: (taskId: string, content: string) => void;
  onEditComment?: (taskId: string, commentId: string, content: string) => void;
  onDeleteComment?: (taskId: string, commentId: string) => void;
  onAddAttachment: (taskId: string, file: File) => void;
  onDeleteAttachment: (taskId: string, attachmentId: string) => void;
}

export function TaskDetailsDialog({ 
  open, 
  onOpenChange, 
  task, 
  employees, 
  currentUser, 
  currentEmployee = null,
  onApprovaTask,
  onRifiutaTask,
  tuttiITask = [],
  onAggiornaSottoattivita,
  onApriTask,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onAddAttachment,
  onDeleteAttachment 
}: TaskDetailsDialogProps) {
  const { t, lingua } = useTranslation();
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState('comments');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Il parziale digitato dopo la `@`: e' null quando l'utente non sta
  // scrivendo una menzione, ed e' quel null a decidere se l'elenco puo'
  // intercettare i tasti oppure no.
  const [parzialeMenzione, setParzialeMenzione] = useState<string | null>(null);
  const [indiceCandidato, setIndiceCandidato] = useState(0);
  // Dopo aver riscritto il testo il cursore va rimesso a mano dietro la
  // menzione: React lo spedirebbe altrimenti in fondo al textarea.
  const cursoreDaRipristinare = useRef<number | null>(null);
  // Rimettere il cursore a mano scatena un evento `select`: senza questo
  // flag l'elenco si riaprirebbe subito sulla menzione appena completata.
  const ignoraProssimaSelezione = useRef(false);

  const candidati =
    parzialeMenzione === null ? [] : candidatiMenzione(parzialeMenzione, employees);
  const elencoAperto = candidati.length > 0;

  useEffect(() => {
    if (!open) {
      setCommentText('');
      setActiveTab('comments');
      setEditingCommentId(null);
      setEditingCommentText('');
      setParzialeMenzione(null);
    }
  }, [open]);

  useEffect(() => {
    const posizione = cursoreDaRipristinare.current;
    if (posizione === null || !commentRef.current) return;
    cursoreDaRipristinare.current = null;
    ignoraProssimaSelezione.current = true;
    commentRef.current.focus();
    commentRef.current.setSelectionRange(posizione, posizione);
  }, [commentText]);

  if (!task) return null;

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    const sanitizedComment = Sanitizer.comment(commentText);
    if (!sanitizedComment) return;
    onAddComment(task.id, sanitizedComment);
    setCommentText('');
    setParzialeMenzione(null);
  };

  // Lo stato della menzione si ricalcola a ogni movimento del cursore, non
  // solo quando il testo cambia: spostarsi con le frecce dentro una `@` gia'
  // scritta deve riaprire l'elenco, uscirne deve chiuderlo.
  const aggiornaMenzioneInCorso = (testo: string, cursore: number | null) => {
    const inCorso = cursore === null ? null : menzioneInCorso(testo, cursore);
    setParzialeMenzione(inCorso ? inCorso.parziale : null);
    setIndiceCandidato(0);
  };

  const scegliMenzione = (scelto: Employee) => {
    const cursore = commentRef.current?.selectionStart ?? commentText.length;
    const esito = completaMenzione(commentText, cursore, scelto);
    setCommentText(esito.testo);
    cursoreDaRipristinare.current = esito.nuovaPosizione;
    setParzialeMenzione(null);
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Finche' l'elenco e' chiuso il textarea deve comportarsi esattamente
    // come prima: Invio va a capo, Cmd/Ctrl+Invio pubblica.
    if (elencoAperto) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndiceCandidato((i) => (i + 1) % candidati.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndiceCandidato((i) => (i - 1 + candidati.length) % candidati.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        // Cmd/Ctrl+Invio resta la scorciatoia per pubblicare anche mentre si
        // scrive una menzione: chi la usa vuole inviare, non completare.
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          handleAddComment();
          return;
        }
        e.preventDefault();
        scegliMenzione(candidati[indiceCandidato]);
        return;
      }
      if (e.key === 'Escape') {
        // Fermato qui, altrimenti l'Esc chiuderebbe l'intera finestra.
        e.preventDefault();
        e.stopPropagation();
        setParzialeMenzione(null);
        return;
      }
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const handleEditComment = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(currentContent);
  };

  const handleSaveEdit = () => {
    if (!editingCommentId || !editingCommentText.trim() || !onEditComment) return;
    const sanitizedComment = Sanitizer.comment(editingCommentText);
    if (!sanitizedComment) return;
    onEditComment(task.id, editingCommentId, sanitizedComment);
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleDeleteComment = (commentId: string) => {
    if (!onDeleteComment) return;
    if (confirm(t('Are you sure you want to delete this comment?'))) {
      onDeleteComment(task.id, commentId);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddAttachment(task.id, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadAttachment = (attachment: TaskAttachment) => {
    // `fileData` arriva dal jsonb `tasks.attachments`, che autore,
    // assegnatario e manager possono riscrivere con una PATCH diretta a
    // PostgREST. Metterlo alla lettera in `href` significava che un
    // `javascript:...` veniva eseguito nella sessione di chi apriva
    // l'allegato: `download` non lo impedisce, il browser lo ignora per
    // `javascript:` e per `data:text/html`. Quindi si scarica solo cio' che
    // passa la whitelist, e il rifiuto e' visibile invece che silenzioso.
    const fileData = Sanitizer.attachmentDataURL(attachment.fileData);
    if (!fileData) {
      toast.error(t('This attachment was blocked because its format is not allowed'));
      return;
    }

    const link = document.createElement('a');
    link.href = fileData;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return FilePdf;
    if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) return FileImage;
    if (fileType.includes('doc')) return FileDoc;
    return File;
  };

  const assignee = task.assigneeId ? employees.find(e => e.id === task.assigneeId) : null;
  const isOverdue = eInRitardo(task);

  const priorityColors = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    low: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  };

  const StatusIcon = task.status === 'completed' ? CheckCircle : task.status === 'in-progress' ? CircleHalf : Circle;

  const getActivityIcon = (type: TaskActivity['type']) => {
    switch (type) {
      case 'created':
        return CheckCircle;
      case 'status_changed':
        return ArrowsLeftRight;
      case 'assignee_changed':
        return User;
      case 'due_date_changed':
        return Calendar;
      case 'priority_changed':
        return Flag;
      case 'title_changed':
      case 'description_changed':
        return FileText;
      case 'comment_added':
        return ChatCircle;
      case 'attachment_added':
        return Paperclip;
      case 'attachment_removed':
        return Trash;
      case 'approved':
        return ShieldCheck;
      case 'approval_rejected':
        return ArrowCounterClockwise;
      default:
        return ClockCounterClockwise;
    }
  };

  const stato = (valore?: string) => t(ETICHETTA_STATO[valore ?? ''] ?? valore ?? '');
  const priorita = (valore?: string) => t(ETICHETTA_PRIORITA[valore ?? ''] ?? valore ?? '');

  const getActivityMessage = (activity: TaskActivity) => {
    switch (activity.type) {
      case 'created':
        return t('created this task');
      case 'status_changed':
        return t('changed status from {old} to {new}', {
          old: stato(activity.oldValue),
          new: stato(activity.newValue),
        });
      case 'assignee_changed':
        return activity.oldValue
          ? t('reassigned from {old} to {new}', {
              old: activity.oldValue,
              new: activity.newValue || t('Unassigned'),
            })
          : t('assigned to {name}', { name: activity.newValue ?? '' });
      case 'due_date_changed':
        return t('changed due date from {old} to {new}', {
          old: activity.oldValue ?? '',
          new: activity.newValue ?? '',
        });
      case 'priority_changed':
        return t('changed priority from {old} to {new}', {
          old: priorita(activity.oldValue),
          new: priorita(activity.newValue),
        });
      case 'title_changed':
        return t('updated the title');
      case 'description_changed':
        return t('updated the description');
      case 'comment_added':
        return t('added a comment');
      case 'attachment_added':
        return t('attached {file}', { file: activity.details ?? '' });
      case 'attachment_removed':
        return t('removed attachment {file}', { file: activity.details ?? '' });
      case 'approved':
        return t('approved this task');
      case 'approval_rejected':
        return activity.details
          ? t('sent it back for changes: {reason}', { reason: activity.details })
          : t('sent it back for changes');
      default:
        return activity.details || t('made a change');
    }
  };

  const comments = task.comments || [];
  const activities = task.activities || [];
  const attachments = task.attachments || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{task.title}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={cn('text-xs', priorityColors[task.priority])}>
                  {task.priority.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <StatusIcon weight="fill" className="w-3 h-3" />
                  {task.status.replace('-', ' ').toUpperCase()}
                </Badge>
                <StatoApprovazione task={task} employees={employees} mostraRequisito />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock weight="bold" className="w-3.5 h-3.5" />
                  <span className={cn(isOverdue && 'text-destructive font-medium')}>
                    {scadenzaFormattata(task, lingua) ?? t('No due date')}
                  </span>
                </div>
              </div>
            </div>
            {assignee && (
              <Avatar className="w-12 h-12">
                <AvatarImage src={assignee.avatar} alt={assignee.name} />
                <AvatarFallback>{assignee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {task.description}
          </div>

          {/*
            Perche' questo lavoro e' fermo. Sta in alto, sotto il titolo: e' la
            prima cosa che si va a cercare aprendo un task che non si muove.
          */}
          <StatoBlocco
            task={task}
            tuttiITask={tuttiITask}
            onApri={onApriTask ? (bloccante) => onApriTask(bloccante.id) : undefined}
            className="mt-4"
          />

          {/*
            Si mostra da solo a chi puo' agire: e' il componente a chiedere alle
            regole, non questo dialogo a indovinare con un `&&`.
          */}
          {onApprovaTask && onRifiutaTask && (
            <AzioniApprovazione
              task={task}
              currentUser={currentEmployee}
              employees={employees}
              onApprova={onApprovaTask}
              onRifiuta={onRifiutaTask}
              className="mt-4"
            />
          )}
        </DialogHeader>

        {/*
          I passi stanno FUORI dalle schede a linguetta e prima di esse: si
          spuntano mentre si lavora, e nasconderli dietro una linguetta
          significherebbe che nessuno li spunta.
        */}
        {/*
          Anche quando l'elenco e' VUOTO.

          Con la condizione sulla lunghezza, un task creato senza passi non
          mostrava mai il campo per aggiungerne: il primo passo era
          impossibile da inserire per il resto della vita del task. Un elenco
          vuoto qui non e' rumore, e' l'unico modo di cominciare.
        */}
        {onAggiornaSottoattivita && (
          <div className="px-6 pb-4">
            <ElencoSottoattivita
              /*
                Non `task.subtasks` grezzo: e' JSONB, quindi cio' che torna dal
                database non e' garantito essere cio' che ci abbiamo scritto.
                `sottoattivitaValide` e' la porta d'ingresso e non lancia mai.
              */
              value={sottoattivitaValide(task.subtasks)}
              onChange={(passi) => onAggiornaSottoattivita(task.id, passi)}
              currentUserId={currentUser?.id ?? null}
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 w-auto">
            <TabsTrigger value="comments">{t('Comments ({count})', { count: comments.length })}</TabsTrigger>
            <TabsTrigger value="attachments">{t('Attachments ({count})', { count: attachments.length })}</TabsTrigger>
            <TabsTrigger value="activity">{t('Activity ({count})', { count: activities.length })}</TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="flex-1 overflow-hidden mt-4 px-6 flex flex-col">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 pb-6">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ChatCircle className="w-12 h-12 mx-auto mb-2 opacity-50" weight="light" />
                    <p className="text-sm">{t('No comments yet')}</p>
                  </div>
                ) : (
                  comments.map((comment) => {
                    const isEditing = editingCommentId === comment.id;
                    const isOwnComment = currentUser && comment.userId === currentUser.id;
                    
                    return (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={comment.userAvatar} alt={comment.userName} />
                          <AvatarFallback className="text-xs">{comment.userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="bg-muted rounded-lg p-3">
                              <Textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="min-h-[80px] resize-none mb-2"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  disabled={!editingCommentText.trim()}
                                >{t('Save')}</Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="w-4 h-4 mr-1" weight="bold" />{t('Cancel')}</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-muted rounded-lg p-3 group">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{comment.userName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {tempoRelativo(comment.createdAt, lingua)}
                                  </span>
                                </div>
                                {isOwnComment && onEditComment && onDeleteComment && (
                                  // Su schermo piccolo non esiste il passaggio
                                  // del mouse: nascondere i comandi dietro
                                  // `group-hover` li rendeva irraggiungibili da
                                  // telefono. Restano quindi visibili sotto
                                  // `sm`, e da tastiera `focus-within` li mostra
                                  // invece di farli premere al buio.
                                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      // 24px non basta come area toccabile.
                                      className="h-8 w-8"
                                      aria-label={t('Edit comment')}
                                      onClick={() => handleEditComment(comment.id, comment.content)}
                                    >
                                      <PencilSimple className="w-3.5 h-3.5" weight="bold" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      aria-label={t('Delete comment')}
                                      onClick={() => handleDeleteComment(comment.id)}
                                    >
                                      <Trash className="w-3.5 h-3.5" weight="bold" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {currentUser && (
              <div className="pt-4 pb-6 flex-shrink-0">
                <div className="flex gap-2">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    <AvatarFallback className="text-xs">{currentUser.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 relative">
                      {elencoAperto && (
                        <ul
                          role="listbox"
                          aria-label={t('Mention a teammate')}
                          className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-52 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
                        >
                          {candidati.map((persona, indice) => (
                            <li
                              key={persona.id}
                              role="option"
                              aria-selected={indice === indiceCandidato}
                              className={cn(
                                'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer',
                                indice === indiceCandidato
                                  ? 'bg-accent text-accent-foreground'
                                  : 'hover:bg-accent/50'
                              )}
                              // onMouseDown e non onClick: il click toglierebbe
                              // il fuoco al textarea prima di poter leggere la
                              // posizione del cursore.
                              onMouseDown={(e) => {
                                e.preventDefault();
                                scegliMenzione(persona);
                              }}
                              onMouseEnter={() => setIndiceCandidato(indice)}
                            >
                              <Avatar className="w-6 h-6 flex-shrink-0">
                                <AvatarImage src={persona.avatar} alt={persona.name} />
                                <AvatarFallback className="text-[10px]">
                                  {persona.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium truncate">{persona.name}</span>
                              {persona.email && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {persona.email}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Textarea
                        ref={commentRef}
                        placeholder={t('Add a comment...')}
                        value={commentText}
                        onChange={(e) => {
                          ignoraProssimaSelezione.current = false;
                          setCommentText(e.target.value);
                          aggiornaMenzioneInCorso(e.target.value, e.target.selectionStart);
                        }}
                        onSelect={(e) => {
                          if (ignoraProssimaSelezione.current) {
                            ignoraProssimaSelezione.current = false;
                            return;
                          }
                          const campo = e.currentTarget;
                          aggiornaMenzioneInCorso(campo.value, campo.selectionStart);
                        }}
                        onBlur={() => setParzialeMenzione(null)}
                        className="min-h-[80px] resize-none w-full"
                        aria-autocomplete="list"
                        aria-expanded={elencoAperto}
                        onKeyDown={handleCommentKeyDown}
                      />
                    </div>
                    <Button
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      size="icon"
                      className="flex-shrink-0"
                      aria-label={t('Post comment')}
                    >
                      <PaperPlaneTilt className="w-4 h-4" weight="bold" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 ml-10">
                  {elencoAperto
                    ? t('Use the arrow keys to choose, Enter to confirm, Esc to close')
                    : t('Press Cmd+Enter to post. Type @ to mention a teammate')}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="attachments" className="flex-1 overflow-hidden mt-4 px-6 flex flex-col">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3 pb-6">
                {attachments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Paperclip className="w-12 h-12 mx-auto mb-2 opacity-50" weight="light" />
                    <p className="text-sm">{t('No attachments yet')}</p>
                  </div>
                ) : (
                  attachments.map((attachment) => {
                    const FileIcon = getFileIcon(attachment.fileType);
                    return (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="flex-shrink-0 w-10 h-10 bg-background rounded flex items-center justify-center">
                          <FileIcon className="w-5 h-5 text-muted-foreground" weight="bold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{attachment.fileName}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{formatFileSize(attachment.fileSize)}</span>
                            <span>•</span>
                            <span>{t('by {name}', { name: attachment.uploadedByName })}</span>
                            <span>•</span>
                            <span>{tempoRelativo(attachment.uploadedAt, lingua)}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t('Download attachment')}
                            onClick={() => handleDownloadAttachment(attachment)}
                          >
                            <DownloadSimple className="w-4 h-4" weight="bold" />
                          </Button>
                          {currentUser && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={t('Delete attachment')}
                              onClick={() => onDeleteAttachment(task.id, attachment.id)}
                            >
                              <Trash className="w-4 h-4" weight="bold" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            {currentUser && (
              <div className="pt-4 pb-6 flex-shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <UploadSimple className="mr-2 h-4 w-4" weight="bold" />{t('Upload Attachment')}</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-hidden mt-4 px-6">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3 pb-6">
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClockCounterClockwise className="w-12 h-12 mx-auto mb-2 opacity-50" weight="light" />
                    <p className="text-sm">{t('No activity yet')}</p>
                  </div>
                ) : (
                  activities.map((activity) => {
                    const ActivityIcon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <ActivityIcon className="w-4 h-4 text-muted-foreground" weight="bold" />
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="text-sm">
                            <span className="font-medium">{activity.userName}</span>
                            {' '}
                            <span className="text-muted-foreground">{getActivityMessage(activity)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {tempoRelativo(activity.createdAt, lingua)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
