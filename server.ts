import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";
// The complete `/api/*` surface (auth, GitHub import, projects, AI, admin).
// `server.ts` mounts it instead of duplicating those routes — see the note
// next to `mountApi()` further down.
import { mountApi } from "./api/index";

// The README tells users to create `.env.local`, while classic dotenv only
// reads `.env` — load both so GEMINI_API_KEY is picked up either way.
// Earlier entries win; existing process.env values are never overridden.
dotenv.config({ path: ".env.local" });
dotenv.config();

const appRootDir = process.cwd();

const app = express();
/**
 * Listen port.
 *
 * WHY read from the environment: hosting platforms (Vercel, Render, Railway,
 * Fly, Docker, any PaaS) inject the public port as `PORT`, and a hard-coded
 * 3000 makes `npm start` collide with whatever already owns 3000 on the box —
 * the container then crashes on boot even though the deployment is fine.
 */
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));

// NOTE: the old `/download-project-zip` route was removed on purpose. It served a
// pre-built `public/project-source.zip` that no longer exists, so the SPA
// fallback returned `index.html` with a 200 — visitors clicked "Download ZIP"
// and got a web page instead of an archive. The export modal now builds the
// ZIP in the browser from the user's own generated files (see ExportModal.tsx),
// which also means the platform's own source code is never downloadable.

// Orange Cash & Subscription In-Memory & File Persistence
const DB_FILE = path.join(appRootDir, "subscriptions_db.json");
const DEVICES_DB_FILE = path.join(appRootDir, "devices_db.json");
const ADMIN_SETTINGS_FILE = path.join(appRootDir, "admin_settings.json");
const OFFICIAL_ORANGE_WALLET = "01207782741";

interface OrangeCashTransaction {
  id: string;
  senderPhone: string;
  recipientWallet: string; // "01207782741"
  transactionReference: string;
  amount: number;
  currency: string;
  planId: "free" | "pro" | "business";
  planName: string;
  billingCycle: "monthly" | "yearly";
  userName?: string;
  userEmail?: string;
  submittedAt: string;
  status: "confirmed" | "pending" | "rejected";
  verifiedAt?: string;
  receiptImage?: string;
  notes?: string;
}

interface UserSubscriptionState {
  tier: "free" | "pro" | "business";
  status: "active" | "expired" | "trial";
  planName: string;
  activatedAt?: string;
  expiresAt?: string;
  billingCycle?: "monthly" | "yearly";
  generationsUsedToday: number;
  generationsLimitToday: number;
  canExportZip: boolean;
  canDeployCustomDomain: boolean;
  canUseVisualInspector: boolean;
  priorityAiModel: boolean;
  transactions: OrangeCashTransaction[];
}

interface DeviceRecord {
  deviceId: string;
  fingerprintHash: string;
  ipAddress: string;
  userAgent: string;
  firstSeen: string;
  lastSeen: string;
  registeredEmails: string[];
  freeGenerationsUsed: number;
  freeGenerationsLimit: number;
  isBlocked: boolean;
  blockReason?: string;
  associatedTier: "free" | "pro" | "business";
}

interface AdminSettings {
  orangeWalletNumber: string;
  defaultFreeLimit: number;
  autoVerificationEnabled: boolean;
  supportWhatsappNumber: string;
  siteName: string;
  adminEmail: string;
  adminPin: string;
  totalGenerationsExecuted: number;
}

function loadSubscriptionData(): UserSubscriptionState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading subscription DB:", e);
  }
  return {
    tier: "free",
    status: "active",
    planName: "Starter Free",
    activatedAt: new Date().toISOString(),
    expiresAt: undefined,
    billingCycle: "monthly",
    generationsUsedToday: 0,
    generationsLimitToday: 5,
    canExportZip: false,
    canDeployCustomDomain: false,
    canUseVisualInspector: true,
    priorityAiModel: false,
    transactions: [
      {
        id: "txn_welcome_starter",
        senderPhone: "01207782741",
        recipientWallet: OFFICIAL_ORANGE_WALLET,
        transactionReference: "EBNILI-FREE-STARTER",
        amount: 0,
        currency: "EGP",
        planId: "free",
        planName: "Starter Free",
        billingCycle: "monthly",
        userName: "مستخدم إبنيلي",
        userEmail: "elsayedsameh803@gmail.com",
        submittedAt: new Date().toISOString(),
        status: "confirmed",
        verifiedAt: new Date().toISOString(),
        notes: "حساب افتراضي مجاني"
      }
    ]
  };
}

function saveSubscriptionData(data: UserSubscriptionState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing subscription DB:", e);
  }
}

