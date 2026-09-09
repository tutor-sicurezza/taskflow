import { describe, it, expect } from 'vitest';
import { newId } from '@/lib/utils';

/**
 * Identificatori delle entita' create nell'interfaccia.
 *
 * Prima venivano generati con `Date.now().toString()`. Non e' un difetto
 * teorico: durante il collaudo sono comparsi due task con lo STESSO id nello
 * stesso elenco, perche' creati nello stesso millisecondo — e da quel momento
 * erano indistinguibili, con modifica, eliminazione e cambio di stato che
 * agivano su entrambi.
 *
 * Il test riproduce proprio quella condizione: molte generazioni consecutive,
 * senza attese.
 */
describe('newId', () => {
  it('non produce collisioni nemmeno generando in serie stretta', () => {
    const quanti = 5000;
    const generati = new Set<string>();

    for (let i = 0; i < quanti; i++) generati.add(newId());

    expect(generati.size).toBe(quanti);
  });

  it('applica il prefisso quando richiesto, mantenendo l\'unicita\'', () => {
    const a = newId('activity');
    const b = newId('activity');

    expect(a.startsWith('activity-')).toBe(true);
    expect(b.startsWith('activity-')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('senza prefisso restituisce un identificatore nudo', () => {
    expect(newId()).not.toContain('undefined-');
  });

  it('resta unico anche quando crypto.randomUUID non e disponibile', () => {
    // Contesti non sicuri (http su rete locale) non espongono randomUUID: il
    // ripiego non deve reintrodurre le collisioni che si stanno evitando.
    const originale = globalThis.crypto.randomUUID;
    // @ts-expect-error rimozione volontaria per esercitare il ripiego
    globalThis.crypto.randomUUID = undefined;

    try {
      const generati = new Set<string>();
      for (let i = 0; i < 2000; i++) generati.add(newId());
      expect(generati.size).toBe(2000);
    } finally {
      globalThis.crypto.randomUUID = originale;
    }
  });
});
