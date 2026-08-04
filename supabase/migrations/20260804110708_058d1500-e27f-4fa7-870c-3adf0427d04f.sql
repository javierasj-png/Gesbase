CREATE TABLE public.chatbot_conocimiento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  contenido text NOT NULL,
  categoria text NOT NULL DEFAULT 'general',
  activo boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_conocimiento TO authenticated;
GRANT ALL ON public.chatbot_conocimiento TO service_role;
ALTER TABLE public.chatbot_conocimiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gestionan conocimiento"
  ON public.chatbot_conocimiento FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER trg_chatbot_conocimiento_updated
  BEFORE UPDATE ON public.chatbot_conocimiento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.chatbot_preguntas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pregunta text NOT NULL,
  respuesta_ia text,
  respuesta text,
  estado text NOT NULL DEFAULT 'pendiente',
  created_by uuid,
  respondida_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_preguntas TO authenticated;
GRANT ALL ON public.chatbot_preguntas TO service_role;
ALTER TABLE public.chatbot_preguntas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gestionan preguntas del asistente"
  ON public.chatbot_preguntas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER trg_chatbot_preguntas_updated
  BEFORE UPDATE ON public.chatbot_preguntas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_chatbot_preguntas_estado ON public.chatbot_preguntas(estado);
CREATE INDEX idx_chatbot_conocimiento_activo ON public.chatbot_conocimiento(activo);