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
  name: "list_alertas_certificaciones",
  title: "Alertas de certificaciones",
  description:
    "Devuelve las certificaciones de maquinistas próximas a vencer o vencidas (por inactividad), respetando las bases visibles para el usuario.",
  inputSchema: {
    base: z.string().optional().describe("Filtrar por base."),
    dias: z.number().int().positive().max(365).optional().describe("Ventana en días para 'próxima a vencer' (por defecto 90)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ base, dias }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const client = sb(ctx);
    const ventanaDias = dias ?? 90;

    let q = client
      .from("maquinista_certificaciones")
      .select(
        "id, maquinista_id, certificacion_id, base_id, fecha_ultimo_servicio, periodo_inactividad_meses, vigilar_vencimiento, estado, maquinistas!inner(nombre, apellidos, matricula, base, activo), certificaciones(nombre, tipo)",
      )
      .eq("vigilar_vencimiento", true)
      .eq("maquinistas.activo", true);
    if (base) q = q.eq("maquinistas.base", base);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const hoy = new Date();
    const alertas = (data ?? [])
      .map((r: any) => {
        if (!r.fecha_ultimo_servicio) return null;
        const meses = r.periodo_inactividad_meses ?? 12;
        const fVenc = new Date(r.fecha_ultimo_servicio);
        fVenc.setMonth(fVenc.getMonth() + meses);
        const diasRest = Math.ceil((fVenc.getTime() - hoy.getTime()) / 86400000);
        return {
          maquinista: `${r.maquinistas?.apellidos ?? ""}, ${r.maquinistas?.nombre ?? ""}`.trim(),
          matricula: r.maquinistas?.matricula,
          base: r.maquinistas?.base,
          certificacion: r.certificaciones?.nombre,
          tipo: r.certificaciones?.tipo,
          fecha_ultimo_servicio: r.fecha_ultimo_servicio,
          fecha_estimada_vencimiento: fVenc.toISOString().slice(0, 10),
          dias_restantes: diasRest,
          estado: diasRest < 0 ? "Vencida" : diasRest <= ventanaDias ? "Próxima a vencer" : "Vigente",
        };
      })
      .filter((x: any) => x && (x.estado === "Vencida" || x.estado === "Próxima a vencer"))
      .sort((a: any, b: any) => a.dias_restantes - b.dias_restantes);

    return {
      content: [{ type: "text", text: JSON.stringify(alertas) }],
      structuredContent: { alertas },
    };
  },
});
