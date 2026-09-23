import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function DocumentacionReglamentariaPage() {
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      // RLS limita automáticamente a las bases del usuario
      const { count } = await supabase
        .from('doc_sondeos' as never)
        .select('id', { count: 'exact', head: true });
      setTotal(count ?? 0);
      setLoading(false);
    })();
  }, []);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Documentación reglamentaria</h1>
          <p className="text-sm text-muted-foreground">
            Seguimiento de distribución y lectura de documentos por base de conducción y maquinista.
          </p>
        </div>
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            ) : (
              <>
                <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="font-medium">
                  {total === 0 ? 'Todavía no hay sondeos registrados' : `${total} sondeo(s) registrados`}
                </p>
                <p className="text-sm text-muted-foreground">
                  La importación de datos estará disponible próximamente.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
