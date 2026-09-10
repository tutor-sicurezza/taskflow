import { describe, it, expect } from 'vitest';
import {
  trovaMenzioni,
  candidatiMenzione,
  menzioneInCorso,
  completaMenzione,
} from '@/lib/menzioni';
import type { Employee } from '@/lib/types';

/**
 * Il rilevamento delle menzioni non e' un banale match di regex: i nomi
 * contengono spazi, il testo contiene indirizzi email, e due colleghi possono
 * avere un nome prefisso dell'altro. Questi test fissano esattamente quei
 * confini, che sono la ragione per cui il modulo cerca i nomi reali invece di
 * provare a interpretare il testo.
 */

function persona(id: string, name: string, email?: string): Employee {
  return {
    id,
    name,
    avatar: '',
    role: 'Developer',
    email,
    status: 'active',
    joinedDate: '2024-01-01',
  };
}

const team: Employee[] = [
  persona('1', 'Marco Bianchi', 'marco.bianchi@azienda.it'),
  persona('2', 'Marco', 'marco@azienda.it'),
  persona('3', 'Anna Rossi', 'anna.rossi@azienda.it'),
  persona('4', 'Mario', 'mario@azienda.it'),
];

describe('trovaMenzioni', () => {
  it('riconosce un nome che contiene uno spazio', () => {
    expect(trovaMenzioni('ciao @Anna Rossi puoi guardare?', team)).toEqual(['3']);
  });

  it('riconosce due menzioni nello stesso commento', () => {
    const ids = trovaMenzioni('@Anna Rossi e @Marco Bianchi ci pensate voi', team);
    expect(ids.sort()).toEqual(['1', '3']);
  });

  it('restituisce un solo id se la stessa persona e\' menzionata due volte', () => {
    expect(trovaMenzioni('@Anna Rossi ... ancora @Anna Rossi', team)).toEqual(['3']);
  });

  it('non lascia che @Marco rubi la menzione a @Marco Bianchi', () => {
    // Il collega di nome "Marco" esiste davvero: senza l'ordinamento dal nome
    // piu' lungo verrebbe notificato lui al posto di Marco Bianchi.
    expect(trovaMenzioni('grazie @Marco Bianchi', team)).toEqual(['1']);
  });

  it('riconosce comunque il nome corto quando e\' quello scritto', () => {
    expect(trovaMenzioni('grazie @Marco per il lavoro', team)).toEqual(['2']);
  });

  it('non considera menzione la @ di un indirizzo email', () => {
    expect(trovaMenzioni('scrivi a mario@azienda.it appena puoi', team)).toEqual([]);
  });

  it('ignora le differenze di maiuscole', () => {
    expect(trovaMenzioni('ehi @anna ROSSI', team)).toEqual(['3']);
  });

  it('non riconosce un nome che e\' solo il prefisso di una parola piu\' lunga', () => {
    expect(trovaMenzioni('@Marco Bianchini non e\' dei nostri', team)).toEqual(['2']);
  });

  it('restituisce un elenco vuoto se non ci sono menzioni', () => {
    expect(trovaMenzioni('nessuno da avvisare qui', team)).toEqual([]);
  });

  it('ignora nomi che non appartengono a nessuno', () => {
    expect(trovaMenzioni('@Giovanni Verdi ci pensi tu?', team)).toEqual([]);
  });
});

describe('candidatiMenzione', () => {
  it('filtra per sottostringa del nome ignorando le maiuscole', () => {
    expect(candidatiMenzione('ROS', team).map((p) => p.id)).toEqual(['3']);
  });

  it('filtra anche per email', () => {
    expect(candidatiMenzione('anna.rossi@', team).map((p) => p.id)).toEqual(['3']);
  });

  it('restituisce al massimo cinque candidati', () => {
    const molti = Array.from({ length: 20 }, (_, i) => persona(String(i), `Collega ${i}`));
    expect(candidatiMenzione('Collega', molti)).toHaveLength(5);
  });

  it('con parziale vuoto propone i primi nomi invece di un elenco vuoto', () => {
    expect(candidatiMenzione('', team).length).toBeGreaterThan(0);
  });
});

describe('menzioneInCorso', () => {
  it('restituisce quello che e\' stato digitato dopo la @', () => {
    expect(menzioneInCorso('ciao @Ann', 9)).toEqual({ parziale: 'Ann', inizio: 5 });
  });

  it('funziona con il cursore in mezzo al testo', () => {
    const testo = 'ciao @Ann, come va?';
    expect(menzioneInCorso(testo, 9)).toEqual({ parziale: 'Ann', inizio: 5 });
  });

  it('non considera in corso una @ che sta su una riga precedente', () => {
    expect(menzioneInCorso('ciao @Anna\nseconda riga', 20)).toBeNull();
  });

  it('non considera in corso la @ di un indirizzo email', () => {
    expect(menzioneInCorso('scrivi a mario@azienda', 22)).toBeNull();
  });

  it('smette di seguire la @ dopo troppi caratteri', () => {
    const testo = `@${'x'.repeat(40)}`;
    expect(menzioneInCorso(testo, testo.length)).toBeNull();
  });

  it('accetta un parziale con lo spazio, perche\' i nomi ne contengono', () => {
    expect(menzioneInCorso('ciao @Anna Ro', 13)).toEqual({ parziale: 'Anna Ro', inizio: 5 });
  });

  it('restituisce null se non c\'e\' nessuna @', () => {
    expect(menzioneInCorso('nessuna chiocciola', 10)).toBeNull();
  });
});

describe('completaMenzione', () => {
  it('inserisce il nome completo senza rovinare il resto della frase', () => {
    const testo = 'ciao @Ann, puoi guardare?';
    const esito = completaMenzione(testo, 9, team[2]);

    expect(esito.testo).toBe('ciao @Anna Rossi , puoi guardare?');
    expect(esito.nuovaPosizione).toBe('ciao @Anna Rossi '.length);
  });

  it('sostituisce il parziale invece di accodarsi ad esso', () => {
    const esito = completaMenzione('@Mar', 4, team[0]);
    expect(esito.testo).toBe('@Marco Bianchi ');
    expect(esito.nuovaPosizione).toBe(esito.testo.length);
  });

  it('inserisce al cursore quando non c\'e\' nessuna @ aperta', () => {
    const esito = completaMenzione('ciao ', 5, team[2]);
    expect(esito.testo).toBe('ciao @Anna Rossi ');
  });
});
