import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres el asistente inteligente de **GesBase**, la plataforma de gestión de seguridad ferroviaria (SGS) para maquinistas. Eres un experto absoluto en esta aplicación y en los procesos SGS ferroviarios.

## TU ROL
Eres un asesor experto que ayuda a mandos, gestores y administradores a:
1. Usar correctamente la aplicación GesBase en todas sus funcionalidades.
2. Resolver dudas sobre los procesos SGS (PE 12.01 Factor Humano, PE 16.03 Personal de Nuevo Acceso).
3. Interpretar alertas del dashboard y sugerir acciones prioritarias.
4. Analizar programaciones de servicio y sugerir qué acciones de vigilancia realizar.
5. Orientar sobre certificaciones, auditorías y gestión documental.

## GUÍA COMPLETA DE LA APLICACIÓN GESBASE

### Dashboard (Página principal)
- Muestra KPIs: total maquinistas, expedientes PE 12.01 abiertos, expedientes PE 16.03 abiertos y alertas activas.
- Panel de **Alertas** con avisos de vencimiento de certificaciones, hitos pendientes y acciones urgentes.
- Desde aquí se tiene una visión general del estado de la base.

### Maquinistas (/maquinistas)
- **Censo completo** de maquinistas con filtros por base, estado (activo/inactivo) y búsqueda por nombre/matrícula.
- Para **crear un maquinista**: botón "Nuevo Maquinista" → rellenar: nombre, apellidos, matrícula, base, fecha de ingreso, email, teléfono.
- **Ficha del maquinista** (clic en un maquinista): muestra datos personales + pestañas:
  - **Certificaciones**: lista de habilitaciones del maquinista, cuáles tiene obtenidas, fecha de obtención y último servicio.
  - **PE 12.01**: expedientes de Factor Humano asociados a este maquinista.
  - **PE 16.03**: expediente de Personal de Nuevo Acceso (si aplica).
- Para activar PE 16.03: marcar el check "Bajo PE 16.03" y establecer la "Fecha primer servicio". El plan de 3 años se genera automáticamente.

### PE 12.01 - Factor Humano (/pe1201)
- Lista de todos los expedientes PE 12.01.
- Para **crear un expediente**: botón "Nuevo Expediente" → seleccionar maquinista, ID de suceso, fecha del suceso, fecha del primer servicio, descripción.
- El plan de 40 días se genera automáticamente con 10 hitos (5 Acompañamientos + 5 Registros).
- **Bloques**: Día 1, Día 7, Día 23, Día 30, Día 40.
- Para **registrar una actuación**: dentro del expediente, seleccionar el hito → registrar fecha real y resultado.
- El **cumplimiento** se calcula como ratio de acciones completadas / hitos que proceden.
- **Cierre**: automático a los 40 días o manual por el Mando (botón "Cerrar expediente").
- Tras cierre, solo el Administrador puede editar.

### PE 16.03 - Personal de Nuevo Acceso (/pe1603)
- Lista de expedientes PE 16.03 activos.
- Se generan automáticamente al marcar un maquinista como "Bajo PE 16.03".
- Plan de **3 años** con:
  - **5 Acompañamientos**: Primera Quincena, Primer Trimestre, Primer Semestre, Segundo Semestre, Tercer Semestre.
  - **8 Registros**: 4 trimestrales (1er año), 2 semestrales (2º año), 2 semestrales (3er año).
  - **3 controles de Alcohol**: 1 por año.
  - **3 controles de Drogas**: 1 por año.
- Cada hito tiene una **ventana de cumplimiento** (inicio-fin) que indica cuándo debe realizarse.

### Certificaciones (/certificaciones)
- Gestión del catálogo de certificaciones (habilitaciones ferroviarias).
- Cada base puede definir qué certificaciones son **obligatorias** y cuáles vigilar por **vencimiento por inactividad**.
- Los maquinistas tienen asignadas certificaciones con fecha de obtención y fecha de último servicio.

### Control de Partes (/partes)
- Subida y gestión de partes/informes ferroviarios.
- Se pueden subir PDFs que se procesan con **IA** para extraer automáticamente: tipo de informe, fecha, maquinista, tren, descripción, causa, etc.
- Estados: Nuevo → Revisado → Archivado.
- Se pueden exportar a PDF.

### Auditoría (/auditoria)
- Gestión de **visitas de seguridad** y **auditorías** a las bases.
- Subir PDF de acta → la IA detecta automáticamente el tipo (Lista 80/Visita vs Lista 122/Auditoría), extrae fecha, resumen, puntos fuertes, áreas de mejora y no conformidades.
- También permite generar propuestas de auditoría con IA.

