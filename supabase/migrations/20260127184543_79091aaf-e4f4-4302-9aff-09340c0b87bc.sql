-- Tabla para almacenar las certificaciones de cada maquinista
CREATE TABLE public.maquinista_certificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maquinista_id UUID NOT NULL REFERENCES public.maquinistas(id) ON DELETE CASCADE,
  certificacion_id UUID NOT NULL REFERENCES public.certificaciones(id) ON DELETE CASCADE,
  -- Configuración heredada de la base (puede personalizarse)
  obligatoria BOOLEAN NOT NULL DEFAULT false,
  vigilar_vencimiento BOOLEAN NOT NULL DEFAULT true,
  periodo_inactividad_meses INTEGER NOT NULL DEFAULT 12,
  aviso_dias INTEGER NOT NULL DEFAULT 30,
  -- Fecha del último servicio (para control de vencimiento)
  fecha_ultimo_servicio DATE,
  -- Metadatos
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  -- Evitar duplicados
  UNIQUE(maquinista_id, certificacion_id)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_maquinista_certificaciones_maquinista ON public.maquinista_certificaciones(maquinista_id);
CREATE INDEX idx_maquinista_certificaciones_certificacion ON public.maquinista_certificaciones(certificacion_id);
CREATE INDEX idx_maquinista_certificaciones_vencimiento ON public.maquinista_certificaciones(vigilar_vencimiento, fecha_ultimo_servicio) 
  WHERE vigilar_vencimiento = true;

-- Habilitar RLS
ALTER TABLE public.maquinista_certificaciones ENABLE ROW LEVEL SECURITY;

-- Políticas RLS basadas en acceso a la base del maquinista
CREATE POLICY "Admins full access maquinista_certificaciones"
  ON public.maquinista_certificaciones FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mandos can view certificaciones from their bases"
  ON public.maquinista_certificaciones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM maquinistas m 
    WHERE m.id = maquinista_certificaciones.maquinista_id 
    AND can_access_base(auth.uid(), m.base)
  ));

CREATE POLICY "Mandos can insert certificaciones in their bases"
  ON public.maquinista_certificaciones FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM maquinistas m 
    WHERE m.id = maquinista_certificaciones.maquinista_id 
    AND can_access_base(auth.uid(), m.base)
  ));

CREATE POLICY "Mandos can update certificaciones in their bases"
  ON public.maquinista_certificaciones FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM maquinistas m 
    WHERE m.id = maquinista_certificaciones.maquinista_id 
    AND can_access_base(auth.uid(), m.base)
  ));

CREATE POLICY "Mandos can delete certificaciones in their bases"
  ON public.maquinista_certificaciones FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM maquinistas m 
    WHERE m.id = maquinista_certificaciones.maquinista_id 
    AND can_access_base(auth.uid(), m.base)
  ));

-- Trigger para updated_at
CREATE TRIGGER update_maquinista_certificaciones_updated_at
  BEFORE UPDATE ON public.maquinista_certificaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();