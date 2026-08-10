#!/usr/bin/env node
/**
 * verify-backend.mjs
 *
 * Verificación automática: confirma que GesBase solo habla con el backend
 * de Lovable Cloud y que no quedan llamadas residuales a proyectos Supabase
 * externos (p. ej. refs antiguas hardcodeadas).
 *
 * Uso:  npm run verify:backend
 * Salida: código 0 si todo está correcto, 1 si hay algún fallo.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const results = [];
const fail = (check, detail) => results.push({ ok: false, check, detail });
const pass = (check, detail = "") => results.push({ ok: true, check, detail });

// ---------------------------------------------------------------------------
// 0. Cargar .env y determinar el ref esperado (Lovable Cloud)
// ---------------------------------------------------------------------------
const envPath = join(ROOT, ".env");
if (!existsSync(envPath)) {
  fail(".env presente", "No existe .env en la raíz del proyecto");
  report();
}

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const EXPECTED_REF = env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!EXPECTED_REF) fail("VITE_SUPABASE_PROJECT_ID definido", "Falta en .env");
else pass("VITE_SUPABASE_PROJECT_ID definido", EXPECTED_REF);

// Refs conocidas que NO deben aparecer nunca (proyectos externos históricos)
const BLOCKED_REFS = ["ocjcqyxrlwcardrbfgsz"];

// ---------------------------------------------------------------------------
// 1. La URL del backend apunta al proyecto esperado
// ---------------------------------------------------------------------------
{
  const expectedHost = `https://${EXPECTED_REF}.supabase.co`;
  if (SUPABASE_URL === expectedHost)
    pass("VITE_SUPABASE_URL apunta a Lovable Cloud", SUPABASE_URL);
  else
    fail(
      "VITE_SUPABASE_URL apunta a Lovable Cloud",
      `Esperado ${expectedHost}, encontrado ${SUPABASE_URL}`,
    );
}

// ---------------------------------------------------------------------------
// 2. La publishable key pertenece al mismo proyecto (claim `ref` del JWT)
// ---------------------------------------------------------------------------
{
  try {
    const payload = JSON.parse(
      Buffer.from(PUBLISHABLE_KEY.split(".")[1], "base64url").toString("utf8"),
    );
    if (payload.ref === EXPECTED_REF)
      pass("Publishable key pertenece al proyecto", `ref=${payload.ref}`);
    else
      fail(
        "Publishable key pertenece al proyecto",
        `El JWT tiene ref=${payload.ref}, esperado ${EXPECTED_REF}`,
      );
  } catch {
    fail("Publishable key pertenece al proyecto", "No se pudo decodificar el JWT");
  }
}

// ---------------------------------------------------------------------------
// Utilidad: recorrer archivos del repo
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);
const SKIP_FILES = new Set([
  "package-lock.json",
  "bun.lockb",
  "pnpm-lock.yaml",
  "yarn.lock",
  "verify-backend.mjs",
]);
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".toml",
  ".html", ".css", ".md", ".env", ".sql", ".yaml", ".yml", ".txt",
]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (
      !SKIP_FILES.has(entry) &&
      (TEXT_EXT.has(full.slice(full.lastIndexOf("."))) || entry === ".env")
    )
      yield full;
  }
}

// ---------------------------------------------------------------------------
// 3. Ninguna URL *.supabase.co del código apunta a otro proyecto
// ---------------------------------------------------------------------------
{
  const urlRe = /https:\/\/([a-z0-9]{20})\.supabase\.co/g;
  const offenders = [];
  for (const file of walk(ROOT)) {
    const content = readFileSync(file, "utf8");
    for (const m of content.matchAll(urlRe)) {
      if (m[1] !== EXPECTED_REF)
        offenders.push(`${relative(ROOT, file)} -> ${m[1]}.supabase.co`);
    }
  }
  if (offenders.length === 0)
    pass("Sin URLs supabase.co ajenas al proyecto", "Todas las URLs usan el ref esperado");
  else fail("Sin URLs supabase.co ajenas al proyecto", offenders.join("\n  "));
}

// ---------------------------------------------------------------------------
// 4. Ninguna referencia residual a proyectos externos bloqueados
// ---------------------------------------------------------------------------
{
  const offenders = [];
  for (const file of walk(ROOT)) {
    const content = readFileSync(file, "utf8");
    for (const ref of BLOCKED_REFS) {
      if (content.includes(ref)) offenders.push(`${relative(ROOT, file)} contiene ${ref}`);
    }
  }
  if (offenders.length === 0)
    pass("Sin refs residuales de proyectos externos", BLOCKED_REFS.join(", "));
  else fail("Sin refs residuales de proyectos externos", offenders.join("\n  "));
}

// ---------------------------------------------------------------------------
// 5. config.toml enlazado al proyecto correcto
// ---------------------------------------------------------------------------
{
  const tomlPath = join(ROOT, "supabase", "config.toml");
  if (!existsSync(tomlPath)) {
    fail("config.toml enlazado al proyecto", "No existe supabase/config.toml");
  } else {
    const toml = readFileSync(tomlPath, "utf8");
    const m = toml.match(/^project_id\s*=\s*"([^"]+)"/m);
    if (m && m[1] === EXPECTED_REF)
      pass("config.toml enlazado al proyecto", `project_id=${m[1]}`);
    else
      fail(
        "config.toml enlazado al proyecto",
        `project_id=${m?.[1] ?? "(no definido)"}, esperado ${EXPECTED_REF}`,
      );
  }
}

// ---------------------------------------------------------------------------
// 6. Frontend: createClient solo en el cliente generado (y MCP con env)
// ---------------------------------------------------------------------------
{
  const ALLOWED = [
    "src/integrations/supabase/client.ts",
  ];
  const ALLOWED_PREFIX = "src/lib/mcp/"; // herramientas MCP: usan process.env.SUPABASE_URL
  const offenders = [];
  for (const file of walk(join(ROOT, "src"))) {
    const rel = relative(ROOT, file);
    if (ALLOWED.includes(rel) || rel.startsWith(ALLOWED_PREFIX)) continue;
    const content = readFileSync(file, "utf8");
    if (/createClient\s*\(/.test(content) && content.includes("@supabase/supabase-js"))
      offenders.push(rel);
  }
  if (offenders.length === 0)
    pass("Frontend usa solo el cliente generado", "src/integrations/supabase/client.ts");
  else
    fail(
      "Frontend usa solo el cliente generado",
      `createClient fuera del cliente generado en:\n  ${offenders.join("\n  ")}`,
    );
}

// ---------------------------------------------------------------------------
// 7. Edge functions: URL del backend solo vía variables de entorno
// ---------------------------------------------------------------------------
{
  const offenders = [];
  const fnDir = join(ROOT, "supabase", "functions");
  if (existsSync(fnDir)) {
    for (const file of walk(fnDir)) {
      const content = readFileSync(file, "utf8");
      // URLs supabase.co hardcodeadas (las dinámicas con ${projectRef} se validan en el check 3/4)
      if (/https:\/\/[a-z0-9]{20}\.supabase\.co/.test(content))
        offenders.push(relative(ROOT, file));
    }
  }
  if (offenders.length === 0)
    pass("Edge functions usan SUPABASE_URL de entorno", "Sin URLs hardcodeadas");
  else fail("Edge functions usan SUPABASE_URL de entorno", offenders.join("\n  "));
}

// ---------------------------------------------------------------------------
// Informe final
// ---------------------------------------------------------------------------
function report() {
  console.log("\n=== Verificación de backend GesBase ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "✅ PASS" : "❌ FAIL"}  ${r.check}${r.detail ? `\n        ${r.detail}` : ""}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `\n${failed === 0 ? "✅ Todo correcto: la app solo usa Lovable Cloud." : `❌ ${failed} check(s) fallidos.`}\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}
report();
