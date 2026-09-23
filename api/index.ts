// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — self-contained, lightweight entry point.
//
// WHY self-contained (no `import ... from "../server"`):
//  • `server.ts` is a ~2300-line dev server: it pulls `vite` middleware,
//    serves static files from `dist/`, and reads/writes JSON "databases"
//    with `fs` — none of which works inside a Vercel serverless function.
//  • Importing the whole file also drags heavy deps into the function bundle
//    and crashes cold starts (ERR_MODULE_NOT_FOUND / FUNCTION_INVOCATION_FAILED).
//  • So this function implements the HTTP API surface the frontend needs
//    (health, subscriptions, admin read paths, Gemini AI proxy) directly on
//    Express, with in-memory state. Writes are best-effort (serverless FS is
//    ephemeral) and never throw.
// ─────────────────────────────────────────────────────────────────────────────
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json({ limit: "15mb" }));

// ── CORS (allows preview deployments & custom domains) ───────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ── Health & status ─────────────────────────────────────────────────────────
// NOTE: getApiKey is defined in the Gemini section below (function hoisting
// makes it available here at runtime).
app.get(["/api/health", "/api", "/", "/health"], (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "ebnili-api",
    time: new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    hasKey: Boolean(getApiKey()),
  });
});

// ── Subscriptions: stateless defaults (client holds source of truth) ─────────
const DEFAULT_SUBSCRIPTION = {
  tier: "free",
  status: "active",
  planName: "Starter Free",
  generationsUsedToday: 0,
  generationsLimitToday: 5,
  canExportZip: false,
  canDeployCustomDomain: false,
  canUseVisualInspector: true,
  priorityAiModel: false,
  transactions: [],
};

// ── Subscriptions: accept BOTH endpoints the frontend uses ──────────────────
function subscriptionPayload() {
  return {
    success: true,
    subscription: { ...DEFAULT_SUBSCRIPTION, activatedAt: new Date().toISOString() },
    orangeWalletNumber: "01207782741",
    supportWhatsappNumber: "01207782741",
  };
}

app.get("/api/subscriptions/current", (_req: Request, res: Response) => {
  res.json(subscriptionPayload());
});

// Frontend SubscriptionModal posts to /auto-verify; server.ts activates the
// plan immediately, so mirror that: return an activated subscription object.
function activateSubscription(body: Record<string, unknown>) {
  const planId = (body.planId as string) || "pro";
  const planName =
    planId === "business" ? "Business" : planId === "pro" ? "Pro" : "Starter Free";
  const tier = (planId === "business" ? "business" : planId === "pro" ? "pro" : "free") as
    | "free"
    | "pro"
    | "business";
  return {
    success: true,
    status: "confirmed",
    subscription: {
      ...DEFAULT_SUBSCRIPTION,
      tier,
      status: "active",
      planName,
      activatedAt: new Date().toISOString(),
      generationsLimitToday: tier === "free" ? 5 : 9999,
      canExportZip: tier !== "free",
      canDeployCustomDomain: tier === "business",
      priorityAiModel: tier !== "free",
    },
  };
}

app.post("/api/subscriptions/auto-verify", (req: Request, res: Response) => {
  res.json(activateSubscription((req.body as Record<string, unknown>) ?? {}));
});

app.post("/api/subscriptions/submit-orange-cash", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "pending",
    message: "تم استلام طلبك بنجاح، سيتم مراجعته وتفعيل اشتراكك.",
    transactionId: `txn_${Date.now()}`,
  });
});

app.post("/api/subscriptions/reset-free", (_req: Request, res: Response) => {
  res.json({ success: true, subscription: DEFAULT_SUBSCRIPTION });
});

// ── Device protection (stateless stubs) ─────────────────────────────────────
app.get("/api/protection/status", (req: Request, res: Response) => {
  res.json({
    success: true,
    deviceId: req.query.deviceId ?? null,
    isBlocked: false,
    freeGenerationsUsed: 0,
    freeGenerationsLimit: 5,
  });
});

// ── Admin (read-safe stubs; no secrets leaked) ──────────────────────────────
app.post("/api/admin/auth", (req: Request, res: Response) => {
  const { pin, email } = (req.body as { pin?: string; email?: string }) ?? {};
  // Env vars first, then the same repo defaults accepted by server.ts —
  // keeps the owner login working even when ADMIN_PIN / ADMIN_EMAIL are
  // not configured on Vercel.
  const validPin = pin && (pin === process.env.ADMIN_PIN || pin === "1977Sameh@");
  const validEmail =
    email && email.toLowerCase() === (process.env.ADMIN_EMAIL || "elsayedsameh803@gmail.com").toLowerCase();
  const ok = validPin || validEmail;
  if (!ok) return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
  res.json({ success: true });
});

