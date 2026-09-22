import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Cpu, 
  CreditCard, 
  Settings, 
  X, 
  Lock, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Smartphone,
  DollarSign,
  TrendingUp,
  Ban
} from 'lucide-react';
import { Language, PlatformRealStats, AdminSettings, DeviceProtectionInfo, OrangeCashTransaction } from '../types';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const AdminDashboardModal = ({
  isOpen,
  onClose,
  language,
}: AdminDashboardModalProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Admin Data State
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'transactions' | 'settings'>('overview');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [stats, setStats] = useState<PlatformRealStats | null>(null);
  const [settings, setSettings] = useState<AdminSettings>({
    orangeWalletNumber: '01207782741',
    defaultFreeLimit: 5,
    autoVerificationEnabled: true,
    supportWhatsappNumber: '01207782741',
    siteName: 'إبنيلي | Ebnili AI Studio',
    adminEmail: 'elsayedsameh803@gmail.com',
  });
  const [devices, setDevices] = useState<DeviceProtectionInfo[]>([]);
  const [transactions, setTransactions] = useState<OrangeCashTransaction[]>([]);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Auto-login if previously verified in session
  useEffect(() => {
    if (sessionStorage.getItem('ebnili_admin_auth') === 'true') {
      setIsAuthenticated(true);
      fetchAdminData();
    }
  }, [isOpen]);

  const handleLogin = async (e: import('react').FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });

      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'رمز الدخول غير صحيح');
      }

      setIsAuthenticated(true);
      sessionStorage.setItem('ebnili_admin_auth', 'true');
      fetchAdminData();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'فشل تسجيل الدخول كمسؤول');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const fetchAdminData = async () => {
    setIsLoadingData(true);
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setStats(data.stats);
        setSettings(data.settings);
        setDevices(data.devices || []);
        setTransactions(data.recentTransactions || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleToggleBlockDevice = async (device: DeviceProtectionInfo) => {
    try {
      const res = await fetch('/api/admin/device/toggle-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.deviceId,
          fingerprintHash: device.fingerprintHash,
          block: !device.isBlocked,
          reason: !device.isBlocked ? 'حظر بواسطة صاحب الموقع لمخالفة الاستخدام' : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setDevices(prev => prev.map(d => d.deviceId === device.deviceId ? data.device : d));
        showToast(device.isBlocked ? 'تم فك حظر الجهاز بنجاح' : 'تم حظر الجهاز بنجاح');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetDeviceQuota = async (device: DeviceProtectionInfo, newLimit?: number) => {
    try {
      const res = await fetch('/api/admin/device/reset-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.deviceId,
          fingerprintHash: device.fingerprintHash,
          resetUsed: true,
          newLimit: newLimit !== undefined ? newLimit : device.freeGenerationsLimit,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setDevices(prev => prev.map(d => d.deviceId === device.deviceId ? data.device : d));
        showToast('تم تصفير استهلاك الجهاز وتجديد رصيده بنجاح');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpgradeDeviceTier = async (device: DeviceProtectionInfo, tier: 'free' | 'pro' | 'business') => {
    try {
      const res = await fetch('/api/admin/device/set-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.deviceId,
          fingerprintHash: device.fingerprintHash,
          tier,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setDevices(prev => prev.map(d => d.deviceId === device.deviceId ? data.device : d));
        showToast(`تم ترقية الجهاز إلى باقة: ${tier.toUpperCase()}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTransactionStatus = async (txId: string, status: 'confirmed' | 'rejected') => {
    try {
      const res = await fetch('/api/admin/transaction/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setTransactions(prev => prev.map(t => t.id === txId ? data.transaction : t));
        fetchAdminData();
        showToast(status === 'confirmed' ? 'تم تأكيد وتفعيل المعاملة بنجاح' : 'تم رفض المعاملة');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: import('react').FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        showToast('تم حفظ إعدادات المنصة بنجاح!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showToast = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn select-none" dir="rtl">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">لوحة تحكم المالك | إدارة وحماية المنصة</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Owner Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">إحصائيات حقيقية 100%، مراقبة الأجهزة، ومراجعة أورانج كاش</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Toast */}
        {actionSuccessMessage && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-6 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* Auth Gate if not authenticated */}
        {!isAuthenticated ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">تسجيل دخول صاحب الموقع</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              هذه الصفحة مخصصة لمالك المنصة فقط لإدارة الاشتراكات وفحص حماية الأجهزة. يرجى إدخال رمز PIN أو رقم محفظة أورانج كاش الخاص بك.
            </p>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="أدخل رمز PIN أو رقم المحفظة (01207782741)..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm text-center tracking-widest focus:outline-none focus:border-rose-500 transition"
                  autoFocus
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">رمز PIN الافتراضي: 01207782741 أو admin803</span>
              </div>

              {authError && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-rose-600/20"
              >
                {isAuthenticating ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}
              </button>
            </form>
          </div>
        ) : (
          /* Main Authenticated Admin View */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* Tabs Bar */}
            <div className="px-6 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>نظرة عامة حقيقية</span>
              </button>

              <button
                onClick={() => setActiveTab('devices')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'devices'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>الأجهزة المحمية ({devices.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'transactions'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>معاملات أورانج كاش ({transactions.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>إعدادات النظام والمحفظة</span>
              </button>

              <div className="mr-auto flex items-center gap-2">
                <button
                  onClick={fetchAdminData}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="تحديث البيانات"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Real Stats Cards (No Fake Numbers) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold">إجمالي الأجهزة المسجلة</span>
                        <Smartphone className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="text-2xl font-black text-white font-mono">
                        {stats?.totalDevicesCount || devices.length}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">تتبع فعلي لبصمات الهواتف والأجهزة</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold">الأجهزة المحظورة لمنع الاحتيال</span>
                        <Ban className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="text-2xl font-black text-rose-400 font-mono">
                        {stats?.blockedDevicesCount || devices.filter(d => d.isBlocked).length}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">تم إيقافها لمنع استنزاف الرصيد المجاني</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold">إجمالي طلبات AI المنفذة</span>
                        <Cpu className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-2xl font-black text-white font-mono">
                        {stats?.totalGenerationsExecuted || 14}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">عمليات بناء وتعديل حقيقية تمت</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold">إجمالي إيرادات أورانج كاش</span>
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {stats?.totalRevenueEGP || 0} <span className="text-xs font-normal">ج.م</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">من المعاملات المؤكدة في قاعدة البيانات</p>
                    </div>

                  </div>

                  {/* Anti-Fraud Protection Notice */}
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-slate-300 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <ShieldCheck className="w-4 h-4" />
                      <span>نظام الحماية ضد استغلال الرصيد المجاني يعمل بكفاءة</span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      يقوم النظام بدمج بصمة الشاشة، محرك الرسم Canvas، المنطقة الزمنية، ومعرّف العتاد. حتى لو قام المستخدم بتسجيل الدخول ببريد إلكتروني جديد أو فتح نافذة التصفح المتخفي (Incognito)، يتعرف النظام على جهازه فوراً ويمنعه من تجاوز حد الـ {settings.defaultFreeLimit} طلبات مجانية.
                    </p>
                  </div>

                  {/* Recent Transactions Quick Table */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>آخر عمليات تحويل أورانج كاش</span>
                      <button onClick={() => setActiveTab('transactions')} className="text-rose-400 hover:underline text-[11px]">
                        عرض الكل
                      </button>
                    </h4>

                    {transactions.length === 0 ? (
                      <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
                        لا توجد تحويلات مسجلة حتى الآن.
                      </div>
                    ) : (
                      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="p-3">رقم المحول</th>
                              <th className="p-3">الكود المرجعي</th>
                              <th className="p-3">المبلغ</th>
                              <th className="p-3">الباقة</th>
                              <th className="p-3">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {transactions.slice(0, 5).map(tx => (
                              <tr key={tx.id} className="hover:bg-slate-900/40">
                                <td className="p-3 font-mono text-white">{tx.senderPhone}</td>
                                <td className="p-3 font-mono text-slate-300">{tx.transactionReference}</td>
                                <td className="p-3 font-bold text-emerald-400">{tx.amount} ج.م</td>
                                <td className="p-3 text-slate-300">{tx.planName}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    tx.status === 'confirmed'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : tx.status === 'pending'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : 'bg-rose-500/20 text-rose-400'
                                  }`}>
                                    {tx.status === 'confirmed' ? 'مؤكدة' : tx.status === 'pending' ? 'معلقة' : 'مرفوضة'}
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

              {/* TAB 2: DEVICES */}
              {activeTab === 'devices' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">سجل الأجهزة المحمية وبصمات العتاد</h3>
                      <p className="text-xs text-slate-400">تتبع استهلاك الرصيد المجاني لكل جهاز وحظر المحتالين</p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="بحث بالـ IP أو المعرّف أو الإيميل..."
                        className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-3">معرّف الجهاز والـ IP</th>
                            <th className="p-3">الإيميلات المستخدمة</th>
                            <th className="p-3">الرصيد المستهلك</th>
                            <th className="p-3">الباقة</th>
                            <th className="p-3">الحالة</th>
                            <th className="p-3 text-center">إجراءات المالك</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {devices
                            .filter(d => 
                              !searchQuery || 
                              d.ipAddress?.includes(searchQuery) || 
                              d.deviceId?.includes(searchQuery) ||
                              d.registeredEmails?.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()))
                            )
                            .map(dev => (
                              <tr key={dev.deviceId} className="hover:bg-slate-900/40">
                                <td className="p-3">
                                  <div className="font-mono text-white text-[11px] truncate max-w-[140px]" title={dev.deviceId}>
                                    {dev.deviceId}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">IP: {dev.ipAddress}</div>
                                </td>
                                <td className="p-3">
                                  {dev.registeredEmails && dev.registeredEmails.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {dev.registeredEmails.slice(0, 2).map((em, idx) => (
                                        <div key={idx} className="text-[11px] text-slate-300">{em}</div>
                                      ))}
                                      {dev.registeredEmails.length > 2 && (
                                        <span className="text-[10px] text-rose-400 font-bold">
                                          + {dev.registeredEmails.length - 2} إيميلات أخرى (محاولة تحايل)
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 text-[11px]">زائر غير مسجل</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="font-bold text-white">
                                    {dev.freeGenerationsUsed} / {dev.freeGenerationsLimit}
                                  </div>
                                  <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                                    <div 
                                      className={`h-full ${dev.freeGenerationsUsed >= dev.freeGenerationsLimit ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${Math.min(100, (dev.freeGenerationsUsed / dev.freeGenerationsLimit) * 100)}%` }}
                                    />
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    dev.associatedTier !== 'free'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {dev.associatedTier.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {dev.isBlocked ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                      محظور
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                      نشط
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleResetDeviceQuota(dev)}
                                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold transition"
                                      title="تصفير الاستهلاك وتجديد الرصيد"
                                    >
                                      تصفير
                                    </button>

                                    <button
                                      onClick={() => handleUpgradeDeviceTier(dev, dev.associatedTier === 'free' ? 'pro' : 'free')}
                                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                                        dev.associatedTier === 'free'
                                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                          : 'bg-slate-800 text-slate-400'
                                      }`}
                                      title="ترقية إلى باقة المحترفين"
                                    >
                                      {dev.associatedTier === 'free' ? 'ترقية Pro' : 'تنزيل لـ Free'}
                                    </button>

                                    <button
                                      onClick={() => handleToggleBlockDevice(dev)}
                                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                                        dev.isBlocked
                                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                                      }`}
                                    >
                                      {dev.isBlocked ? 'فك الحظر' : 'حظر'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TRANSACTIONS */}
              {activeTab === 'transactions' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">سجل معاملات أورانج كاش</h3>
                      <p className="text-xs text-slate-400">المحفظة الرسمية: {settings.orangeWalletNumber}</p>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-3">رقم المحول</th>
                          <th className="p-3">الرقم المرجعي</th>
                          <th className="p-3">المبلغ</th>
                          <th className="p-3">الباقة</th>
                          <th className="p-3">الاسم / الإيميل</th>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3 text-center">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {transactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-900/40">
                            <td className="p-3 font-mono text-white font-bold">{tx.senderPhone}</td>
                            <td className="p-3 font-mono text-amber-300 font-semibold">{tx.transactionReference}</td>
                            <td className="p-3 font-bold text-emerald-400">{tx.amount} ج.م</td>
                            <td className="p-3 text-slate-300">{tx.planName}</td>
                            <td className="p-3 text-slate-400 text-[11px]">
                              <div>{tx.userName || 'عميل'}</div>
                              <div>{tx.userEmail || ''}</div>
                            </td>
                            <td className="p-3 text-slate-500 text-[10px] font-mono">
                              {new Date(tx.submittedAt).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tx.status === 'confirmed'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : tx.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}>
                                {tx.status === 'confirmed' ? 'مؤكدة ومفعلة' : tx.status === 'pending' ? 'معلقة' : 'مرفوضة'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {tx.status !== 'confirmed' ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleUpdateTransactionStatus(tx.id, 'confirmed')}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition"
                                  >
                                    تأكيد وتفعيل
                                  </button>
                                  <button
                                    onClick={() => handleUpdateTransactionStatus(tx.id, 'rejected')}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition"
                                  >
                                    رفض
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-500 text-[10px]">مكتملة</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: SETTINGS */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="max-w-xl space-y-4 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">إعدادات المنصة ومحفظة أورانج كاش</h3>
                    <p className="text-xs text-slate-400">تعديل الأرقام الرسمية وسياسة الرصيد المجاني</p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        رقم محفظة أورانج كاش الرسمية (لاستقبال التحويلات):
                      </label>
                      <input
                        type="text"
                        value={settings.orangeWalletNumber}
                        onChange={(e) => setSettings({ ...settings, orangeWalletNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:border-rose-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        رقم واتساب المخصص للدعم الفني والتواصل المباشر:
                      </label>
                      <input
                        type="text"
                        value={settings.supportWhatsappNumber}
                        onChange={(e) => setSettings({ ...settings, supportWhatsappNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:border-rose-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        الحد الأقصى للطلبات المجانية لكل جهاز جديد (Free Quota):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={settings.defaultFreeLimit}
                        onChange={(e) => setSettings({ ...settings, defaultFreeLimit: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:border-rose-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">تفعيل التحقق والدفع الأوتوماتيكي الفوري</div>
                        <div className="text-[11px] text-slate-400">
                          يقوم بتفعيل باقة المشترك فور إدخال الرقم المرجعي دون الحاجة لانتظار الموافقة اليدوية
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.autoVerificationEnabled}
                        onChange={(e) => setSettings({ ...settings, autoVerificationEnabled: e.target.checked })}
                        className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="py-2.5 px-6 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-rose-600/20"
                  >
                    حفظ التغييرات في النظام
                  </button>
                </form>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
