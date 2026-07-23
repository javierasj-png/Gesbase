import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useBaseFilter } from '@/hooks/useBaseFilter';
import { addMonths, differenceInDays, format } from 'date-fns';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

export type EstadoCert = 'vencidas' | 'proximas' | 'vigentes';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  estado: EstadoCert | null;
  baseFilter?: string;
}

interface Row {
  maquinista: string;
  matricula: string | null;
  certificacion: string;
  ultimoServicio: string | null;
  vencimiento: string | null;
  dias: number | null;
}

const TITULOS: Record<EstadoCert, { t: string; icon: any; color: string }> = {
  vencidas: { t: 'Certificaciones Vencidas', icon: AlertTriangle, color: 'text-status-vencido' },
  proximas: { t: 'Certificaciones Próximas a Vencer (3m)', icon: Clock, color: 'text-status-warning' },
  vigentes: { t: 'Certificaciones en Vigor', icon: CheckCircle, color: 'text-status-ok' },
};

export function CertificacionesEstadoDialog({ open, onOpenChange, estado, baseFilter }: Props) {
  const { getAccessibleBases, isAdmin } = useBaseFilter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !estado) return;
    (async () => {
      setLoading(true);
      try {
        const { data: maquinistas } = await supabase
          .from('maquinistas')
          .select('id, nombre, apellidos, matricula, base, activo');
        const maqsFiltrados = (maquinistas || []).filter(m => {
          if (!m.activo) return false;
          if (baseFilter && baseFilter !== 'all' && m.base !== baseFilter) return false;
          if (!isAdmin && !getAccessibleBases.includes(m.base as any)) return false;
          return true;
        });
        if (maqsFiltrados.length === 0) { setRows([]); return; }

        const maqIds = maqsFiltrados.map(m => m.id);
        const bases = [...new Set(maqsFiltrados.map(m => m.base))];

        const { data: basesData } = await supabase
          .from('bases_conduccion').select('id, nombre').in('nombre', bases);
        const baseIdMap = new Map(basesData?.map(b => [b.nombre, b.id]) || []);
        const baseIds = basesData?.map(b => b.id) || [];

        const { data: baseCerts } = await supabase
          .from('base_certificaciones')
          .select('base_id, certificacion_id, vigilar_vencimiento, periodo_inactividad_meses, aviso_dias')
          .in('base_id', baseIds);
        const baseConfigMap = new Map<string, Map<string, any>>();
        for (const bc of baseCerts || []) {
          if (!baseConfigMap.has(bc.base_id)) baseConfigMap.set(bc.base_id, new Map());
          baseConfigMap.get(bc.base_id)!.set(bc.certificacion_id, bc);
        }

        // Paginate maquinista_certificaciones
        const allMc: any[] = [];
        const PAGE = 1000;
        for (let i = 0; i < maqIds.length; i += 200) {
          const chunk = maqIds.slice(i, i + 200);
          let from = 0;
          while (true) {
            const { data } = await supabase
              .from('maquinista_certificaciones')
              .select('maquinista_id, certificacion_id, fecha_ultimo_servicio, obtenida')
              .in('maquinista_id', chunk)
              .range(from, from + PAGE - 1);
            if (!data || data.length === 0) break;
            allMc.push(...data);
            if (data.length < PAGE) break;
            from += PAGE;
          }
        }

        const { data: certs } = await supabase.from('certificaciones').select('id, nombre');
        const certNameMap = new Map(certs?.map(c => [c.id, c.nombre]) || []);
        const maqMap = new Map(maqsFiltrados.map(m => [m.id, m]));

        const result: Row[] = [];
        for (const mc of allMc) {
          if (!mc.obtenida) continue;
          const maq = maqMap.get(mc.maquinista_id);
          if (!maq) continue;
          const baseId = baseIdMap.get(maq.base);
          if (!baseId) continue;
          const config = baseConfigMap.get(baseId)?.get(mc.certificacion_id);
          if (!config?.vigilar_vencimiento) continue;

          let dias: number | null = null;
          let vencimiento: Date | null = null;
          let esta: EstadoCert;
          if (!mc.fecha_ultimo_servicio) {
            esta = 'vencidas';
          } else {
            vencimiento = addMonths(new Date(mc.fecha_ultimo_servicio), config.periodo_inactividad_meses || 12);
            dias = differenceInDays(vencimiento, new Date());
            const aviso = config.aviso_dias || 90;
            if (dias < 0) esta = 'vencidas';
            else if (dias <= aviso) esta = 'proximas';
            else esta = 'vigentes';
          }
          if (esta !== estado) continue;

          result.push({
            maquinista: `${maq.apellidos || ''}, ${maq.nombre || ''}`.replace(/^, /, ''),
            matricula: maq.matricula,
            certificacion: certNameMap.get(mc.certificacion_id) || mc.certificacion_id,
            ultimoServicio: mc.fecha_ultimo_servicio ? format(new Date(mc.fecha_ultimo_servicio), 'dd/MM/yyyy') : null,
            vencimiento: vencimiento ? format(vencimiento, 'dd/MM/yyyy') : null,
            dias,
          });
        }
        result.sort((a, b) => {
          if (a.dias === null && b.dias === null) return a.maquinista.localeCompare(b.maquinista);
          if (a.dias === null) return -1;
          if (b.dias === null) return 1;
          return a.dias - b.dias;
        });
        setRows(result);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, estado, baseFilter, isAdmin, getAccessibleBases]);

  if (!estado) return null;
  const meta = TITULOS[estado];
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${meta.color}`} />
            {meta.t} <span className="text-muted-foreground font-normal">({rows.length})</span>
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin resultados</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Maquinista</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Certificación</TableHead>
                <TableHead>Últ. servicio</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Días</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.maquinista}</TableCell>
                  <TableCell className="font-mono text-xs">{r.matricula || '—'}</TableCell>
                  <TableCell>{r.certificacion}</TableCell>
                  <TableCell>{r.ultimoServicio || '—'}</TableCell>
                  <TableCell>{r.vencimiento || '—'}</TableCell>
                  <TableCell className={`text-right font-semibold ${r.dias === null || r.dias < 0 ? 'text-status-vencido' : r.dias <= 90 ? 'text-status-warning' : 'text-status-ok'}`}>
                    {r.dias === null ? 'Sin servicio' : r.dias}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
