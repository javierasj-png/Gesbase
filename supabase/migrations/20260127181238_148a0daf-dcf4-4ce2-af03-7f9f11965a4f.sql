-- Crear tabla de maquinistas
CREATE TABLE public.maquinistas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula TEXT NOT NULL UNIQUE,
  nombre_apellidos TEXT NOT NULL,
  base TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  observaciones TEXT,
  bajo_pe_1603 BOOLEAN NOT NULL DEFAULT false,
  fecha_primer_servicio DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.maquinistas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: admins pueden todo
CREATE POLICY "Admins can do everything on maquinistas"
  ON public.maquinistas
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Mandos pueden ver maquinistas de sus bases
CREATE POLICY "Mandos can view maquinistas from their bases"
  ON public.maquinistas
  FOR SELECT
  USING (public.can_access_base(auth.uid(), base));

-- Mandos pueden insertar maquinistas en sus bases
CREATE POLICY "Mandos can insert maquinistas in their bases"
  ON public.maquinistas
  FOR INSERT
  WITH CHECK (public.can_access_base(auth.uid(), base));

-- Mandos pueden actualizar maquinistas de sus bases
CREATE POLICY "Mandos can update maquinistas in their bases"
  ON public.maquinistas
  FOR UPDATE
  USING (public.can_access_base(auth.uid(), base));

-- Trigger para updated_at
CREATE TRIGGER update_maquinistas_updated_at
  BEFORE UPDATE ON public.maquinistas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_maquinistas_base ON public.maquinistas(base);
CREATE INDEX idx_maquinistas_activo ON public.maquinistas(activo);
CREATE INDEX idx_maquinistas_matricula ON public.maquinistas(matricula);