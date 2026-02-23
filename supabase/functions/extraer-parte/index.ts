import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pdf from "npm:pdf-parse@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `Eres un agente experto en extracción de datos de documentos ferroviarios españoles.
Analiza el documento adjunto (parte de incidencia/retraso/avería) y extrae los siguientes campos:

CAMPOS A EXTRAER:
- numeroParte: texto, puede incluir letras y números
- fechaParte: fecha en formato ISO (YYYY-MM-DD). Si ves DD/MM/YYYY, conviértelo
- horaParte: hora en formato HH:MM (24h)
- horaInicio: si hay rango de horas, hora de inicio
- horaFin: si hay rango de horas, hora de fin
- base: base, centro o dependencia
- maquinista: nombre del maquinista
- maquinistaId: matrícula o ID si aparece
- trenServicio: número de tren, servicio o turno
- lineaTramo: línea o tramo ferroviario
- tipoParte: clasificar en una de estas: "Incidencia", "Retraso", "Avería", "Seguridad", "Otro"
- descripcionHechos: descripción de lo ocurrido
- minutosRetraso: número entero de minutos. Si dice "1h 20m", convertir a 80
- causa: causa del incidente si aparece
- accionesTomadas: acciones realizadas
- firmante: nombre y/o cargo del firmante
- observaciones: cualquier otra información relevante

REGLAS:
1. Si un campo no está presente, usar null
2. Nunca inventar datos - si no es claro, dejar null
3. Para cada campo, indica un nivel de confianza (0-100)
4. Si hay datos ambiguos o conflictivos, anótalos en "dudas"

RESPONDE ÚNICAMENTE con JSON válido (sin comentarios, sin markdown) con esta estructura:
{
  "parteExtraido": {
    "numeroParte": { "valor": "...", "confianza": 95 },
    "fechaParte": { "valor": "2024-01-15", "confianza": 90 },
    "horaParte": { "valor": "14:30", "confianza": 85 },
    "horaInicio": { "valor": null, "confianza": 0 },
    "horaFin": { "valor": null, "confianza": 0 },
    "base": { "valor": "...", "confianza": 80 },
    "maquinista": { "valor": "...", "confianza": 85 },
    "maquinistaId": { "valor": null, "confianza": 0 },
    "trenServicio": { "valor": "...", "confianza": 80 },
    "lineaTramo": { "valor": "...", "confianza": 80 },
    "tipoParte": { "valor": "Incidencia", "confianza": 90 },
    "descripcionHechos": { "valor": "...", "confianza": 85 },
    "minutosRetraso": { "valor": 0, "confianza": 70 },
    "causa": { "valor": "...", "confianza": 75 },
    "accionesTomadas": { "valor": "...", "confianza": 70 },
    "firmante": { "valor": "...", "confianza": 80 },
    "observaciones": { "valor": null, "confianza": 0 }
  },
  "confianzaGlobal": 85,
  "dudas": [],
  "registroListo": {
    "numero_parte": "...",
    "fecha_parte": "2024-01-15",
    "hora_parte": "14:30",
    "hora_inicio": null,
    "hora_fin": null,
    "base": "...",
    "maquinista_texto": "...",
    "maquinista_id": null,
    "tren_servicio": "...",
    "linea_tramo": "...",
    "tipo_parte": "Incidencia",
    "descripcion_hechos": "...",
    "minutos_retraso": 0,
    "causa": "...",
    "acciones_tomadas": "...",
    "firmante": "...",
    "observaciones": null,
    "fuente_archivo": null
  }
}`;

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

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- End authentication ---

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const imageBase64 = formData.get("imageBase64") as string | null;
    const fileName = formData.get("fileName") as string || "documento";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    let messageContent: any[] = [];

    if (imageBase64) {
      console.log("Procesando imagen base64...");
      messageContent = [
        { type: "text", text: EXTRACTION_PROMPT },
        { type: "image_url", image_url: { url: imageBase64 } }
      ];
    } else if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const mimeType = file.type || "application/octet-stream";
      const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        console.log("Procesando PDF, extrayendo texto...");
        let pdfText = "";
        try {
          const buffer = Buffer.from(uint8Array);
          const pdfData = await pdf(buffer);
          pdfText = (pdfData.text || "").trim();
          console.log(`Texto extraído del PDF: ${pdfText.length} caracteres, ${pdfData.numpages} páginas`);
        } catch (pdfError) {
          console.warn("No se pudo extraer texto del PDF:", pdfError);
        }

        if (pdfText.length > 50) {
          console.log("PDF con texto legible, enviando como texto al modelo");
          messageContent = [
            { 
              type: "text", 
              text: `${EXTRACTION_PROMPT}\n\n--- CONTENIDO DEL DOCUMENTO (extraído del PDF "${fileName}") ---\n\n${pdfText}` 
            }
          ];
        } else {
          console.log("PDF sin texto legible (escaneado), enviando como imagen para OCR");
          let binary = "";
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);
          messageContent = [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
          ];
        }
      } else {
        console.log("Procesando imagen...");
        let binary = "";
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        messageContent = [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
        ];
      }
    } else {
      return new Response(
        JSON.stringify({ error: "No se proporcionó archivo o imagen" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Enviando documento a Lovable AI para extracción...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error de Lovable AI:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Inténtalo de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Añade créditos en Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Error al procesar el documento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    console.log("Respuesta de IA recibida, parseando...");

    let extractedData;
    try {
      let cleanContent = content.trim();
      cleanContent = cleanContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        jsonStr = jsonStr.replace(/\/\/[^\n"]*(?=\n)/g, '');
        extractedData = JSON.parse(jsonStr);
      } else {
        throw new Error("No se encontró JSON en la respuesta");
      }
    } catch (parseError) {
      console.error("Error parseando respuesta:", parseError);
      console.error("Contenido raw:", content.substring(0, 500));
      extractedData = {
        parteExtraido: {},
        confianzaGlobal: 0,
        dudas: [{ campo: "general", motivo: "No se pudo parsear la respuesta del modelo", necesito: "Revisar documento manualmente" }],
        registroListo: {},
        rawResponse: content
      };
    }

    if (extractedData.registroListo) {
      extractedData.registroListo.fuente_archivo = fileName;
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...extractedData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en extracción:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconocido",
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
