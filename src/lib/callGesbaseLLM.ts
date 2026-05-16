import { supabase } from "@/integrations/supabase/client";

type CallGesbaseLLMParams = {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export async function callGesbaseLLM({
  prompt,
  system = "Eres el asistente experto de Gesbase para auditorías, partes y seguridad operacional ferroviaria.",
  model = "gpt-4.1-mini",
  temperature = 0.2,
  maxOutputTokens = 1200,
}: CallGesbaseLLMParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke("chatgpt", {
    body: {
      system,
      prompt,
      model,
      temperature,
      max_output_tokens: maxOutputTokens,
    },
  });

  if (error) {
    console.error("Error llamando a Edge Function chatgpt:", error);
    throw new Error("No se ha podido conectar con el asistente de Gesbase.");
  }

  if (!data?.content) {
    console.error("Respuesta inesperada de chatgpt:", data);
    throw new Error("La respuesta del asistente ha llegado vacía.");
  }

  return data.content;
}
