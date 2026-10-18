import { useCallback, useState } from 'react';
import { Copy, CheckCircle2, AlertTriangle, Loader2, Globe } from 'lucide-react';
import type { RemoteProject } from '../lib/projects';

interface CustomDomainCardProps {
  project: RemoteProject;
  language: 'ar' | 'en';
  onDomainChanged?: (domain: string | null) => void;
}

const DNS_TARGET_CNAME = 'cname.ebnily.app';
const DNS_TARGET_A = '76.76.21.21';

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}
export function CustomDomainCard({
  project,
  language,
  onDomainChanged,
}: CustomDomainCardProps) {
  const ar = language === 'ar';
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'success' | 'error'; text: string }>({ kind: 'info', text: '' });
  const [copied, setCopied] = useState(false);

  const domain = project.custom_domain ?? null;
  const status: RemoteProject['custom_domain_status'] = project.custom_domain_status ?? null;

  const t = {
    add: ar ? 'إضافة دومين مخصص' : 'Add custom domain',
    placeholder: ar ? 'مثال: متجرك.كوم' : 'e.g. myshop.com',
    btnAdd: ar ? 'تحقق واربط الآن' : 'Verify and link now',
    btnVerify: ar ? 'تحقق من الدومين' : 'Verify domain',
    btnRecheck: ar ? 'إعادة التحقق' : 'Re-check',
    btnCopy: ar ? 'نسخ الرابط' : 'Copy link',
    copiedText: ar ? 'تم النسخ!' : 'Copied!',
    noDomainTitle: ar ? 'لا يوجد دومين مربوط' : 'No custom domain linked',
    noDomainDesc: ar ? 'اربط دومين خاص بك بمشروعك المنشور لتشغيله تحت اسم نطاقك الخاص.' : 'Link a custom domain to your published project to serve it under your own name.',
    pendingTitle: ar ? 'الدومين في الانتظار' : 'Domain pending',
    pendingDesc: ar ? 'تم حفظ الدومين. أضف سجلات DNS التالية في لوحة نطاقاتك، ثم اضغط تحقق.' : 'Domain saved. Add the DNS records below at your domain registrar, then verify.',
    verifyingTitle: ar ? 'جاري التحقق...' : 'Verifying...',
    verifyingDesc: ar ? 'نتحقق من أن سجلات DNS تشير إلى ابنيلي. قد يستغرق دقيقة واحدة.' : 'Checking that your DNS records point to Ebnily. This may take a minute.',
    activeTitle: ar ? 'الدومين مفعل' : 'Domain active',
    activeDesc: ar ? 'موقعك يعمل الآن على الدومين المخصص.' : 'Your site is now live on your custom domain.',
    failedTitle: ar ? 'فشل التحقق من الدومين' : 'Domain verification failed',
    failedDesc: ar ? 'لم نتمكن من التأكد من سجلات DNS. تأكد من إضافة السجلات بشكل صحيح ثم جرب مرة أخرى.' : "We couldn't confirm your DNS records. Make sure you added them correctly, then try again.",
    cnameLabel: ar ? 'سجل CNAME' : 'CNAME record',
    cnameHost: ar ? 'الاسم (المضيف)' : 'Host / Name',
    cnameValue: ar ? 'القيمة (يوجه إلى)' : 'Value / Points to',
    aLabel: ar ? 'سجل A (بديل)' : 'A record (fallback)',
    aHost: ar ? 'الاسم (المضيف)' : 'Host / Name',
    aValue: ar ? 'القيمة (IP)' : 'Value / IP',
    siteLink: ar ? 'فتح الموقع' : 'Open site',
    errorLabel: ar ? 'السبب' : 'Reason',
  };

  const setMsg = (kind: 'info' | 'success' | 'error', text: string) => setMessage({ kind, text });

  const handleAdd = async () => {
    const domainValue = normalizeDomain(input);
    if (!domainValue) return;
    setAdding(true);
    setMsg('info', ar ? 'يحفظ الدومين...' : 'Saving domain...');
    try {
      const res = await fetch('/api/domains/add', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, domain: domainValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg('error', typeof data.message === 'string' ? data.message : ar ? 'فشل حفظ الدومين' : 'Failed to save domain');
        return;
      }
      setMsg('success', ar ? 'تم حفظ الدومين وجاري الانتظار للتحقق' : 'Domain saved, awaiting verification');
      setInput('');
      onDomainChanged?.(domainValue);
    } catch {
      setMsg('error', ar ? 'تعذر الاتصال بالخادم' : 'Could not reach the server');
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async () => {
    if (!domain) return;
    setVerifying(true);
    setMsg('info', ar ? 'جاري التحقق من DNS...' : 'Verifying DNS...');
    try {
      const res = await fetch('/api/domains/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, domain }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg('error', typeof data.message === 'string' ? data.message : ar ? 'فشل التحقق' : 'Verification failed');
        return;
      }
      const newStatus = data.status as RemoteProject['custom_domain_status'];
      if (newStatus === 'active') {
        setMsg('success', ar ? 'تم تفعيل الدومين بنجاح!' : 'Domain activated successfully!');
      } else {
        setMsg('error', typeof data.error === 'string' ? data.error : ar ? 'فشل التحقق من الدومين' : 'Domain verification failed');
      }
      onDomainChanged?.(data.domain ?? domain);
    } catch {
      setMsg('error', ar ? 'تعذر الاتصال بالخادم' : 'Could not reach the server');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = async () => {
    const url = `https://${domain}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const statusColor =
    status === 'active' ? 'text-emerald-400' : status === 'failed' ? 'text-rose-400' : 'text-amber-400';
  const statusBg =
    status === 'active' ? 'bg-emerald-500/10' : status === 'failed' ? 'bg-rose-500/10' : 'bg-amber-500/10';
  const statusBorder =
    status === 'active' ? 'border-emerald-500/30' : status === 'failed' ? 'border-rose-500/30' : 'border-amber-500/30';

  const siteUrl = domain ? `https://${domain}` : '';

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-5 h-5 text-slate-400" aria-hidden="true" />
        <h3 className="text-sm font-black text-white">{t.add}</h3>
      </div>

      {!domain ? (
        <>
          <p className="text-xs text-slate-400 mb-3">{t.noDomainDesc}</p>
          <div className="flex gap-2">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
             
            />
            <button
              type="button"
              disabled={adding || !input.trim()}
              onClick={handleAdd}
              className="shrink-0 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-500 transition"
            >
              {adding ? (ar ? 'جاري الحفظ...' : 'Saving...') : t.btnAdd}
            </button>
          </div>
          {message.text && (
            <p className={`mt-2 text-xs ${message.kind === 'success' ? 'text-emerald-400' : message.kind === 'error' ? 'text-rose-400' : 'text-amber-400'}`}>{message.text}</p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBg} ${statusBorder} ${statusColor}`}>
                {status === 'active' ? (
                  <CheckCircle2 className="w-2.5 h-2.5" aria-hidden="true" />
                ) : status === 'failed' ? (
                  <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
                ) : (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
                )}
                {status === 'active'
                  ? t.activeTitle
                  : status === 'failed'
                  ? t.failedTitle
                  : status === 'verifying'
                  ? t.verifyingTitle
                  : t.pendingTitle}
              </span>
            </div>
            {status === 'active' && (
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 hover:bg-slate-700 transition"
              >
                {t.siteLink}
              </a>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">
            {status === 'active'
              ? t.activeDesc
              : status === 'failed'
              ? t.failedDesc
              : status === 'verifying'
              ? t.verifyingDesc
              : t.pendingDesc}
            <span className="font-mono text-slate-500 ml-1">
              {domain}
            </span>
          </p>

          {(status === 'pending' || status === 'failed') && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 mb-3">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-wider mb-2">
                {t.cnameLabel}
              </h4>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t.cnameHost}</p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 p-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 dir=\"ltr\"">
                      @
                    </span>
                    <span className="text-[10px] text-slate-500" aria-hidden="true">
                      →
                    </span>
                    <span className="flex-1 min-w-0 p-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 dir=\"ltr\"">
                      {DNS_TARGET_CNAME}
                    </span>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-2">
                  <p className="text-xs text-slate-400 mb-1">{t.aHost}</p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 p-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 dir=\"ltr\"">
                      @
                    </span>
                    <span className="text-[10px] text-slate-500" aria-hidden="true">
                      →
                    </span>
                    <span className="flex-1 min-w-0 p-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 dir=\"ltr\"">
                      {DNS_TARGET_A}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {status === 'active' && (
              <button
                type="button"
                onClick={handleCopy}
                disabled={copied}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 disabled:opacity-60 hover:bg-slate-700 transition"
                title={copied ? t.copiedText : t.btnCopy}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1.5" aria-hidden="true" />
                    {t.copiedText}
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1.5" aria-hidden="true" />
                    {t.btnCopy}
                  </>
                )}
              </button>
            )}
            {(status === 'pending' || status === 'failed') && (
              <button
                type="button"
                disabled={verifying}
                onClick={handleVerify}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-500 transition"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                    {ar ? 'جاري التحقق...' : 'Verifying...'}
                  </>
                ) : status === 'failed' ? t.btnRecheck : t.btnVerify}
              </button>
            )}
            {message.text && status !== 'active' && (
              <p className={`text-xs ${message.kind === 'success' ? 'text-emerald-400' : message.kind === 'error' ? 'text-rose-400' : 'text-amber-400'}`}>{message.text}</p>
            )}
          </div>
          {status === 'failed' && project.custom_domain_error && (
            <p className="mt-2 text-xs text-rose-400">{project.custom_domain_error}</p>
          )}
        </>
      )}
    </section>
  );
};








