/**
 * Verifica di fumo su autenticazione e provisioning degli account.
 *
 * Serve a rispondere a una domanda precisa: disattivando "Allow new users to
 * sign up" su Supabase, l'applicazione continua a funzionare? La risposta
 * dipende da due percorsi diversi che e' facile confondere:
 *
 *   - /auth/v1/signup            -> registrazione pubblica, DEVE essere chiusa
 *   - /auth/v1/admin/users       -> creazione da parte dell'amministratore,
 *                                   usata da api/tenants/<id>/members.ts, che
 *                                   deve continuare a funzionare
 *
 * Uso:  node scripts/smoke-auth.mjs
 * Legge le credenziali da .env.local. Non modifica nulla in modo permanente:
 * l'account di prova che crea viene eliminato alla fine.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const i = line.indexOf('=');
  process.env[line.slice(0, i).trim()] = line
    .slice(i + 1)
    .trim()
    .replace(/^"|"$/g, '');
}

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(process.env.SUPABASE_URL, SERVICE, {
  auth: { persistSession: false },
});
const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });

// Le credenziali di prova NON stanno qui: questo file finisce su GitHub.
// Vivono in .env.local, che e' in .gitignore. Se mancano, il controllo 5 viene
// saltato invece di fallire.
const ACCOUNTS = [
  [process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD],
  [process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD],
].filter(([email, password]) => email && password);
const PROBE_EMAIL = process.env.QA_PROBE_EMAIL || 'qa.smoke.probe@gmail.com';

let failures = 0;
const ok = (m) => console.log('  OK   ' + m);
const ko = (m) => {
  failures++;
  console.log('  FAIL ' + m);
};

console.log(`\nProgetto: ${URL}\n`);

// 1. Stato della registrazione pubblica
const settings = await fetch(`${URL}/auth/v1/settings`, {
  headers: { apikey: ANON },
}).then((r) => r.json());
const signupOpen = settings.disable_signup === false;
console.log(
  `1) Registrazione pubblica: ${signupOpen ? 'APERTA (da chiudere nel dashboard)' : 'chiusa'}`
);

// 2. Tentativo reale di registrazione pubblica
const { data: su, error: sue } = await anon().auth.signUp({
  email: PROBE_EMAIL,
  password: 'Smoke-Probe-2026!',
});
if (signupOpen) {
  console.log(
    `2) signUp con chiave anon: ${sue ? 'rifiutato (' + sue.message + ')' : 'RIUSCITO — chiunque puo creare un account'}`
  );
} else if (sue) {
  ok(`2) signUp con chiave anon rifiutato: ${sue.message}`);
} else {
  ko('2) signUp con chiave anon RIUSCITO nonostante disable_signup');
}
if (su?.user?.id) await admin.auth.admin.deleteUser(su.user.id);

// 3. Creazione da amministratore: la stessa chiamata di
//    api/tenants/[tenantId]/members.ts. Deve funzionare in entrambi i casi.
const password = 'Smoke-Admin-Created-2026!';
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: PROBE_EMAIL,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'Smoke Test' },
});
if (createErr || !created?.user) {
  ko(`3) creazione da amministratore fallita: ${createErr?.message}`);
} else {
  ok('3) creazione da amministratore riuscita');

  const { error: loginErr } = await anon().auth.signInWithPassword({
    email: PROBE_EMAIL,
    password,
  });
  if (loginErr) ko(`4) l'account creato non riesce ad accedere: ${loginErr.message}`);
  else ok("4) l'account creato accede correttamente");

  await admin.auth.admin.deleteUser(created.user.id);
}

// 5. Gli account esistenti accedono e risolvono un'organizzazione, che e' cio'
//    che AuthContext richiede per montare l'applicazione.
if (ACCOUNTS.length === 0) {
  console.log(
    '  SKIP 5) credenziali di prova assenti da .env.local (QA_ADMIN_EMAIL/PASSWORD, QA_USER_EMAIL/PASSWORD)'
  );
}
for (const [email, pw] of ACCOUNTS) {
  const { data, error } = await anon().auth.signInWithPassword({
    email,
    password: pw,
  });
  if (error) {
    ko(`5) ${email}: login fallito (${error.message})`);
    continue;
  }
  const scoped = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  const { data: membership } = await scoped
    .from('organization_members')
    .select('role, organizations(name)')
    .eq('user_id', data.user.id)
    .limit(1)
    .maybeSingle();

  if (membership?.organizations)
    ok(`5) ${email}: ${membership.role} in "${membership.organizations.name}"`);
  else ko(`5) ${email}: nessuna organizzazione, l'app mostrerebbe la schermata di blocco`);
}

console.log(
  failures === 0
    ? '\nTutti i controlli superati.\n'
    : `\n${failures} controllo/i falliti.\n`
);
process.exit(failures === 0 ? 0 : 1);
