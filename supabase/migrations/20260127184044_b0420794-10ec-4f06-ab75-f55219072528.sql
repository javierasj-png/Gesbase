-- Crear tabla de catálogo de certificaciones
CREATE TABLE public.certificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('vehiculo', 'linea')),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Índice único para evitar duplicados
CREATE UNIQUE INDEX idx_certificaciones_nombre ON public.certificaciones (nombre);

-- Habilitar RLS
ALTER TABLE public.certificaciones ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: todos pueden ver, solo admins pueden modificar
CREATE POLICY "Todos pueden ver certificaciones activas"
  ON public.certificaciones FOR SELECT
  USING (activo = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden insertar certificaciones"
  ON public.certificaciones FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden actualizar certificaciones"
  ON public.certificaciones FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden eliminar certificaciones"
  ON public.certificaciones FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_certificaciones_updated_at
  BEFORE UPDATE ON public.certificaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar certificaciones iniciales de ejemplo
INSERT INTO public.certificaciones (tipo, nombre, descripcion, activo) VALUES
  ('linea', 'Túnel de Guadarrama', 'Certificación para conducción en el túnel de alta velocidad Guadarrama', true),
  ('linea', 'Variante de Pajares', 'Certificación para la variante de Pajares', true),
  ('vehiculo', 'Serie 100 (AVE)', 'Certificación vehículo Serie 100', true),
  ('vehiculo', 'Serie 112 (AVE S-112)', 'Certificación vehículo Serie 112', true),
  ('vehiculo', 'Serie 103 (AVE S-103)', 'Certificación vehículo Serie 103', true);