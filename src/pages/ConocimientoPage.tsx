import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessConocimiento } from '@/lib/conocimientoAccess';
import { AppLayout } from '@/components/AppLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { BookOpen, Plus, Pencil, Trash2, Loader2, HelpCircle, Check, X, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useChatbotConocimiento,
  CATEGORIAS_CONOCIMIENTO,
  type ConocimientoItem,
} from '@/hooks/useChatbotConocimiento';
import { format, parseISO } from 'date-fns';

const emptyForm = { titulo: '', contenido: '', categoria: 'funcionalidad nueva', activo: true };

export default function ConocimientoPage() {
  usePageMeta({
    title: 'Conocimiento del asistente — Gestión de Base',
    description: 'Documenta nuevas funcionalidades para que el asistente de GesBase las aprenda y resuelve preguntas pendientes.',
    path: '/conocimiento',
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    articulos,
    preguntas,
    loading,
    guardarArticulo,
    borrarArticulo,
    responderPregunta,
    descartarPregunta,
    borrarPregunta,
  } = useChatbotConocimiento();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ConocimientoItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});

  if (!canAccessConocimiento(user?.email)) return <Navigate to="/dashboard" replace />;

  const pendientes = preguntas.filter((p) => p.estado === 'pendiente');
  const resueltas = preguntas.filter((p) => p.estado === 'respondida');

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articulos;
    return articulos.filter(
      (a) =>
        a.titulo.toLowerCase().includes(q) ||
        a.contenido.toLowerCase().includes(q) ||
        a.categoria.toLowerCase().includes(q),
    );
  }, [articulos, search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: ConocimientoItem) => {
    setEditing(a);
    setForm({ titulo: a.titulo, contenido: a.contenido, categoria: a.categoria, activo: a.activo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.contenido.trim()) {
      toast({ title: 'Faltan datos', description: 'Título y contenido son obligatorios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await guardarArticulo({ ...form, id: editing?.id });
      toast({ title: editing ? 'Conocimiento actualizado' : 'Conocimiento añadido' });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleResponder = async (id: string) => {
    const texto = (respuestas[id] || '').trim();
    if (!texto) return;
    try {
      await responderPregunta(id, texto);
      setRespuestas((prev) => ({ ...prev, [id]: '' }));
      toast({ title: 'Respuesta guardada', description: 'El asistente la usará a partir de ahora.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              Conocimiento del asistente
            </h1>
            <p className="text-sm text-muted-foreground">
              Documenta aquí las nuevas funcionalidades y cambios de GesBase. El asistente los usará en sus respuestas.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Añadir conocimiento
          </Button>
        </div>

        <Tabs defaultValue="articulos">
          <TabsList>
            <TabsTrigger value="articulos">Artículos ({articulos.length})</TabsTrigger>
            <TabsTrigger value="pendientes">Preguntas sin respuesta ({pendientes.length})</TabsTrigger>
            <TabsTrigger value="resueltas">Resueltas ({resueltas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="articulos" className="space-y-3 pt-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar en el conocimiento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtrados.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Todavía no hay conocimiento añadido. Empieza documentando la última funcionalidad.
              </p>
            ) : (
              <div className="grid gap-3">
                {filtrados.map((a) => (
                  <Card key={a.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{a.titulo}</CardTitle>
                          <CardDescription className="flex items-center gap-2 pt-1">
                            <Badge variant="outline">{a.categoria}</Badge>
                            {!a.activo && <Badge variant="secondary">Inactivo</Badge>}
                            <span className="text-xs">
                              Actualizado {format(parseISO(a.updated_at), 'dd/MM/yyyy')}
                            </span>
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              await borrarArticulo(a.id);
                              toast({ title: 'Conocimiento eliminado' });
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{a.contenido}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pendientes" className="space-y-3 pt-4">
            {pendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No hay preguntas pendientes. Cuando el asistente no sepa responder algo, aparecerá aquí.
              </p>
            ) : (
              pendientes.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      {p.pregunta}
                    </CardTitle>
                    <CardDescription>
                      {format(parseISO(p.created_at), "dd/MM/yyyy HH:mm")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea
                      rows={3}
                      placeholder="Escribe la respuesta correcta para que el asistente la aprenda..."
                      value={respuestas[p.id] || ''}
                      onChange={(e) => setRespuestas((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleResponder(p.id)} disabled={!(respuestas[p.id] || '').trim()}>
                        <Check className="w-4 h-4 mr-1" />
                        Guardar respuesta
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => descartarPregunta(p.id)}>
                        <X className="w-4 h-4 mr-1" />
                        Descartar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="resueltas" className="space-y-3 pt-4">
            {resueltas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Aún no hay preguntas resueltas.</p>
            ) : (
              resueltas.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base">{p.pregunta}</CardTitle>
                      <Button size="icon" variant="ghost" onClick={() => borrarPregunta(p.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{p.respuesta}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar conocimiento' : 'Añadir conocimiento'}</DialogTitle>
            <DialogDescription>
              Describe la funcionalidad con detalle: dónde está, para qué sirve y cómo se usa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej.: Planes específicos de vigilancia"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_CONOCIMIENTO.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contenido</Label>
              <Textarea
                rows={10}
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                placeholder="Explica la funcionalidad, la ruta de la aplicación, los permisos y los casos de uso."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
              <Label>Activo (el asistente lo usa)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
