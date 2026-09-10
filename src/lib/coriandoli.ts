/**
 * I coriandoli, che rispettano chi ha chiesto meno movimento.
 *
 * `MotionConfig reducedMotion="user"` in `main.tsx` copre tutte le animazioni
 * di framer-motion, ma non questa: `canvas-confetti` disegna su una canvas per
 * conto suo e non sa niente di React. Ed e' l'animazione piu' aggressiva del
 * prodotto — duecento particelle che attraversano lo schermo — quindi proprio
 * quella che chi soffre di emicrania o di disturbi vestibolari ha chiesto di
 * non vedere quando ha spuntato quella preferenza di sistema.
 *
 * Non si spegne la festa a tutti: si spegne a chi l'ha chiesto. Chi non ha
 * espresso nessuna preferenza continua a vedere i coriandoli come prima.
 */

import confetti from 'canvas-confetti';

/** Vero se il sistema operativo chiede di ridurre il movimento. */
export function movimentoRidotto(): boolean {
  // `matchMedia` puo' mancare (ambienti di test, browser vecchissimi): in
  // dubbio si anima, perche' e' il comportamento che c'era prima.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type OpzioniCoriandoli = Parameters<typeof confetti>[0];

/** Coriandoli, ma solo per chi li vuole. */
export function coriandoli(opzioni?: OpzioniCoriandoli): void {
  if (movimentoRidotto()) return;
  void confetti(opzioni);
}
