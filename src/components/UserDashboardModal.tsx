import { useCallback, useEffect, useState } from 'react';
import {
  X,
  RefreshCw,
  Crown,
  Wallet,
  Gauge,
  FolderTree,
  ExternalLink,
  ArrowUpRight,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { AuthUser, Language, UserSubscription } from '../types';
import type { ProjectSummary } from '../lib/projects';

/**
 * USER DASHBOARD — «لوحة المستخدم»
 *
 * The owner asked for a personal dashboard in the control rail showing, in one
 * place: the customer's plan, their credit balance, how much of today's AI
 * allowance is left (the quota meter), and their own projects.
 *
 * ISOLATION — THE HARD RULE
 * --------------------------
 * Another account must never see this screen, and must never reach its data:
 *   1. App never mounts this modal without a verified session (`authUser`
 *      comes from `/api/auth/me`, which reads the signed HttpOnly cookie).
 *   2. This component sends NO identity of any kind — no user id, no email, no
 *      account id — so there is nothing to tamper with. "Who am I" is resolved
 *      server-side from the session cookie on every single request below.
 *   3. The server scopes each of these routes by owner (`/api/projects` filters
 *      `owner_id`, `/api/ai/quota` reads the caller's account row,
 *      `/api/auth/me` returns the caller's own wallet), so a request aimed at
 *      somebody else's row answers 401/404 — never data.
 * The browser is a viewer here, never the authority.
 */

interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  tier: string;
  resetsAt?: string;
}

/** One row of GET /api/projects — only ever the caller's own rows. */
export interface UserDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  /** The verified session. The modal is never rendered without it. */
  authUser: AuthUser;
  /** Optimistic client copy; the server copy read on open wins. */
  subscription?: UserSubscription;
  /** Already scoped to this account by App's refreshProjectList. */
  projects?: ProjectSummary[];
  onOpenSubscription?: () => void;
  onSelectProject?: (id: string) => void;
  onRefreshProjects?: () => void | Promise<void>;
}

/** Same contract as the rest of the client: 401 means "signed out", nothing else. */
class AuthRequiredError extends Error {
  constructor() {
    super('AUTH_REQUIRED');
    this.name = 'AuthRequiredError';
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 401) throw new AuthRequiredError();
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : 'request failed';
    throw new Error(message);
  }
  return data as T;
}

/** `0 / 0` must never render as a full bar — an unknown limit reads as "—" instead. */
function percent(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

function relativeTime(iso: string, ar: boolean): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return ar ? 'الآن' : 'now';
  if (minutes < 60) return ar ? `منذ ${minutes} د` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ar ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return ar ? `منذ ${days} يوم` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB');
}

