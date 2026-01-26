-- Crear enum para tipo de parte
CREATE TYPE public.tipo_parte AS ENUM ('Incidencia', 'Retraso', 'Avería', 'Seguridad', 'Otro');

-- Crear enum para estado del parte
CREATE TYPE public.estado_parte AS ENUM ('Nuevo', 'En revisión', 'Cerrado');

-- Crear función update_updated_at_column si no existe
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear tabla de partes (sin FK a maquinistas por ahora)
CREATE TABLE public.partes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_parte TEXT,
  fecha_parte DATE,
  hora_parte TIME,
  hora_inicio TIME,
  hora_fin TIME,
  base TEXT,
  maquinista_texto TEXT,
  maquinista_id TEXT,
  tren_servicio TEXT,
  linea_tramo TEXT,
  tipo_parte tipo_parte DEFAULT 'Otro',
  descripcion_hechos TEXT,
  minutos_retraso INTEGER DEFAULT 0,
  causa TEXT,
  acciones_tomadas TEXT,
  firmante TEXT,
  observaciones TEXT,
  fuente_archivo TEXT,
  archivo_url TEXT,
  estado estado_parte DEFAULT 'Nuevo',
  responsable TEXT,
  dudas_conflictos TEXT,
  confianza_global INTEGER DEFAULT 0,
  datos_extraidos JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- Habilitar RLS
ALTER TABLE public.partes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para partes
CREATE POLICY "Permitir lectura de partes" 
ON public.partes 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserción de partes" 
ON public.partes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir actualización de partes" 
ON public.partes 
FOR UPDATE 
USING (true);

CREATE POLICY "Permitir eliminación de partes" 
ON public.partes 
FOR DELETE 
USING (true);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_partes_updated_at
BEFORE UPDATE ON public.partes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Crear bucket de storage para archivos de partes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('partes', 'partes', true);

-- Políticas de storage
CREATE POLICY "Permitir lectura pública de partes" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'partes');

CREATE POLICY "Permitir subida de partes" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'partes');

CREATE POLICY "Permitir actualización de partes storage" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'partes');

CREATE POLICY "Permitir eliminación de partes storage" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'partes');