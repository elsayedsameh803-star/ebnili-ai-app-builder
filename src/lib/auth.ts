import type { AuthProviderId, AuthProviderInfo, AuthUser } from '../types';

/**
 * Thin client for the server-side OAuth flow implemented in `api/index.ts`.
 *
 * The client secret and the code→token exchange never reach the browser: we only
 * ever navigate to `/api/auth/<provider>` and read the signed HttpOnly session
 * cookie back through `/api/auth/me`.
 */

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
};

export function getAuthErrorMessage(code: string, language: 'ar' | 'en'): string {
  const entry = AUTH_ERROR_MESSAGES[code];
  if (entry) return entry[language];
  return language === 'ar'
    ? 'تعذّر تسجيل الدخول. حاول مرة أخرى.'
    : 'Sign-in failed. Please try again.';
}

/** Which providers the server has credentials for (hides the rest of the UI). */
export async function fetchAuthProviders(): Promise<AuthProviderInfo[]> {
  try {
    const res = await fetch('/api/auth/providers');
    if (!res.ok) return [];
    const data = (await res.json()) as { providers?: AuthProviderInfo[] };
    return Array.isArray(data.providers) ? data.providers : [];
  } catch {
    return [];
  }
}

/** The current user, or `null` for guests. Never throws. */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = (await res.json()) as { authenticated?: boolean; user?: AuthUser | null };
    return data.authenticated && data.user ? data.user : null;
  } catch {
    return null;
  }
}

/** Full-page redirect into the provider's consent screen. */
export function startOAuth(provider: AuthProviderId): void {
  window.location.href = `/api/auth/${provider}`;
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
