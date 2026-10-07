CREATE OR REPLACE FUNCTION public.protect_profile_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND auth.uid() IS NOT NULL
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el estado de la cuenta' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.protect_profile_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_profile_status ON public.profiles;
CREATE TRIGGER trg_protect_profile_status BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_status();