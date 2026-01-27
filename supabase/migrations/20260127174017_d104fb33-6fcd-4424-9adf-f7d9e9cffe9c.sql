-- Crear tabla para bases de conducción
CREATE TABLE public.bases_conduccion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  codigo TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Habilitar RLS
ALTER TABLE public.bases_conduccion ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos pueden ver bases activas"
ON public.bases_conduccion
FOR SELECT
USING (activa = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden insertar bases"
ON public.bases_conduccion
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden actualizar bases"
ON public.bases_conduccion
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden eliminar bases"
ON public.bases_conduccion
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_bases_conduccion_updated_at
BEFORE UPDATE ON public.bases_conduccion
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar bases iniciales
INSERT INTO public.bases_conduccion (nombre, codigo) VALUES
  ('Madrid-Chamartín', 'MAD'),
  ('Barcelona-Sants', 'BCN'),
  ('Sevilla-Santa Justa', 'SVQ'),
  ('Valencia-Joaquín Sorolla', 'VLC');