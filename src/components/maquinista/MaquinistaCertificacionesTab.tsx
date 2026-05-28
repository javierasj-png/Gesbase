import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, Eye, EyeOff, Loader2, Train, Calendar, CheckCircle2 } from 'lucide-react';
import { useMaquinistaCertificaciones, TipoRenovacion } from '@/hooks/useMaquinistaCertificaciones';
import { format } from 'date-fns';

interface MaquinistaCertificacionesTabProps {
  maquinistaId: string;
  baseName: string;
}

export function MaquinistaCertificacionesTab({ maquinistaId, baseName }: MaquinistaCertificacionesTabProps) {
  const { certificaciones, disponibles, loading, kpis, actualizarFechaServicio, toggleObtenida } = useMaquinistaCertificaciones(maquinistaId, baseName);
  const [registrarServicioOpen, setRegistrarServicioOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<string>('');
  const [fechaServicio, setFechaServicio] = useState('');
  const [tipoRenovacion, setTipoRenovacion] = useState<TipoRenovacion>('servicio');
  const [referenciaRenovacion, setReferenciaRenovacion] = useState('');
  const [saving, setSaving] = useState(false);

  const handleRegistrarServicio = async () => {
    if (!selectedCert || !fechaServicio) return;

    setSaving(true);
    await actualizarFechaServicio(selectedCert, fechaServicio, tipoRenovacion, referenciaRenovacion);
    setSaving(false);
    setRegistrarServicioOpen(false);
    setSelectedCert('');
    setFechaServicio('');
    setTipoRenovacion('servicio');
    setReferenciaRenovacion('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Cargando certificaciones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Certificaciones</h2>
          <p className="text-sm text-muted-foreground">
            Certificaciones de vehículos y líneas (vencimiento por inactividad)
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setRegistrarServicioOpen(true)}>
          <Plus className="w-4 h-4" />
          Renovar Certificación
        </Button>
      </div>

      {/* KPIs */}
      {certificaciones.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{kpis.obtenidas}/{kpis.total}</p>
              <p className="text-xs text-muted-foreground">Obtenidas</p>
            </CardContent>
          </Card>
          <Card className="bg-status-cumplida-bg border-status-ok">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-status-ok">{kpis.vigentes}</p>
              <p className="text-xs text-muted-foreground">Vigentes</p>
            </CardContent>
          </Card>
          <Card className="bg-status-proximo-bg border-status-proximo">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-status-proximo">{kpis.proximasVencer}</p>
              <p className="text-xs text-muted-foreground">Próx. a vencer</p>
            </CardContent>
          </Card>
          <Card className="bg-status-vencido-bg border-status-vencido">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-status-vencido">{kpis.vencidas}</p>
              <p className="text-xs text-muted-foreground">Vencidas</p>
            </CardContent>
          </Card>
          {kpis.obligatoriasFaltantes > 0 && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{kpis.obligatoriasFaltantes}</p>
                <p className="text-xs text-muted-foreground">Obligat. sin obtener</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-center w-20">Obtenida</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead>Certificación</TableHead>
                <TableHead className="text-center w-20">Obligat.</TableHead>
                <TableHead className="text-center w-20">Vigilar</TableHead>
                <TableHead className="text-center w-28">Últ. Renovación</TableHead>
                <TableHead className="text-center w-28">Venc. Est.</TableHead>
                <TableHead className="text-center w-16">Días</TableHead>
                <TableHead className="text-center w-24">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificaciones.map((item) => (
                <TableRow 
                  key={item.certificacion_id} 
                  className={!item.obtenida ? 'opacity-50' : ''}
                >
                  <TableCell className="text-center">
                    <Checkbox
                      checked={item.obtenida}
                      onCheckedChange={(checked) => toggleObtenida(item.certificacion_id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{item.certificacion_tipo}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.certificacion_nombre}</TableCell>
                  <TableCell className="text-center">
                    {item.obligatoria ? (
                      <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.vigilar_vencimiento ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <Eye className="w-4 h-4 text-primary" />
                        <span className="text-[10px] text-muted-foreground">{item.periodo_inactividad_meses}m</span>
                      </div>
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {item.obtenida && item.fecha_ultimo_servicio 
                      ? (
                        <div>
                          <div>{format(new Date(item.fecha_ultimo_servicio), 'dd/MM/yyyy')}</div>
                          {item.tipo_renovacion && (
                            <Badge variant="outline" className="text-[10px] mt-0.5">
                              {item.tipo_renovacion === 'servicio' ? 'Servicio' : 'Asesoramiento'}
                            </Badge>
                          )}
                        </div>
                      )
                      : <span className="text-muted-foreground">{item.obtenida ? 'Sin reg.' : '—'}</span>}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {item.obtenida && item.fecha_vencimiento 
                      ? format(item.fecha_vencimiento, 'dd/MM/yyyy') 
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {item.obtenida && item.dias_restantes !== null 
                      ? (
                        <span className={
                          item.dias_restantes < 0 ? 'text-status-vencido' :
                          item.dias_restantes <= item.aviso_dias ? 'text-status-proximo' :
                          'text-status-ok'
                        }>
                          {item.dias_restantes >= 0 ? item.dias_restantes : Math.abs(item.dias_restantes)}
                        </span>
                      )
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge estado={item.estado} size="sm" />
                  </TableCell>
                </TableRow>
              ))}
              {certificaciones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    <Train className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No hay certificaciones configuradas para esta base
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Registrar Servicio */}
      <Dialog open={registrarServicioOpen} onOpenChange={setRegistrarServicioOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Renovar Certificación
            </DialogTitle>
            <DialogDescription>
              Renueva una certificación mediante un servicio o un asesoramiento formativo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Certificación con vigilancia</Label>
              <Select value={selectedCert} onValueChange={setSelectedCert}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una certificación" />
                </SelectTrigger>
                <SelectContent>
                  {/* Solo certificaciones obtenidas Y con vigilancia activa */}
                  {certificaciones.filter(c => c.obtenida && c.vigilar_vencimiento).length > 0 ? (
                    certificaciones.filter(c => c.obtenida && c.vigilar_vencimiento).map(cert => (
                      <SelectItem key={cert.certificacion_id} value={cert.certificacion_id}>
                        <span className="capitalize">[{cert.certificacion_tipo}]</span> {cert.certificacion_nombre}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty__" disabled>
                      No hay certificaciones con vigilancia
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo certificaciones obtenidas con vigilancia de vencimiento activa
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo de renovación</Label>
              <Select value={tipoRenovacion} onValueChange={(v) => setTipoRenovacion(v as TipoRenovacion)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="servicio">Servicio</SelectItem>
                  <SelectItem value="asesoramiento">Asesoramiento formativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha de renovación</Label>
              <Input
                type="date"
                value={fechaServicio}
                onChange={(e) => setFechaServicio(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div className="space-y-2">
              <Label>
                {tipoRenovacion === 'servicio' ? 'Tren (opcional)' : 'ID del curso (opcional)'}
              </Label>
              <Input
                type="text"
                value={referenciaRenovacion}
                onChange={(e) => setReferenciaRenovacion(e.target.value)}
                placeholder={tipoRenovacion === 'servicio' ? 'Ej: 04521' : 'Ej: CURSO-2025-014'}
              />
              <p className="text-xs text-muted-foreground">
                {tipoRenovacion === 'servicio'
                  ? 'Número del tren con el que se renueva la certificación'
                  : 'Identificador del asesoramiento formativo'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistrarServicioOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRegistrarServicio} 
              disabled={saving || !selectedCert || !fechaServicio}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
