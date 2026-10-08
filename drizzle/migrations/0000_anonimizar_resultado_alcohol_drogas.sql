CREATE OR REPLACE FUNCTION public.anular_resultado_alcohol_drogas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tipo IN ('alcohol','drogas') THEN
    NEW.resultado := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_anular_resultado_1603 ON public.actuaciones_1603;
CREATE TRIGGER trg_anular_resultado_1603 BEFORE INSERT OR UPDATE ON public.actuaciones_1603
FOR EACH ROW EXECUTE FUNCTION public.anular_resultado_alcohol_drogas();

DROP TRIGGER IF EXISTS trg_anular_resultado_plan_anual ON public.actuaciones_plan_anual;
CREATE TRIGGER trg_anular_resultado_plan_anual BEFORE INSERT OR UPDATE ON public.actuaciones_plan_anual
FOR EACH ROW EXECUTE FUNCTION public.anular_resultado_alcohol_drogas();

UPDATE public.actuaciones_1603 SET resultado = NULL WHERE tipo IN ('alcohol','drogas') AND resultado IS NOT NULL;
UPDATE public.actuaciones_plan_anual SET resultado = NULL WHERE tipo IN ('alcohol','drogas') AND resultado IS NOT NULL;

COMMENT ON COLUMN public.actuaciones_1603.resultado IS 'No se guarda para alcohol/drogas (protección de datos).';
COMMENT ON COLUMN public.actuaciones_plan_anual.resultado IS 'No se guarda para alcohol/drogas (protección de datos).';