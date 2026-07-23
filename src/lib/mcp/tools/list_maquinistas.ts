import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_maquinistas",
  title: "Listar maquinistas",
  description:
    "Devuelve los maquinistas visibles para el usuario autenticado (respeta RLS y bases asignadas). Filtro opcional por base y por estado activo.",
  inputSchema: {
    base: z.string().optional().describe("Nombre de la base (opcional)."),
    activo: z.boolean().optional().describe("Filtrar por activo/inactivo."),
    limit: z.number().int().positive().max(500).optional().describe("Máximo de filas (por defecto 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ base, activo, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    let q = sb(ctx)
      .from("maquinistas")
      .select("id, matricula, nombre, apellidos, base, activo, fecha_primer_servicio, bajo_pe_1603")
      .order("apellidos", { ascending: true })
      .limit(limit ?? 100);
    if (base) q = q.eq("base", base);
    if (typeof activo === "boolean") q = q.eq("activo", activo);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { maquinistas: data },
    };
  },
});
