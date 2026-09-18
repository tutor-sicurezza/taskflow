/**
 * L'organizzazione inventata che compare negli screenshot del README.
 *
 * Nessuno di questi nomi esiste. Non e' una precauzione formale: le immagini
 * di un gestionale mostrano chi lavora su cosa, chi e' in ritardo e chi ha
 * commentato cosa, e pubblicarle con dati veri vorrebbe dire pubblicare le
 * giornate di persone vere. Qui l'interfaccia e' quella autentica — e' il
 * codice del repository che gira — e i dati sono di fantasia.
 *
 * Le righe hanno la forma del DATABASE, non quella dei tipi dell'interfaccia:
 * arrivano dove arriverebbero quelle di PostgREST, e sono i mapper veri
 * dell'applicazione a trasformarle. Inventarle gia' trasformate avrebbe
 * saltato proprio il codice che si vuole mostrare funzionante.
 */

const ORG = 'org-demo-0000-0000-0000-000000000001';

/** Un'immagine di profilo che non richiede rete: iniziali su fondo colorato. */
function ritratto(iniziali, sfondo) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">` +
    `<rect width="96" height="96" rx="48" fill="${sfondo}"/>` +
    `<text x="48" y="60" font-family="Inter,system-ui,sans-serif" font-size="34"` +
    ` font-weight="600" fill="#ffffff" text-anchor="middle">${iniziali}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PERSONE = [
  {
    id: 'utente-demo-0001',
    email: 'mara.olivieri@esempio.test',
    full_name: 'Mara Olivieri',
    avatar_url: ritratto('MO', '#4f46e5'),
    job_title: 'Head of Engineering',
    departments: ['Engineering'],
    status: 'active',
    team_lead: true,
    joined_date: '2024-02-12T09:00:00.000Z',
    ruolo: 'admin',
  },
  {
    id: 'utente-demo-0002',
    email: 'davide.ferrero@esempio.test',
    full_name: 'Davide Ferrero',
    avatar_url: ritratto('DF', '#0f766e'),
    job_title: 'Backend Engineer',
    departments: ['Engineering'],
    status: 'active',
    team_lead: false,
    joined_date: '2024-06-03T09:00:00.000Z',
    ruolo: 'member',
  },
  {
    id: 'utente-demo-0003',
    email: 'sofia.ricci@esempio.test',
    full_name: 'Sofia Ricci',
    avatar_url: ritratto('SR', '#b45309'),
    job_title: 'Product Designer',
    departments: ['Design'],
    status: 'active',
    team_lead: false,
    joined_date: '2025-01-20T09:00:00.000Z',
    ruolo: 'member',
  },
  {
    id: 'utente-demo-0004',
    email: 'luca.bianchi@esempio.test',
    full_name: 'Luca Bianchi',
    avatar_url: ritratto('LB', '#be123c'),
    job_title: 'Customer Success',
    departments: ['Support'],
    status: 'active',
    team_lead: false,
    joined_date: '2025-03-09T09:00:00.000Z',
    ruolo: 'member',
  },
  {
    id: 'utente-demo-0005',
    email: 'chiara.esposito@esempio.test',
    full_name: 'Chiara Esposito',
    avatar_url: ritratto('CE', '#7c3aed'),
    job_title: 'QA Engineer',
    departments: ['Engineering'],
    status: 'active',
    team_lead: false,
    joined_date: '2025-05-14T09:00:00.000Z',
    ruolo: 'manager',
  },
];

/** Chi guarda gli screenshot: un'amministratrice, cosi' si vede tutto. */
export const IO = PERSONE[0];

/*
  Le date sono relative al giorno in cui si generano le immagini.

  Con date fisse gli screenshot invecchiano: dopo un mese ogni scadenza e'
  passata e la dashboard mostra tutto in ritardo, che non e' il prodotto ma il
  passare del tempo. Cosi' invece una nuova esecuzione produce sempre la stessa
  scena.
*/
const GIORNO = 24 * 60 * 60 * 1000;
const oggi = new Date();
oggi.setUTCHours(9, 0, 0, 0);
const fra = (giorni) => new Date(oggi.getTime() + giorni * GIORNO).toISOString();
const soloData = (giorni) => fra(giorni).slice(0, 10);

const commento = (task, chi, testo, giorni) => ({
  id: `com-${task}-${chi.id}-${giorni}`,
  taskId: task,
  userId: chi.id,
  userName: chi.full_name,
  userAvatar: chi.avatar_url,
  content: testo,
  createdAt: fra(giorni),
});

const voce = (task, chi, tipo, giorni, extra = {}) => ({
  id: `att-${task}-${tipo}-${giorni}`,
  taskId: task,
  userId: chi.id,
  userName: chi.full_name,
  userAvatar: chi.avatar_url,
  type: tipo,
  createdAt: fra(giorni),
  ...extra,
});

const [mara, davide, sofia, luca, chiara] = PERSONE;

export const TASK = [
  {
    id: 'd35392e2-0c26-4333-8344-a40fc781f020',
    title: 'Rate limiting on the public API',
    description:
      'Introduce a per-token limit on /api/v1. Return 429 with Retry-After ' +
      'and document the thresholds in the integration guide.',
    assignee_id: davide.id,
    priority: 'high',
    status: 'in-progress',
    due_date: soloData(2),
    created_at: fra(-9),
    department: 'Engineering',
    labels: ['api', 'reliability'],
    estimate_minutes: 480,
    spent_minutes: 210,
    subtasks: [
      { id: 's1', title: 'Choose the counter window', done: true, createdAt: fra(-9) },
      { id: 's2', title: 'Middleware + tests', done: true, createdAt: fra(-8) },
      { id: 's3', title: 'Document the thresholds', done: false, createdAt: fra(-8) },
    ],
    blocked_by: [],
    watchers: [mara.id, chiara.id],
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    attachments_count: 2,
    comments: [
      commento('d35392e2-0c26-4333-8344-a40fc781f020', chiara, 'Load test ready as soon as the middleware lands.', -3),
      commento('d35392e2-0c26-4333-8344-a40fc781f020', davide, 'Sliding window, 1000 req/h per token.', -2),
    ],
    activities: [
      voce('d35392e2-0c26-4333-8344-a40fc781f020', mara, 'created', -9),
      voce('d35392e2-0c26-4333-8344-a40fc781f020', davide, 'status_changed', -8, {
        oldValue: 'not started',
        newValue: 'in progress',
      }),
      voce('d35392e2-0c26-4333-8344-a40fc781f020', chiara, 'comment_added', -3),
    ],
  },
  {
    id: 'd938ae33-fd24-4e0a-8e5f-0f1fe0dd25f2',
    title: 'Redesign the empty states',
    description:
      'Every list shows a bare "no results". Give each one a reason and a next step.',
    assignee_id: sofia.id,
    priority: 'medium',
    status: 'in-progress',
    due_date: soloData(5),
    created_at: fra(-6),
    department: 'Design',
    labels: ['ux'],
    estimate_minutes: 360,
    spent_minutes: 120,
    subtasks: [
      { id: 's1', title: 'Inventory of the 14 empty states', done: true, createdAt: fra(-6) },
      { id: 's2', title: 'Copy for each one', done: false, createdAt: fra(-5) },
    ],
    blocked_by: [],
    watchers: [mara.id],
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    attachments_count: 0,
    comments: [
      commento('d938ae33-fd24-4e0a-8e5f-0f1fe0dd25f2', sofia, 'Starting with the ones people hit on day one.', -4),
    ],
    activities: [voce('d938ae33-fd24-4e0a-8e5f-0f1fe0dd25f2', mara, 'created', -6)],
  },
  {
    id: '8fd4d6f6-8000-4e97-80b0-3b37bc06244c',
    title: 'Migrate the session store',
    description: 'Move refresh tokens out of the shared table. Needs the rate limiting in place.',
    assignee_id: davide.id,
    priority: 'high',
    status: 'blocked',
    due_date: soloData(9),
    created_at: fra(-5),
    department: 'Engineering',
    labels: ['security'],
    estimate_minutes: 600,
    spent_minutes: 0,
    subtasks: [],
    blocked_by: ['d35392e2-0c26-4333-8344-a40fc781f020'],
    watchers: [mara.id],
    requires_approval: true,
    approved_by: null,
    approved_at: null,
    attachments_count: 1,
    comments: [
      commento('8fd4d6f6-8000-4e97-80b0-3b37bc06244c', davide, 'Parked until the limiter is merged.', -2),
    ],
    activities: [
      voce('8fd4d6f6-8000-4e97-80b0-3b37bc06244c', mara, 'created', -5),
      voce('8fd4d6f6-8000-4e97-80b0-3b37bc06244c', davide, 'status_changed', -2, {
        oldValue: 'not started',
        newValue: 'blocked',
      }),
    ],
  },
  {
    id: 'a8c7101f-25cf-4532-80ac-3cc4cfb9b67f',
    title: 'Quarterly access review',
    description: 'Check every account with admin rights and remove the ones nobody claims.',
    assignee_id: chiara.id,
    priority: 'medium',
    status: 'completed',
    due_date: soloData(-1),
    created_at: fra(-14),
    department: 'Engineering',
    labels: ['compliance'],
    estimate_minutes: 240,
    spent_minutes: 255,
    subtasks: [],
    blocked_by: [],
    watchers: [mara.id],
    requires_approval: true,
    approved_by: null,
    approved_at: null,
    attachments_count: 0,
    comments: [
      commento('a8c7101f-25cf-4532-80ac-3cc4cfb9b67f', chiara, 'Done — three dormant admin accounts removed.', -1),
    ],
    activities: [
      voce('a8c7101f-25cf-4532-80ac-3cc4cfb9b67f', mara, 'created', -14),
      voce('a8c7101f-25cf-4532-80ac-3cc4cfb9b67f', chiara, 'status_changed', -1, {
        oldValue: 'in progress',
        newValue: 'completed',
      }),
    ],
  },
  {
    id: 'ce4f84ce-601a-44d5-8e71-6c1e0bc125db',
    title: 'Onboarding emails bounce for .test domains',
    description: 'Two customers reported it this week. Reproduced on staging.',
    assignee_id: luca.id,
    priority: 'high',
    status: 'not-started',
    due_date: soloData(-2),
    created_at: fra(-3),
    department: 'Support',
    labels: ['bug', 'email'],
    estimate_minutes: 120,
    spent_minutes: 0,
    subtasks: [],
    blocked_by: [],
    watchers: [mara.id, davide.id],
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    attachments_count: 0,
    comments: [],
    activities: [voce('ce4f84ce-601a-44d5-8e71-6c1e0bc125db', luca, 'created', -3)],
  },
  {
    id: 'd2c197ba-7ed4-41a9-8a5e-9018e29d587c',
    title: 'Weekly backup verification',
    description: 'Restore last night\'s dump into the scratch project and diff the row counts.',
    assignee_id: chiara.id,
    priority: 'low',
    status: 'not-started',
    due_date: soloData(4),
    created_at: fra(-2),
    department: 'Engineering',
    labels: ['ops'],
    estimate_minutes: 60,
    spent_minutes: 0,
    subtasks: [],
    blocked_by: [],
    watchers: [],
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    attachments_count: 0,
    comments: [],
    activities: [voce('d2c197ba-7ed4-41a9-8a5e-9018e29d587c', mara, 'created', -2)],
    recurrence: { tipo: 'settimane', ogni: 1, giorniSettimana: [1] },
  },
  {
    id: 'd37c4c80-c253-49f3-8a79-c1c4daa7d0ce',
    title: 'Draft the Q3 engineering update',
    description: 'One page: what shipped, what slipped, what we learned.',
    assignee_id: mara.id,
    priority: 'medium',
    status: 'in-progress',
    due_date: soloData(1),
    created_at: fra(-4),
    department: 'Engineering',
    labels: [],
    estimate_minutes: 180,
    spent_minutes: 90,
    subtasks: [],
    blocked_by: [],
    watchers: [],
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    attachments_count: 0,
    comments: [],
    activities: [voce('d37c4c80-c253-49f3-8a79-c1c4daa7d0ce', mara, 'created', -4)],
  },
  {
    id: '1e9c0090-96e2-485c-8eef-cd29d0cb930c',
    title: 'Accessibility pass on the task dialog',
    description: 'Focus order, focus ring contrast, and labels on the icon-only buttons.',
    assignee_id: sofia.id,
    priority: 'medium',
    status: 'completed',
    due_date: soloData(-4),
    created_at: fra(-12),
    department: 'Design',
    labels: ['a11y'],
    estimate_minutes: 300,
    spent_minutes: 290,
    subtasks: [],
    blocked_by: [],
    watchers: [mara.id],
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    attachments_count: 0,
    comments: [],
    activities: [
      voce('1e9c0090-96e2-485c-8eef-cd29d0cb930c', mara, 'created', -12),
      voce('1e9c0090-96e2-485c-8eef-cd29d0cb930c', sofia, 'status_changed', -4, {
        oldValue: 'in progress',
        newValue: 'completed',
      }),
    ],
  },
  {
    id: '3a3fbcb0-9536-4249-8eb1-ddb1efc8e59a',
    title: 'Trim the bundle: locales were shipping eagerly',
    description: 'The date-fns locales ended up in the initial chunk. Move them behind the lazy boundary.',
    assignee_id: davide.id,
    priority: 'low',
    status: 'completed',
    due_date: soloData(-6),
    created_at: fra(-16),
    department: 'Engineering',
    labels: ['performance'],
    estimate_minutes: 90,
    spent_minutes: 75,
    subtasks: [],
    blocked_by: [],
    watchers: [],
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    attachments_count: 0,
    comments: [],
    activities: [voce('3a3fbcb0-9536-4249-8eb1-ddb1efc8e59a', davide, 'created', -16)],
  },
  {
    id: '454e62dd-eae9-4c47-8118-2fdc4af5c528',
    title: 'Write the incident postmortem',
    description: 'The 40 minutes of failed logins on Tuesday. Timeline, cause, what we changed.',
    assignee_id: null,
    priority: 'high',
    status: 'not-started',
    due_date: soloData(3),
    created_at: fra(-1),
    department: 'Engineering',
    labels: ['incident'],
    estimate_minutes: 240,
    spent_minutes: 0,
    subtasks: [],
    blocked_by: [],
    watchers: [mara.id],
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    attachments_count: 0,
    comments: [],
    activities: [voce('454e62dd-eae9-4c47-8118-2fdc4af5c528', mara, 'created', -1)],
  },
];

export const NOTIFICHE = [
  {
    id: 'not-demo-1',
    user_id: IO.id,
    task_ref: 'a8c7101f-25cf-4532-80ac-3cc4cfb9b67f',
    task_title: 'Quarterly access review',
    type: 'task_status_changed',
    message: '"Quarterly access review" is waiting for your approval',
    action_by: chiara.id,
    action_by_name: chiara.full_name,
    action_by_avatar: chiara.avatar_url,
    link: null,
    read: false,
    created_at: fra(-1),
  },
  {
    id: 'not-demo-2',
    user_id: IO.id,
    task_ref: 'd35392e2-0c26-4333-8344-a40fc781f020',
    task_title: 'Rate limiting on the public API',
    type: 'task_comment',
    message: 'Davide Ferrero commented on "Rate limiting on the public API"',
    action_by: davide.id,
    action_by_name: davide.full_name,
    action_by_avatar: davide.avatar_url,
    link: null,
    read: false,
    created_at: fra(-2),
  },
  {
    id: 'not-demo-3',
    user_id: IO.id,
    task_ref: '8fd4d6f6-8000-4e97-80b0-3b37bc06244c',
    task_title: 'Migrate the session store',
    type: 'task_status_changed',
    message: '"Migrate the session store": Davide Ferrero set the status to blocked',
    action_by: davide.id,
    action_by_name: davide.full_name,
    action_by_avatar: davide.avatar_url,
    link: null,
    read: true,
    created_at: fra(-2),
  },
];

export const ORGANIZZAZIONE = {
  id: ORG,
  name: 'Northwind Studio',
  slug: 'northwind-studio',
  owner_id: IO.id,
};

export const MEMBRI = PERSONE.map((p) => ({
  role: p.ruolo,
  user_id: p.id,
  organization_id: ORG,
  custom_permissions: null,
  created_at: p.joined_date,
  organizations: ORGANIZZAZIONE,
  profiles: {
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    job_title: p.job_title,
    departments: p.departments,
    status: p.status,
    team_lead: p.team_lead,
    joined_date: p.joined_date,
  },
}));

/**
 * Le righe di `user_state`: cio' che appartiene alla singola persona.
 *
 * Le due bandiere del giro di benvenuto sono vere perche' le immagini devono
 * mostrare il prodotto in uso, non il suo primo minuto: con `false` si apre la
 * finestra "Welcome to TaskFlow" e copre esattamente cio' che si vuole far
 * vedere. Si passa dal dato, non chiudendo la finestra a forza dopo: cosi' la
 * scena e' la stessa a ogni esecuzione, senza dipendere da un click che puo'
 * arrivare troppo presto.
 */
export const STATO_UTENTE = [
  { key: 'has-completed-welcome', value: true },
  { key: 'has-seen-launch-announcement', value: true },
  { key: 'lingua', value: 'en' },
];

/** Le righe di `app_state`: configurazione dell'organizzazione. */
export const STATO_APP = [
  { key: 'departments', value: ['Engineering', 'Design', 'Support'] },
  { key: 'system-settings', value: { general: { applicationName: 'TaskFlow' } } },
];
