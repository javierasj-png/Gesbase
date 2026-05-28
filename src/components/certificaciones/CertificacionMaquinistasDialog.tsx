import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addMonths, differenceInDays } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  baseNombre: string;
  certificacionId: string;
  certificacionNombre: string;
  certificacionTipo: string;
  vigilarVencimiento: boolean;
  periodoInactividadMeses: number;
  avisoDias: number;
}

interface Row {
  maquinistaId: string;
  nombreCompleto: string;
  matricula: string;
  obtenida: boolean;
  fechaUltimoServicio: string | null;
  fechaVencimiento: Date | null;
  diasRestantes: number | null;
}

export function CertificacionMaquinistasDialog({
  open, onOpenChange, baseNombre, certificacionId, certificacionNombre,
  certificacionTipo, vigilarVencimiento, periodoInactividadMeses, avisoDias,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: maqs } = await supabase
        .from('maquinistas')
        .select('id, nombre, apellidos, matricula')
        .eq('base', baseNombre)
        .eq('activo', true);

      const ids = (maqs || []).map(m => m.id);
      let certsByMaq = new Map<string, { obtenida: boolean; fecha_ultimo_servicio: string | null }>();

      if (ids.length > 0) {
        // paginate to bypass 1000-row default limit
        const PAGE = 1000;
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('maquinista_certificaciones')
            .select('maquinista_id, obtenida, fecha_ultimo_servicio')
            .eq('certificacion_id', certificacionId)
            .in('maquinista_id', ids)
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error || !data || data.length === 0) break;
          for (const r of data) {
            certsByMaq.set(r.maquinista_id, {
              obtenida: !!r.obtenida,
              fecha_ultimo_servicio: r.fecha_ultimo_servicio,
            });
          }
          if (data.length < PAGE) break;
          from += PAGE;
        }
      }

      const today = new Date();
      const built: Row[] = (maqs || []).map(m => {
        const cert = certsByMaq.get(m.id);
        const obtenida = cert?.obtenida ?? false;
        let venc: Date | null = null;
        let dias: number | null = null;
        if (obtenida && vigilarVencimiento && cert?.fecha_ultimo_servicio) {
          venc = addMonths(new Date(cert.fecha_ultimo_servicio), periodoInactividadMeses);
          dias = differenceInDays(venc, today);
        }
        return {
          maquinistaId: m.id,
          nombreCompleto: `${m.apellidos}, ${m.nombre}`,
          matricula: m.matricula,
          obtenida,
          fechaUltimoServicio: cert?.fecha_ultimo_servicio ?? null,
          fechaVencimiento: venc,
          diasRestantes: dias,
        };
      });

      if (!cancelled) {
        setRows(built);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, baseNombre, certificacionId, vigilarVencimiento, periodoInactividadMeses]);

  const obtenidas = rows.filter(r => r.obtenida);
  const noObtenidas = rows.filter(r => !r.obtenida).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

  // Ordenar obtenidas: si vigilancia, por fecha venc ascendente (más próximas primero), sin fecha al final
  const obtenidasOrdenadas = vigilarVencimiento
    ? [...obtenidas].sort((a, b) => {
        if (a.fechaVencimiento && b.fechaVencimiento) return a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime();
        if (a.fechaVencimiento) return -1;
        if (b.fechaVencimiento) return 1;
        return a.nombreCompleto.localeCompare(b.nombreCompleto);
      })
    : [...obtenidas].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{certificacionTipo}</Badge>
            {certificacionNombre}
          </DialogTitle>
          <DialogDescription>
            Base: <strong>{baseNombre}</strong>
            {vigilarVencimiento ? (
              <span className="inline-flex items-center gap-1 ml-3 text-amber-600">
                <Eye className="w-3 h-3" /> Vigilancia: {periodoInactividadMeses}m · Aviso: {avisoDias}d
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 ml-3 text-muted-foreground">
                <EyeOff className="w-3 h-3" /> Sin vigilancia
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Obtenidas */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-status-ok" />
                Con la certificación obtenida ({obtenidasOrdenadas.length})
                {vigilarVencimiento && <span className="text-xs text-muted-foreground font-normal">— ordenados por vencimiento más próximo</span>}
              </h3>
              {obtenidasOrdenadas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">Ningún maquinista la tiene obtenida.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Maquinista</TableHead>
                      <TableHead className="w-28">Matrícula</TableHead>
                      {vigilarVencimiento && <TableHead className="text-center w-32">Últ. servicio</TableHead>}
                      {vigilarVencimiento && <TableHead className="text-center w-32">Vencimiento</TableHead>}
                      {vigilarVencimiento && <TableHead className="text-center w-20">Días</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {obtenidasOrdenadas.map(r => (
                      <TableRow key={r.maquinistaId}>
                        <TableCell className="font-medium">{r.nombreCompleto}</TableCell>
                        <TableCell className="font-mono text-xs">{r.matricula}</TableCell>
                        {vigilarVencimiento && (
                          <TableCell className="text-center text-sm">
                            {r.fechaUltimoServicio ? format(new Date(r.fechaUltimoServicio), 'dd/MM/yyyy') : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                        {vigilarVencimiento && (
                          <TableCell className="text-center text-sm">
                            {r.fechaVencimiento ? format(r.fechaVencimiento, 'dd/MM/yyyy') : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                        {vigilarVencimiento && (
                          <TableCell className="text-center font-medium">
                            {r.diasRestantes !== null ? (
                              <span className={
                                r.diasRestantes < 0 ? 'text-status-vencido' :
                                r.diasRestantes <= avisoDias ? 'text-status-proximo' :
                                'text-status-ok'
                              }>
                                {r.diasRestantes}
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* No obtenidas */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-status-vencido" />
                Sin la certificación ({noObtenidas.length})
              </h3>
              {noObtenidas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">Todos los maquinistas la tienen obtenida.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Maquinista</TableHead>
                      <TableHead className="w-28">Matrícula</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noObtenidas.map(r => (
                      <TableRow key={r.maquinistaId}>
                        <TableCell className="font-medium">{r.nombreCompleto}</TableCell>
                        <TableCell className="font-mono text-xs">{r.matricula}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
