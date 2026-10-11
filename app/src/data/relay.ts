// Versión dentro de claude.ai: la página no puede consultar otros sitios directamente.
// Las consultas de lectura (Scryfall, EDHREC, Archidekt, Moxfield) pasan por Firecrawl,
// el conector de la cuenta de quien abre la página. Cada consulta gasta créditos de Firecrawl.
declare const __TARGET__: string;
export const IN_CLAUDE = typeof __TARGET__ !== "undefined" && __TARGET__ === "artifact";

interface McpErr { code?: string; message?: string; retryable?: boolean; retryAfterMs?: number }
interface McpNs { callTool(server: string, tool: string, input?: unknown, opts?: unknown): Promise<{ payload?: unknown }> }
interface ClaudeWin { claude?: { use?(n: string): Promise<unknown> } }

let mcpP: Promise<McpNs | null> | null = null;
function mcp(): Promise<McpNs | null> {
  if (!mcpP) {
    const c = (window as unknown as ClaudeWin).claude;
    mcpP = c && c.use ? (c.use("mcp") as Promise<McpNs | null>).catch(() => null) : Promise.resolve(null);
  }
  return mcpP;
}

/** Última razón por la que no se pudo consultar, en palabras para la persona. */
let problem: string | null = null;
export const relayProblem = (): string | null => problem;

function explain(code: string | undefined): string {
  switch (code) {
    case "server_not_connected": case "selection_required": case "server_not_found":
      return "Para buscar cartas y datos de EDHREC, agrega el conector Firecrawl en claude.ai (Ajustes, Conectores) y vuelve a abrir la página.";
    case "needs_reauth": return "El conector Firecrawl pide volver a conectarse: hazlo en claude.ai (Ajustes, Conectores).";
    case "not_in_manifest": case "not_granted": case "consent_required": case "approval_required":
      return "No se dio permiso a Firecrawl para esta página. Puedes darlo en el menú Permisos del artifact.";
    case "blocked_by_policy": return "La organización no permite usar Firecrawl desde esta página.";
    case "server_unavailable": case "rate_limited": return "Firecrawl no está respondiendo. Inténtalo en unos minutos.";
    case "tool_error": return "Firecrawl no pudo leer esa página (puede que no haya créditos o que el sitio la bloquee).";
    default: return "No se pudo consultar a través de Firecrawl.";
  }
}

/** Como fetch, solo para lecturas: devuelve una Response con el texto crudo de la página. Lanza TypeError si no hay camino. */
export async function relayGet(url: string): Promise<Response> {
  const m = await mcp();
  if (!m) { problem = "Esta vista no permite consultar sitios externos. Abre la página dentro de claude.ai con el conector Firecrawl."; throw new TypeError(problem); }
  const call = () => m.callTool("Firecrawl", "firecrawl_scrape", { url, formats: ["rawHtml"], onlyMainContent: false }, { cache: { staleTime: 300000, gcTime: 86400000 } });
  let res: { payload?: unknown };
  try { res = await call(); }
  catch (e) {
    const err = (e || {}) as McpErr;
    if (err.retryable) {
      await new Promise(r => setTimeout(r, Math.min(err.retryAfterMs || 1500, 8000) + Math.random() * 500));
      try { res = await call(); } catch (e2) { problem = explain(((e2 || {}) as McpErr).code); throw new TypeError(problem); }
    } else { problem = explain(err.code); throw new TypeError(problem); }
  }
  let p = res.payload as Record<string, unknown> | string | undefined;
  if (typeof p === "string") { try { p = JSON.parse(p) as Record<string, unknown>; } catch { /* texto suelto */ } }
  const obj = (p && typeof p === "object" ? p : {}) as { rawHtml?: string; html?: string; markdown?: string; metadata?: { statusCode?: number }; data?: { rawHtml?: string; metadata?: { statusCode?: number } } };
  const body = obj.rawHtml ?? (obj.data && obj.data.rawHtml) ?? obj.html ?? (typeof p === "string" ? p : "");
  const meta = obj.metadata || (obj.data && obj.data.metadata) || {};
  let status = Number(meta.statusCode) || (body ? 200 : 502);
  if (status < 200 || status > 599) status = 502;
  problem = null;
  return new Response(String(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Mensaje para las funciones que necesitan enviar datos (combos, torneos): no hay forma de hacerlo dentro de claude.ai. */
export const NOT_HERE = "no está disponible en la versión dentro de claude.ai";
