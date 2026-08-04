import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConocimientoItem {
  id: string;
  titulo: string;
  contenido: string;
  categoria: string;
  activo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreguntaItem {
  id: string;
  pregunta: string;
  respuesta_ia: string | null;
  respuesta: string | null;
  estado: string;
  created_by: string | null;
  respondida_por: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORIAS_CONOCIMIENTO = [
  'general',
  'funcionalidad nueva',
  'PE 12.01',
  'PE 16.03',
  'Plan anual',
  'Planes específicos',
  'Certificaciones',
  'Auditoría',
  'Partes',
  'Administración',
];

export function useChatbotConocimiento() {
  const [articulos, setArticulos] = useState<ConocimientoItem[]>([]);
  const [preguntas, setPreguntas] = useState<PreguntaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: arts }, { data: pregs }] = await Promise.all([
      supabase
        .from('chatbot_conocimiento' as any)
        .select('*')
        .order('updated_at', { ascending: false }),
      supabase
        .from('chatbot_preguntas' as any)
        .select('*')
        .order('created_at', { ascending: false }),
    ]);
    setArticulos((arts as any) || []);
    setPreguntas((pregs as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const guardarArticulo = useCallback(
    async (values: { id?: string; titulo: string; contenido: string; categoria: string; activo: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (values.id) {
        const { error } = await supabase
          .from('chatbot_conocimiento' as any)
          .update({
            titulo: values.titulo,
            contenido: values.contenido,
            categoria: values.categoria,
            activo: values.activo,
            updated_by: user?.id ?? null,
          } as any)
          .eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('chatbot_conocimiento' as any).insert({
          titulo: values.titulo,
          contenido: values.contenido,
          categoria: values.categoria,
          activo: values.activo,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        } as any);
        if (error) throw error;
      }
      await fetchAll();
    },
    [fetchAll],
  );

  const borrarArticulo = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('chatbot_conocimiento' as any).delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll],
  );

  const responderPregunta = useCallback(
    async (id: string, respuesta: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('chatbot_preguntas' as any)
        .update({ respuesta, estado: 'respondida', respondida_por: user?.id ?? null } as any)
        .eq('id', id);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll],
  );

  const descartarPregunta = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('chatbot_preguntas' as any)
        .update({ estado: 'descartada' } as any)
        .eq('id', id);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll],
  );

  const borrarPregunta = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('chatbot_preguntas' as any).delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll],
  );

  return {
    articulos,
    preguntas,
    loading,
    refetch: fetchAll,
    guardarArticulo,
    borrarArticulo,
    responderPregunta,
    descartarPregunta,
    borrarPregunta,
  };
}

/** Registra una pregunta que el asistente no supo responder. */
export async function registrarPreguntaSinRespuesta(pregunta: string, respuestaIa: string) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('chatbot_preguntas' as any).insert({
    pregunta: pregunta.slice(0, 2000),
    respuesta_ia: respuestaIa.slice(0, 4000),
    created_by: user?.id ?? null,
  } as any);
}
