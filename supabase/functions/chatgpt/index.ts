import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  try {
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      prompt,
      system = "Eres el asistente experto de Gesbase para auditorías, partes y seguridad operacional ferroviaria.",
      model: requestedModel,
      temperature = 0.2,
      max_output_tokens = 1200,
    } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Falta 'prompt' en el body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const messages = [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ];

    let endpoint = "";
    let apiKey = "";
    let model = requestedModel ?? "google/gemini-2.5-flash";

    if (OPENAI_API_KEY) {
      endpoint = "https://api.openai.com/v1/chat/completions";
      apiKey = OPENAI_API_KEY;
      // Si nos pasan un modelo openai/* lo limpiamos
      if (model.startsWith("openai/")) model = model.replace("openai/", "");
      if (model.startsWith("google/")) model = "gpt-4o-mini";
    } else if (LOVABLE_API_KEY) {
      endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = LOVABLE_API_KEY;
      if (!model.includes("/")) model = "google/gemini-2.5-flash";
    } else {
      return new Response(
        JSON.stringify({ error: "No hay OPENAI_API_KEY ni LOVABLE_API_KEY configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: max_output_tokens,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("AI provider error", resp.status, errBody);
      const msg =
        resp.status === 429
          ? "Servicio de IA con límite alcanzado. Inténtalo en un minuto."
          : resp.status === 402
            ? "Sin créditos en el proveedor de IA."
            : `Error del proveedor de IA (${resp.status}).`;
      return new Response(
        JSON.stringify({ error: msg, status: resp.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({ content, model }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("chatgpt function error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
