import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Max-Age": "86400",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `Eres un mando de Renfe redactando una comunicación interna a un maquinista sobre una anomalía detectada (PREVER, suceso, incidencia).

REGLAS OBLIGATORIAS:
- Lenguaje profesional, sereno y respetuoso.
- Cultura JUSTA y NO PUNITIVA: el objetivo es aprender y mejorar la seguridad, NUNCA culpabilizar, sancionar ni juzgar.
- Evita verbos acusatorios ("usted hizo mal", "incumplió", "negligencia", "error suyo").
- Usa fórmulas como "hemos observado", "con el fin de reforzar", "como parte de nuestro proceso de mejora continua".
- Menciona que se abre un seguimiento especial conforme a los procedimientos internos de SGS.
- Invita a la colaboración y al diálogo.
- Cierra ofreciendo apoyo y disponibilidad del mando.
- 4 a 7 frases. Sin Markdown, sin asteriscos, sin emojis. Texto plano listo para email.
- Empieza con "Estimado/a compañero/a," y firma con "Un saludo,\\nEl Mando de la Base."`;

async function callGroq(userPrompt: string): Promise<Response | null> {
  if (!GROQ_API_KEY) return null;
  return await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });
}

async function callLovable(userPrompt: string): Promise<Response | null> {
  if (!LOVABLE_API_KEY) return null;
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { maquinista, motivo, indice_prever, fecha_anomalia } = await req.json();

    const ctx = [
      `Maquinista: ${maquinista || "—"}`,
      `Motivo / descripción de la anomalía: ${motivo || "—"}`,
      indice_prever ? `Índice PREVER / Gestión de anomalía: ${indice_prever}` : null,
      fecha_anomalia ? `Fecha de la anomalía: ${fecha_anomalia}` : null,
    ].filter(Boolean).join("\n");

    const userPrompt = `Redacta el cuerpo del email de comunicación de anomalía con estos datos:\n\n${ctx}`;

    let resp = await callGroq(userPrompt);
    if (!resp || !resp.ok) {
      if (resp && resp.status !== 429 && resp.status !== 401 && resp.status !== 403) {
        const err = await resp.text();
        console.error("Groq error:", resp.status, err);
      }
      resp = await callLovable(userPrompt);
    }

    if (!resp || !resp.ok) {
      const status = resp?.status ?? 500;
      const body = resp ? await resp.text() : "no provider";
      console.error("AI error:", status, body);
      if (status === 429) return new Response(JSON.stringify({ error: "Servicio IA limitado. Reinténtalo en unos segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Sin créditos de IA disponibles." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Error generando el email." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ body: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generar-email-anomalia error:", e);
    return new Response(JSON.stringify({ error: "Error interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
