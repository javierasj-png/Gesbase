import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_PROMPT = `Eres un auditor experto en Sistemas de Gestión de Seguridad (SGS) ferroviarios en España.

Analiza el documento proporcionado, que corresponde a una visita de seguridad o auditoría realizada en una base de conducción ferroviaria.

PASO 1 - CLASIFICACIÓN DEL DOCUMENTO:
Determina el tipo de documento:
- "visita_seguridad" si se trata de una Visita de Seguridad a la Base (Lista 80 o similar). Suele ser un checklist de verificación de aspectos operativos.
- "auditoria" si se trata de una Auditoría de Base (Lista 122 o similar). Suele ser una revisión más formal y exhaustiva con hallazgos estructurados.

Extrae la fecha de realización del documento (no la fecha de emisión, sino la fecha en que se realizó la visita/auditoría).

PASO 2 - ANÁLISIS:
Genera un ACTA DE AUDITORÍA estructurada con los siguientes apartados:

1. **RESUMEN EJECUTIVO**: Breve resumen de la visita/auditoría (2-3 párrafos). Incluye fecha, tipo de visita, alcance y conclusión general.

2. **PUNTOS FUERTES**: Lista de aspectos positivos detectados. Para cada uno indica:
   - titulo: descripción breve del punto fuerte
   - detalle: explicación más detallada
   - area: área o proceso al que aplica (ej: "Certificaciones", "PE 16.03", "Documentación", "Formación", etc.)

3. **PUNTOS DE MEJORA**: Lista de aspectos mejorables (no son no conformidades). Para cada uno:
   - titulo: descripción breve
   - detalle: explicación y recomendación
   - area: área o proceso
   - prioridad: "alta", "media" o "baja"

4. **NO CONFORMIDADES**: Lista de incumplimientos detectados. Para cada uno:
   - titulo: descripción breve
   - detalle: descripción del incumplimiento
   - norma_referencia: normativa o procedimiento incumplido
   - area: área o proceso
   - severidad: "mayor" o "menor"
   - accion_correctiva: acción correctiva propuesta
   - plazo_dias: plazo propuesto para la corrección (número entero)

RESPONDE EN FORMATO JSON con esta estructura exacta:
{
  "tipo_documento": "visita_seguridad" o "auditoria",
  "fecha_documento": "YYYY-MM-DD" (fecha de realización extraída del documento, o null si no se puede determinar),
  "resumen": "Texto del resumen ejecutivo...",
  "puntos_fuertes": [
    { "titulo": "...", "detalle": "...", "area": "..." }
  ],
  "puntos_mejora": [
    { "titulo": "...", "detalle": "...", "area": "...", "prioridad": "media" }
  ],
  "no_conformidades": [
    { "titulo": "...", "detalle": "...", "norma_referencia": "...", "area": "...", "severidad": "menor", "accion_correctiva": "...", "plazo_dias": 30 }
  ],
  "acta_completa": "Texto completo del acta en formato markdown, incluyendo todos los apartados de forma narrativa y profesional para poder exportar como documento formal."
}

REGLAS:
- Si el documento no tiene información suficiente para algún apartado, indica "No se ha podido determinar a partir del documento proporcionado"
- Sé objetivo y profesional
- Basa tus conclusiones SOLO en lo que aparece en el documento`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = user.id;

    const { visitaId } = await req.json();
    if (!visitaId) {
      return new Response(
        JSON.stringify({ error: "visitaId es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY no configurada");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get visita record
    const { data: visita, error: visitaError } = await supabaseAdmin
      .from("visitas_base")
      .select("*")
      .eq("id", visitaId)
      .single();

    if (visitaError || !visita) {
      throw new Error("Visita no encontrada");
    }

    // Verify user has access to this base - check admin role or base assignment directly
    // (avoid RPC overload ambiguity with can_access_base)
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    let canAccess = !!userRoles;
    if (!canAccess) {
      const { data: assignment } = await supabaseAdmin
        .from("base_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("base_nombre", visita.base_nombre)
        .maybeSingle();
      canAccess = !!assignment;
    }

    if (!canAccess) {
      return new Response(
        JSON.stringify({ error: "Sin acceso a esta base" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabaseAdmin
      .from("visitas_base")
      .update({ estado_analisis: "procesando" })
      .eq("id", visitaId);

    // Download the file
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    const { data: fileData, error: fileError } = await supabaseAdmin
      .storage
      .from("visitas-base")
      .download(visita.archivo_url);

    if (fileError || !fileData) {
      await supabaseAdmin
        .from("visitas_base")
        .update({ estado_analisis: "error" })
        .eq("id", visitaId);
      throw new Error("No se pudo descargar el archivo");
    }

    const arrayBuffer = await fileData.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      await supabaseAdmin
        .from("visitas_base")
        .update({ estado_analisis: "error" })
        .eq("id", visitaId);
      return new Response(
        JSON.stringify({ error: "El archivo excede el tamaño máximo permitido (10MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const mimeType = fileData.type || "application/pdf";

    console.log("Enviando documento a IA para análisis de auditoría...");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: ANALYSIS_PROMPT },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error de IA:", response.status, errorText);

      await supabaseAdmin
        .from("visitas_base")
        .update({ estado_analisis: "error" })
        .eq("id", visitaId);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Inténtalo de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Error al analizar el documento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let analysisData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No se encontró JSON en la respuesta");
      }
    } catch (parseError) {
      console.error("Error parseando respuesta:", parseError);
      await supabaseAdmin
        .from("visitas_base")
        .update({ estado_analisis: "error" })
        .eq("id", visitaId);
      return new Response(
        JSON.stringify({ error: "Error procesando la respuesta del análisis" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine tipo and fecha from AI detection
    const tipoDetectado = analysisData.tipo_documento === "auditoria" ? "auditoria" : "visita_seguridad";
    const fechaDetectada = analysisData.fecha_documento || visita.fecha_visita;
    
    // Build titulo from detected type and date
    const tipoLabel = tipoDetectado === "auditoria" ? "Auditoría" : "Visita Seguridad";
    let fechaFormateada = "";
    try {
      const d = new Date(fechaDetectada);
      fechaFormateada = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } catch {
      fechaFormateada = fechaDetectada;
    }

    // Update visita with analysis results + detected type/date
    const { error: updateError } = await supabaseAdmin
      .from("visitas_base")
      .update({
        estado_analisis: "completado",
        tipo: tipoDetectado,
        fecha_visita: fechaDetectada,
        titulo: `${tipoLabel} ${fechaFormateada}`,
        resumen: analysisData.resumen || "",
        puntos_fuertes: analysisData.puntos_fuertes || [],
        puntos_mejora: analysisData.puntos_mejora || [],
        no_conformidades: analysisData.no_conformidades || [],
        acta_completa: analysisData.acta_completa || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", visitaId);

    if (updateError) {
      console.error("Error actualizando visita:", updateError);
      throw new Error("Error guardando resultados del análisis");
    }

    return new Response(
      JSON.stringify({ success: true, tipo_detectado: tipoDetectado, fecha_detectada: fechaDetectada, ...analysisData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en análisis:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