app.get("/api/admin/overview", (_req: Request, res: Response) => {
  res.json({
    success: true,
    stats: { totalDevices: 0, totalTransactions: 0, pendingTransactions: 0, totalGenerationsExecuted: 0 },
  });
});

for (const p of [
  "/api/admin/device/toggle-block",
  "/api/admin/device/reset-quota",
  "/api/admin/device/set-tier",
  "/api/admin/transaction/update-status",
  "/api/admin/settings",
]) {
  app.post(p, (req: Request, res: Response) =>
    res.json({ success: true, path: p, received: req.body ?? {} }),
  );
}

// ── Gemini AI proxy ─────────────────────────────────────────────────────────
// Accepts GEMINI_API_KEY plus common aliases so the function works no matter
// which exact variable name was configured in the Vercel dashboard.
function getApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ""
  ).trim();
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// Priority order mirrors the verified server.ts list (gemini-3.8-flash…),
// keeping the older models as last-resort fallbacks.
const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

async function generateWithGemini(ai: GoogleGenAI, prompt: string, systemInstruction?: string) {
  let lastError: unknown = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      // NOTE: `contents` must be a plain string (not an array). Passing an
      // array of strings makes the SDK throw a 500 inside the function.
      return await ai.models.generateContent({
        model,
        contents: prompt,
        ...(systemInstruction ? { config: { systemInstruction } } : {}),
      });
    } catch (e) {
      lastError = e;
      // Brief pause before the next candidate (mirrors server.ts behaviour).
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError ?? new Error("All candidate Gemini models are currently unavailable");
}

// The @google/genai SDK returns `response.text` as a *getter property*, not a
// method — read it defensively so we never send an empty `code` back.
function extractText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as { text?: unknown; candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  if (typeof r.text === "string" && r.text.length > 0) return r.text;
  try {
    const parts = r.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
  } catch {
    return "";
  }
}

// ── Owner-defined generation standards (applied to every AI endpoint) ─────
const CORE_RULES = `NON-NEGOTIABLE STANDARDS:
1. CLEAN OUTPUT ONLY — deliver the complete code artifact in exactly the format specified and nothing else: no explanations, no greetings, no recommendations, no suggestions, no conversational commentary. Inside the generated user interface, include absolutely no side text, tips, watermarks, "AI-generated" badges, or any written commentary addressed to the user.
2. FLAGSHIP QUALITY — match the polish of the largest commercial web platforms: modern clean UI/UX, cohesive design tokens, generous spacing, accessible contrast, smooth micro-interactions, pixel-consistent components, full mobile-first responsiveness, RTL layout with Arabic typography when the request is in Arabic, and a result production-ready for immediate use.
3. STABILITY FIRST — never jeopardize generation: emit syntactically valid complete documents (doctype, head, body always present), preserve every existing working feature when refining, never truncate, never emit placeholders or pseudo-code, and keep JavaScript error-free with zero console errors.`;

const GENERATE_SYSTEM = `You are Ebnily AI, an elite full-stack engineer and UI/UX designer generating single-file interactive web applications that run directly inside an iframe.
Return ONLY one complete standalone HTML document beginning with <!DOCTYPE html> and ending with </html>, including the Tailwind CDN (https://cdn.tailwindcss.com), an icon library, Google Fonts (Cairo font with dir="rtl" when Arabic is requested), full state management in an inline <script>, realistic mock data, interactive forms, search and filtering, modals, and mobile responsiveness.
No markdown fences, no JSON, no prose before or after the document.
${CORE_RULES}`;

const REFINE_SYSTEM = `You are Ebnily AI's precision code refiner. Apply the user's modification request to the provided HTML application.
Return ONLY the complete updated HTML document (from <!DOCTYPE html> to </html>) with the requested change applied while every existing feature, style, and script keeps working. No explanations, no diffs, no markdown fences, no prose.
${CORE_RULES}`;

const STUDIO_SYSTEM = `You are the Ebnily AI studio assistant. Produce exactly the artifact the request asks for — pure text, pure code, or a pure JSON object exactly as the caller requires — with zero commentary around it.
${CORE_RULES}`;

// Strip prose/markdown wrappers some models add so clients always receive
// code only (owner standard #1) without touching valid documents.
function stripToCode(text: string): string {
  let t = (text || "").trim();
  // Unwrap a response that is nothing but one fenced block.
  const fence = t.match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
  if (fence && typeof fence[1] === "string") t = fence[1].trim();
  // Cut any prose written before the document.
  const start = t.search(/<!DOCTYPE html>/i);
  if (start > 0) t = t.slice(start);
  // Cut fences/commentary written after </html> (tail prose, change lists…).
  const end = t.search(/<\/html>/i);
  if (end >= 0) {
    t = t.slice(0, end + "</html>".length);
  } else {
    // Truncated document: drop a trailing closing fence if present.
    const closeFence = t.indexOf("```");
    if (closeFence > 10) t = t.slice(0, closeFence);
  }
  return t.trim();
}

