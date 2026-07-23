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
  name: "list_expedientes_1603",
  title: "Expedientes PE 16.03",
  description: "Lista expedientes PE 16.03 (nuevo acceso). Filtro opcional por base y estado.",
  inputSchema: {
    base: z.string().optional(),
    estado: z.string().optional().describe("Ej: 'abierto' o 'cerrado'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ base, estado }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    let q = sb(ctx)
      .from("expedientes_1603")
      .select("id, maquinista_id, fecha_primer_servicio, fecha_inicio, fecha_fin_prevista, estado, maquinistas!inner(nombre, apellidos, matricula, base)")
      .order("fecha_fin_prevista", { ascending: true });
    if (estado) q = q.eq("estado", estado);
    if (base) q = q.eq("maquinistas.base", base);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { expedientes: data } };
  },
});
