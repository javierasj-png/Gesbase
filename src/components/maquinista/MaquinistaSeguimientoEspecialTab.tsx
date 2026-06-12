import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, AlertOctagon, Loader2, Mail, Trash2, Lock, CheckCircle2, XCircle, Calendar, CalendarRange, Users, FileText, GraduationCap, MessageSquare, Pencil } from 'lucide-react';
import { useSeguimientosEspeciales, type AccionSeguimiento, type SeguimientoEspecial } from '@/hooks/useSeguimientosEspeciales';
import { SeguimientoEspecialModal } from './SeguimientoEspecialModal';
import { EditarSeguimientoEspecialDialog } from './EditarSeguimientoEspecialDialog';
import { DisenarPlanSeguimientoDialog } from './DisenarPlanSeguimientoDialog';
import { RegistrarAccionSeguimientoDialog } from './RegistrarAccionSeguimientoDialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Props {
  maquinistaId: string;
  maquinistaNombre: string;
  maquinistaEmail?: string | null;
}

type EstadoBloque = 'cumplida' | 'vencida' | 'en_ventana';

function getBlockState(a: AccionSeguimiento, hoy: Date): EstadoBloque {
  if (a.estado === 'cumplida') return 'cumplida';
  const f = parseISO(a.fecha_objetivo);
  if (a.estado === 'vencida' || f < hoy) return 'vencida';
  return 'en_ventana';
}

const tipoLabel: Record<string, string> = {
  acompanamiento: 'Acompañamiento',
  registro: 'Análisis de registro',
  formativa: 'Acción formativa',
};

const tipoIcon: Record<string, any> = {
  acompanamiento: Users,
  registro: FileText,
  formativa: GraduationCap,
};

export function MaquinistaSeguimientoEspecialTab({ maquinistaId, maquinistaNombre, maquinistaEmail }: Props) {
  const { toast } = useToast();
  const { seguimientos, acciones, loading, crear, actualizar, disenarPlan, cerrar, eliminar, registrarAccion, marcarVencida } = useSeguimientosEspeciales(maquinistaId);
  const [open, setOpen] = useState(false);
  const [editSeg, setEditSeg] = useState<SeguimientoEspecial | null>(null);
  const [planDialog, setPlanDialog] = useState<{ id: string; fecha_inicio: string; hasPending: boolean } | null>(null);
  const [accionRegistro, setAccionRegistro] = useState<AccionSeguimiento | null>(null);
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
                      <Button variant="outline" size="sm" onClick={() => setEditSeg(s)} className="gap-1">
                        <Pencil className="w-3 h-3" /> Editar
                      </Button>
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
                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cumplimiento del plan</span>
                    <Badge variant={cumplidas === total ? 'default' : cumplidas / total >= 0.5 ? 'secondary' : 'destructive'} className="text-sm">
                      {Math.round((cumplidas / total) * 100)}%
                    </Badge>
                  </div>
                  <Progress value={Math.round((cumplidas / total) * 100)} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {cumplidas} de {total} acciones cumplidas{vencidas > 0 && ` · ${vencidas} vencidas`}
                  </p>

                  {/* Timeline por bandas - igual que PE 16.03 / PE 12.01 */}
                  <div className="border rounded-lg overflow-hidden">
                    {(['acompanamiento', 'registro', 'formativa'] as const).map(tipo => {
                      const bloques = lista.filter(a => a.tipo === tipo);
                      if (bloques.length === 0) return null;
                      const TipoIcon = tipoIcon[tipo];
                      return (
                        <div key={tipo} className="timeline-band">
                          <div className="timeline-label">
                            <div className="flex items-center gap-1">
                              <TipoIcon className="w-3 h-3" />
                              {tipoLabel[tipo]}
                            </div>
                          </div>
                          <div className="timeline-blocks">
                            {bloques.map(a => {
                              const estado = getBlockState(a, hoy);
                              return (
                                <div
                                  key={a.id}
                                  className={`timeline-block ${
                                    estado === 'cumplida' ? 'bg-status-cumplida-bg border border-status-ok' :
                                    estado === 'vencida' ? 'bg-status-vencido-bg border border-status-vencido' :
                                    'bg-status-proximo-bg border border-status-proximo'
                                  }`}
                                >
                                  <p className="text-[10px] text-muted-foreground">
                                    {format(parseISO(a.fecha_objetivo), 'dd/MM/yy', { locale: es })}
                                  </p>
                                  {a.fecha_real && (
                                    <p className="text-[10px] font-medium">
                                      ✓ {format(parseISO(a.fecha_real), 'dd/MM/yy', { locale: es })}
                                    </p>
                                  )}
                                  {a.indice_prever != null && (
                                    <p className="text-[10px] font-medium">PREVER {a.indice_prever}</p>
                                  )}
                                  <div className="mt-1 flex items-center justify-center">
                                    {estado === 'cumplida' ? (
                                      <CheckCircle2 className="w-4 h-4 text-status-ok" />
                                    ) : estado === 'vencida' ? (
                                      <XCircle className="w-4 h-4 text-status-vencido" />
                                    ) : (
                                      <Calendar className="w-4 h-4 text-status-proximo" />
                                    )}
                                  </div>
                                  {a.comentario_vencida && estado === 'vencida' && (
                                    <p className="text-[9px] text-muted-foreground truncate max-w-full mt-1" title={a.comentario_vencida}>
                                      💬 {a.comentario_vencida}
                                    </p>
                                  )}
                                  {s.estado === 'abierto' && a.estado === 'pendiente' && (
                                    <div className="mt-2 flex flex-col items-center gap-1">
                                      <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={() => setAccionRegistro(a)}>
                                        Registrar
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] text-destructive gap-1" onClick={() => {
                                        const c = prompt('Comentario justificativo de la vencida:');
                                        if (c) marcarVencida(a.id, c);
                                      }}>
                                        <MessageSquare className="w-3 h-3" /> Vencida
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Leyenda */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-status-cumplida-bg border border-status-ok"></span>
                      Cumplida
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-status-proximo-bg border border-status-proximo"></span>
                      En ventana
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-status-vencido-bg border border-status-vencido"></span>
                      Vencida
                    </div>
                  </div>
                </div>
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

      <RegistrarAccionSeguimientoDialog
        open={!!accionRegistro}
        onOpenChange={(o) => { if (!o) setAccionRegistro(null); }}
        accion={accionRegistro}
        onSubmit={async (id, fechaReal, extras) => {
          await registrarAccion(id, fechaReal, extras);
          toast({ title: 'Acción registrada' });
        }}
      />
    </div>
  );
}
