
-- 1. Fix bases_conduccion: replace public SELECT with authenticated-only
DROP POLICY IF EXISTS "Authenticated read bases" ON public.bases_conduccion;
CREATE POLICY "Authenticated read bases" ON public.bases_conduccion
  FOR SELECT TO authenticated USING (true);

-- 2. Fix certificaciones: replace public SELECT with authenticated-only
DROP POLICY IF EXISTS "Authenticated users can view certifications" ON public.certificaciones;
CREATE POLICY "Authenticated users can view certifications" ON public.certificaciones
  FOR SELECT TO authenticated USING (true);

-- 3. Fix base_certificaciones: replace public SELECT with authenticated-only
DROP POLICY IF EXISTS "Read base_certificaciones" ON public.base_certificaciones;
CREATE POLICY "Read base_certificaciones" ON public.base_certificaciones
  FOR SELECT TO authenticated USING (true);

-- 4. Restrict SECURITY DEFINER helper functions to authenticated users only
-- has_role (both overloads)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(public.app_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role, uuid) TO authenticated;

-- can_access_base (both overloads)
REVOKE ALL ON FUNCTION public.can_access_base(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_base(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.can_access_base(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_base(text, uuid) TO authenticated;

-- can_admin_base (both overloads)
REVOKE ALL ON FUNCTION public.can_admin_base(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_admin_base(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.can_admin_base(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_admin_base(text, uuid) TO authenticated;

-- is_gestor
REVOKE ALL ON FUNCTION public.is_gestor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated;

-- gestor_can_manage_user
REVOKE ALL ON FUNCTION public.gestor_can_manage_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestor_can_manage_user(uuid, uuid) TO authenticated;
