import type { Request, Response, NextFunction } from "express";

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

export interface CustomDomainMatch {
  projectId: string;
  projectName: string;
}

async function supabaseGet<T>(path: string, query: Record<string, string>): Promise<T | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const qs = new URLSearchParams(query).toString();
  const url = `${SUPABASE_URL}/rest/v1/${path}${qs ? `?${qs}` : ""}`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Resolve an incoming Host header to the project whose active custom domain matches. */
export async function findProjectByCustomDomain(host: string): Promise<CustomDomainMatch | null> {
  const domain = host.split(":")[0].toLowerCase().replace(/^www\./, "");
  if (!domain) return null;
  const rows = await supabaseGet<{ id: string; name: string }[]>(
    "ebnily_projects",
    { custom_domain: `eq.${domain}`, custom_domain_status: "eq.active", select: "id,name", limit: "1" }
  );
  const row = rows?.[0];
  return row ? { projectId: row.id, projectName: row.name } : null;
}

/** Fetch the published HTML for a project (used to serve custom-domain traffic). */
export async function getPublishedHtml(projectId: string): Promise<string | null> {
  const row = await supabaseGet<{ published_html: string | null }[]>(
    "ebnily_projects",
    { id: `eq.${projectId}`, select: "published_html", limit: "1" }
  );
  return row?.[0]?.published_html ?? null;
}

/** Arabic 404 shown when a domain points to Ebnily but is not linked to any active project. */
export const CUSTOM_DOMAIN_NOT_FOUND_HTML = `<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>الدومين غير مربوط</title><style>*{box-sizing:border-box}body{font-family:'Cairo','Plus Jakarta Sans',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#e2e8f0;text-align:center;padding:24px;margin:0}h1{color:#f87171;font-size:20px;margin:0 0 8px}p{color:#94a3b8;font-size:14px;margin:0 0 16px;max-width:420px}code{background:#1e293b;color:#f8fafc;padding:2px 6px;border-radius:4px;font-size:13px}</style></head><body><h1>الدومين غير مربوط بأي موقع في ابنيلي</h1><p>لم نجد موقعًا منشورًا مربوطًا بهذا النطاق. تأكد من إضافة الدومين وتفعيله من لوحة المشروع.</p></body></html>`;

/** Attach `req.ebnilyCustomDomain` when the Host matches an active custom domain. */
export function customDomainMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host ?? "";
    const match = await findProjectByCustomDomain(host);
    if (match) {
      (req as Request & { ebnilyCustomDomain?: CustomDomainMatch }).ebnilyCustomDomain = match;
    }
    next();
  };
}

/** Serve the matched custom-domain project's published HTML, or the Arabic 404. */
export function customDomainServe() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const match = (req as Request & { ebnilyCustomDomain?: CustomDomainMatch }).ebnilyCustomDomain;
    if (!match || req.method !== "GET") return next();
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();

    const html = await getPublishedHtml(match.projectId);
    if (html) {
      res.set("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }
    res.status(404).send(CUSTOM_DOMAIN_NOT_FOUND_HTML);
  };
}