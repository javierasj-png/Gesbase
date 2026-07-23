import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMaquinistas from "./tools/list_maquinistas";
import getMaquinista from "./tools/get_maquinista";
import listAlertasCertificaciones from "./tools/list_alertas_certificaciones";
import listExpedientes1603 from "./tools/list_expedientes_1603";
import listExpedientes1201 from "./tools/list_expedientes_1201";

// Direct Supabase issuer (never the .lovable.cloud proxy). Read at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gesbase-mcp",
  title: "GesBase — Renfe SGS",
  version: "0.1.0",
  instructions:
    "Herramientas de solo lectura sobre GesBase (Renfe Viajeros): maquinistas, alertas de certificaciones, expedientes PE 16.03 y PE 12.01. Todas las llamadas se ejecutan con la identidad del usuario autenticado y respetan las bases y roles asignados (RLS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listMaquinistas,
    getMaquinista,
    listAlertasCertificaciones,
    listExpedientes1603,
    listExpedientes1201,
  ],
});
