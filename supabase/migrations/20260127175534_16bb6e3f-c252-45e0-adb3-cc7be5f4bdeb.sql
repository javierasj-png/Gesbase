-- Crear tabla para almacenar las certificaciones asignadas a cada base
CREATE TABLE public.base_certificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_id UUID NOT NULL REFERENCES public.bases_conduccion(id) ON DELETE CASCADE,
  certificacion_id TEXT NOT NULL,
  certificacion_nombre TEXT NOT NULL,
  certificacion_tipo TEXT NOT NULL,
  obligatoria BOOLEAN NOT NULL DEFAULT false,
  vigilar_vencimiento BOOLEAN NOT NULL DEFAULT true,
  periodo_inactividad_meses INTEGER NOT NULL DEFAULT 12,
  aviso_dias INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(base_id, certificacion_id)
);

-- Enable RLS
ALTER TABLE public.base_certificaciones ENABLE ROW LEVEL SECURITY;

-- Policies: Solo admins pueden gestionar
CREATE POLICY "Solo admins pueden ver asignaciones"
  ON public.base_certificaciones FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'mando'::app_role));

CREATE POLICY "Solo admins pueden insertar asignaciones"
  ON public.base_certificaciones FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admins pueden actualizar asignaciones"
  ON public.base_certificaciones FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admins pueden eliminar asignaciones"
  ON public.base_certificaciones FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_base_certificaciones_updated_at
  BEFORE UPDATE ON public.base_certificaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();