import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generarInformeBasico(basesData: any[]) {
  const fecha = new Date().toISOString().split("T")[0];

  let informe = `# INFORME DE PROPUESTA DE AUDITORÍA

**Fecha:** ${fecha}

## 1. RESUMEN EJECUTIVO

Se genera una propuesta de auditoría basada en los datos disponibles en el sistema.

No se ha utilizado motor de IA porque no hay una clave de IA configurada o porque el servicio de IA no ha respondido correctamente.

`;

  for (const base of basesData) {
    const visitas = base.visitas || [];
    const partes = base.partes || [];
    const pe1603 = base.pe1603 || [];
    const pe1201 = base.pe1201 || [];

    const totalNC = visitas.reduce((acc: number, v: any) => {
      if (Array.isArray(v.no_conformidades)) return acc + v.no_conformidades.length;
      if (typeof v.no_conformidades === "number") return acc + v.no_conformidades;
      return acc;
    }, 0);

    informe += `## 2. ANÁLISIS DE LA BASE ${base.base}

| Indicador | Valor |
|---|---:|
| Maquinistas activos | ${base.totalMaquinistas ?? 0} |
| Expedientes PE 16.03 abiertos | ${pe1603.length} |
| Expedientes PE 12.01 abiertos | ${pe1201.length} |
| Visitas/Auditorías analizadas | ${visitas.length} |
| Partes recientes registrados | ${partes.length} |
| No conformidades detectadas | ${totalNC} |

`;

    if (pe1603.length > 0) {
      informe += `### Estado PE 16.03

| Maquinista | Cumplimiento actual | Cumpl. global | Exigibles hoy | Vencidos | % tiempo | Fecha fin |
|---|---:|---:|---:|---:|---:|---|
`;
      for (const item of pe1603) {
        const ca = item.cumplimientoActual === null ? "—" : `${item.cumplimientoActual}%`;
        informe += `| ${item.maquinista || "-"} | ${ca} | ${item.cumplimientoGlobal ?? 0}% | ${item.exigiblesHoy ?? 0} | ${item.vencidos ?? 0} | ${item.pctTiempoTranscurrido ?? 0}% | ${item.fechaFin || "-"} |\n`;
      }
      informe += "\n_Cumplimiento actual = realizado / exigible a día de hoy. Si no hay hitos exigibles aún, se marca '—' (expediente en curso, sin desviación)._\n\n";
    }

    if (pe1201.length > 0) {
      informe += `### Estado PE 12.01

| Maquinista | Suceso | Cumplimiento actual | Cumpl. global | Exigibles hoy | Vencidos | % tiempo | Fecha fin |
|---|---|---:|---:|---:|---:|---:|---|
`;
      for (const item of pe1201) {
        const ca = item.cumplimientoActual === null ? "—" : `${item.cumplimientoActual}%`;
        informe += `| ${item.maquinista || "-"} | ${item.idSuceso || "-"} | ${ca} | ${item.cumplimientoGlobal ?? 0}% | ${item.exigiblesHoy ?? 0} | ${item.vencidos ?? 0} | ${item.pctTiempoTranscurrido ?? 0}% | ${item.fechaFin || "-"} |\n`;
      }
      informe += "\n_Cumplimiento actual = realizado / exigible a día de hoy. Si no hay hitos exigibles aún, se marca '—' (expediente en curso, sin desviación)._\n\n";
    }

    if (visitas.length > 0) {
      informe += `### Histórico de visitas y auditorías

| Fecha | Tipo | Título | Estado |
|---|---|---|---|
`;
      for (const visita of visitas) {
        informe += `| ${visita.fecha_visita || "-"} | ${visita.tipo || "-"} | ${visita.titulo || "-"} | ${visita.estado_analisis || "-"} |\n`;
      }
      informe += "\n";
    }

    if (partes.length > 0) {
      informe += `### Partes recientes

| Fecha | Tipo | Estado | Descripción |
|---|---|---|---|
`;
      for (const parte of partes.slice(0, 10)) {
        informe += `| ${parte.fecha_parte || "-"} | ${parte.tipo_parte || parte.tipo_informe || "-"} | ${parte.estado || "-"} | ${(parte.descripcion_hechos || "-").toString().replace(/\|/g, "/")} |\n`;
      }
      informe += "\n";
    }

    informe += `### Valoración preliminar

La base ${base.base} debe priorizarse en función de las no conformidades detectadas, expedientes abiertos, acciones vencidas y recurrencia de partes o hallazgos en visitas anteriores.

`;
  }

  informe += `## 3. HALLAZGOS PRINCIPALES

- Revisar las bases con expedientes PE 16.03 o PE 12.01 abiertos.
- Priorizar las bases con acciones vencidas.
- Realizar seguimiento específico de no conformidades detectadas en visitas o auditorías anteriores.
- Analizar la recurrencia de partes e incidencias en cada base.

## 4. PLAN DE ACCIÓN PROPUESTO

| Acción | Prioridad | Plazo recomendado |
|---|---|---|
| Revisar expedientes PE 16.03 abiertos y acciones vencidas | Alta | 30 días |
| Revisar expedientes PE 12.01 abiertos | Alta | 30 días |
| Hacer seguimiento de no conformidades pendientes | Media | 60 días |
| Programar visita o auditoría en bases con mayor recurrencia de hallazgos | Media | 90 días |

## 5. CALENDARIO PROPUESTO DE VISITAS Y AUDITORÍAS

Se propone programar las visitas y auditorías priorizando:

1. Bases con no conformidades abiertas.
2. Bases con acciones vencidas en PE 16.03 o PE 12.01.
3. Bases con mayor número de partes recientes.
4. Bases sin visita o auditoría reciente.

## 6. CONCLUSIONES Y RECOMENDACIONES

El informe se ha generado automáticamente con los datos disponibles.

Para obtener un análisis más avanzado con redacción asistida por IA, deberá configurarse una clave de IA válida en el entorno de ejecución de la Edge Function.

`;

  return informe;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error:
            "Faltan variables de Supabase en la Edge Function: SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const OLLAMA_API_KEY = Deno.env.get("OLLAMA_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { baseFilter } = body;

    console.log("Generando propuesta de auditoría", {
      userId: user.id,
      baseFilter,
      hasGroq: !!GROQ_API_KEY,
      hasLovable: !!LOVABLE_API_KEY,
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!userRoles;

    let basesAccesibles: string[] = [];

    if (isAdmin) {
      const { data: allBases, error: basesError } = await supabaseAdmin
        .from("bases_conduccion")
        .select("nombre")
        .eq("activa", true);

      if (basesError) {
        throw new Error(`Error consultando bases_conduccion: ${basesError.message}`);
      }

      basesAccesibles = allBases?.map((b) => b.nombre) || [];
    } else {
      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from("base_assignments")
        .select("base_nombre")
        .eq("user_id", user.id);

      if (assignmentsError) {
        throw new Error(`Error consultando base_assignments: ${assignmentsError.message}`);
      }

      basesAccesibles = assignments?.map((a) => a.base_nombre) || [];
    }

    if (baseFilter && baseFilter !== "all") {
      if (!basesAccesibles.includes(baseFilter)) {
        return new Response(JSON.stringify({ error: "Sin acceso a esta base" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      basesAccesibles = [baseFilter];
    }

    if (basesAccesibles.length === 0) {
      return new Response(JSON.stringify({ error: "No tienes bases asignadas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const basesData: any[] = [];

    for (const baseNombre of basesAccesibles) {
      const { data: maqs, error: maqsError } = await supabaseAdmin
        .from("maquinistas")
        .select("id, nombre, apellidos, matricula, activo, bajo_pe_1603")
        .eq("base", baseNombre)
        .eq("activo", true);

      if (maqsError) {
        console.error("Error consultando maquinistas", baseNombre, maqsError);
      }

      const maqIds = maqs?.map((m) => m.id) || [];

      let pe1603Info: any[] = [];

      if (maqIds.length > 0) {
        const { data: exp1603 } = await supabaseAdmin
          .from("expedientes_1603")
          .select("id, maquinista_id, estado, fecha_inicio, fecha_fin_prevista")
          .in("maquinista_id", maqIds)
          .eq("estado", "abierto");

        if (exp1603 && exp1603.length > 0) {
          const expIds = exp1603.map((e) => e.id);

          const { data: plan } = await supabaseAdmin
            .from("plan_1603")
            .select("id, expediente_id, tipo, etiqueta, estado, actuacion_id, inicio_ventana, fin_ventana")
            .in("expediente_id", expIds);

          const hoy = new Date();
          pe1603Info = exp1603.map((e) => {
            const items = plan?.filter((p) => p.expediente_id === e.id) || [];
            const total = items.length;
            const realizados = items.filter((i) => i.actuacion_id).length;
            const vencidos = items.filter(
              (i) => !i.actuacion_id && i.fin_ventana && new Date(i.fin_ventana) < hoy
            ).length;
            // Exigibles a día de hoy = bloques cuya ventana ya ha abierto (inicio_ventana <= hoy)
            const exigibles = items.filter(
              (i) => i.inicio_ventana && new Date(i.inicio_ventana) <= hoy
            ).length;
            const realizadosExigibles = items.filter(
              (i) => i.actuacion_id && i.inicio_ventana && new Date(i.inicio_ventana) <= hoy
            ).length;
            const maq = maqs?.find((m) => m.id === e.maquinista_id);

            // % tiempo transcurrido del expediente
            let pctTiempo = 0;
            if (e.fecha_inicio && e.fecha_fin_prevista) {
              const ini = new Date(e.fecha_inicio).getTime();
              const fin = new Date(e.fecha_fin_prevista).getTime();
              if (fin > ini) {
                pctTiempo = Math.min(100, Math.max(0, Math.round(((hoy.getTime() - ini) / (fin - ini)) * 100)));
              }
            }

            return {
              maquinista: maq ? `${maq.nombre} ${maq.apellidos}` : e.maquinista_id,
              fechaInicio: e.fecha_inicio,
              fechaFin: e.fecha_fin_prevista,
              pctTiempoTranscurrido: pctTiempo,
              total,
              realizados,
              vencidos,
              exigiblesHoy: exigibles,
              realizadosExigibles,
              cumplimientoGlobal: total > 0 ? Math.round((realizados / total) * 100) : 0,
              cumplimientoActual: exigibles > 0 ? Math.round((realizadosExigibles / exigibles) * 100) : null,
            };
          });
        }
      }

      let pe1201Info: any[] = [];

      if (maqIds.length > 0) {
        const { data: exp1201 } = await supabaseAdmin
          .from("expedientes_1201")
          .select("id, maquinista_id, estado, id_suceso, descripcion_suceso, fecha_primer_servicio, fecha_fin_prevista")
          .in("maquinista_id", maqIds)
          .eq("estado", "abierto");

        if (exp1201 && exp1201.length > 0) {
          const expIds = exp1201.map((e) => e.id);

          const { data: plan } = await supabaseAdmin
            .from("plan_1201")
            .select("id, expediente_id, tipo, etiqueta, estado, actuacion_id, dia_desde_origen, fecha_objetivo")
            .in("expediente_id", expIds);

          const hoy2 = new Date();
          pe1201Info = exp1201.map((e) => {
            const items = plan?.filter((p) => p.expediente_id === e.id && p.estado !== "no_procede") || [];
            const total = items.length;
            const realizados = items.filter((i) => i.actuacion_id).length;
            const vencidos = items.filter(
              (i) => !i.actuacion_id && i.fecha_objetivo && new Date(i.fecha_objetivo) < hoy2
            ).length;
            // Exigibles a día de hoy = hitos cuya fecha objetivo ya ha llegado
            const exigibles = items.filter(
              (i) => i.fecha_objetivo && new Date(i.fecha_objetivo) <= hoy2
            ).length;
            const realizadosExigibles = items.filter(
              (i) => i.actuacion_id && i.fecha_objetivo && new Date(i.fecha_objetivo) <= hoy2
            ).length;
            const maq = maqs?.find((m) => m.id === e.maquinista_id);

            let pctTiempo = 0;
            if (e.fecha_primer_servicio && e.fecha_fin_prevista) {
              const ini = new Date(e.fecha_primer_servicio).getTime();
              const fin = new Date(e.fecha_fin_prevista).getTime();
              if (fin > ini) {
                pctTiempo = Math.min(100, Math.max(0, Math.round(((hoy2.getTime() - ini) / (fin - ini)) * 100)));
              }
            }

            return {
              maquinista: maq ? `${maq.nombre} ${maq.apellidos}` : e.maquinista_id,
              idSuceso: e.id_suceso,
              descripcion: e.descripcion_suceso,
              fechaInicio: e.fecha_primer_servicio,
              fechaFin: e.fecha_fin_prevista,
              pctTiempoTranscurrido: pctTiempo,
              total,
              realizados,
              vencidos,
              exigiblesHoy: exigibles,
              realizadosExigibles,
              cumplimientoGlobal: total > 0 ? Math.round((realizados / total) * 100) : 0,
              cumplimientoActual: exigibles > 0 ? Math.round((realizadosExigibles / exigibles) * 100) : null,
            };
          });
        }
      }

      const { data: visitas } = await supabaseAdmin
        .from("visitas_base")
        .select("id, tipo, fecha_visita, titulo, estado_analisis, resumen, puntos_fuertes, puntos_mejora, no_conformidades")
        .eq("base_nombre", baseNombre)
        .eq("estado_analisis", "completado")
        .order("fecha_visita", { ascending: false })
        .limit(10);

      const { data: partes } = await supabaseAdmin
        .from("partes")
        .select("id, tipo_parte, tipo_informe, fecha_parte, estado, descripcion_hechos, causa, base")
        .eq("base", baseNombre)
        .order("fecha_parte", { ascending: false })
        .limit(20);

      basesData.push({
        base: baseNombre,
        totalMaquinistas: maqIds.length,
        pe1603: pe1603Info,
        pe1201: pe1201Info,
        visitas: visitas || [],
        partes: partes || [],
      });
    }

    console.log("Bases analizadas:", basesData.length, "Modo IA:", GROQ_API_KEY ? "groq" : (LOVABLE_API_KEY ? "lovable" : "sin_ia"));

    const fechaHoy = new Date().toISOString().split("T")[0];

    const systemPrompt = `Eres el AUDITOR JEFE de Seguridad en la Circulación de Renfe, con más de 20 años de experiencia en Sistemas de Gestión de Seguridad (SGS) ferroviarios bajo el marco normativo de la AESF (Agencia Estatal de Seguridad Ferroviaria), el Reglamento UE 2018/762 y los procedimientos internos PE 12.01 (Factor Humano tras suceso) y PE 16.03 (Personal de Nuevo Acceso).

Tu misión: redactar una PROPUESTA DE AUDITORÍA INTERNA rigurosa, accionable y defendible ante la AESF, lista para ser presentada al Comité de Seguridad. NO un resumen genérico: un documento de auditoría real.

PRINCIPIOS:
- Cero relleno: cada frase aporta un dato, un hallazgo o una acción concreta.
- Trazabilidad: cita siempre los datos que respaldan cada hallazgo (nº de expedientes, % cumplimiento, NCs concretas, fechas).
- Foco en riesgo: prioriza lo que pone en riesgo la circulación o el cumplimiento normativo.
- Tono técnico-profesional, en español de España, sin anglicismos innecesarios.

CRITERIO CLAVE DE CUMPLIMIENTO (MUY IMPORTANTE):
- El indicador prioritario NO es \`cumplimientoGlobal\` (realizado / total del plan completo), sino \`cumplimientoActual\` (realizado / exigible a día de hoy).
- Un expediente recién abierto tendrá \`cumplimientoGlobal\` bajo de forma natural porque aún no ha transcurrido el tiempo; eso NO es una no conformidad.
- Una desviación sólo es preocupante si \`cumplimientoActual\` es bajo y/o hay \`vencidos > 0\`. Si \`exigiblesHoy = 0\`, el expediente está en periodo de gracia y debe marcarse como "En curso — sin hitos exigibles aún", NO como incumplimiento.
- Pondera siempre el \`pctTiempoTranscurrido\` del expediente: si es <20% el expediente está iniciándose; si es >80% y \`cumplimientoActual\` < 80%, es alto riesgo.
- UMBRALES OFICIALES DE CUMPLIMIENTO (aplicar SIEMPRE sobre \`cumplimientoActual\`):
  · > 80%  → 🟢 **Satisfactorio** (conforme)
  · 65–80% → 🟡 **Aceptable** (observación menor)
  · 50–65% → 🟠 **Mejorable** (observación / NC menor)
  · < 50%  → 🔴 **Insuficiente** (no conformidad)
- En las tablas y semáforos usa SIEMPRE \`cumplimientoActual\` (no el global). Muestra el global solo como referencia secundaria.`;

    const userPrompt = `Fecha de emisión: ${fechaHoy}
Bases incluidas en el alcance: ${basesData.map((b: any) => b.base).join(", ")}

DATOS REALES DEL SISTEMA GESBASE (JSON):
\`\`\`json
${JSON.stringify(basesData, null, 2)}
\`\`\`

Redacta el INFORME DE PROPUESTA DE AUDITORÍA en formato Markdown con la siguiente estructura OBLIGATORIA y CON EL NIVEL DE DETALLE QUE SE INDICA:

# INFORME DE PROPUESTA DE AUDITORÍA INTERNA — SGS
**Fecha:** ${fechaHoy} · **Ámbito:** ${basesData.map((b: any) => b.base).join(", ")} · **Marco:** PE 12.01, PE 16.03, Reglamento UE 2018/762

## 1. Resumen ejecutivo
Párrafo de 6-10 líneas con: contexto, criticidad global (Alta/Media/Baja JUSTIFICADA con cifras), 3 hallazgos top y la recomendación principal. Después una tabla resumen:
| Indicador | Valor | Valoración |
con filas para: nº bases, maquinistas activos, expedientes 16.03 abiertos, expedientes 12.01 abiertos, % cumplimiento medio 16.03, % cumplimiento medio 12.01, acciones vencidas totales, NCs abiertas, partes recientes.

## 2. Alcance y metodología
Breve (4-6 líneas): bases auditadas, periodo analizado (deduce desde fechas de los datos), fuentes (expedientes 1201/1603, visitas Lista 80/122, partes), criterio de muestreo y criterios de evaluación basados en **cumplimientoActual** (realizado/exigible a día de hoy) con los UMBRALES OFICIALES: >80% Satisfactorio 🟢, 65-80% Aceptable 🟡, 50-65% Mejorable 🟠, <50% Insuficiente 🔴. Expedientes con \`exigiblesHoy = 0\` se clasifican como "En curso — sin hitos exigibles aún" y NO computan como incumplimiento.

## 3. Análisis detallado por base
Para CADA base, una subsección \`### 3.x Base [NOMBRE]\` con:
- **Ficha de la base**: tabla con maquinistas activos, expedientes abiertos, NCs históricas, partes recientes.
- **Estado PE 16.03**: tabla maquinista por maquinista (cumplimiento %, acciones vencidas, fecha fin prevista, semáforo 🟢🟡🔴 según umbrales).
- **Estado PE 12.01**: tabla por expediente (suceso, cumplimiento, vencidos, fecha fin, semáforo).
- **Histórico de visitas y NCs**: tabla con fecha, tipo, NCs detectadas, estado.
- **Partes recientes relevantes**: solo los que aporten señal (incidencias graves, recurrencia, mismo maquinista repetido).
- **Riesgos detectados en esta base**: lista bullet con 3-6 riesgos CONCRETOS citando los datos (ej: "Maquinista X con 4 acciones 16.03 vencidas y cumplimiento 42%").

## 4. Hallazgos consolidados
Numerados H-01, H-02… Para cada uno:
- **Descripción** (qué se ha detectado, con cifras).
- **Evidencia** (qué dato del sistema lo soporta).
- **Criticidad**: Crítica / Alta / Media / Baja.
- **Requisito incumplido** (PE 12.01 / PE 16.03 / Reglamento UE 2018/762 art. X / procedimiento interno).
Mínimo 5 hallazgos si los datos lo permiten.

## 5. No conformidades propuestas
Tabla:
| ID | Descripción | Base | Tipo (NC mayor / NC menor / Observación) | Cláusula incumplida |

## 6. Plan de acción propuesto
Tabla detallada:
| ID | Acción correctiva | Responsable sugerido | Plazo | Indicador de cierre | Prioridad |
Acciones SMART, no genéricas. Mínimo 6 acciones.

## 7. Calendario propuesto de visitas y auditorías (próximos 6 meses)
Tabla mes a mes:
| Mes | Base | Tipo (Visita Lista 80 / Auditoría Lista 122 / Seguimiento NC) | Foco | Justificación |
Prioriza bases con peor cumplimiento, más NCs abiertas o sin visita reciente.

## 8. Conclusiones y recomendaciones al Comité de Seguridad
3-5 párrafos: estado general, riesgos residuales, recomendación formal (aprobar/aprobar con condiciones/rechazar), y siguientes pasos.

## 9. Anexo — Indicadores clave (KPIs)
Tabla con: % cumplimiento global 16.03, % cumplimiento global 12.01, ratio NCs/visita, ratio partes/maquinista, nº expedientes vencidos.

REGLAS DE REDACCIÓN:
- Si un dato no existe en el JSON, escribe "Sin datos en el periodo" — NUNCA inventes cifras.
- Usa SIEMPRE las cifras reales del JSON, no aproximaciones.
- Las tablas Markdown deben estar bien formateadas (cabecera con \`|---|\`).
- No uses emojis salvo los semáforos 🟢🟡🔴.
- El informe debe poder imprimirse y entregarse tal cual; no incluyas notas al modelo ni meta-comentarios.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    

    if (!OPENAI_API_KEY && !GROQ_API_KEY) {
      console.warn("No hay OPENAI_API_KEY ni GROQ_API_KEY. Generando informe básico sin IA.");

      const informeBasico = generarInformeBasico(basesData);

      return new Response(
        JSON.stringify({
          success: true,
          informe: informeBasico,
          modo: "sin_ia",
          warning: "No hay API key de IA configurada. Se ha generado un informe básico sin IA.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Para este informe usamos Lovable AI (Gemini 2.5 Flash) como motor principal:
    // el prompt + datos suele superar el límite TPM de llama-3.1-8b-instant en Groq.
    // Groq queda como fallback si Lovable AI no está disponible o falla.
    let response: Response;
    if (LOVABLE_API_KEY) {
      console.log("Generando propuesta de auditoría con Lovable AI (gemini-2.5-flash)...");
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          max_tokens: 12000,
        }),
      });
    } else {
      console.log("Generando propuesta de auditoría con Groq (llama-3.3-70b-versatile)...");
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: aiMessages,
          max_tokens: 8000,
        }),
      });
    }

    // Si el motor principal falla, probamos Ollama Cloud (gpt-oss:20b) como fallback intermedio
    if (!response.ok && OLLAMA_API_KEY) {
      console.warn(`Motor principal respondió ${response.status}. Intentando fallback Ollama Cloud...`);
      response = await fetch("https://ollama.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OLLAMA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-oss:20b",
          messages: aiMessages,
          max_tokens: 8000,
        }),
      });
    }

    // Si Ollama también falla, intentamos Groq como último fallback
    if (!response.ok && LOVABLE_API_KEY && GROQ_API_KEY) {
      console.warn(`Fallback Ollama respondió ${response.status}. Intentando fallback Groq...`);
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: aiMessages,
          max_tokens: 8000,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error de IA:", response.status, errorText);

      const informeBasico = generarInformeBasico(basesData);

      return new Response(
        JSON.stringify({
          success: true,
          informe: informeBasico,
          modo: "sin_ia",
          warning: `La IA no respondió correctamente. Status ${response.status}. Se ha generado informe básico.`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    if (!content) {
      const informeBasico = generarInformeBasico(basesData);

      return new Response(
        JSON.stringify({
          success: true,
          informe: informeBasico,
          modo: "sin_ia",
          warning: "La IA no devolvió contenido. Se ha generado informe básico.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        informe: content,
        modo: "ia",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error general en propuesta-auditoria:", error);

    // Fallback graceful: devolver 200 con informe mínimo y warning,
    // para que el frontend muestre el error real sin romper la UX.
    const fecha = new Date().toISOString().split("T")[0];
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    const informeMinimo = `# INFORME DE PROPUESTA DE AUDITORÍA

**Fecha:** ${fecha}

## Aviso

No se ha podido generar el informe completo por un error interno: ${mensaje}

Revisa la configuración del entorno o vuelve a intentarlo más tarde.
`;

    return new Response(
      JSON.stringify({
        success: true,
        informe: informeMinimo,
        modo: "sin_ia",
        warning: `Error al generar la propuesta: ${mensaje}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