function loadDevicesData(): Record<string, DeviceRecord> {
  try {
    if (fs.existsSync(DEVICES_DB_FILE)) {
      const raw = fs.readFileSync(DEVICES_DB_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading devices DB:", e);
  }
  return {};
}

function saveDevicesData(data: Record<string, DeviceRecord>) {
  try {
    fs.writeFileSync(DEVICES_DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing devices DB:", e);
  }
}

function loadAdminSettings(): AdminSettings {
  try {
    if (fs.existsSync(ADMIN_SETTINGS_FILE)) {
      const raw = fs.readFileSync(ADMIN_SETTINGS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading admin settings:", e);
  }
  return {
    orangeWalletNumber: "01207782741",
    defaultFreeLimit: 5,
    autoVerificationEnabled: true,
    supportWhatsappNumber: "01207782741",
    siteName: "إبنيلي | Ebnili AI Studio",
    adminEmail: process.env.SITE_OWNER_EMAIL || process.env.OWNER_EMAIL || "",
    // SECURITY: the seeded `adminPin: "1977Sameh@"` was a real password
    // committed to this repository. The fallback now carries NO PIN, so a fresh
    // clone cannot be unlocked by anyone who reads the source. Set ADMIN_PIN in
    // `.env` (which is git-ignored) or save one from the dashboard.
    adminPin: "",
    totalGenerationsExecuted: 0,
  };
}

function saveAdminSettings(data: AdminSettings) {
  try {
    fs.writeFileSync(ADMIN_SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing admin settings:", e);
  }
}

let currentSubscription: UserSubscriptionState = loadSubscriptionData();
let devicesDb: Record<string, DeviceRecord> = loadDevicesData();
let adminSettings: AdminSettings = loadAdminSettings();

// Device Protection & Anti-Abuse Core
function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}

function findOrCreateDevice(
  deviceId: string,
  fingerprintHash: string,
  ipAddress: string,
  userAgent: string,
  email?: string
): DeviceRecord {
  // First match by fingerprintHash, then by deviceId
  let recordKey = Object.keys(devicesDb).find(
    (k) => (fingerprintHash && devicesDb[k].fingerprintHash === fingerprintHash) || (deviceId && devicesDb[k].deviceId === deviceId)
  );

  const now = new Date().toISOString();

  if (!recordKey) {
    const newKey = deviceId || fingerprintHash || `dev_${Date.now()}`;
    const newRecord: DeviceRecord = {
      deviceId: deviceId || newKey,
      fingerprintHash: fingerprintHash || newKey,
      ipAddress,
      userAgent: userAgent.substring(0, 200),
      firstSeen: now,
      lastSeen: now,
      registeredEmails: email ? [email] : [],
      freeGenerationsUsed: 0,
      freeGenerationsLimit: adminSettings.defaultFreeLimit || 5,
      isBlocked: false,
      associatedTier: "free",
    };
    devicesDb[newKey] = newRecord;
    saveDevicesData(devicesDb);
    return newRecord;
  }

  const existing = devicesDb[recordKey];
  existing.lastSeen = now;
  existing.ipAddress = ipAddress;
  if (email && !existing.registeredEmails.includes(email)) {
    existing.registeredEmails.push(email);
  }
  saveDevicesData(devicesDb);
  return existing;
}

function checkDeviceQuota(
  deviceId: string,
  fingerprintHash: string,
  ipAddress: string,
  userAgent: string,
  email?: string
): { allowed: boolean; reason?: string; device: DeviceRecord } {
  const device = findOrCreateDevice(deviceId, fingerprintHash, ipAddress, userAgent, email);

  // If globally subscribed to pro/business or device has active pro tier, allow
  if (currentSubscription.tier !== "free" || device.associatedTier !== "free") {
    return { allowed: true, device };
  }

  if (device.isBlocked) {
    return {
      allowed: false,
      reason: device.blockReason || "تم حظر هذا الجهاز من استخدام المنصة لمخالفة سياسة الاستخدام.",
      device,
    };
  }

  if (device.freeGenerationsUsed >= device.freeGenerationsLimit) {
    return {
      allowed: false,
      reason: `عذراً، تم استهلاك كامل الرصيد المجاني المسموح به لهذا الجهاز (${device.freeGenerationsLimit} طلبات). يمنع نظام الحماية تكرار استخدام الرصيد المجاني عبر تبديل الإيميلات أو فتح متصفحات خفية لنفس الجهاز أو الشبكة. يمكنك الترقية فورياً عبر محفظة أورانج كاش (${adminSettings.orangeWalletNumber}) للاستمرار بلا حدود.`,
      device,
    };
  }

  return { allowed: true, device };
}

function recordDeviceGeneration(device: DeviceRecord) {
  if (currentSubscription.tier === "free" && device.associatedTier === "free") {
    device.freeGenerationsUsed += 1;
    saveDevicesData(devicesDb);
  }
  adminSettings.totalGenerationsExecuted = (adminSettings.totalGenerationsExecuted || 0) + 1;
  saveAdminSettings(adminSettings);
}

// Watermark Injection Helper
// Owner standard #1 (clean output only): generated interfaces must contain
// absolutely no side text, badges, or watermarks — injection stays disabled.
function injectWatermark(html: string, _tier: "free" | "pro" | "business"): string {
  return html;
}

// Accepts GEMINI_API_KEY plus common aliases (same list as api/index.ts)
// so a key configured under any known variable name still works locally.
function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ""
  ).trim();
}

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Resilient Gemini Generator with Gemini 3.8 Flash priority & high-availability fallbacks
async function generateWithGeminiResilient(ai: GoogleGenAI, options: { contents: any; config?: any }) {
  // Gemini candidates verified against ai.google.dev (2026-09-23):
  // gemini-3.8-flash (newest stable Flash for software engineering),
  // gemini-flash-latest (official alias), gemini-3.7/3.6-flash (stable),
  // gemini-2.5-flash (older stable last resort). Shut-down models excluded.
  const candidateModels = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
  ];
  let lastError: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      return { response, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      // If temporary spike (503 / 429), proceed smoothly to next fallback model
      if (i < candidateModels.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
    }
  }

  throw lastError || new Error("All candidate Gemini models are currently unavailable");
}

// ==========================================
// STATIC ASSETS & SPA FALLBACK
// ==========================================

// The complete `/api/*` surface — auth, GitHub import, projects, AI, admin.
// This runner used to declare its own, much smaller duplicate set with no
// `/api/auth/*`, no `/api/projects*` and no `/api/github/*`, so anyone running
// `npm start` (Docker, Render, Railway, a VPS) got a site where sign-in listed
// no providers, the project store 404'd, and repository import did not exist at
// all. Mounting the SAME app removes the duplication and guarantees the two
// runners can never disagree about behaviour.
//
// Mounted at the ROOT (not at `/api`): every route inside is already declared
// with its full `/api/...` path, and it sits before the static handler so an
// API route is always answered by the API, never by index.html.
app.use(mountApi());

const distDir = path.join(appRootDir, "dist");

// `typeof` guard keeps this safe when running as ESM (tsx dev server).
const isBundledServer =
  typeof __filename !== "undefined" && /\.cjs$/.test(String(__filename));

// Serving the built SPA is required in three situations:
//   1. `npm run dev`  → Vite dev middleware (handled in startServer below)
//   2. `npm start`    → the esbuild bundle `dist/server.cjs` serves `dist/`
//   3. Vercel         → the serverless function may receive every request
// Registering these handlers unconditionally (in production only) means the app
// behaves the same locally and on Vercel, regardless of how requests are routed.
const isProductionBuild =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.VERCEL) ||
  isBundledServer;

if (isProductionBuild) {
  app.use(express.static(distDir));

  // SPA fallback implemented as plain middleware instead of `app.get("*")`,
  // because the wildcard string pattern is rejected by Express 5's router.
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    const requestPath = req.path || "/";
    // Never intercept backend endpoints.
    if (requestPath === "/api" || requestPath.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) next();
    });
  });
}

// Unknown /api paths → JSON 404 (never an HTML page, never a crash).
app.use("/api", (_req: express.Request, res: express.Response) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
});

// Global error handler (last resort): always JSON, never an HTML stack trace.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled server error:", err);
    if (res.headersSent) return;
    const e = err as { type?: string };
    // Body-parser failures are client errors, not server errors.
    if (e?.type === "entity.too.large")
      return res.status(413).json({ success: false, message: "Request payload too large" });
    if (e?.type === "entity.parse.failed")
      return res.status(400).json({ success: false, message: "Invalid JSON body" });
    res.status(500).json({ success: false, message: "Internal server error" });
  },
);

// Vite middleware setup (local development only)
async function startServer() {
  if (!isProductionBuild) {
    // The module id is intentionally held in a variable: it prevents esbuild and
    // Vercel's dependency tracer from pulling the whole Vite toolchain into the
    // serverless function bundle. This branch only ever runs under `npm run dev`.
    const viteModuleId = "vite";
    const { createServer: createViteServer } = await import(viteModuleId);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// On Vercel the exported `app` is invoked directly by the platform, so the port
// listener must only be started for local runs.
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;

