import type { Request, Response, NextFunction } from "express";

/**
 * Safe environment variable resolution.
 * Never throw if env vars are missing — degrade gracefully instead.
 */
const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const IS_CONFIGURED = Boolean(SUPABASE_URL && SERVICE_KEY);

export interface CustomDomainMatch {
  projectId: string;
  projectName: string;
}

/**
 * Safe Supabase GET wrapper.
 * Returns null on any error (network, missing config, bad JSON) — never throws.
 */
async function supabaseGet<T>(path: string, query: Record<string, string>): Promise<T | null> {
  if (!IS_CONFIGURED) return null;
  const qs = new URLSearchParams(query).toString();
  const url = `${SUPABASE_URL}/rest/v1/${path}${qs ? `?${qs}` : ""}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s hard timeout
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Resolve an incoming Host header to the project whose active custom domain matches.
 * Wrapped in try/catch — never throws.
 */
export async function findProjectByCustomDomain(host: string): Promise<CustomDomainMatch | null> {
  try {
    const domain = host.split(":")[0].toLowerCase().replace(/^www\./, "");
    if (!domain) return null;
    const rows = await supabaseGet<{ id: string; name: string }[]>(
      "ebnily_projects",
      { custom_domain: `eq.${domain}`, custom_domain_status: "eq.active", select: "id,name", limit: "1" }
    );
    const row = rows?.[0];
    return row ? { projectId: row.id, projectName: row.name } : null;
  } catch {
    return null;
  }
}

/**
 * Fetch the published HTML for a project (used to serve custom-domain traffic).
 * Wrapped in try/catch — never throws.
 */
export async function getPublishedHtml(projectId: string): Promise<string | null> {
  try {
    const row = await supabaseGet<{ published_html: string | null }[]>(
      "ebnily_projects",
      { id: `eq.${projectId}`, select: "published_html", limit: "1" }
    );
    return row?.[0]?.published_html ?? null;
  } catch {
    return null;
  }
}

/** Arabic 404 shown when a domain points to Ebnily but is not linked to any active project. */
export const CUSTOM_DOMAIN_NOT_FOUND_HTML = `<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>الدومين غير مربوط</title><style>*{box-sizing:border-box}body{font-family:'Cairo','Plus Jakarta Sans',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#e2e8f0;text-align:center;padding:24px;margin:0}h1{color:#f87171;font-size:20px;margin:0 0 8px}p{color:#94a3b8;font-size:14px;margin:0 0 16px;max-width:420px}code{background:#1e293b;color:#f8fafc;padding:2px 6px;border-radius:4px;font-size:13px}</style></head><body><h1>الدومين غير مربوط بأي موقع في ابنيلي</h1><p>لم نجد موقعًا منشورًا مربوطًا بهذا النطاق. تأكد من إضافة الدومين وتفعيله من لوحة المشروع.</p></body></html>`;

/** Fallback HTML served when middleware cannot reach Supabase. */
export const MIDDLEWARE_UNAVAILABLE_HTML = `<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>جاري الصيانة</title><style>*{box-sizing:border-box}body{font-family:'Cairo','Plus Jakarta Sans',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#e2e8f0;text-align:center;padding:24px;margin:0}h1{color:#fbbf24;font-size:20px;margin:0 0 8px}p{color:#94a3b8;font-size:14px;margin:0 0 16px;max-width:420px}</style></head><body><h1>جاري الصيانة مؤقتًا</h1><p>الخدمة غير متاحة حاليًا، يرجى المحاولة مرة أخرى بعد بضع دقائق.</p></body></html>`;

/**
 * Attach `req.ebnilyCustomDomain` when the Host matches an active custom domain.
 * Fully wrapped in try/catch — never throws, always calls next().
 */
export function customDomainMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const host = req.headers.host ?? "";
      const match = await findProjectByCustomDomain(host);
      if (match) {
        (req as Request & { ebnilyCustomDomain?: CustomDomainMatch }).ebnilyCustomDomain = match;
      }
    } catch {
      // Supabase unreachable or misconfigured — continue without custom domain match.
    }
    next();
  };
}

/**
 * Serve the matched custom-domain project's published HTML, or the Arabic 404.
 * Fully wrapped in try/catch — never throws, always calls next() or sends a safe fallback.
 */
export function customDomainServe() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const match = (req as Request & { ebnilyCustomDomain?: CustomDomainMatch }).ebnilyCustomDomain;
      if (!match || req.method !== "GET") return next();
      if (req.path === "/api" || req.path.startsWith("/api/")) return next();

      const html = await getPublishedHtml(match.projectId);
      if (html) {
        res.set("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
      }
      res.status(404).send(CUSTOM_DOMAIN_NOT_FOUND_HTML);
    } catch {
      // Any failure → serve a safe Arabic maintenance page instead of crashing with 500.
      res.status(503).set("Content-Type", "text/html; charset=utf-8").send(MIDDLEWARE_UNAVAILABLE_HTML);
    }
  };
}