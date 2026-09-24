import { useRef, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Upload, X, AlertCircle, Loader2 } from 'lucide-react';
import { useBaseFilter } from '@/hooks/useBaseFilter';
import { readDocFile } from '@/lib/docReglamentaria/readFile';
import { MODO_LABEL, norm, isValidDate, totalRegistros, type ResultadoLectura } from '@/lib/docReglamentaria/parser';

interface Preview {
  id: string;
  nombre: string;
  res: ResultadoLectura;
  fecha: string;
  base: string; // base de Gesbase elegida
}

function matchBase(origen: string, bases: string[]): string {
  const o = norm(origen);
  if (!o) return '';
  return bases.find(b => norm(b) === o) || bases.find(b => o.includes(norm(b)) || norm(b).includes(o)) || '';
}

export default function DocumentacionReglamentariaPage() {
  const { getAccessibleBases } = useBaseFilter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Preview[]>([]);
  const [reading, setReading] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true);
    const nuevos: Preview[] = [];
    for (const f of Array.from(files)) {
      const res = await readDocFile(f);
      nuevos.push({ id: crypto.randomUUID(), nombre: f.name, res, fecha: res.fechaSondeo, base: matchBase(res.baseOrigen, getAccessibleBases) });
    }
    setItems(prev => [...prev, ...nuevos]);
    setReading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const update = (id: string, patch: Partial<Preview>) => setItems(p => p.map(i => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Documentación reglamentaria</h1>
            <p className="text-sm text-muted-foreground">
              Seguimiento de distribución y lectura de documentos por base de conducción y maquinista.
            </p>
          </div>
          <div>
            <input ref={inputRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={e => onFiles(e.target.files)} />
            <Button onClick={() => inputRef.current?.click()} disabled={reading} className="gap-2">
              {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Seleccionar Excel/CSV
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-medium">Selecciona archivos para ver una vista previa</p>
              <p className="text-sm text-muted-foreground">
                Formatos admitidos: «Seguimiento docs. area…», «Seguimiento maqs. area…» y detalle individual. Nada se guarda todavía.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Vista previa: los datos no se guardan.</p>
            {items.map(it => {
              const n = totalRegistros(it.res);
              const fechaOk = isValidDate(it.fecha);
              return (
                <Card key={it.id}>
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{it.nombre}</CardTitle>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary">{it.res.modo ? MODO_LABEL[it.res.modo] : 'Formato no reconocido'}</Badge>
                        <Badge variant="outline">{n} registro(s)</Badge>
                        {it.res.errores.length > 0 && <Badge variant="destructive">{it.res.errores.length} error(es)</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setItems(p => p.filter(x => x.id !== it.id))} aria-label="Quitar">
                      <X className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3 text-sm">
                      <div>
                        <label className="text-xs text-muted-foreground">Fecha del sondeo</label>
                        <Input type="date" value={it.fecha} onChange={e => update(it.id, { fecha: e.target.value })} className={fechaOk ? '' : 'border-destructive'} />
                        {!fechaOk && <p className="text-xs text-destructive mt-1">Indica la fecha del sondeo.</p>}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Base de origen (archivo)</label>
                        <p className="h-10 flex items-center font-medium">{it.res.baseOrigen || '—'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Base de Gesbase</label>
                        <Select value={it.base} onValueChange={v => update(it.id, { base: v })}>
                          <SelectTrigger className={it.base ? '' : 'border-destructive'}><SelectValue placeholder="Elegir base…" /></SelectTrigger>
                          <SelectContent>
                            {getAccessibleBases.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {!it.base && <p className="text-xs text-destructive mt-1">Sin correspondencia: elige una base existente.</p>}
                      </div>
                    </div>

                    {it.res.errores.length > 0 && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm max-h-40 overflow-y-auto">
                        {it.res.errores.slice(0, 50).map((e, i) => (
                          <p key={i} className="flex gap-2 text-destructive"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{e}</p>
                        ))}
                        {it.res.errores.length > 50 && <p className="text-muted-foreground">…y {it.res.errores.length - 50} más</p>}
                      </div>
                    )}
                    {it.res.avisos.map((a, i) => <p key={i} className="text-sm text-muted-foreground">{a}</p>)}

                    {n > 0 && (
                      <div className="overflow-x-auto border rounded-md">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            {it.res.modo === 'agregado' && <tr><th className="p-2 text-left">Referencia</th><th className="p-2 text-left">Título</th><th className="p-2">Incl.</th><th className="p-2">Recib.</th><th className="p-2">Abiert.</th><th className="p-2">Leídos</th></tr>}
                            {it.res.modo === 'resumen_maquinista' && <tr><th className="p-2 text-left">Matrícula</th><th className="p-2 text-left">Nombre</th><th className="p-2">Asignados</th><th className="p-2">Leídos</th></tr>}
                            {it.res.modo === 'detalle_agente' && <tr><th className="p-2 text-left">Matrícula</th><th className="p-2 text-left">Nombre</th><th className="p-2 text-left">Referencia</th><th className="p-2">Estado</th></tr>}
                          </thead>
                          <tbody>
                            {it.res.agregados.slice(0, 10).map(r => <tr key={r.linea} className="border-t"><td className="p-2">{r.referencia}</td><td className="p-2">{r.titulo}</td><td className="p-2 text-center">{r.incluidos}</td><td className="p-2 text-center">{r.recibidos}</td><td className="p-2 text-center">{r.abiertos}</td><td className="p-2 text-center">{r.leidos}</td></tr>)}
                            {it.res.resumenes.slice(0, 10).map(r => <tr key={r.linea} className="border-t"><td className="p-2 font-mono">{r.matricula}</td><td className="p-2">{r.nombre}</td><td className="p-2 text-center">{r.asignados}</td><td className="p-2 text-center">{r.leidosTotal}</td></tr>)}
                            {it.res.detalle.slice(0, 10).map(r => <tr key={r.linea} className="border-t"><td className="p-2 font-mono">{r.matricula}</td><td className="p-2">{r.nombre}</td><td className="p-2">{r.referencia}</td><td className="p-2 text-center capitalize">{r.estado}</td></tr>)}
                          </tbody>
                        </table>
                        {n > 10 && <p className="p-2 text-xs text-muted-foreground">Mostrando 10 de {n}.</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
