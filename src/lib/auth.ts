import type { AuthProviderId, AuthProviderInfo, AuthUser } from '../types';

/**
 * OWNER-ONLY UI GATING
 * ────────────────────
 * The header exposes a few controls that belong to the site owner and must never
 * be shown to ordinary users (owner dashboard, backend/database console, …).
 *
 * The decision is made by the SERVER: `/api/auth/me` verifies the signed session
 * cookie and stamps `user.isOwner` on the response. Nothing about the owner's
 * identity is hard-coded here, so the public bundle no longer leaks the address,
 * and the flag cannot be forged by editing client state. The real protection
 * still lives on the server, where every admin route requires a valid owner
 * session (see `requireAdmin` in `api/index.ts`).
 */
export function isOwnerAccount(user: AuthUser | null | undefined): boolean {
  return user?.isOwner === true;
}

/**
 * Thin client for the server-side OAuth flow implemented in `api/index.ts`.
 *
 * The client secret and the code→token exchange never reach the browser: we only
 * ever navigate to `/api/auth/<provider>` and read the signed HttpOnly session
 * cookie back through `/api/auth/me`.
 */

/**
 * Project export — turns the single-file generated app into a real, multi-file
 * project that extracts as a normal ZIP (src files you can open in an editor,
 * a package.json with working scripts, and a README).
 *
 * WHY THIS EXISTS
 * ---------------
 * Ebnily generates one standalone `index.html` (Tailwind CDN + inline <style>
 * + inline <script>) so it can run inside the preview iframe. Zipping that
 * verbatim produced an archive containing nothing but a web page, which is not
 * what a "Download ZIP" button should deliver. Here the same HTML is decomposed
 * into `index.html` + `src/styles.css` + `src/app.js` — functionally identical
 * (classic script + relative paths, so it even opens straight off the
 * filesystem) but a genuine source project.
 *
 * The DOM is parsed with the real `DOMParser` rather than regexes, so quoting,
 * nested tags, and multiple style/script blocks are handled correctly.
 */

export interface ExportedProject {
  /** Path inside the archive → file contents. */
  files: Record<string, string>;
  /** Folder name used at the archive root. */
  rootDir: string;
}

