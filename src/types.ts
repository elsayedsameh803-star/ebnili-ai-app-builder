export type DeviceMode = 'desktop' | 'tablet' | 'mobile';
export type ViewMode = 'preview' | 'code' | 'split';
export type Language = 'ar' | 'en';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  plan?: string[];
  versionTag?: string;
  selectedElementRef?: string;
}

export interface VersionHistoryItem {
  id: string;
  version: string;
  timestamp: string;
  title: string;
  prompt: string;
  code: string;
  files: Record<string, string>;
}

export interface ConsoleLog {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  time: string;
}

export interface SelectedElementInfo {
  tagName: string;
  text: string;
  className: string;
  selector: string;
}

export interface AppProject {
  id: string;
  name: string;
  description: string;
  code: string; // The primary executable HTML/JS code
  files: Record<string, string>;
  activeFile: string;
  versions: VersionHistoryItem[];
  createdAt: string;
  updatedAt: string;
  theme: {
    primaryColor: string;
    borderRadius: string;
    darkMode: boolean;
  };
}

export interface StarterTemplate {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: string;
  promptAr: string;
  promptEn: string;
  category: string;
  tags: string[];
}

export type SubscriptionTier = 'free' | 'pro' | 'business';
export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  /** List price in USD — the headline number shown everywhere. */
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  /**
   * Exact amount to transfer to the Orange Cash wallet (EGP). Orange Cash is an
   * Egyptian wallet and cannot receive USD, so this is what the customer
   * actually pays; it is derived from the USD price by `USD_TO_EGP` in
   * `data/plans.ts` and never hard-coded.
   */
  payEgpMonthly: number;
  payEgpYearly: number;
  badgeAr?: string;
  badgeEn?: string;
  isPopular?: boolean;
  featuresAr: string[];
  featuresEn: string[];
  limitsAr: string;
  limitsEn: string;
}

export interface OrangeCashTransaction {
  id: string;
  senderPhone: string;
  recipientWallet: string; // "01207782741"
  transactionReference: string;
  amount: number;
  currency: string;
  planId: SubscriptionTier;
  planName: string;
  billingCycle: BillingCycle;
  userName?: string;
  userEmail?: string;
  submittedAt: string;
  status: 'confirmed' | 'pending' | 'rejected';
  verifiedAt?: string;
  receiptImage?: string;
  notes?: string;
}

export interface DeviceProtectionInfo {
  deviceId: string;
  fingerprintHash: string;
  ipAddress?: string;
  userAgent?: string;
  freeGenerationsUsed: number;
  freeGenerationsLimit: number;
  isBlocked: boolean;
  blockReason?: string;
  associatedTier?: SubscriptionTier;
  registeredEmails?: string[];
  lastSeen?: string;
}

export interface UserTeam {
  id: string;
  nameAr: string;
  nameEn: string;
  createdBy: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export interface UserTeamMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'member' | 'guest';
  joinedAt: string;
  active: boolean;
}

export interface UserDashboardData {
  user: { id: string; name: string; email: string; picture?: string; provider: string; isOwner?: boolean };
  subscription: UserSubscription;
  teams: UserTeam[];
  teamMemberships: { teamId: string; role: string; active: boolean }[];
  orangeWalletNumber: string;
  profileComplete: boolean;
  lastActiveAt?: string;
  isBlocked?: boolean;
}

export interface UserTeamResponse {
  success: boolean;
  team?: UserTeam;
  teams?: UserTeam[];
  members?: UserTeamMember[];
  error?: string;
}

export interface UserTeamMemberRequest {
  teamId: string;
  userName: string;
  userEmail: string;
  role?: 'owner' | 'member' | 'guest';
}

export interface CreateTeamRequest {
  nameAr: string;
  nameEn: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
  provider: string;
  isOwner?: boolean;
  isAdmin?: boolean;
}

export interface UserSubscription {
  tier: SubscriptionTier;
  status: 'active' | 'expired' | 'trial';
  planName: string;
  activatedAt?: string;
  expiresAt?: string;
  billingCycle?: BillingCycle;
  generationsUsedToday: number;
  generationsLimitToday: number;
  canExportZip: boolean;
  canDeployCustomDomain: boolean;
  canUseVisualInspector: boolean;
  priorityAiModel: boolean;
  showWatermark?: boolean;
  transactions: OrangeCashTransaction[];
}

export interface UserTeam {
  id: string;
  nameAr: string;
  nameEn: string;
  createdBy: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export interface UserTeamMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'member' | 'guest';
  joinedAt: string;
  active: boolean;
}

export type AuthProviderId = 'google' | 'github';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string;
  provider: AuthProviderId;
  /**
   * Decided by the SERVER (`/api/auth/me`) from the signed session cookie.
   * Only ever `true` for the site owner — the browser cannot grant it to
   * itself, and the owner's address is not part of the public bundle.
   */
  isOwner?: boolean;
  /**
   * An ACTIVE delegated administrator — may open the console and manage
   * subscriptions, but may NOT touch the admin list itself.
   *
   * Stamped by the server on `/api/auth/me`. Never derive this in the browser:
   * the admin routes re-check server-side regardless of what a client believes.
   */
  isAdmin?: boolean;
}

export interface AuthProviderInfo {
  id: AuthProviderId;
  configured: boolean;
}

export interface AdminDelegate {
  /** Normalised, lower-cased address. */
  email: string;
  /** `false` suspends console access without removing the entry. */
  active: boolean;
}

export interface AdminSettings {
  orangeWalletNumber: string;
  defaultFreeLimit: number;
  autoVerificationEnabled: boolean;
  supportWhatsappNumber: string;
  siteName: string;
  adminEmail: string;
  /**
   * Owner-delegated administrators, with their on/off switch.
   *
   * NEVER nullable: `/api/admin/overview` is owner-session only, so this array is
   * populated exclusively from the server. Defaults to empty so a partial payload
   * renders an honest "no admins yet" instead of throwing on `.map`.
   */
  admins: AdminDelegate[];
}

export interface PlatformRealStats {
  totalDevicesCount: number;
  blockedDevicesCount: number;
  totalGenerationsExecuted: number;
  totalRevenueEGP: number;
  activeProUsersCount: number;
  lastActiveTime: string;
  totalTransactionsCount: number;
}

