import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, Train } from "lucide-react";

// Beta namespace not yet in supabase-js types.
type AuthOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: AuthOAuth }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const authorizationId = params.get("authorization_id") ?? "";

  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!authorizationId) {
      setError("Falta el parámetro authorization_id.");
      return;
    }
    if (!isAuthenticated) {
      const next = window.location.pathname + window.location.search;
      navigate(`/?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar la autorización.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, isAuthenticated, authLoading, navigate]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("El servidor de autorización no devolvió una URL de redirección.");
        setBusy(false);
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setError(e?.message ?? "Error inesperado.");
      setBusy(false);
    }
  }

  if (authLoading || (!details && !error)) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No se puede autorizar</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "una aplicación externa";
  const redirectUri = details?.client?.redirect_uri ?? details?.redirect_uri;
  const scopes: string[] = details?.scopes ?? details?.scope ?? [];

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow">
            <Train className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle>Conectar {clientName} a GesBase</CardTitle>
          <CardDescription>
            Esto permitirá que <strong>{clientName}</strong> use las herramientas de GesBase actuando como tú.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
              <span>Se respetan tus roles (admin / gestor / mando) y las bases que tienes asignadas. Solo verá los datos que ya puedes ver tú.</span>
            </p>
            {redirectUri && (
              <p className="text-xs break-all"><strong>Redirección:</strong> {redirectUri}</p>
            )}
            {Array.isArray(scopes) && scopes.length > 0 && (
              <p className="text-xs"><strong>Permisos solicitados:</strong> {scopes.join(", ")}</p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aprobar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
