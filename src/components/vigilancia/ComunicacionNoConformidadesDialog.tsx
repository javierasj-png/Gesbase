import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Sparkles } from 'lucide-react';

export interface NoConformidadItem {
  id?: string;
  maquinista: string;
  accion: string;
  fecha: string;
  observaciones?: string | null;
  comunicada?: boolean;
  comunicada_at?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planNombre: string;
  base: string;
  items: NoConformidadItem[];
  onComunicado?: () => void;
}


export function ComunicacionNoConformidadesDialog({
  open,
  onOpenChange,
  planNombre,
  base,
  items,
  onComunicado,
}: Props) {
  const { toast } = useToast();
  const [destinatario, setDestinatario] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [generando, setGenerando] = useState(false);
  const [registrando, setRegistrando] = useState(false);


  const detalle = items
    .map(
      (i) =>
        `- ${i.maquinista} · ${i.accion} · ${i.fecha}${i.observaciones ? ` · ${i.observaciones}` : ''}`
    )
    .join('\n');

  useEffect(() => {
    if (!open) return;
    setAsunto(`No conformidades detectadas - ${planNombre} (${base})`);
    setCuerpo(
      `Buenos días,\n\nEn el desarrollo del plan específico de vigilancia "${planNombre}" (base ${base}) se han detectado las siguientes no conformidades:\n\n${detalle}\n\nSe solicita valoración y adopción de las medidas que procedan.\n\nUn saludo.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, planNombre, base, items.length]);

  const generarIA = async () => {
    setGenerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('generar-email-anomalia', {
        body: {
          maquinista: items.map((i) => i.maquinista).join(', '),
          motivo: `No conformidades detectadas en el plan específico de vigilancia "${planNombre}" (base ${base}):\n${detalle}`,
          indice_prever: null,
          fecha_anomalia: null,
        },
      });
      if (error) throw error;
      if (data?.body) {
        setCuerpo(data.body);
        toast({ title: 'Cuerpo generado por IA' });
      } else if (data?.error) {
        toast({ title: 'IA no disponible', description: data.error, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error generando con IA', description: e?.message, variant: 'destructive' });
    } finally {
      setGenerando(false);
    }
  };

  const registrarComunicacion = async () => {
    const ids = items.map((i) => i.id).filter(Boolean) as string[];
    if (ids.length === 0) return;
    setRegistrando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('planes_vigilancia_acciones')
        .update({
          comunicada: true,
          comunicada_at: new Date().toISOString(),
          comunicada_por: userData?.user?.id ?? null,
          comunicacion_destinatario: destinatario || null,
          comunicacion_asunto: asunto || null,
        } as any)
        .in('id', ids);
      if (error) throw error;
      toast({ title: 'Comunicación registrada', description: 'Queda guardada como trazabilidad en el plan.' });
      onComunicado?.();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message });
    } finally {
      setRegistrando(false);
    }
  };

  const abrirMailto = async () => {
    const url = `mailto:${encodeURIComponent(destinatario)}?subject=${encodeURIComponent(
      asunto
    )}&body=${encodeURIComponent(cuerpo)}`;
    window.open(url, '_blank');
    await registrarComunicacion();
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comunicación de no conformidades</DialogTitle>
          <DialogDescription>
            {items.length} no conformidad{items.length === 1 ? '' : 'es'} en {planNombre}. La
            comunicación es opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Destinatario</Label>
            <Input
              type="email"
              placeholder="responsable@renfe.es"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Asunto</Label>
            <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Cuerpo</Label>
              <Button size="sm" variant="outline" onClick={generarIA} disabled={generando}>
                {generando ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1" />
                )}
                Regenerar con IA
              </Button>
            </div>
            <Textarea rows={14} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={abrirMailto} disabled={!destinatario.trim()}>
            <Mail className="w-4 h-4 mr-1" /> Abrir correo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
