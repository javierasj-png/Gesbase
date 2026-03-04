import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres el asistente inteligente de GesBase, una plataforma de gestión de seguridad ferroviaria (SGS) para maquinistas.

Tu función es ayudar al usuario (mandos, gestores o administradores) a:
1. Resolver dudas sobre los procesos SGS (PE 12.01 Factor Humano, PE 16.03 Personal de Nuevo Acceso).
2. Interpretar alertas y avisos del sistema.
3. Analizar la programación de servicio de un maquinista y sugerir qué acciones de vigilancia se pueden realizar.

REGLAS DE PLANIFICACIÓN DE ACCIONES:
- **Acompañamientos**: Se realizan DURANTE el servicio, en trenes. Necesitas saber el horario de conducción del maquinista.
- **Registros**: Se pueden hacer en CUALQUIER momento (durante servicio o descanso). Son los más flexibles.
- **Pruebas de Alcohol y Drogas**: Se realizan EXCLUSIVAMENTE en periodo de DESCANSO del maquinista, nunca durante la conducción.

PROCESO PE 12.01 - Factor Humano:
- Se inicia tras un suceso ferroviario.
- Plan de 40 días con 10 hitos: 5 Acompañamientos + 5 Registros.
- Bloques: Día 1, Día 7, Día 23, Día 30, Día 40.
- Cierre automático a los 40 días o manual por el Mando.

PROCESO PE 16.03 - Personal de Nuevo Acceso:
- Plan de 3 años para maquinistas nuevos.
- Incluye: Acompañamientos (5), Registros (8), controles de Alcohol (3) y Drogas (3).
- Las ventanas de cumplimiento son específicas por tipo y año.

CERTIFICACIONES:
- Cada base tiene certificaciones obligatorias y opcionales.
- Algunas requieren vigilancia de vencimiento por inactividad.

Cuando el usuario te proporcione un horario o programación de servicio:
1. Identifica los periodos de CONDUCCIÓN (servicio activo en trenes).
2. Identifica los periodos de DESCANSO.
3. Sugiere:
   - En conducción → Acompañamientos posibles
   - En descanso → Pruebas de Alcohol/Drogas posibles
   - En cualquier momento → Registros
4. Prioriza las acciones según urgencia de vencimiento si el usuario indica qué hitos están pendientes.

Responde siempre en español. Sé conciso y práctico. Usa formato markdown cuando sea útil.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes, inténtalo de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA agotados. Contacta con el administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Error del servicio de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-gesbase error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
