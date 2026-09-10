const requiredEnvKeys = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function getRequiredEnv() {
  const missing = requiredEnvKeys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    supabaseUrl: process.env.SUPABASE_URL as string,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY as string,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    resendApiKey: process.env.RESEND_API_KEY,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    /**
     * APP_URL ha la precedenza su VERCEL_URL, non il contrario.
     *
     * VERCEL_URL e' l'indirizzo del singolo deploy
     * (nome-progetto-<hash>.vercel.app): cambia a ogni pubblicazione e, con la
     * protezione dei deploy attiva, chiede di autenticarsi. Va benissimo per
     * una chiamata interna, ma finisce anche dentro i link delle email, dove
     * serve l'indirizzo stabile a cui le persone accedono davvero.
     */
    appUrl: process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  };
}
