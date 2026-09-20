// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function entry point.
//
// IMPORTANT: the `.js` extension below is REQUIRED.
// `package.json` declares `"type": "module"`, so Vercel compiles this file to
// Node ESM. Node's ESM loader does NOT resolve extensionless relative imports,
// so `import app from "../server"` crashes the function on cold start with
// `ERR_MODULE_NOT_FOUND` — which Vercel surfaces as FUNCTION_INVOCATION_FAILED.
// TypeScript maps `../server.js` back to `../server.ts` at compile time, and the
// emitted JS keeps `../server.js`, which matches the emitted `server.js` at runtime.
// ─────────────────────────────────────────────────────────────────────────────
import app from "../server.js";

export default app;

