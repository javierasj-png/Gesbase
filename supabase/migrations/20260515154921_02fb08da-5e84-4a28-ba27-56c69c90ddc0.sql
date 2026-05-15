ALTER TABLE public.traslados_1603 
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'entrada' 
CHECK (tipo IN ('entrada','salida'));