/** Filesystem-safe, lowercase folder name. */
export function slugify(name: string): string {
  const slug = (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'ebnili-project';
}

/** The generated app always lands in `index.html`; fall back to any HTML file. */
function pickPrimaryHtml(files: Record<string, string>): { html: string } | null {
  const entries = Object.entries(files ?? {});
  if (entries.length === 0) return null;

  const byIndex = entries.find(([name]) => name.toLowerCase().endsWith('index.html'));
  if (byIndex) return { html: String(byIndex[1] ?? '') };

  const anyHtml = entries.find(
    ([name, content]) => /\.html?$/i.test(name) && /<html/i.test(String(content ?? '')),
  );
  if (anyHtml) return { html: String(anyHtml[1] ?? '') };

  const biggest = entries
    .map(([, content]) => ({ html: String(content ?? '') }))
    .sort((a, b) => b.html.length - a.html.length)[0];
  return biggest || null;
}

/** Inline scripts that must stay inline to keep working (Babel, JSON-LD, modules). */
function mustStayInline(script: HTMLScriptElement): boolean {
  if (script.src) return true;
  const type = (script.getAttribute('type') || '').toLowerCase();
  return type !== '' && type !== 'text/javascript' && type !== 'application/javascript';
}

export function buildProjectExport(
  projectName: string,
  files: Record<string, string>,
): ExportedProject {
  const rootDir = slugify(projectName);
  const primary = pickPrimaryHtml(files);
  const out: Record<string, string> = {};
  const p = (rel: string) => `${rootDir}/${rel}`;

  const packageJson = {
    name: rootDir,
    private: true,
    version: '1.0.0',
    type: 'module',
    description: `${projectName} — generated with Ebnili AI App Builder`,
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    devDependencies: { vite: '^5.4.0' },
  };

  const readme = [
    `# ${projectName}`,
    '',
    'Generated with [Ebnili AI App Builder](https://ebnily.vercel.app).',
    '',
    '## Project structure',
    '',
    '```',
    'index.html      page shell + CDN tags (Tailwind, fonts, icons)',
    'src/styles.css  styles extracted from the generated document',
    'src/app.js      application logic extracted from the generated document',
    'vite.config.js  dev/build config',
    '```',
    '',
    '## Run it',
    '',
    'Open `index.html` directly in a browser, or run a dev server:',
    '',
    '```bash',
    'npm install',
    'npm run dev',
    '```',
    '',
  ].join('\n');

  // No parseable document: fall back to dumping whatever files we were given.
  if (!primary || !/<html|<body|<div/i.test(primary.html)) {
    Object.entries(files ?? {}).forEach(([name, content]) => {
      out[p(name)] = String(content ?? '');
    });
    out[p('package.json')] = JSON.stringify(packageJson, null, 2);
    out[p('README.md')] = readme;
    return { files: out, rootDir };
  }

  const doc = new DOMParser().parseFromString(primary.html, 'text/html');

  // 1. Pull every inline <style> out into one stylesheet.
  const cssParts: string[] = [];
  Array.from(doc.querySelectorAll('style')).forEach((node) => {
    const text = node.textContent?.trim();
    if (text) cssParts.push(text);
    node.remove();
  });

  // 2. Pull runnable inline <script> bodies out into one script file.
  const jsParts: string[] = [];
  Array.from(doc.querySelectorAll('script')).forEach((node) => {
    if (mustStayInline(node as HTMLScriptElement)) return;
    const text = node.textContent?.trim();
    if (text) jsParts.push(text);
    node.remove();
  });

  // 2b. Capture the document title, then drop the original <title> and
  //     <meta charset> — the rebuilt shell supplies its own, so keeping the
  //     originals would emit them twice.
  const title = (doc.title || '').trim() || projectName;
  Array.from(doc.querySelectorAll('title')).forEach((node) => node.remove());
  Array.from(doc.querySelectorAll('meta[charset]')).forEach((node) => node.remove());

  const bodyHtml = doc.body?.innerHTML?.trim() ?? '';
  const headHtml = doc.head?.innerHTML?.trim() ?? '';
  const htmlLang = doc.documentElement.getAttribute('lang') || 'en';
  const dir = doc.documentElement.getAttribute('dir') || '';
  const hasCss = cssParts.length > 0;
  const hasJs = jsParts.length > 0;

  // 3. Rebuild a clean shell. Classic (non-module) script + relative paths keep
  //    the project working from a static host AND straight off the filesystem.
  const indexHtml = [
    '<!DOCTYPE html>',
    `<html lang="${htmlLang}"${dir ? ` dir="${dir}"` : ''}>`,
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${title.replace(/</g, '&lt;')}</title>`,
    headHtml,
    hasCss ? '<link rel="stylesheet" href="./src/styles.css" />' : '',
    '</head>',
    '<body>',
    bodyHtml,
    // Loaded at the end of the body so the DOM exists before it runs, which is
    // where an inline script normally sits.
    hasJs ? '<script src="./src/app.js"></script>' : '',
    '</body>',
    '</html>',
    '',
  ]
    .filter(Boolean)
    .join('\n');

  out[p('index.html')] = indexHtml;
  if (hasCss) out[p('src/styles.css')] = `${cssParts.join('\n\n')}\n`;
  if (hasJs) out[p('src/app.js')] = `${jsParts.join('\n\n')}\n`;

  out[p('vite.config.js')] = [
    "import { defineConfig } from 'vite';",
    '',
    'export default defineConfig({',
    '  server: { port: 3000, open: true },',
    '});',
    '',
  ].join('\n');

  out[p('package.json')] = `${JSON.stringify(packageJson, null, 2)}\n`;
  out[p('README.md')] = readme;
  out[p('.gitignore')] = 'node_modules\ndist\n.DS_Store\n';

  return { files: out, rootDir };
}

export const AUTH_ERROR_MESSAGES: Record<string, { ar: string; en: string }> = {
  not_configured: {
    ar: 'طريقة الدخول غير مُهيأة على الخادم بعد. أضف مفاتيح OAuth من إعدادات Vercel.',
    en: 'This sign-in method is not configured on the server yet. Add the OAuth keys in Vercel settings.',
  },
  state_cookie_missing: {
    ar: 'انتهت صلاحية محاولة الدخول. حاول مرة أخرى.',
    en: 'Your sign-in attempt expired. Please try again.',
  },
  state_cookie_invalid: {
    ar: 'تعذّر التحقق من محاولة الدخول. حاول مرة أخرى.',
    en: 'Could not verify the sign-in attempt. Please try again.',
  },
  state_provider_mismatch: {
    ar: 'طريقة الدخول لا تطابق الطلب. حاول مرة أخرى.',
    en: 'Sign-in method mismatch. Please try again.',
  },
  state_mismatch: {
    ar: 'تم إبطال الطلب لأسباب أمنية. حاول مرة أخرى.',
    en: 'The request was rejected for security reasons. Please try again.',
  },
  missing_code: {
    ar: 'لم يُكمل مزوّد الدخول العملية. حاول مرة أخرى.',
    en: 'The provider did not complete the flow. Please try again.',
  },
  profile_failed: {
    ar: 'تعذّر جلب بيانات الحساب من مزوّد الدخول.',
    en: 'Could not load your account details from the provider.',
  },
  exchange_failed: {
    ar: 'فشل الاتصال بمزوّد الدخول. حاول مرة أخرى.',
    en: 'Could not reach the sign-in provider. Please try again.',
  },
  unknown_provider: {
    ar: 'طريقة دخول غير معروفة.',
    en: 'Unknown sign-in method.',
  },
  access_denied: {
    ar: 'تم إلغاء عملية الدخول.',
    en: 'Sign-in was cancelled.',
  },
  redirect_uri_mismatch: {
    ar: 'رابط الرجوع غير مسجّل. أضف رابط الرجوع الظاهر في أسفل هذه الرسالة إلى إعدادات تطبيق Google أو GitHub.',
    en: 'The callback URL is not registered. Add the exact URL shown below to your Google or GitHub OAuth app settings.',
  },
  supabase_not_configured: {
    ar: 'مصدر تسجيل الدخول (Supabase) غير مُهيّأ على الخادم.',
    en: 'The Supabase sign-in provider is not configured on the server.',
  },
  pkce_missing: {
    ar: 'انتهت صلاحية محاولة الدخول. حاول مرة أخرى من البداية.',
    en: 'Your sign-in attempt expired. Please start again.',
  },
  pkce_invalid: {
    ar: 'تعذّر التحقق من محاولة الدخول. حاول مرة أخرى.',
    en: 'Could not verify the sign-in attempt. Please try again.',
  },
  oauth_denied: {
    ar: 'لم تكتمل عملية الدخول. ربما أُلغيت أو رُفض الإذن.',
    en: 'Sign-in was not completed. It may have been cancelled or denied.',
  },
};

export function getAuthErrorMessage(code: string, language: 'ar' | 'en'): string {
  const entry = AUTH_ERROR_MESSAGES[code];
  if (entry) return entry[language];
  return language === 'ar'
    ? 'تعذّر تسجيل الدخول. حاول مرة أخرى.'
    : 'Sign-in failed. Please try again.';
}

/**
 * Single source of truth for the sign-in UI.
 *
 * The client used to read /api/auth/providers for the button list and
 * /api/auth/config for the callback URLs, so the two could describe different
 * things. Everything now comes from the single /api/auth/providers response.
 */
export interface AuthRuntime {
  providers: AuthProviderInfo[];
  baseUrl: string;
  route: 'supabase' | 'direct';
  callbackBase: string;
}

export async function fetchAuthRuntime(): Promise<AuthRuntime | null> {
  try {
    const res = await fetch('/api/auth/providers');
    if (!res.ok) return null;
    const data = (await res.json()) as {
      providers?: AuthProviderInfo[];
      baseUrl?: string;
      route?: 'supabase' | 'direct';
      callbackBase?: string;
    };
    if (!Array.isArray(data.providers)) return null;
    return {
      providers: data.providers,
      baseUrl: data.baseUrl ?? '',
      route: data.route ?? 'direct',
      callbackBase: data.callbackBase ?? '',
    };
  } catch {
    return null;
  }
}

/** Which providers the server has credentials for (hides the rest of the UI). */
export async function fetchAuthProviders(): Promise<AuthProviderInfo[]> {
  const runtime = await fetchAuthRuntime();
  return runtime?.providers ?? [];
}

/**
 * Deadline for any initialization call that is allowed to hold the UI hostage.
 *
 * WHY: `fetch` has no timeout of its own. If `/api/auth/me` stalls (cold
 * serverless start, flaky mobile network, a proxy that never finishes the
 * response) the promise simply never settles, `setAuthChecked(true)` never runs,
 * and the visitor is stuck on the "جارٍ تجهيز الاستوديو…" splash FOREVER. Every
 * non-critical init call is therefore bounded.
 */
export const AUTH_INIT_TIMEOUT_MS = 8_000;

/**
 * `fetch` with a hard deadline, built on AbortController so it works on every
 * browser we support (no reliance on the newer `AbortSignal.timeout`).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = AUTH_INIT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** The current user, or `null` for guests. Never throws, never hangs. */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetchWithTimeout('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      user?: AuthUser | null;
      isOwner?: boolean;
    };
    if (!data.authenticated || !data.user) return null;
    // The owner verdict comes from the server: prefer the flag on the session
    // object, fall back to the top-level one. Never re-derive it here.
    return { ...data.user, isOwner: data.user.isOwner === true || data.isOwner === true };
  } catch {
    return null;
  }
}

/** Full-page redirect into the provider's consent screen. */
export function startOAuth(provider: AuthProviderId): void {
  window.location.href = `/api/auth/${provider}`;
}

/**
 * The exact callback URLs that must be registered on the provider / Supabase
 * side, shown in the UI so a redirect_uri mismatch can be fixed by copying the
 * value rather than guessing. Derived from the same /api/auth/providers
 * response as the buttons, so the two can never disagree.
 */
export async function fetchAuthCallbacks(): Promise<{ google: string; github: string } | null> {
  const runtime = await fetchAuthRuntime();
  if (!runtime?.callbackBase) return null;
  return {
    google: `${runtime.callbackBase}/google`,
    github: `${runtime.callbackBase}/github`,
  };
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    /* the cookie is cleared server-side regardless */
  }
}