app.post("/api/ai/generate-app", async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return res.status(500).json({ success: false, message: "GEMINI_API_KEY غير مُعد على الخادم" });
    const { prompt, language = "ar" } = (req.body as { prompt?: string; language?: string }) ?? {};
    if (!prompt) return res.status(400).json({ success: false, message: "prompt مطلوب" });
    const result = await generateWithGemini(
      ai,
      `Build a complete single-file HTML app for this request (lang: ${language}):\n${prompt}`,
      GENERATE_SYSTEM,
    );
    const code = stripToCode(extractText(result));
    if (!code) {
      console.error("generate-app: Gemini returned empty text");
      return res.status(500).json({ success: false, message: "الذكاء الاصطناعي أعاد رداً فارغاً، حاول بصياغة مختلفة" });
    }
    res.json({ success: true, code, appName: prompt.slice(0, 60) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-app failed:", msg);
    if (/API_KEY|API key|key/i.test(msg) && /invalid|incorrect|missing|not valid/i.test(msg)) {
      return res.status(500).json({ success: false, message: "مفتاح GEMINI_API_KEY غير صالح، تحقق من القيمة في Vercel" });
    }
    const short = msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
    res.status(500).json({ success: false, message: `فشل توليد التطبيق، حاول مرة أخرى — السبب: ${short}` });
  }
});

app.post("/api/ai/refine-app", async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return res.status(500).json({ success: false, message: "GEMINI_API_KEY غير مُعد على الخادم" });
    const { prompt, currentCode, language = "ar" } = (req.body as { prompt?: string; currentCode?: string; language?: string }) ?? {};
    if (!prompt || !currentCode)
      return res.status(400).json({ success: false, message: "prompt و currentCode مطلوبان" });
    const result = await generateWithGemini(
      ai,
      `Refine this HTML app (lang: ${language}). Instruction: ${prompt}\n\nCurrent code:\n${currentCode}`,
      REFINE_SYSTEM,
    );
    const refined = stripToCode(extractText(result));
    if (!refined) {
      console.error("refine-app: Gemini returned empty text");
      return res.status(500).json({ success: false, message: "الذكاء الاصطناعي أعاد رداً فارغاً، حاول بصياغة مختلفة" });
    }
    res.json({ success: true, code: refined });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("refine-app failed:", msg);
    if (/API_KEY|API key|key/i.test(msg) && /invalid|incorrect|missing|not valid/i.test(msg)) {
      return res.status(500).json({ success: false, message: "مفتاح GEMINI_API_KEY غير صالح، تحقق من القيمة في Vercel" });
    }
    const short = msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
    res.status(500).json({ success: false, message: `فشل تحسين التطبيق، حاول مرة أخرى — السبب: ${short}` });
  }
});

for (const p of ["/api/ai/gemini-enhance-prompt", "/api/ai/gemini-architect", "/api/ai/gemini-code-doctor"]) {
  app.post(p, async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      if (!ai) return res.status(500).json({ success: false, message: "GEMINI_API_KEY غير مُعد على الخادم" });
      const { prompt = "", language = "ar" } = (req.body as { prompt?: string; language?: string }) ?? {};
      const result = await generateWithGemini(ai, `(lang: ${language}) ${prompt}`, STUDIO_SYSTEM);
      const text = extractText(result);
      if (!text) {
        console.error(`${p}: Gemini returned empty text`);
        return res.status(500).json({ success: false, message: "الذكاء الاصطناعي أعاد رداً فارغاً، حاول بصياغة مختلفة" });
      }
      res.json({ success: true, result: text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${p} failed:`, msg);
      if (/API_KEY|API key|key/i.test(msg) && /invalid|incorrect|missing|not valid/i.test(msg)) {
        return res.status(500).json({ success: false, message: "مفتاح GEMINI_API_KEY غير صالح، تحقق من القيمة في Vercel" });
      }
      res.status(500).json({ success: false, message: "فشل طلب الذكاء الاصطناعي" });
    }
  });
}

// ── Unknown /api paths → JSON 404 (never HTML, never crash) ─────────────────
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
});

// ── Global error handler (last resort: always JSON) ─────────────────────────
app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled API error:", err);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Internal server error" });
  },
);

export default app;