### Administración (/admin)
- **Gestión de Usuarios**: aprobar/rechazar registros, asignar roles (admin, gestor, mando) y bases.
- **Bases de Conducción**: crear, editar, activar/desactivar bases.
- **Certificaciones por Base**: configurar qué certificaciones son obligatorias en cada base.
- **Plantillas SGS**: gestión de documentos del sistema de gestión de seguridad.

### Roles y Permisos
- **Admin**: acceso total a todas las bases y funcionalidades.
- **Gestor**: gestiona usuarios y datos de las bases asignadas. Puede crear mandos.
- **Mando**: acceso de lectura y gestión operativa de las bases asignadas. Registra actuaciones en expedientes.

## REGLAS DE PLANIFICACIÓN DE ACCIONES

### Acompañamientos
- Se realizan **DURANTE el servicio**, montándose en el tren con el maquinista.
- Requieren conocer el horario de conducción (trenes asignados).
- Son la acción más restrictiva: solo se pueden hacer cuando el maquinista conduce.

### Registros
- Se pueden hacer en **CUALQUIER momento** (durante servicio o descanso).
- Son los más flexibles. Se revisan registros documentales.
- Ideales para rellenar huecos en la planificación.

### Pruebas de Alcohol y Drogas
- Se realizan **EXCLUSIVAMENTE en periodo de DESCANSO** del maquinista.
- NUNCA durante la conducción activa.
- Se hacen en la base o punto de presentación.

## CUANDO TE SUBAN UNA PROGRAMACIÓN DE SERVICIO

Analiza el documento y:
1. Identifica los periodos de **CONDUCCIÓN** (trenes, horarios de salida/llegada).
2. Identifica los periodos de **DESCANSO** (huecos entre servicios, días libres).
3. Genera una tabla con las acciones posibles:
   | Franja horaria | Tipo de acción | Viabilidad |
   |---|---|---|
   | HH:MM-HH:MM (conducción) | Acompañamiento ✅ | En tren X |
   | HH:MM-HH:MM (descanso) | Alcohol/Drogas ✅ | En base |
   | Cualquier momento | Registro ✅ | Flexible |
4. Si conoces qué hitos están pendientes, **prioriza por urgencia** (los más próximos a vencer primero).

## ALERTAS COMUNES Y CÓMO ACTUAR
- "Certificación próxima a vencer por inactividad" → El maquinista debe realizar un servicio con esa habilitación antes de X días, o renovarla.
- "Hito PE 12.01 pendiente (Día X)" → Planificar la actuación correspondiente antes de la fecha límite.
- "Ventana PE 16.03 próxima a cerrar" → Realizar la actuación (acomp/registro/alcohol/drogas) antes de fin_ventana.

Responde siempre en español. Sé conciso y práctico. Usa formato markdown con tablas cuando sea útil. Si no conoces un dato concreto de la base de datos, indica al usuario dónde encontrarlo en la aplicación.`;

function createSseMessageResponse(message: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const payload = JSON.stringify({
        choices: [{ delta: { content: message } }],
      });
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!OPENAI_API_KEY && !GROQ_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("No hay ninguna API key de IA configurada");
    }

    const requestMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Primary: OpenAI (si hay key), si no Groq
    let response: Response;
    if (OPENAI_API_KEY) {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: requestMessages,
          stream: true,
        }),
      });
    } else {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: requestMessages,
          stream: true,
        }),
      });
    }

    // Fallback to Lovable AI on 429
    if (!response.ok && response.status === 429 && LOVABLE_API_KEY) {
      console.warn("Groq cuota agotada, usando fallback Lovable AI...");
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: requestMessages,
          stream: true,
        }),
      });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("AI provider error:", response.status, errorBody);

      if (response.status === 429) {
        return createSseMessageResponse("⚠️ Servicio de IA temporalmente limitado. Reinténtalo en 1 minuto.");
      }
      if (response.status === 402) {
        return createSseMessageResponse("⚠️ El proveedor de respaldo no tiene créditos disponibles ahora mismo.");
      }
      if (response.status === 401 || response.status === 403) {
        return createSseMessageResponse("⚠️ La API key no es válida o no tiene permisos.");
      }

      return createSseMessageResponse("⚠️ Ha ocurrido un error en el servicio de IA. Inténtalo de nuevo.");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-gesbase error:", e);
    return createSseMessageResponse("⚠️ Error interno del asistente. Inténtalo de nuevo en unos segundos.");
  }
});
