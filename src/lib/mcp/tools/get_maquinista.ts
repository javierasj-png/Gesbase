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
  name: "get_maquinista",
  title: "Detalle de un maquinista",
  description:
    "Devuelve la ficha completa de un maquinista por id o matrícula, incluyendo sus certificaciones vigentes y su expediente PE 16.03 y PE 12.01 abiertos si existen.",
  inputSchema: {
    id: z.string().uuid().optional().describe("UUID del maquinista."),
    matricula: z.string().optional().describe("Matrícula del maquinista (alternativa a id)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, matricula }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    if (!id && !matricula) {
      return { content: [{ type: "text", text: "Debes indicar id o matrícula" }], isError: true };
    }
    const client = sb(ctx);
    let mq = client.from("maquinistas").select("*").limit(1);
    if (id) mq = mq.eq("id", id);
    else mq = mq.eq("matricula", matricula!);
    const { data: maquinistas, error } = await mq;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const maquinista = maquinistas?.[0];
    if (!maquinista) return { content: [{ type: "text", text: "No encontrado" }], isError: true };

    const [certs, e1603, e1201] = await Promise.all([
      client.from("maquinista_certificaciones").select("*").eq("maquinista_id", maquinista.id),
      client.from("expedientes_1603").select("*").eq("maquinista_id", maquinista.id).eq("estado", "abierto"),
      client.from("expedientes_1201").select("*").eq("maquinista_id", maquinista.id).eq("estado", "Abierta"),
    ]);

    const payload = {
      maquinista,
      certificaciones: certs.data ?? [],
      expedientes_1603_abiertos: e1603.data ?? [],
      expedientes_1201_abiertos: e1201.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
