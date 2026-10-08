import { useState } from 'react';
import {
  User as UserIcon,
  Crown,
  TrendingUp,
  Users,
  Plus,
  CheckCircle,
  Eye,
  EyeOff,
  RefreshCw,
  LogOut,
  Lock,
  Settings,
  Calendar,
  DollarSign,
  Shield,
  Building,
} from 'lucide-react';
import { SubscriptionTier, UserSubscription, Language } from '../types';

export interface UserDashboardProps {
  user: { id: string; name: string; email: string; picture?: string; provider: string; isOwner?: boolean };
  subscription?: UserSubscription;
  teams: { id: string; nameAr: string; nameEn: string; memberCount: number; createdAt: string }[];
  orangeWalletNumber: string;
  isBlocked?: boolean;
  language: Language;
  onLogout: () => void;
  onOpenSubscription?: () => void;
  onOpenAdmin?: () => void;
  onOpenTeamManagement?: () => void;
  onAddTeamMember?: (teamId: string) => void;
}

export const UserDashboard = ({
  user,
  subscription,
  teams = [],
  orangeWalletNumber,
  isBlocked = false,
  language,
  onLogout,
  onOpenSubscription,
  onOpenAdmin,
  onOpenTeamManagement,
  onAddTeamMember,
}: UserDashboardProps) => {
  const ar = language === 'ar';
  const [showWalletNumber, setShowWalletNumber] = useState(false);
  const [copied, setCopied] = useState(false);

  const isSubActive = subscription?.status === 'active';
  const isExpired = subscription?.status === 'expired';
  const isTrial = subscription?.status === 'trial';

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{ar ? 'حسابك مؤقتاً محظور' : 'Your account is temporarily blocked'}</h3>
        <p className="text-sm text-slate-400 text-center max-w-md">{ar ? 'لقد تم حظر حسابك بسبب مخالفات استخدمت السياسة الخاصة بنا. يرجى الاتصال بالدعم للحصول على مساعدة.' : 'Your account has been blocked due to violations of our policies. Please contact support for assistance.'}</p>
        <button onClick={onLogout} className="mt-4 px-4 py-2 bg-rose-500/20 border border-rose-500/30 rounded-lg text-sm font-semibold text-rose-300 hover:bg-rose-500/30 transition">
          {ar ? 'تسجيل الخروج' : 'Sign out'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="relative">
        <div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-amber-400/20 blur-lg" />
        <div className="relative flex items-center gap-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60 shadow-xl">
          {user.picture ? (
            <img src={user.picture} alt={user.name} className="w-16 h-16 shrink-0 rounded-2xl object-cover ring-2 ring-rose-500/40" />
          ) : (
            <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-400 flex items-center justify-center shadow-lg">
              <UserIcon className="w-8 h-8 text-white" />

      {/* Wallet & subscription */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-white">{ar ? 'المحفظة' : 'Wallet'}</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold text-white font-['Cairo',sans-serif]">{ar ? 'ج.م' : 'EGP'}</span>
              <span className="text-2xl font-extrabold text-amber-400 font-['Cairo',sans-serif]">{orangeWalletNumber || '•••••••'}</span>
            </div>
            <button
              onClick={() => { setShowWalletNumber(!showWalletNumber); setCopied(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              {showWalletNumber ? <><EyeOff className="w-3.5 h-3.5" /> {ar ? 'إخفاء' : 'Hide'}</> : <><Eye className="w-3.5 h-3.5" /> {ar ? 'إظهار' : 'Show'}</>}
            </button>
          </div>
          {showWalletNumber && orangeWalletNumber && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(orangeWalletNumber);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {ar ? 'تم نسخ رقم المحفظة' : 'Wallet number copied'}
            </button>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-crown-500/20 flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-white">{ar ? 'الاشتراك' : 'Subscription'}</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">{ar ? 'الباقة الحالية' : 'Current plan'}</p>
              <p className="text-lg font-bold text-white font-['Cairo',sans-serif]">{subscription?.planName || (ar ? 'مجاني' : 'Free')}</p>
            </div>
            <button
              onClick={onOpenSubscription}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-sm font-bold text-amber-300 hover:bg-amber-500/30 transition flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {ar ? 'تعديل الاشتراك' : 'Manage'}
            </button>
          </div>
          {subscription?.expiresAt && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{ar ? `ينتهي ${new Date(subscription.expiresAt).toLocaleDateString('ar-EG')}` : `Expires ${new Date(subscription.expiresAt).toLocaleDateString('en-GB')}`}</span>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
            <span>{ar ? `${subscription?.generationsUsedToday ?? 0} / ${subscription?.generationsLimitToday ?? 0} استخدامات` : `${subscription?.generationsUsedToday ?? 0} / ${subscription?.generationsLimitToday ?? 0} uses`}</span>
          </div>
        </div>
      </div>

      {/* Teams section */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Building className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-white">{ar ? 'الفرق' : 'Teams'}</h3>
          </div>
          {onOpenTeamManagement && (
            <button
              onClick={onOpenTeamManagement}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              {ar ? 'فريق جديد' : 'New team'}
            </button>
          )}
        </div>

        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mb-2">
              <Users className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400">{ar ? 'مازيادات لا توجد بعد' : 'No teams yet'}</p>
            <p className="text-xs text-slate-500 mt-1">{ar ? 'أنشئ فريقاً للعمل مع فريقك' : 'Create a team to collaborate with your team'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/60 hover:border-slate-700/60 transition group">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{team.nameAr}</p>
                  <p className="text-xs text-slate-500">{ar ? `${team.memberCount} عضو` : `${team.memberCount} member${Number(team.memberCount) !== 1 ? 's' : ''}`}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onAddTeamMember && (
                    <button
                      onClick={() => onAddTeamMember(team.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:bg-indigo-500/10 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {ar ? 'إضافة' : 'Add'}
                    </button>
                  )}
                  <button className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 transition">
                    <Settings className="w-3.5 h-3.5" />
                    {ar ? 'إدارة' : 'Manage'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Access control notice */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white mb-1">{ar ? 'أمان الحساب' : 'Account security'}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {ar
                ? 'كل بياناتك مشفرة ومحمية. لا يمكن لأي مستخدم آخر الدخول إلى لوحة تحكمك إلا أنت. بعد تنفيذ المهمة، تصبح بياناتك مقروءة فقط ولا يمكن تعديلها.'
                : 'Your data is encrypted and protected. No other user can access your dashboard except you. After task execution, your data becomes read-only and cannot be modified.'}
            </p>
          </div>
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onOpenSubscription}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-sm font-bold text-amber-300 hover:bg-amber-500/25 transition"
        >
          <Crown className="w-4 h-4" />
          {ar ? 'الاشتراك' : 'Subscription'}
        </button>
        <button
          onClick={() => onOpenAdmin?.()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-sm font-bold text-rose-300 hover:bg-rose-500/25 transition"
        >
          <Shield className="w-4 h-4" />
          {ar ? 'الإدارة' : 'Admin'}
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm font-bold text-slate-300 hover:bg-rose-500/20 transition"
        >
          <LogOut className="w-4 h-4" />
          {ar ? 'تسجيل الخروج' : 'Sign out'}
        </button>
      </div>
    </div>
  );
};

export default UserDashboard;

