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
  priceMonthly: number;
  priceYearly: number;
  currency: string;
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

export interface UserSubscription {
  tier: SubscriptionTier;
  status: 'active' | 'expired' | 'trial';
  planName: string;
  activatedAt?: string;
  expiresAt?: string;
  billingCycle?: BillingCycle;
  generationsUsedToday: number;
  generationsLimitToday: number; // 5 for free, Infinity for pro
  canExportZip: boolean;
  canDeployCustomDomain: boolean;
  canUseVisualInspector: boolean;
  priorityAiModel: boolean;
  showWatermark?: boolean; // False for pro/business, true for free
  transactions: OrangeCashTransaction[];
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

export type AuthProviderId = 'google' | 'github';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string;
  provider: AuthProviderId;
}

export interface AuthProviderInfo {
  id: AuthProviderId;
  configured: boolean;
}

export interface AdminSettings {
  orangeWalletNumber: string;
  defaultFreeLimit: number;
  autoVerificationEnabled: boolean;
  supportWhatsappNumber: string;
  siteName: string;
  adminEmail: string;
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

