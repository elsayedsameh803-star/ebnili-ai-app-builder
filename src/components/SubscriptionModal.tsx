import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Sparkles, 
  Copy, 
  CheckCircle2, 
  Smartphone, 
  CreditCard, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft,
  Upload, 
  FileText, 
  Clock, 
  Zap, 
  HelpCircle,
  RotateCcw,
  BadgeCheck,
  AlertCircle
} from 'lucide-react';
import { Language, UserSubscription, SubscriptionTier, BillingCycle } from '../types';
import { 
  SUBSCRIPTION_PLANS, 
  ORANGE_CASH_WALLET_NUMBER, 
  ORANGE_CASH_USSD_CODE,
  ORANGE_CASH_STEPS_AR, 
  ORANGE_CASH_STEPS_EN 
} from '../data/plans';
import { getDeviceFingerprint } from '../utils/fingerprint';
import { MessageCircle } from 'lucide-react';

interface SubscriptionModalProps {
  isOpen?: boolean;
  onClose: () => void;
  subscription?: UserSubscription;
  currentSubscription?: UserSubscription;
  onSubscriptionUpdated: (newSub: UserSubscription) => void;
  language: Language;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen = true,
  onClose,
  subscription: subProp,
  currentSubscription: currSubProp,
  onSubscriptionUpdated,
  language,
}) => {
  const subscription = subProp || currSubProp || {
    tier: 'free',
    planName: 'Starter Free',
    status: 'active',
    generationsUsedToday: 0,
    generationsLimitToday: 5,
    canExportZip: false,
    canUseCustomDomain: false,
    canUseVisualInspector: true,
  };

  const [activeTab, setActiveTab] = useState<'plans' | 'checkout' | 'history'>('plans');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlanTier, setSelectedPlanTier] = useState<SubscriptionTier>('pro');
  
  // Checkout Form State
  const [senderPhone, setSenderPhone] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  // Interaction & Processing State
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedUssd, setCopiedUssd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCelebration, setSuccessCelebration] = useState(false);

  if (!isOpen) return null;

  const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanTier) || SUBSCRIPTION_PLANS[1];
  const targetPrice = billingCycle === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly;

  const handleSelectPlanToCheckout = (tier: SubscriptionTier) => {
    if (tier === 'free') return;
    setSelectedPlanTier(tier);
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === tier);
    const price = billingCycle === 'yearly' ? plan?.priceYearly : plan?.priceMonthly;
    setAmountInput(String(price || 249));
    setErrorMessage(null);
    setActiveTab('checkout');
  };

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(ORANGE_CASH_WALLET_NUMBER);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  const handleCopyUssd = () => {
    navigator.clipboard.writeText(ORANGE_CASH_USSD_CODE);
    setCopiedUssd(true);
    setTimeout(() => setCopiedUssd(false), 2500);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!senderPhone.trim() || senderPhone.trim().length < 8) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال رقم هاتف محفظة أورانج كاش المحول منها بشكل صحيح.' : 'Please enter a valid sender phone number.');
      return;
    }

    if (!transactionReference.trim() || transactionReference.trim().length < 3) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال الرقم المرجعي أو كود العملية من رسالة أورانج كاش.' : 'Please enter the transaction reference / operation code.');
      return;
    }

    setIsSubmitting(true);

    try {
      const devFp = getDeviceFingerprint();

      const res = await fetch('/api/subscriptions/auto-verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-id': devFp.deviceId,
          'x-fingerprint-hash': devFp.fingerprintHash,
        },
        body: JSON.stringify({
          planId: selectedPlanTier,
          billingCycle,
          senderPhone: senderPhone.trim(),
          transactionReference: transactionReference.trim(),
          amount: Number(amountInput) || targetPrice,
          userName: userName.trim() || undefined,
          userEmail: userEmail.trim() || undefined,
          deviceId: devFp.deviceId,
          fingerprintHash: devFp.fingerprintHash,
          receiptImage: receiptPreview || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل التحقق من العملية، يرجى التأكد من الرقم المرجعي أو التواصل عبر واتساب.');
      }

      onSubscriptionUpdated(data.subscription);
      setSuccessCelebration(true);
      setTimeout(() => {
        setSuccessCelebration(false);
        setActiveTab('history');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || (language === 'ar' ? 'حدث خطأ أثناء الاتصال بالخادم.' : 'Server communication error.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToFree = async () => {
    try {
      const res = await fetch('/api/subscriptions/reset-free', { method: 'POST' });
      const data = await res.json();
      if (data.subscription) {
        onSubscriptionUpdated(data.subscription);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn select-none">
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white font-['Cairo',sans-serif]">
                  {language === 'ar' ? 'باقات واشتراكات منصة إبنيلي' : 'Ebnili AI Plans & Subscriptions'}
                </h3>
                <span className="text-[10px] bg-orange-500/20 text-orange-300 font-bold px-2 py-0.5 rounded-full border border-orange-500/30 flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  Orange Cash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {language === 'ar' 
                  ? 'بناء غير محدود، تصدير الكود بالكامل، وتفعيل فوري عبر محفظة أورانج كاش' 
                  : 'Unlimited AI generation, complete source code export, instant activation via Orange Cash'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Current Tier Badge */}
            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
              subscription.tier === 'pro' 
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
                : subscription.tier === 'business'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              <BadgeCheck className="w-3.5 h-3.5" />
              <span>
                {language === 'ar' ? 'خطتك الحالية: ' : 'Current Plan: '}
                <strong className="text-white uppercase">{subscription.tier}</strong>
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950 px-6 pt-2 shrink-0">
          <button
            onClick={() => { setActiveTab('plans'); setErrorMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === 'plans'
                ? 'border-orange-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-orange-400" />
            <span>{language === 'ar' ? 'الباقات والمميزات' : 'Plans & Pricing'}</span>
          </button>

          <button
            onClick={() => { setActiveTab('checkout'); setErrorMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === 'checkout'
                ? 'border-orange-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-orange-400" />
            <span>{language === 'ar' ? 'الدفع والتأكيد (Orange Cash)' : 'Checkout & Orange Cash'}</span>
            <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.2 rounded font-mono">
              01207782741
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('history'); setErrorMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-orange-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>{language === 'ar' ? 'سجل المعاملات والاشتراك' : 'Transactions & Active Plan'}</span>
            {subscription.transactions && subscription.transactions.length > 0 && (
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full font-mono">
                {subscription.transactions.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: PLANS & PRICING */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              {/* Billing Cycle Switch */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-white">
                    {language === 'ar' ? 'اختر دورة الفوترة المناسبة لك' : 'Select your billing cycle'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {language === 'ar' 
                      ? 'وفر حتى 20% عند الاشتراك السنوي عبر محفظة أورانج كاش' 
                      : 'Save up to 20% with yearly payment via Orange Cash'}
                  </p>
                </div>

                <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      billingCycle === 'monthly'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {language === 'ar' ? 'شهرياً' : 'Monthly'}
                  </button>

                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      billingCycle === 'yearly'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{language === 'ar' ? 'سنوياً' : 'Yearly'}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">
                      -20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Plans Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isCurrent = subscription.tier === plan.id;
                  const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

                  return (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col justify-between rounded-2xl p-5 transition border ${
                        plan.isPopular
                          ? 'bg-gradient-to-b from-orange-950/40 via-slate-900 to-slate-900 border-orange-500/60 shadow-xl shadow-orange-500/10 ring-1 ring-orange-500/30'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {plan.badgeAr && (
                        <div className="absolute -top-3 right-4 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                          {language === 'ar' ? plan.badgeAr : plan.badgeEn}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-base font-extrabold text-white">
                            {language === 'ar' ? plan.nameAr : plan.nameEn}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 min-h-[34px] leading-relaxed">
                            {language === 'ar' ? plan.taglineAr : plan.taglineEn}
                          </p>
                        </div>

                        {/* Price Display */}
                        <div className="flex items-baseline gap-1 py-2 border-y border-slate-800/80">
                          {price === 0 ? (
                            <span className="text-2xl font-black text-white">
                              {language === 'ar' ? 'مجاناً' : 'Free'}
                            </span>
                          ) : (
                            <>
                              <span className="text-3xl font-black text-white font-mono">{price}</span>
                              <span className="text-xs font-semibold text-orange-400">
                                {language === 'ar' ? 'ج.م' : 'EGP'}
                              </span>
                              <span className="text-xs text-slate-400">
                                /{billingCycle === 'yearly' ? (language === 'ar' ? 'سنة' : 'yr') : (language === 'ar' ? 'شهر' : 'mo')}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Features List */}
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            {language === 'ar' ? 'المزايا المضمنة:' : 'Included features:'}
                          </span>
                          <ul className="space-y-2 text-xs">
                            {(language === 'ar' ? plan.featuresAr : plan.featuresEn).map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-slate-300 leading-snug">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                                  plan.isPopular ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  ✓
                                </span>
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-6 mt-4 border-t border-slate-800">
                        {isCurrent ? (
                          <div className="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs text-center border border-slate-700 flex items-center justify-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>{language === 'ar' ? 'خطتك الحالية المفعلة' : 'Current Active Plan'}</span>
                          </div>
                        ) : plan.id === 'free' ? (
                          <button
                            onClick={handleResetToFree}
                            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                          >
                            {language === 'ar' ? 'الباقة المجانية' : 'Use Free Starter'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectPlanToCheckout(plan.id)}
                            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                              plan.isPopular
                                ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black shadow-orange-500/20'
                                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                            }`}
                          >
                            <span>{language === 'ar' ? 'الترقية عبر Orange Cash' : 'Upgrade via Orange Cash'}</span>
                            {language === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Orange Cash Quick Note Banner */}
              <div className="bg-gradient-to-r from-orange-950/50 via-slate-900 to-slate-900 border border-orange-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs sm:text-sm">
                      {language === 'ar' 
                        ? 'الدفع المباشر عبر محفظة أورانج كاش (Orange Cash)' 
                        : 'Direct Checkout via Orange Cash Mobile Wallet'}
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      {language === 'ar'
                        ? 'حول لأي باقة مباشرة إلى الرقم 01207782741 وأدخل كود العملية لتفعيل حسابك فورياً دون انتظار.'
                        : 'Transfer directly to 01207782741, input your reference ID, and your subscription activates instantly.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => { setSelectedPlanTier('pro'); setActiveTab('checkout'); }}
                  className="whitespace-nowrap px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md shadow-orange-600/30 transition cursor-pointer"
                >
                  {language === 'ar' ? 'بدء الدفع الآن' : 'Pay with Orange Cash'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CHECKOUT & ORANGE CASH CONFIRMATION */}
          {activeTab === 'checkout' && (
            <div className="space-y-6">
              {/* Top Banner: Selected Plan & Destination Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box 1: Plan Summary */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">
                      {language === 'ar' ? 'الباقة المختارة للتفعيل:' : 'Selected Plan:'}
                    </span>
                    <span className="text-[11px] bg-orange-500/20 text-orange-300 font-bold px-2 py-0.5 rounded-full border border-orange-500/30">
                      {billingCycle === 'yearly' ? (language === 'ar' ? 'اشتراك سنوي (-20%)' : 'Yearly Plan') : (language === 'ar' ? 'اشتراك شهري' : 'Monthly Plan')}
                    </span>
                  </div>

                  <div className="my-2">
                    <h4 className="text-lg font-black text-white">
                      {language === 'ar' ? selectedPlan.nameAr : selectedPlan.nameEn}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {language === 'ar' ? selectedPlan.taglineAr : selectedPlan.taglineEn}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">{language === 'ar' ? 'المبلغ المطلوب تحويله:' : 'Amount to transfer:'}</span>
                    <span className="text-xl font-black text-orange-400 font-mono">
                      {targetPrice} <span className="text-xs text-slate-300 font-sans">{language === 'ar' ? 'جنيه مصري' : 'EGP'}</span>
                    </span>
                  </div>
                </div>

                {/* Box 2: Official Orange Cash Wallet & Quick Copy */}
                <div className="bg-gradient-to-br from-orange-950/60 via-slate-900 to-slate-950 p-4 rounded-2xl border border-orange-500/40 shadow-lg shadow-orange-500/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-300 font-bold flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'رقم محفظة أورانج كاش الرسمية' : 'Official Orange Cash Wallet'}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full">
                      {language === 'ar' ? 'معتمد ومؤكد' : 'Verified'}
                    </span>
                  </div>

                  {/* Big Number Copy Widget */}
                  <div className="my-3 bg-slate-950 px-4 py-3 rounded-xl border border-orange-500/50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400">{language === 'ar' ? 'رقم التحويل (Destination)' : 'Recipient Phone:'}</span>
                      <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-wider">
                        {ORANGE_CASH_WALLET_NUMBER}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyWallet}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer shadow-md ${
                        copiedNumber
                          ? 'bg-emerald-600 text-white'
                          : 'bg-orange-600 hover:bg-orange-500 text-white'
                      }`}
                    >
                      {copiedNumber ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedNumber ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') : (language === 'ar' ? 'نسخ الرقم' : 'Copy')}</span>
                    </button>
                  </div>

                  {/* USSD Dial Helper */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>
                      {language === 'ar' ? 'للتحويل السريع اطلب الكود:' : 'Quick USSD Dial:'}{' '}
                      <strong className="text-orange-300 font-mono">#115#</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUssd}
                      className="text-orange-400 hover:text-orange-300 underline font-semibold"
                    >
                      {copiedUssd ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ #115#' : 'Copy #115#')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Orange Cash Instructions */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-black">
                      i
                    </span>
                    {language === 'ar' ? 'خطوات التحويل عبر Orange Cash' : 'How to Pay with Orange Cash'}
                  </h5>
                  <span className="text-[11px] text-slate-400">
                    {language === 'ar' ? 'مدة التفعيل: فورية خلال ثوانٍ' : 'Activation: Instant in seconds'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {(language === 'ar' ? ORANGE_CASH_STEPS_AR : ORANGE_CASH_STEPS_EN).map((st) => (
                    <div key={st.step} className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400">
                        <span className="w-4 h-4 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px]">
                          {st.step}
                        </span>
                        <span>{st.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {st.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direct WhatsApp Support Helper for Payment */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h6 className="text-xs font-bold text-white">
                      {language === 'ar' ? 'هل تريد التفعيل أو الدعم الفوري عبر واتساب؟' : 'Need instant activation or WhatsApp support?'}
                    </h6>
                    <p className="text-[11px] text-slate-400">
                      {language === 'ar'
                        ? 'تواصل مباشرة مع المالك عبر رقم محفظة أورانج كاش 01207782741'
                        : 'Chat directly with the owner on 01207782741'}
                    </p>
                  </div>
                </div>

                <a
                  href={`https://wa.me/201207782741?text=${encodeURIComponent(
                    language === 'ar'
                      ? `مرحباً، أود تفعيل باقة ${selectedPlan.nameAr} وسداد قيمتها عبر محفظة أورانج كاش.`
                      : `Hello, I want to activate the ${selectedPlan.nameEn} plan via Orange Cash.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-md shadow-emerald-600/20"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'مراسلة واتساب' : 'WhatsApp Owner'}</span>
                </a>
              </div>

              {/* Transaction Reference Submission Form */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-orange-500/30 shadow-xl space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h4 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-400" />
                    {language === 'ar' ? 'تأكيد المعاملة وتفعيل الاشتراك' : 'Submit Transaction Reference to Activate'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === 'ar'
                      ? 'أدخل بيانات العملية المرجعية التي وصلتك في رسالة SMS بعد التحويل لتفعيل باقتك فورياً.'
                      : 'Provide the transaction reference code received in your SMS to confirm and unlock Pro perks.'}
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitPayment} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Sender Wallet / Mobile Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        {language === 'ar' ? 'رقم المحفظة المحول منها (Orange Cash/Vodafone/Etisalat) *' : 'Sender Wallet Phone Number *'}
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          placeholder="012XXXXXXXX"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 font-mono tracking-wider"
                        />
                        <Smartphone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {language === 'ar' ? 'رقم الهاتف الخاص بمحفظتك التي قمت بالتحويل منها' : 'The wallet phone number you sent funds from'}
                      </span>
                    </div>

                    {/* Transaction Reference / Operation Code */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        {language === 'ar' ? 'الرقم المرجعي للعملية (Transaction Reference / ID) *' : 'Transaction Reference / Operation ID *'}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={transactionReference}
                          onChange={(e) => setTransactionReference(e.target.value)}
                          placeholder="مثال: REF-9842109 أو 884129"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 font-mono uppercase tracking-wider font-bold"
                        />
                        <BadgeCheck className="w-4 h-4 text-orange-400 absolute left-3 top-3" />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {language === 'ar' ? 'كود العملية الموجود في رسالة تأكيد تحويل أورانج كاش النصية' : 'The reference ID found in your Orange Cash SMS confirmation'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Amount Transferred */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        {language === 'ar' ? 'المبلغ المحول (ج.م) *' : 'Transferred Amount (EGP) *'}
                      </label>
                      <input
                        type="number"
                        required
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        placeholder="249"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 font-mono font-bold"
                      />
                    </div>

                    {/* Subscriber Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        {language === 'ar' ? 'اسم المشترك' : 'Subscriber Name'}
                      </label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder={language === 'ar' ? 'مثال: سامح السيد' : 'e.g., Sameh Elsayed'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {/* Email for Invoicing */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        {language === 'ar' ? 'البريد الإلكتروني للإشعار' : 'Billing Email'}
                      </label>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Screenshot / Receipt Upload (Optional) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      {language === 'ar' ? 'صورة إشعار التحويل / لقطة الشاشة (اختياري لتسريع التوثيق)' : 'Payment Receipt / Screenshot (Optional)'}
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer transition">
                        <Upload className="w-4 h-4 text-orange-400" />
                        <span>{language === 'ar' ? 'اختيار لقطة الشاشة' : 'Choose Receipt Image'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptUpload}
                          className="hidden"
                        />
                      </label>

                      {receiptPreview ? (
                        <div className="flex items-center gap-2">
                          <img 
                            src={receiptPreview} 
                            alt="Receipt preview" 
                            className="w-8 h-8 rounded-lg object-cover border border-orange-500/40"
                          />
                          <span className="text-[11px] text-emerald-400 font-semibold">
                            {language === 'ar' ? 'تم إرفاق الإشعار' : 'Receipt attached'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReceiptPreview(null)}
                            className="text-xs text-rose-400 hover:text-rose-300 underline"
                          >
                            {language === 'ar' ? 'حذف' : 'Remove'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          {language === 'ar' ? 'يمكنك إرفاق صورة رسالة التأكيد لتوثيق فوري' : 'Upload screenshot for instant archiving'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submit CTA */}
                  <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        {language === 'ar'
                          ? 'تحويل مباشر إلى 01207782741 وتفعيل تلقائي فوري'
                          : 'Direct transfer to 01207782741 with instant activation'}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-orange-500/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                          <span>{language === 'ar' ? 'جاري التحقق والتفعيل...' : 'Verifying & Activating...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-slate-950" />
                          <span>{language === 'ar' ? 'تأكيد المعاملة وتفعيل الاشتراك الآن' : 'Confirm Reference & Activate Subscription'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: TRANSACTIONS & ACTIVE PLAN */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Active Plan Card */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">
                      {language === 'ar' ? 'حالة الحساب والاشتراك الحالي' : 'Current Account & Subscription Status'}
                    </span>
                    <h3 className="text-xl font-extrabold text-white flex items-center gap-2 mt-0.5">
                      <span>{subscription.planName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {language === 'ar' ? 'نشط ومفعل' : 'Active'}
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      {language === 'ar' ? 'ترقية أو تغيير الباقة' : 'Change or Upgrade Plan'}
                    </button>
                  </div>
                </div>

                {/* Quota & Perks breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'توليد الذكاء الاصطناعي' : 'AI Generation'}</span>
                    <strong className="text-white font-bold text-sm">
                      {subscription.generationsLimitToday > 100 
                        ? (language === 'ar' ? 'غير محدود ∞' : 'Unlimited ∞') 
                        : `${subscription.generationsUsedToday}/${subscription.generationsLimitToday}`}
                    </strong>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'تصدير الكود الكامل' : 'Full Code ZIP Export'}</span>
                    <strong className="text-emerald-400 font-bold text-sm">
                      {subscription.canExportZip ? (language === 'ar' ? 'مفعل ✅' : 'Unlocked ✅') : (language === 'ar' ? 'غير متاح' : 'Locked')}
                    </strong>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'التعديل البصري' : 'Visual Inspector'}</span>
                    <strong className="text-rose-400 font-bold text-sm">
                      {subscription.canUseVisualInspector ? (language === 'ar' ? 'مفعل ✅' : 'Enabled ✅') : (language === 'ar' ? 'غير متاح' : 'Locked')}
                    </strong>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'محفظة الدفع المعتمدة' : 'Official Wallet'}</span>
                    <strong className="text-orange-400 font-mono font-bold text-xs">
                      {ORANGE_CASH_WALLET_NUMBER}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Transactions Reference Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{language === 'ar' ? 'سجل معاملات وتأكيدات Orange Cash' : 'Orange Cash Transaction Reference Log'}</span>
                  </h4>
                  <span className="text-xs text-slate-500">
                    {subscription.transactions?.length || 0} {language === 'ar' ? 'معاملة مسجلة' : 'records'}
                  </span>
                </div>

                {(!subscription.transactions || subscription.transactions.length === 0) ? (
                  <div className="text-center py-8 bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                    {language === 'ar' ? 'لا توجد معاملات تحويل مسجلة بعد.' : 'No recorded transactions yet.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-xs text-left" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4 font-semibold">{language === 'ar' ? 'الرقم المرجعي / ID' : 'Reference ID'}</th>
                          <th className="py-3 px-4 font-semibold">{language === 'ar' ? 'الباقة' : 'Plan'}</th>
                          <th className="py-3 px-4 font-semibold">{language === 'ar' ? 'محفظة المرسل' : 'Sender Wallet'}</th>
                          <th className="py-3 px-4 font-semibold">{language === 'ar' ? 'محفظة الاستلام' : 'Recipient Wallet'}</th>
                          <th className="py-3 px-4 font-semibold">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                          <th className="py-3 px-4 font-semibold">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                          <th className="py-3 px-4 font-semibold">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {subscription.transactions.map((txn) => (
                          <tr key={txn.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              {txn.transactionReference}
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {txn.planName}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {txn.senderPhone}
                            </td>
                            <td className="py-3 px-4 font-mono text-orange-400 font-semibold">
                              {txn.recipientWallet}
                            </td>
                            <td className="py-3 px-4 font-bold text-white font-mono">
                              {txn.amount} {txn.currency}
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {new Date(txn.submittedAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <Check className="w-3 h-3" />
                                {language === 'ar' ? 'مؤكد ومفعل' : 'Confirmed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Success Celebration Overlay */}
        {successCelebration && (
          <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-400 to-green-500 text-slate-950 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/30 animate-bounce">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
              {language === 'ar' ? 'تم تأكيد المعاملة وتفعيل اشتراكك بنجاح! 🎉' : 'Payment Confirmed & Subscription Activated! 🎉'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed mb-4">
              {language === 'ar' 
                ? `تم توثيق الرقم المرجعي للعملية وتفعيل باقة ${selectedPlan.nameAr} فورياً على حسابك. استمتع ببناء التطبيقات بلا حدود وتصدير الكود بالكامل!`
                : `Your Orange Cash reference code has been verified and your subscription is now live. Enjoy unlimited generation and full export capabilities!`}
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-xl border border-orange-500/30">
              <span>{language === 'ar' ? 'الرقم المرجعي:' : 'Reference:'}</span>
              <strong>{transactionReference || 'EBNILI-ORANGE-VERIFIED'}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
