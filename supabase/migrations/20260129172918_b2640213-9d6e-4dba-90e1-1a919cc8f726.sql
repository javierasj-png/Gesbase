-- Ampliar el rango permitido para Índice PREVER (actualmente NUMERIC(3,2) provoca error con valores como 111111)
ALTER TABLE public.actuaciones_1603
  ALTER COLUMN indice_prever TYPE numeric(10,2)
  USING indice_prever::numeric;
