import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertOctagon, Loader2, Mail, Trash2, Lock, CheckCircle2, XCircle, Clock, CalendarRange } from 'lucide-react';
import { useSeguimientosEspeciales, type AccionSeguimiento } from '@/hooks/useSeguimientosEspeciales';
import { SeguimientoEspecialModal } from './SeguimientoEspecialModal';
import { DisenarPlanSeguimientoDialog } from './DisenarPlanSeguimientoDialog';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Props {
  maquinistaId: string;
  maquinistaNombre: string;
  maquinistaEmail?: string | null;
}

function estadoCalc(a: AccionSeguimiento, hoy: Date): { label: string; icon: any; cls: string } {
  if (a.estado === 'cumplida') return { label: 'Cumplida', icon: CheckCircle2, cls: 'text-status-cumplida bg-status-cumplida-bg' };
  const f = parseISO(a.fecha_objetivo);
  const dias = differenceInDays(f, hoy);
  if (a.estado === 'vencida' || dias < 0) return { label: `Vencida ${Math.abs(dias)}d`, icon: XCircle, cls: 'text-status-vencido bg-status-vencido-bg' };
  return { label: `En ${dias}d`, icon: Clock, cls: 'text-status-proximo bg-status-proximo-bg' };
}

export function MaquinistaSeguimientoEspecialTab({ maquinistaId, maquinistaNombre, maquinistaEmail }: Props) {
  const { toast } = useToast();
  const { seguimientos, acciones, loading, crear, disenarPlan, cerrar, eliminar, registrarAccion, marcarVencida } = useSeguimientosEspeciales(maquinistaId);
  const [open, setOpen] = useState(false);
  const [planDialog, setPlanDialog] = useState<{ id: string; fecha_inicio: string; hasPending: boolean } | null>(null);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-primary" />
            Seguimiento Especial
          </h2>
          <p className="text-sm text-muted-foreground">
            Gestión de anomalías PREVER, comunicación al maquinista y plan de refuerzo opcional.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Nuevo seguimiento
        </Button>
      </div>

      {seguimientos.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Sin seguimientos especiales. Crea uno cuando detectes una anomalía relevante.
        </CardContent></Card>
      )}

      {seguimientos.map(s => {
        const lista = acciones[s.id] || [];
        const total = lista.length;
        const cumplidas = lista.filter(a => a.estado === 'cumplida').length;
        const vencidas = lista.filter(a => a.estado === 'vencida' || (a.estado === 'pendiente' && parseISO(a.fecha_objetivo) < hoy)).length;
        return (
          <Card key={s.id} className={s.estado === 'cerrado' ? 'opacity-75' : ''}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={s.estado === 'abierto' ? 'default' : 'secondary'}>
                      {s.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                    </Badge>
                    {s.indice_prever != null && <Badge variant="outline">PREVER {s.indice_prever}</Badge>}
                    <span className="text-xs text-muted-foreground">
                      Inicio {format(parseISO(s.fecha_inicio), 'dd/MM/yyyy', { locale: es })}
                      {s.fecha_fin && ` → ${format(parseISO(s.fecha_fin), 'dd/MM/yyyy', { locale: es })}`}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{s.motivo}</p>
                  {s.email_enviado_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email registrado {format(parseISO(s.email_enviado_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {s.estado === 'abierto' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setPlanDialog({ id: s.id, fecha_inicio: s.fecha_inicio, hasPending: lista.some(a => a.estado === 'pendiente') })} className="gap-1">
                        <CalendarRange className="w-3 h-3" /> {total > 0 ? 'Rediseñar plan' : 'Diseñar plan'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => cerrar(s.id)} className="gap-1">
                        <Lock className="w-3 h-3" /> Cerrar
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (confirm('Eliminar seguimiento y sus acciones?')) eliminar(s.id);
                  }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {total > 0 && (
                <>
                  <div className="flex items-center gap-3 text-xs">
                    <span>{total} acciones</span>
                    <span className="text-status-cumplida">{cumplidas} cumplidas</span>
                    <span className="text-status-vencido">{vencidas} vencidas</span>
                  </div>
                  <div className="border-t pt-3 space-y-1.5 max-h-72 overflow-y-auto">
                    {lista.map(a => {
                      const st = estadoCalc(a, hoy);
                      const Icon = st.icon;
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge variant="outline" className="text-xs">
                              {a.tipo === 'acompanamiento' ? 'Acomp.' : a.tipo === 'registro' ? 'Reg.' : 'Form.'}
                            </Badge>
                            <span>{format(parseISO(a.fecha_objetivo), 'dd/MM/yyyy', { locale: es })}</span>
                            <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${st.cls}`}>
                              <Icon className="w-3 h-3" />{st.label}
                            </span>
                            {a.comentario_vencida && <span className="text-xs text-muted-foreground truncate">— {a.comentario_vencida}</span>}
                          </div>
                          {s.estado === 'abierto' && a.estado === 'pendiente' && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => {
                                const d = prompt('Fecha real de realización (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
                                if (d) registrarAccion(a.id, d).then(() => toast({ title: 'Acción registrada' }));
                              }}>
                                Registrar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => {
                                const c = prompt('Comentario justificativo de la vencida:');
                                if (c) marcarVencida(a.id, c);
                              }}>
                                Vencida
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      <SeguimientoEspecialModal
        open={open}
        onOpenChange={setOpen}
        maquinistaId={maquinistaId}
        maquinistaNombre={maquinistaNombre}
        maquinistaEmail={maquinistaEmail}
        onCreate={crear}
      />

      {planDialog && (
        <DisenarPlanSeguimientoDialog
          open={!!planDialog}
          onOpenChange={(o) => { if (!o) setPlanDialog(null); }}
          seguimientoId={planDialog.id}
          fechaInicioDefault={planDialog.fecha_inicio}
          hasPendingActions={planDialog.hasPending}
          onDisenar={disenarPlan}
        />
      )}
    </div>
  );
}
