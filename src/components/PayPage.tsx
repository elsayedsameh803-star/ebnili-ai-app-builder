import { useState, useEffect, useRef } from 'react';
import { Check, Copy, Upload, ShieldCheck, ArrowLeft, ArrowRight, Loader2, FileText, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Language, BillingCycle, SubscriptionTier } from '../types';
import {
  SUBSCRIPTION_PLANS,
  ORANGE_CASH_WALLET_NUMBER,
  ORANGE_CASH_STEPS_AR,
  ORANGE_CASH_STEPS_EN,
} from '../data/plans';
import { getDeviceFingerprint } from '../utils/fingerprint';

/**
 * /pay — the checkout page.
 *
 * Reachable as a real URL because `vercel.json` already rewrites every
 * non-/api path to index.html (this app deliberately has no router), e.g.
 * /pay?plan=pro&cycle=monthly.
 *
 * The Orange Cash QR is rendered locally from the wallet number, so the payment
 * number is never handed to a third-party image service.
 */
interface PayPageProps {
  language: Language;
  initialPlan?: SubscriptionTier;
  initialCycle?: BillingCycle;
  onNavigate: (path: string) => void;
}

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_RECEIPT = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/** Read a file as base64 (no data: prefix) for the JSON upload. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export const PayPage = ({
  language,
  initialPlan = 'pro',
  initialCycle = 'monthly',
  onNavigate,
}: PayPageProps) => {
  const ar = language === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;

  const [planId, setPlanId] = useState<SubscriptionTier>(initialPlan);
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [copied, setCopied] = useState(false);
  const [senderPhone, setSenderPhone] = useState('');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[1];
  const usd = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const egp = cycle === 'yearly' ? plan.payEgpYearly : plan.payEgpMonthly;
  const steps = ar ? ORANGE_CASH_STEPS_AR : ORANGE_CASH_STEPS_EN;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Release the object URL when the selection changes, so a long session does
  // not leak a decoded image per pick.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(ORANGE_CASH_WALLET_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(ar ? 'تعذّر النسخ تلقائياً — انسخ الرقم يدوياً.' : 'Could not copy automatically — copy the number manually.');
    }
  };

  const pickFile = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (!ACCEPTED_RECEIPT.includes(f.type)) {
      setError(ar ? 'صيغة غير مدعومة. استخدم صورة أو PDF.' : 'Unsupported format. Use an image or PDF.');
      return;
    }
    if (f.size > MAX_RECEIPT_BYTES) {
      setError(ar ? 'حجم الملف أكبر من 5 ميجابايت.' : 'File is larger than 5 MB.');
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    setError(null);
    if (senderPhone.trim().length < 8) {
      setError(ar ? 'اكتب رقم محفظة أورانج كاش المحوِّل منه.' : 'Enter the sender wallet number.');
      return;
    }
    if (reference.trim().length < 3) {
      setError(ar ? 'اكتب الرقم المرجعي من رسالة التحويل.' : 'Enter the transaction reference from the SMS.');
      return;
    }
    setBusy(true);
    try {
      const devFp = getDeviceFingerprint();
      const res = await fetch('/api/payments/receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': devFp.deviceId,
          'x-fingerprint-hash': devFp.fingerprintHash,
        },
        body: JSON.stringify({
          planId,
          cycle,
          amountEgp: egp,
          amountUsd: usd,
          senderPhone: senderPhone.trim(),
          transactionReference: reference.trim(),
          fileName: file?.name ?? null,
          fileType: file?.type ?? null,
          fileData: file ? await fileToBase64(file) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { message?: string }).message ||
            (ar ? 'تعذّر إرسال الطلب. حاول مرة أخرى.' : 'Could not submit. Please try again.'),
        );
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : (ar ? 'حدث خطأ غير متوقع.' : 'Unexpected error.'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4" dir={ar ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full text-center bg-slate-900 border border-emerald-500/30 rounded-2xl p-8">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
            <Check className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-white mb-2">{ar ? 'تم استلام طلبك' : 'Request received'}</h1>
          <p className="text-sm text-slate-400 leading-7">
            {ar
              ? 'سنتحقق من التحويل عبر محفظة أورانج كاش ونفعّل اشتراكك. التفعيل يدوي ولا يتم تلقائياً.'
              : 'We will verify the Orange Cash transfer and activate your plan. Activation is manual.'}
          </p>
          <button onClick={() => onNavigate('/')} className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition">
            {ar ? 'العودة للاستوديو' : 'Back to the studio'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={ar ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <button onClick={() => onNavigate('/pricing')} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-6">
          <Arrow className="w-3.5 h-3.5 rotate-180" />
          {ar ? 'الأسعار' : 'Pricing'}
        </button>

        <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">{ar ? 'إتمام الدفع' : 'Complete your payment'}</h1>
        <p className="text-sm text-slate-400 mb-8 leading-7">
          {ar
            ? 'حوّل المبلغ إلى محفظة أورانج كاش، ثم ارفع صورة إشعار التحويل.'
            : 'Transfer to the Orange Cash wallet, then upload your transfer receipt.'}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-4">{ar ? 'الباقة' : 'Plan'}</h2>
              <div className="grid grid-cols-2 gap-3">
                {SUBSCRIPTION_PLANS.filter((p) => p.id !== 'free').map((p) => {
                  const active = p.id === planId;
                  const pUsd = cycle === 'yearly' ? p.priceYearly : p.priceMonthly;
                  const pEgp = cycle === 'yearly' ? p.payEgpYearly : p.payEgpMonthly;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlanId(p.id)}
                      className={`text-right p-4 rounded-xl border transition ${
                        active ? 'border-rose-500/60 bg-rose-500/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white mb-1">{ar ? p.nameAr : p.nameEn}</div>
                      <div className="text-xl font-black text-white font-mono">${pUsd.toFixed(2)}</div>
                      <div className="text-[11px] text-orange-300/90 mt-0.5">{ar ? `${pEgp} ج.م` : `${pEgp} EGP`}</div>
                    </button>
                  );
                })}
              </div>
              <div className="inline-flex items-center gap-1 mt-4 p-1 rounded-xl bg-slate-950 border border-slate-800">
                {(['monthly', 'yearly'] as BillingCycle[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCycle(c)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                      cycle === c ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c === 'monthly' ? (ar ? 'شهري' : 'Monthly') : (ar ? 'سنوي' : 'Yearly')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">{ar ? 'بيانات التحويل' : 'Transfer details'}</h2>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">{ar ? 'رقم محفظتك المحوِّل منه' : 'Your sender wallet number'}</label>
                <input
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">{ar ? 'الرقم المرجعي من رسالة التحويل' : 'Transaction reference from the SMS'}</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={ar ? 'مثال: OG12345678' : 'e.g. OG12345678'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">{ar ? 'صورة إشعار التحويل (اختياري)' : 'Payment receipt (optional)'}</label>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="hidden" />
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition">
                    <Upload className="w-3.5 h-3.5" />
                    {ar ? 'اختر ملفاً' : 'Choose file'}
                  </button>
                  {file && preview && (
                    <div className="flex items-center gap-2">
                      {file.type.startsWith('image/') ? (
                        <img src={preview} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-700" />
                      ) : (
                        <span className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center"><FileText className="w-4 h-4 text-slate-400" /></span>
                      )}
                      <span className="text-[11px] text-slate-300 truncate max-w-[140px]">{file.name}</span>
                      <button onClick={() => setFile(null)} className="text-rose-400 hover:text-rose-300"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">{ar ? 'PNG أو JPG أو PDF — حتى 5 ميجابايت.' : 'PNG, JPG or PDF — up to 5 MB.'}</p>
              </div>
              {error && (
                <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>
              )}
              <button
                onClick={submit}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-slate-950 text-xs font-extrabold transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {busy ? (ar ? 'جارٍ الإرسال...' : 'Sending...') : (ar ? 'إرسال طلب التفعيل' : 'Submit activation request')}
              </button>
              <p className="text-[10px] text-slate-500 leading-5">
                {ar
                  ? 'التفعيل يدوي بعد التحقق من التحويل — لا يتم أي تفعيل تلقائي.'
                  : 'Activation is manual after we verify the transfer — nothing is granted automatically.'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/30 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-4">{ar ? 'محفظة أورانج كاش' : 'Orange Cash wallet'}</h2>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="bg-white p-3 rounded-xl shrink-0">
                  <QRCodeSVG value={ORANGE_CASH_WALLET_NUMBER} size={132} level="M" bgColor="#ffffff" fgColor="#0f172a" />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <div className="text-[11px] text-slate-400 mb-1">{ar ? 'رقم المحفظة' : 'Wallet number'}</div>
                  <div className="text-2xl font-black text-white font-mono tracking-wider" dir="ltr">{ORANGE_CASH_WALLET_NUMBER}</div>
                  <div className="text-[11px] text-slate-400 mt-2">{ar ? 'أو من داخل التطبيق: #115#' : 'Or dial from the app: #115#'}</div>
                  <button onClick={copyWallet} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? (ar ? 'تم النسخ' : 'Copied') : (ar ? 'نسخ الرقم' : 'Copy number')}
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-orange-500/20 text-[11px] text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {ar ? `المبلغ المطلوب تحويله: ${egp} ج.م مقابل $${usd.toFixed(2)}` : `Transfer ${egp} EGP for $${usd.toFixed(2)}`}
              </div>
            </div>

          </div>

          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-4">{ar ? 'خطوات الدفع' : 'How to pay'}</h2>
              <ol className="space-y-4">
                {steps.map((s) => (
                  <li key={s.step} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-black flex items-center justify-center shrink-0">
                      {s.step}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">{s.title}</div>
                      <p className="text-[11px] text-slate-400 leading-6 mt-0.5">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

