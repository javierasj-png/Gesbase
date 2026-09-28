import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MODO_LABEL, isValidDate } from '@/lib/docReglamentaria/parser';

interface Sondeo { id: string; fecha_sondeo: string; base_nombre: string; modo: string; nombre_archivo: string | null; created_at: string }

export function SondeosGuardados({ recarga, onChange }: { recarga: number; onChange: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Sondeo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);
  const [borrar, setBorrar] = useState<Sondeo | null>(null);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('doc_sondeos')
      .select('id, fecha_sondeo, base_nombre, modo, nombre_archivo, created_at')
      .order('fecha_sondeo', { ascending: false }).order('base_nombre');
    if (error) toast({ title: 'No se pudieron cargar los sondeos', description: error.message, variant: 'destructive' });
    setRows((data as Sondeo[]) || []);
    setLoading(false);
  };
  useEffect(() => { cargar(); }, [recarga]);

  const guardarFecha = async (s: Sondeo) => {
    if (!isValidDate(fecha)) return;
    setBusy(true);
    const { data, error } = await supabase.from('doc_sondeos').update({ fecha_sondeo: fecha }).eq('id', s.id).select('id');
    setBusy(false);
    if (error) {
      const dup = error.code === '23505';
      toast({ title: 'No se pudo cambiar la fecha', description: dup ? 'Ya existe un sondeo de esa base y formato en esa fecha.' : error.message, variant: 'destructive' });
      return;
    }
    if (!data?.length) { toast({ title: 'Sin permiso para modificar este sondeo', variant: 'destructive' }); return; }
    toast({ title: 'Fecha actualizada' });
    setEditId(null); cargar(); onChange();
  };

  const confirmarBorrado = async () => {
    if (!borrar) return;
    setBusy(true);
    const { data, error } = await supabase.from('doc_sondeos').delete().eq('id', borrar.id).select('id');
    setBusy(false);
    setBorrar(null);
    if (error) { toast({ title: 'No se pudo borrar', description: error.message, variant: 'destructive' }); return; }
    if (!data?.length) { toast({ title: 'Solo un gestor de la base o un administrador puede borrar sondeos', variant: 'destructive' }); return; }
    toast({ title: 'Sondeo borrado' });
    cargar(); onChange();
  };

  const fmt = (d: string) => d.split('-').reverse().join('/');

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Archivos guardados</CardTitle></CardHeader>
      <CardContent>
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay sondeos guardados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-2">Fecha sondeo</th><th className="pr-2">Base</th><th className="pr-2">Formato</th><th className="pr-2">Archivo</th><th className="text-right">Acciones</th>
              </tr></thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {editId === s.id ? (
                        <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-8 w-40" />
                      ) : fmt(s.fecha_sondeo)}
                    </td>
                    <td className="pr-2">{s.base_nombre}</td>
                    <td className="pr-2"><Badge variant="secondary">{MODO_LABEL[s.modo as keyof typeof MODO_LABEL] ?? s.modo}</Badge></td>
                    <td className="pr-2 max-w-[260px] truncate" title={s.nombre_archivo || ''}>{s.nombre_archivo || '—'}</td>
                    <td className="text-right whitespace-nowrap">
                      {editId === s.id ? (<>
                        <Button size="icon" variant="ghost" disabled={busy || !isValidDate(fecha)} onClick={() => guardarFecha(s)} aria-label="Guardar fecha"><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditId(null)} aria-label="Cancelar"><X className="w-4 h-4" /></Button>
                      </>) : (<>
                        <Button size="icon" variant="ghost" onClick={() => { setEditId(s.id); setFecha(s.fecha_sondeo); }} aria-label="Editar fecha"><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setBorrar(s)} aria-label="Borrar"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <AlertDialog open={!!borrar} onOpenChange={o => !o && setBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este sondeo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará el sondeo del {borrar && fmt(borrar.fecha_sondeo)} de {borrar?.base_nombre} con todos sus registros. Las actuaciones y justificaciones registradas no se borran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarBorrado} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
