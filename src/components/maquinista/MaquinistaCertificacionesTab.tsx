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
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, Eye, EyeOff, Loader2, Train, Calendar, CheckCircle2 } from 'lucide-react';
import { useMaquinistaCertificaciones, CertificacionConEstado } from '@/hooks/useMaquinistaCertificaciones';
import { format } from 'date-fns';

interface MaquinistaCertificacionesTabProps {
  maquinistaId: string;
  baseName: string;
}

export function MaquinistaCertificacionesTab({ maquinistaId, baseName }: MaquinistaCertificacionesTabProps) {
  const { certificaciones, disponibles, loading, kpis, actualizarFechaServicio, asignarCertificacion, toggleObtenida } = useMaquinistaCertificaciones(maquinistaId, baseName);
  const [registrarServicioOpen, setRegistrarServicioOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<string>('');
  const [fechaServicio, setFechaServicio] = useState('');
  const [saving, setSaving] = useState(false);

  const handleRegistrarServicio = async () => {
    if (!selectedCert || !fechaServicio) return;

    setSaving(true);
    
    // Check if certification is already assigned
    const yaAsignada = certificaciones.find(c => c.certificacion_id === selectedCert);
    
    if (yaAsignada) {
      await actualizarFechaServicio(selectedCert, fechaServicio);
    } else {
      // Get config from disponibles
      const disp = disponibles.find(d => d.id === selectedCert);
      if (disp) {
        await asignarCertificacion(selectedCert, {
          obligatoria: disp.obligatoria,
          vigilar_vencimiento: disp.vigilar_vencimiento,
          periodo_inactividad_meses: disp.periodo_inactividad_meses,
          aviso_dias: disp.aviso_dias,
          fecha_ultimo_servicio: fechaServicio,
        });
      }
    }
    
    setSaving(false);
    setRegistrarServicioOpen(false);
    setSelectedCert('');
    setFechaServicio('');
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
        <Button onClick={() => setRegistrarServicioOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Servicio
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
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-center p-4 font-medium text-sm w-20">Obtenida</th>
                <th className="text-left p-4 font-medium text-sm">Tipo</th>
                <th className="text-left p-4 font-medium text-sm">Certificación</th>
                <th className="text-center p-4 font-medium text-sm">Vigilar</th>
                <th className="text-left p-4 font-medium text-sm">Último Servicio</th>
                <th className="text-left p-4 font-medium text-sm">Vencimiento Est.</th>
                <th className="text-center p-4 font-medium text-sm">Días</th>
                <th className="text-left p-4 font-medium text-sm">Estado</th>
              </tr>
            </thead>
            <tbody>
              {certificaciones.map((item) => (
                <tr key={item.certificacion_id} className={`border-b last:border-b-0 hover:bg-muted/30 ${!item.obtenida ? 'opacity-60' : ''}`}>
                  <td className="p-4 text-center">
                    <Checkbox
                      checked={item.obtenida}
                      onCheckedChange={(checked) => toggleObtenida(item.certificacion_id, !!checked)}
                      className="mx-auto"
                    />
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="capitalize">{item.certificacion_tipo}</Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-sm">{item.certificacion_nombre}</p>
                        {item.obligatoria && (
                          <span className="text-[10px] text-primary">Obligatoria</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {item.obtenida && item.vigilar_vencimiento ? (
                      <div className="flex flex-col items-center text-xs">
                        <Eye className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">{item.periodo_inactividad_meses}m</span>
                      </div>
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground mx-auto" />
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {item.obtenida && item.fecha_ultimo_servicio 
                      ? format(new Date(item.fecha_ultimo_servicio), 'dd/MM/yyyy') 
                      : <span className="text-muted-foreground">{item.obtenida ? 'Sin registro' : '-'}</span>}
                  </td>
                  <td className="p-4 text-sm">
                    {item.obtenida && item.fecha_vencimiento 
                      ? format(item.fecha_vencimiento, 'dd/MM/yyyy') 
                      : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="p-4 text-sm font-medium text-center">
                    {item.obtenida && item.dias_restantes !== null 
                      ? (
                        <span className={
                          item.dias_restantes < 0 ? 'text-status-vencido' :
                          item.dias_restantes <= item.aviso_dias ? 'text-status-proximo' :
                          'text-status-ok'
                        }>
                          {item.dias_restantes >= 0 ? item.dias_restantes : `${Math.abs(item.dias_restantes)}`}
                        </span>
                      )
                      : '-'}
                  </td>
                  <td className="p-4">
                    <StatusBadge estado={item.estado} size="sm" />
                  </td>
                </tr>
              ))}
              {certificaciones.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <Train className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No hay certificaciones configuradas para esta base
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal Registrar Servicio */}
      <Dialog open={registrarServicioOpen} onOpenChange={setRegistrarServicioOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Registrar Servicio
            </DialogTitle>
            <DialogDescription>
              Registra la fecha del último servicio para actualizar el estado de la certificación
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Certificación</Label>
              <Select value={selectedCert} onValueChange={setSelectedCert}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una certificación" />
                </SelectTrigger>
                <SelectContent>
                  {/* Mostrar primero las ya asignadas, luego las disponibles */}
                  {certificaciones.length > 0 && (
                    <>
                      <SelectItem value="__header_asignadas__" disabled>
                        — Asignadas —
                      </SelectItem>
                      {certificaciones.map(cert => (
                        <SelectItem key={cert.certificacion_id} value={cert.certificacion_id}>
                          <span className="capitalize">[{cert.certificacion_tipo}]</span> {cert.certificacion_nombre}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {disponibles.filter(d => !d.asignada).length > 0 && (
                    <>
                      <SelectItem value="__header_nuevas__" disabled>
                        — Nuevas —
                      </SelectItem>
                      {disponibles.filter(d => !d.asignada).map(cert => (
                        <SelectItem key={cert.id} value={cert.id}>
                          <span className="capitalize">[{cert.tipo}]</span> {cert.nombre}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha del servicio</Label>
              <Input
                type="date"
                value={fechaServicio}
                onChange={(e) => setFechaServicio(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
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
