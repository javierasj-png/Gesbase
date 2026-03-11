import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY no configurada");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { baseFilter } = await req.json();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user accessible bases
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!userRoles;

    let basesAccesibles: string[] = [];
    if (isAdmin) {
      const { data: allBases } = await supabaseAdmin
        .from("bases_conduccion").select("nombre").eq("activa", true);
      basesAccesibles = allBases?.map(b => b.nombre) || [];
    } else {
      const { data: assignments } = await supabaseAdmin
        .from("base_assignments").select("base_nombre").eq("user_id", user.id);
      basesAccesibles = assignments?.map(a => a.base_nombre) || [];
    }

    if (baseFilter && baseFilter !== "all") {
      if (!basesAccesibles.includes(baseFilter)) {
        return new Response(JSON.stringify({ error: "Sin acceso a esta base" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      basesAccesibles = [baseFilter];
    }

    if (basesAccesibles.length === 0) {
      return new Response(JSON.stringify({ error: "No tienes bases asignadas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather data for each base
    const basesData: any[] = [];

    for (const baseNombre of basesAccesibles) {
      // Maquinistas
      const { data: maqs } = await supabaseAdmin
        .from("maquinistas").select("id, nombre, apellidos, matricula, activo, bajo_pe_1603")
        .eq("base", baseNombre).eq("activo", true);
      const maqIds = maqs?.map(m => m.id) || [];

      // PE 16.03
      let pe1603Info: any[] = [];
      if (maqIds.length > 0) {
        const { data: exp1603 } = await supabaseAdmin
          .from("expedientes_1603").select("id, maquinista_id, estado, fecha_inicio, fecha_fin_prevista")
          .in("maquinista_id", maqIds).eq("estado", "abierto");
        if (exp1603 && exp1603.length > 0) {
          const expIds = exp1603.map(e => e.id);
          const { data: plan } = await supabaseAdmin
            .from("plan_1603").select("id, expediente_id, tipo, etiqueta, estado, actuacion_id, inicio_ventana, fin_ventana")
            .in("expediente_id", expIds);
          pe1603Info = exp1603.map(e => {
            const items = plan?.filter(p => p.expediente_id === e.id) || [];
            const total = items.length;
            const realizados = items.filter(i => i.actuacion_id).length;
            const vencidos = items.filter(i => !i.actuacion_id && i.fin_ventana && new Date(i.fin_ventana) < new Date()).length;
            const maq = maqs?.find(m => m.id === e.maquinista_id);
            return {
              maquinista: maq ? `${maq.nombre} ${maq.apellidos}` : e.maquinista_id,
              total, realizados, vencidos,
              cumplimiento: total > 0 ? Math.round((realizados / total) * 100) : 0,
              fechaFin: e.fecha_fin_prevista,
            };
          });
        }
      }

      // PE 12.01
      let pe1201Info: any[] = [];
      if (maqIds.length > 0) {
        const { data: exp1201 } = await supabaseAdmin
          .from("expedientes_1201").select("id, maquinista_id, estado, id_suceso, descripcion_suceso, fecha_primer_servicio, fecha_fin_prevista")
          .in("maquinista_id", maqIds).eq("estado", "abierto");
        if (exp1201 && exp1201.length > 0) {
          const expIds = exp1201.map(e => e.id);
          const { data: plan } = await supabaseAdmin
            .from("plan_1201").select("id, expediente_id, tipo, etiqueta, estado, actuacion_id, dia_desde_origen, fecha_objetivo")
            .in("expediente_id", expIds);
          pe1201Info = exp1201.map(e => {
            const items = plan?.filter(p => p.expediente_id === e.id && p.estado !== "no_procede") || [];
            const total = items.length;
            const realizados = items.filter(i => i.actuacion_id).length;
            const vencidos = items.filter(i => !i.actuacion_id && i.fecha_objetivo && new Date(i.fecha_objetivo) < new Date()).length;
            const maq = maqs?.find(m => m.id === e.maquinista_id);
            return {
              maquinista: maq ? `${maq.nombre} ${maq.apellidos}` : e.maquinista_id,
              idSuceso: e.id_suceso,
              descripcion: e.descripcion_suceso,
              total, realizados, vencidos,
              cumplimiento: total > 0 ? Math.round((realizados / total) * 100) : 0,
              fechaFin: e.fecha_fin_prevista,
            };
          });
        }
      }

      // Visitas y auditorías
      const { data: visitas } = await supabaseAdmin
        .from("visitas_base").select("id, tipo, fecha_visita, titulo, estado_analisis, resumen, puntos_fuertes, puntos_mejora, no_conformidades")
        .eq("base_nombre", baseNombre).eq("estado_analisis", "completado")
        .order("fecha_visita", { ascending: false }).limit(10);

      // Partes
      const { data: partes } = await supabaseAdmin
        .from("partes").select("id, tipo_parte, tipo_informe, fecha_parte, estado, descripcion_hechos, causa, base")
        .eq("base", baseNombre).order("fecha_parte", { ascending: false }).limit(20);

      basesData.push({
        base: baseNombre,
        totalMaquinistas: maqIds.length,
        pe1603: pe1603Info,
        pe1201: pe1201Info,
        visitas: visitas || [],
        partes: partes || [],
      });
    }

    // Build AI prompt
    const prompt = `Eres un auditor jefe experto en Sistemas de Gestión de Seguridad (SGS) ferroviarios en España.

Genera un INFORME DE PROPUESTA DE AUDITORÍA profesional y detallado basándote en los datos reales que se proporcionan a continuación. El informe debe incluir:

1. **RESUMEN EJECUTIVO**: Visión general del estado de cumplimiento de todas las bases analizadas.

2. **ANÁLISIS POR BASE**: Para cada base, analiza:
   - Estado de cumplimiento del PE 16.03 (Plan de Integración de nuevos maquinistas): expedientes abiertos, porcentaje de cumplimiento, acciones vencidas
   - Estado de cumplimiento del PE 12.01 (Actuación tras incidentes): expedientes abiertos, acciones pendientes, vencimientos
   - Histórico de visitas de seguridad y auditorías: frecuencia, hallazgos principales
   - No conformidades detectadas en visitas/auditorías anteriores
   - Partes de incidencia relevantes (PAI, Informes de Conducción)

3. **HALLAZGOS PRINCIPALES**: Lista de los hallazgos más relevantes encontrados en el análisis, clasificados por severidad.

4. **PLAN DE ACCIÓN PROPUESTO**: Acciones correctivas y preventivas recomendadas, con:
   - Descripción de la acción
   - Base afectada
   - Prioridad (Alta/Media/Baja)
   - Plazo recomendado

5. **CALENDARIO PROPUESTO DE VISITAS Y AUDITORÍAS**: Propuesta de fechas y tipo de intervención para cada base.

6. **CONCLUSIONES Y RECOMENDACIONES**: Valoración global y recomendaciones estratégicas.

Fecha actual: ${new Date().toISOString().split("T")[0]}

DATOS DEL SISTEMA:
${JSON.stringify(basesData, null, 2)}

Genera el informe en formato Markdown, profesional y detallado. Usa tablas markdown cuando sea apropiado.`;

    console.log("Generando propuesta de auditoría con IA...");

    const aiMessages = [{ role: "user", content: prompt }];

    // Primary: Groq
    let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: aiMessages, max_tokens: 10000 }),
    });

    // Fallback to Lovable AI on 429
    if (response.status === 429) {
      console.warn("Gemini cuota agotada, usando fallback Lovable AI...");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: aiMessages, max_tokens: 10000 }),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Inténtalo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes. Añade créditos en Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Error al generar el informe" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ success: true, informe: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Error desconocido",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
