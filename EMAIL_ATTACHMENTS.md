# Email Attachment Support — FUNZIONALITÀ RIMOSSA

> **Questo documento non descrive più niente che esista.**
>
> Fino al 17 settembre 2026 conteneva 300 righe che spiegavano come usare tre
> moduli e sei funzioni. Nessuno dei due esiste più:
>
> | Citato nel vecchio documento | Esiste oggi? |
> | --- | --- |
> | `src/lib/emailAttachments.ts` | **no** |
> | `@/lib/emailNotifications` | **no** |
> | `sendTaskNotificationEmail` | **no** |
> | `getEmailConfig`, `getEmailAttachmentSettings` | **no** |
> | `convertTaskAttachmentsToEmailAttachments` | **no** |
> | `filterAttachmentsForEmail`, `getAttachmentSummary` | **no** |
>
> È stato riscritto invece che cancellato perché la sua sparizione silenziosa è
> essa stessa un fatto da registrare.

## Cosa è successo

Il percorso email lato client è stato rifatto: oggi esiste solo
`src/lib/taskEmail.ts`, che chiama `/api/email/send`. È esattamente ciò che la
vecchia avvertenza in testa a questo file chiedeva di fare.

Ma il rifacimento ha chiuso il difetto **togliendo la funzionalità**: gli
allegati non vengono più spediti affatto.

```
$ grep -n "attachment\|allegat" api/email/send.ts api/_lib/invio.ts
(nessun risultato)
```

Gli allegati non entrano mai in un'email. Nessun documento lo diceva, e
`PRD.md:143` li elenca ancora fra le *Essential Features* con criteri di
successo dettagliati — un requisito abbandonato che nessuno ha segnato come
tale.

## Cosa esiste davvero, oggi

- Gli allegati si caricano su un'attività e restano lì: fino a 10 MB per file,
  in base64 nella colonna `attachments` di `tasks` (`src/App.tsx:1447`).
- Le email di notifica partono da `api/email/send.ts` con Resend (o SendGrid),
  e **contengono solo testo e un collegamento all'attività**.
- Chi apre quel collegamento vede gli allegati nell'applicazione.

## Se un giorno si volesse rifarla

Le cose da sapere prima di cominciare, che il vecchio documento non diceva:

1. **La dimensione.** Un allegato da 10 MB diventa ~13,3 MB in base64. Resend
   ha un limite per messaggio ben più basso, e la riga del task li porta già
   tutti insieme.
2. **Il costo di rileggerli.** `useTasks` di proposito non nomina mai
   `attachments` quando non li ha letti, per non cancellarli; un invio dal
   server dovrebbe rileggerli, e sono la parte pesante della tabella.
3. **La sede giusta è il server.** Non il client: `api/_lib/invio.ts` è l'unico
   punto che sa quale provider è configurato e che registra gli esiti in
   `email_delivery_logs`.
