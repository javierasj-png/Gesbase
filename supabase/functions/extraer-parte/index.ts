import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

RESPONDE EN FORMATO JSON con esta estructura exacta:
{
  "parteExtraido": {
    "numeroParte": { "valor": "...", "confianza": 95 },
    "fechaParte": { "valor": "2024-01-15", "confianza": 90 },
    "horaParte": { "valor": "14:30", "confianza": 85 },
    ... (todos los campos)
  },
  "confianzaGlobal": 85,
  "dudas": [
    { "campo": "maquinista", "motivo": "Nombre parcialmente legible", "necesito": "Confirmar nombre completo" }
  ],
  "registroListo": {
    "numero_parte": "...",
    "fecha_parte": "2024-01-15",
    ... (campos normalizados para insertar en BD)
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const imageBase64 = formData.get("imageBase64") as string | null;
    const fileName = formData.get("fileName") as string || "documento";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    let imageContent: { type: string; image_url?: { url: string }; text?: string }[] = [];

    if (imageBase64) {
      // Imagen ya viene en base64
      imageContent = [
        { type: "text", text: EXTRACTION_PROMPT },
        { 
          type: "image_url", 
          image_url: { url: imageBase64 }
        }
      ];
    } else if (file) {
      // Convertir archivo a base64
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);
      const mimeType = file.type || "image/jpeg";
      
      imageContent = [
        { type: "text", text: EXTRACTION_PROMPT },
        { 
          type: "image_url", 
          image_url: { url: `data:${mimeType};base64,${base64}` }
        }
      ];
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
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: imageContent
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

    // Extraer JSON de la respuesta
    let extractedData;
    try {
      // Limpiar markdown code fences y buscar JSON
      let cleanContent = content.trim();
      // Eliminar ```json ... ``` wrappers
      cleanContent = cleanContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      
      // Buscar el objeto JSON principal
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Limpiar posibles comentarios inline que rompen JSON
        let jsonStr = jsonMatch[0];
        // Eliminar comentarios // dentro del JSON
        jsonStr = jsonStr.replace(/\/\/[^\n"]*(?=\n)/g, '');
        extractedData = JSON.parse(jsonStr);
      } else {
        throw new Error("No se encontró JSON en la respuesta");
      }
    } catch (parseError) {
      console.error("Error parseando respuesta:", parseError);
      extractedData = {
        parteExtraido: {},
        confianzaGlobal: 0,
        dudas: [{ campo: "general", motivo: "No se pudo parsear la respuesta del modelo", necesito: "Revisar documento manualmente" }],
        registroListo: {},
        rawResponse: content
      };
    }

    // Añadir nombre del archivo fuente
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
