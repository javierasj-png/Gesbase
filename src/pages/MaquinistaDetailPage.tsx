import { useState, useMemo, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  User, 
  Train, 
  FileCheck, 
  AlertTriangle,
  AlertOctagon,
  Loader2,
  FileDown,
  ClipboardList,
  ShieldCheck,
  RefreshCw,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useMaquinistaDetail } from '@/hooks/useMaquinistaDetail';
import { MaquinistaCertificacionesTab } from '@/components/maquinista/MaquinistaCertificacionesTab';
import { MaquinistaPE1603Tab } from '@/components/maquinista/MaquinistaPE1603Tab';
import { MaquinistaPE1201Tab } from '@/components/maquinista/MaquinistaPE1201Tab';
import { MaquinistaPlanAnualTab } from '@/components/maquinista/MaquinistaPlanAnualTab';
import { MaquinistaSeguimientoEspecialTab } from '@/components/maquinista/MaquinistaSeguimientoEspecialTab';
import { generateDossierPDF } from '@/utils/generateDossierPDF';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, addYears, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function MaquinistaDetailPage() {
  const { id } = useParams<{ id: string }>();
  usePageMeta({ title: 'Ficha del maquinista — Gestión de Base', description: 'Perfil del maquinista con certificaciones, planes SGS PE 16.03, PE 12.01 y seguimientos especiales.', path: '/maquinistas' });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'certificaciones';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [renewingLicense, setRenewingLicense] = useState(false);
  const [renewDate, setRenewDate] = useState<Date | undefined>(undefined);
  const [renewPopoverOpen, setRenewPopoverOpen] = useState(false);
  const { toast } = useToast();

  const { maquinista, expediente1603, plan1603, traslados1603, loading, error, refetch } = useMaquinistaDetail(id);

  // Hermanos en la misma base para navegar prev/next
  const [siblings, setSiblings] = useState<{ id: string }[]>([]);
  useEffect(() => {
    if (!maquinista?.base) return;
    let cancelled = false;
    (async () => {
      const all: { id: string }[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('maquinistas')
          .select('id, apellidos, nombre')
          .eq('base', maquinista.base)
          .eq('activo', true)
          .order('apellidos', { ascending: true })
          .order('nombre', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data.map(d => ({ id: d.id })));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      if (!cancelled) setSiblings(all);
    })();
    return () => { cancelled = true; };
  }, [maquinista?.base]);

  const { prevId, nextId, currentIdx, total } = useMemo(() => {
    const idx = siblings.findIndex(s => s.id === maquinista?.id);
    return {
      currentIdx: idx,
      total: siblings.length,
      prevId: idx > 0 ? siblings[idx - 1].id : null,
      nextId: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null,
    };
  }, [siblings, maquinista?.id]);

  const goToSibling = (sid: string | null) => {
    if (!sid) return;
    const tab = searchParams.get('tab');
    navigate(`/maquinistas/${sid}${tab ? `?tab=${tab}` : ''}`);
  };


  // License status
  const licenciaStatus = useMemo(() => {
    if (!maquinista?.fecha_licencia_conduccion) return null;
    const fechaObtencion = parseISO(maquinista.fecha_licencia_conduccion);
    const fechaCaducidad = addYears(fechaObtencion, 10);
    const diasRestantes = differenceInDays(fechaCaducidad, new Date());
    let estado: 'vigente' | 'proxima' | 'caducada' = 'vigente';
    if (diasRestantes < 0) estado = 'caducada';
    else if (diasRestantes <= 180) estado = 'proxima';
    return { fechaObtencion, fechaCaducidad, diasRestantes, estado };
  }, [maquinista?.fecha_licencia_conduccion]);

  const handleOpenRenew = () => {
    setRenewDate(new Date());
    setRenewPopoverOpen(true);
  };

  const handleRenovarLicencia = async () => {
    if (!maquinista || !renewDate) return;
    setRenewingLicense(true);
    try {
      const nuevaFecha = format(renewDate, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('maquinistas')
        .update({ fecha_licencia_conduccion: nuevaFecha })
        .eq('id', maquinista.id);
      if (error) throw error;
      toast({ title: 'Licencia renovada', description: `Nueva fecha de obtención: ${format(renewDate, 'dd/MM/yyyy')}. Válida hasta ${format(addYears(renewDate, 10), 'dd/MM/yyyy')}` });
      setRenewPopoverOpen(false);
      refetch();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo renovar la licencia' });
    } finally {
      setRenewingLicense(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }
  
  // Error or not found state
  if (error || !maquinista) {
    return (
      <AppLayout>
        <div className="p-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/maquinistas')} className="mb-4">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{error || 'Maquinista no encontrado'}</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/maquinistas')}>
                Volver al listado
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/maquinistas')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col gap-0.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={!prevId}
              onClick={() => goToSibling(prevId)}
              title="Maquinista anterior"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={!nextId}
              onClick={() => goToSibling(nextId)}
              title="Maquinista siguiente"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </div>
          {total > 0 && currentIdx >= 0 && (
            <span className="text-xs text-muted-foreground font-mono">
              {currentIdx + 1}/{total}
            </span>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{maquinista.nombre} {maquinista.apellidos}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">{maquinista.matricula}</span>
                  <span>•</span>
                  <span>{maquinista.base}</span>
                  <span>•</span>
                  <Badge variant={maquinista.activo ? 'default' : 'secondary'}>
                    {maquinista.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            disabled={generatingPDF}
            onClick={async () => {
              setGeneratingPDF(true);
              try {
                await generateDossierPDF(maquinista.id);
                toast({ title: 'Dosier generado', description: 'El PDF se ha descargado correctamente' });
              } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el dosier' });
              } finally {
                setGeneratingPDF(false);
              }
            }}
          >
            {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Dosier PDF
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-[820px]">
            <TabsTrigger value="certificaciones" className="flex items-center gap-2">
              <Train className="w-4 h-4" />
              Certificaciones
            </TabsTrigger>
            <TabsTrigger value="plan-anual" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Plan Anual
            </TabsTrigger>
            <TabsTrigger value="seg-especial" className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" />
              Seg. Especial
            </TabsTrigger>
            <TabsTrigger value="pe1603" className="flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              PE 16.03
            </TabsTrigger>
            <TabsTrigger value="pe1201" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              PE 12.01
            </TabsTrigger>
          </TabsList>

          {/* Tab: Certificaciones */}
          <TabsContent value="certificaciones">
            {/* Licencia de conducción */}
            <Card className="mb-4">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Licencia de Conducción</h3>
                      {licenciaStatus ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Fecha licencia: {format(licenciaStatus.fechaObtencion, 'dd/MM/yyyy')}</span>
                          <span>•</span>
                          <span>Caducidad: {format(licenciaStatus.fechaCaducidad, 'dd/MM/yyyy')}</span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin fecha de licencia registrada</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {licenciaStatus && (
                      <Badge variant={
                        licenciaStatus.estado === 'vigente' ? 'default' :
                        licenciaStatus.estado === 'proxima' ? 'secondary' : 'destructive'
                      }>
                        {licenciaStatus.estado === 'vigente' 
                          ? `Vigente (${licenciaStatus.diasRestantes} días)` 
                          : licenciaStatus.estado === 'proxima' 
                          ? `Caduca en ${licenciaStatus.diasRestantes} días`
                          : 'Caducada'}
                      </Badge>
                    )}
                    <Popover open={renewPopoverOpen} onOpenChange={setRenewPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={handleOpenRenew}
                        >
                          <RefreshCw className="w-3 h-3" />
                          Renovar
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4" align="end">
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Nueva fecha de licencia</p>
                          <Calendar
                            mode="single"
                            selected={renewDate}
                            onSelect={setRenewDate}
                            locale={es}
                            className="p-3 pointer-events-auto"
                          />
                          {renewDate && (
                            <p className="text-xs text-muted-foreground text-center">
                              Válida hasta: {format(addYears(renewDate, 10), 'dd/MM/yyyy')}
                            </p>
                          )}
                          <Button
                            className="w-full gap-1"
                            size="sm"
                            disabled={!renewDate || renewingLicense}
                            onClick={handleRenovarLicencia}
                          >
                            {renewingLicense ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Guardar
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>
            <MaquinistaCertificacionesTab 
              maquinistaId={maquinista.id} 
              baseName={maquinista.base} 
            />
          </TabsContent>

          {/* Tab: Seguimiento Especial */}
          <TabsContent value="seg-especial">
            <MaquinistaSeguimientoEspecialTab
              maquinistaId={maquinista.id}
              maquinistaNombre={`${maquinista.nombre} ${maquinista.apellidos}`}
              maquinistaEmail={(maquinista as any).email}
            />
          </TabsContent>

          {/* Tab: PE 16.03 */}
          <TabsContent value="pe1603">
            <MaquinistaPE1603Tab
              maquinista={{
                id: maquinista.id,
                nombre_apellidos: `${maquinista.nombre} ${maquinista.apellidos}`,
                matricula: maquinista.matricula,
                base: maquinista.base,
                bajo_pe_1603: !!expediente1603,
              }}
              expediente1603={expediente1603}
              plan1603={plan1603}
              traslados1603={traslados1603}
              onRefetch={refetch}
            />
          </TabsContent>

          {/* Tab: PE 12.01 */}
          <TabsContent value="pe1201">
            <MaquinistaPE1201Tab
              maquinistaId={maquinista.id}
              maquinistaNombre={`${maquinista.nombre} ${maquinista.apellidos}`}
              onRefetch={refetch}
            />
          </TabsContent>

          {/* Tab: Plan Anual */}
          <TabsContent value="plan-anual">
            <MaquinistaPlanAnualTab
              maquinistaId={maquinista.id}
              maquinistaNombre={`${maquinista.nombre} ${maquinista.apellidos}`}
              baseName={maquinista.base}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