const TIER_LABEL: Record<string, { ar: string; en: string; className: string }> = {
  free: { ar: 'المجانية', en: 'Free', className: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  pro: { ar: 'برو', en: 'Pro', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  business: { ar: 'بيزنس', en: 'Business', className: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

export const UserDashboardModal = ({
  isOpen,
  onClose,
  language,
  authUser,
  subscription,
  projects = [],
  onOpenSubscription,
  onSelectProject,
  onRefreshProjects,
}: UserDashboardModalProps) => {
  const ar = language === 'ar';

  const [loading, setLoading] = useState<boolean>(false);
  const [signedOut, setSignedOut] = useState<boolean>(false);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [quotaError, setQuotaError] = useState<boolean>(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [serverSubscription, setServerSubscription] = useState<UserSubscription | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const activeSubscription = serverSubscription ?? subscription ?? null;
  const tier = (quota?.tier || activeSubscription?.tier || 'free').toLowerCase();
  const tierMeta = TIER_LABEL[tier] ?? TIER_LABEL.free;

  /**
   * Pull this account's own numbers — on open and on manual refresh.
   * `Promise.allSettled` on purpose: one unreachable endpoint must degrade into
   * a partial dashboard, never into a blank screen.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setSignedOut(false);
    try {
      const [quotaRes, meRes, subRes] = await Promise.allSettled([
        getJson<{ used: number; limit: number; remaining: number; tier: string; resetsAt?: string }>(
          '/api/ai/quota',
        ),
        getJson<{ credits?: number }>('/api/auth/me'),
        getJson<{ subscription: UserSubscription }>('/api/subscriptions/current'),
      ]);

      if (quotaRes.status === 'fulfilled') {
        const q = quotaRes.value;
        setQuota({
          used: Number(q.used) || 0,
          limit: Number(q.limit) || 0,
          remaining: Math.max(0, Number(q.remaining) || 0),
          tier: String(q.tier || 'free'),
          resetsAt: q.resetsAt,
        });
        setQuotaError(false);
      } else {
        setQuotaError(!(quotaRes.reason instanceof AuthRequiredError));
      }

      if (meRes.status === 'fulfilled') {
        const value = meRes.value.credits;
        // `undefined` = the database did not answer. That must read as "unknown",
        // never as zero — telling a customer they are broke because of a timeout
        // is worse than showing nothing.
        setCredits(typeof value === 'number' ? value : null);
      }

      if (subRes.status === 'fulfilled') setServerSubscription(subRes.value.subscription);

      const authFailed = [quotaRes, meRes, subRes].some(
        (r) => r.status === 'rejected' && r.reason instanceof AuthRequiredError,
      );
      if (authFailed) setSignedOut(true);

      await onRefreshProjects?.();
    } finally {
      setLoading(false);
    }
  }, [onRefreshProjects]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
    // Body-scroll lock + Escape: the same rule every overlay in this app follows.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, load, onClose, refreshTick]);

  if (!isOpen) return null;

  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? activeSubscription?.generationsLimitToday ?? 0;
  const remaining = quota ? quota.remaining : Math.max(0, limit - used);
  const usedPct = percent(used, limit);
  const barTone =
    usedPct >= 100
      ? 'from-rose-500 to-rose-400'
      : usedPct >= 70
        ? 'from-amber-500 to-orange-400'
        : 'from-emerald-500 to-teal-400';
  const planStatus = activeSubscription?.status ?? 'active';
  const expiresAt = activeSubscription?.expiresAt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ar ? 'لوحة المستخدم' : 'My dashboard'}
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/85 backdrop-blur-md p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-auto">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950/40">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-rose-500 to-amber-400 flex items-center justify-center shadow-lg">
            <FolderTree className="w-5 h-5 text-white" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-black text-white truncate">
              {ar ? 'لوحة المستخدم' : 'My dashboard'}
            </h2>
            <p className="text-[11px] text-slate-400 truncate" dir="ltr">
              {authUser.email || authUser.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={loading}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            title={ar ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-rose-500/20 transition cursor-pointer"
            title={ar ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* ── Isolation notice — the promise this screen makes ──────────── */}
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[11px] leading-5 text-emerald-200/90">
              {ar
                ? 'هذه لوحتك الخاصة: كل الأرقام هنا تخص حسابك أنت وتُقرأ من جلستك المشفّرة فقط. لا يمكن لأي مستخدم آخر رؤيتها، ولا يُسمح لأحد بفتح مشاريعك — أو مشاريعه — من حسابك.'
                : 'This is your private dashboard: every number below belongs to your account and is read from your own encrypted session. No other user can see it, and nobody can open your projects — or theirs — from your account.'}
            </p>
          </div>

          {signedOut && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
              <Lock className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
              <p className="text-xs text-rose-200">
                {ar
                  ? 'انتهت جلستك — سجّل الدخول من جديد لعرض بياناتك.'
                  : 'Your session expired — sign in again to see your data.'}
              </p>
            </div>
          )}

          {/* ── Stat cards: plan / balance / used / left ──────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span className="text-[11px] font-bold text-slate-400">{ar ? 'الباقه' : 'Plan'}</span>
              </div>
              <p className="text-lg font-black text-white truncate">
                {activeSubscription?.planName ||
                  (tier === 'free' ? (ar ? 'المجانية' : 'Free') : tier.toUpperCase())}
              </p>
              <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold ${tierMeta.className}`}>
                {ar ? tierMeta.ar : tierMeta.en} ·{' '}
                {planStatus === 'active'
                  ? ar
                    ? 'فعّالة'
                    : 'Active'
                  : planStatus === 'expired'
                    ? ar
                      ? 'منتهية'
                      : 'Expired'
                    : ar
                      ? 'تجريبية'
                      : 'Trial'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span className="text-[11px] font-bold text-slate-400">{ar ? 'الرصيد' : 'Balance'}</span>
              </div>
              <p className="text-lg font-black text-white" dir="ltr">
                {credits === null ? '—' : credits}
                <span className="text-xs font-bold text-slate-400 ms-1">{ar ? 'كريديت' : 'credits'}</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {ar ? 'كل توليدة تستهلك كريديت واحد' : 'Each generation costs one credit'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                <span className="text-[11px] font-bold text-slate-400">{ar ? 'مستهلك اليوم' : 'Used today'}</span>
              </div>
              <p className="text-lg font-black text-white" dir="ltr">
                {limit > 0 ? `${used}/${limit}` : used}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {ar ? 'يتجدّد الحد تلقائياً كل يوم' : 'The limit resets automatically daily'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="w-4 h-4 text-rose-400" aria-hidden="true" />
                <span className="text-[11px] font-bold text-slate-400">{ar ? 'المتبقي من الكوتة' : 'Quota left'}</span>
              </div>
              <p className="text-lg font-black text-white" dir="ltr">
                {limit > 0 || quota ? remaining : '—'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 truncate">
                {quota?.resetsAt
                  ? `${ar ? 'التجديد' : 'Resets'}: ${new Date(quota.resetsAt).toLocaleString(ar ? 'ar-EG' : 'en-GB')}`
                  : ar
                    ? 'يُخصم تلقائياً عند كل استخدام'
                    : 'Deducted automatically on every use'}
              </p>
            </div>
          </div>

          {/* ── Quota meter: how much of today's allowance is gone ────────── */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white">
                  {ar ? 'استهلاك الكوتة اليومي' : 'Daily quota usage'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {ar
                    ? 'يُخصم من حدّ باقتك مع كل توليدة، ويتجدّد تلقائياً عند منتصف الليل (بتوقيت UTC).'
                    : 'Deducted from your plan allowance on every generation and renewed automatically at midnight (UTC).'}
                </p>
              </div>
              <span className="text-xs font-black text-slate-300 shrink-0" dir="ltr">
                {usedPct}%
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${barTone} transition-all duration-500`}
                style={{ width: `${limit > 0 ? usedPct : 0}%` }}
                role="progressbar"
                aria-valuenow={used}
                aria-valuemin={0}
                aria-valuemax={limit || 0}
                aria-label={ar ? 'استهلاك الكوتة' : 'Quota usage'}
              />
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap mt-2 text-[11px]">
              <span className="text-slate-400">
                {ar ? 'مستهلك' : 'Used'}:{' '}
                <b className="text-white" dir="ltr">
                  {used}
                </b>
              </span>
              <span className="text-slate-400">
                {ar ? 'الحد' : 'Limit'}:{' '}
                <b className="text-white" dir="ltr">
                  {limit || '—'}
                </b>
              </span>
              <span className="text-slate-400">
                {ar ? 'المتبقي' : 'Remaining'}:{' '}
                <b className={remaining <= 0 ? 'text-rose-400' : 'text-emerald-300'} dir="ltr">
                  {remaining}
                </b>
              </span>
            </div>

            {quotaError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
                <span className="text-[11px] text-amber-200">
                  {ar
                    ? 'تعذّر قراءة الكوتة الآن (الخادم أو قاعدة البيانات غير متاحة). الأرقام المعروضة هي آخر قراءة ناجحة.'
                    : 'Could not read the quota right now (server or database unavailable). The numbers shown are from the last successful read.'}
                </span>
              </div>
            )}
          </div>

          {/* ── Subscription detail + upgrade ────────────────────────────── */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  {ar ? 'تفاصيل الاشتراك' : 'Subscription details'}
                </h3>
                <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                  <li>
                    {ar ? 'الباقه' : 'Plan'}:{' '}
                    <b className="text-slate-200">
                      {activeSubscription?.planName || (ar ? 'المجانية' : 'Free')}
                    </b>
                  </li>
                  <li>
                    {ar ? 'حالة الاشتراك' : 'Status'}:{' '}
                    <b className="text-slate-200">
                      {planStatus === 'active'
                        ? ar
                          ? 'فعّال'
                          : 'Active'
                        : planStatus === 'expired'
                          ? ar
                            ? 'منتهي'
                            : 'Expired'
                          : ar
                            ? 'تجريبي'
                            : 'Trial'}
                    </b>
                  </li>
                  {expiresAt && (
                    <li>
                      {ar ? 'ينتهي في' : 'Expires'}:{' '}
                      <b className="text-slate-200">
                        {new Date(expiresAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}
                      </b>
                    </li>
                  )}
                  <li>
                    {ar ? 'حد التوليد اليومي' : 'Daily generation limit'}:{' '}
                    <b className="text-slate-200" dir="ltr">
                      {limit || '—'}
                    </b>
                  </li>
                </ul>
              </div>
              {onOpenSubscription && (
                <button
                  type="button"
                  onClick={onOpenSubscription}
                  className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black hover:brightness-110 transition cursor-pointer"
                >
                  {tier === 'free'
                    ? ar
                      ? 'ترقية الباقه'
                      : 'Upgrade plan'
                    : ar
                      ? 'إدارة الاشتراك'
                      : 'Manage plan'}
                </button>
              )}
            </div>
          </div>

          {/* ── Projects: this account's rows only ───────────────────────── */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-rose-400" aria-hidden="true" />
                {ar ? 'مشاريعي' : 'My projects'}
                <span className="text-[11px] font-bold text-slate-500" dir="ltr">
                  ({projects.length})
                </span>
              </h3>
            </div>

            {projects.length === 0 ? (
              <div className="py-8 text-center">
                <FolderTree className="w-8 h-8 mx-auto text-slate-600 mb-2" aria-hidden="true" />
                <p className="text-xs text-slate-400">
                  {ar ? 'لا توجد مشاريع محفوظة على حسابك بعد.' : 'No projects saved to your account yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pe-1">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-2 rounded-lg border border-transparent hover:border-slate-800 hover:bg-slate-900 px-3 py-2 transition min-w-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-200 truncate">{p.name}</span>
                      <span className="block text-[10px] text-slate-500 truncate">
                        {p.versionCount ?? 0} {ar ? 'نسخة' : 'versions'} · {relativeTime(p.updatedAt, ar)}
                      </span>
                    </span>
                    {onSelectProject && (
                      <button
                        type="button"
                        onClick={() => onSelectProject(p.id)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-rose-300 hover:bg-rose-500/15 transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        {ar ? 'فتح' : 'Open'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboardModal;
