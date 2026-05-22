-- 1) Make partes bucket private
UPDATE storage.buckets SET public = false WHERE id = 'partes';

-- 2) Replace public storage policies on bucket 'partes'
DROP POLICY IF EXISTS "Permitir lectura pública de partes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de partes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de partes storage" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación de partes storage" ON storage.objects;

CREATE POLICY "partes_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'partes'
  AND EXISTS (
    SELECT 1 FROM public.partes p
    WHERE p.archivo_url = storage.objects.name
      AND (p.base IS NULL OR public.can_access_base(auth.uid(), p.base))
  )
);

CREATE POLICY "partes_insert_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'partes');

CREATE POLICY "partes_update_authenticated"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'partes')
WITH CHECK (bucket_id = 'partes');

CREATE POLICY "partes_delete_authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'partes'
  AND EXISTS (
    SELECT 1 FROM public.partes p
    WHERE p.archivo_url = storage.objects.name
      AND (p.base IS NULL OR public.can_access_base(auth.uid(), p.base))
  )
);

-- 3) Tighten role from {public} to {authenticated} on sensitive tables.
--    Recreate policies preserving USING/WITH CHECK expressions.

-- partes
DROP POLICY IF EXISTS "Admins can delete partes" ON public.partes;
DROP POLICY IF EXISTS "Authenticated users can insert partes" ON public.partes;
DROP POLICY IF EXISTS "Authenticated users can read partes" ON public.partes;
DROP POLICY IF EXISTS "Authenticated users can update partes" ON public.partes;

CREATE POLICY "partes_admin_delete" ON public.partes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "partes_auth_insert" ON public.partes FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "partes_auth_select" ON public.partes FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "partes_auth_update" ON public.partes FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

-- traslados_1603 (was {public})
DROP POLICY IF EXISTS "Access traslados_1603" ON public.traslados_1603;
DROP POLICY IF EXISTS "Manage traslados_1603" ON public.traslados_1603;

CREATE POLICY "Access traslados_1603" ON public.traslados_1603 FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.expedientes_1603 e
  JOIN public.maquinistas m ON m.id = e.maquinista_id
  WHERE e.id = traslados_1603.expediente_id
    AND public.can_access_base(auth.uid(), m.base)
));

CREATE POLICY "Manage traslados_1603" ON public.traslados_1603 FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.expedientes_1603 e
  JOIN public.maquinistas m ON m.id = e.maquinista_id
  WHERE e.id = traslados_1603.expediente_id
    AND public.can_access_base(auth.uid(), m.base)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.expedientes_1603 e
  JOIN public.maquinistas m ON m.id = e.maquinista_id
  WHERE e.id = traslados_1603.expediente_id
    AND public.can_access_base(auth.uid(), m.base)
));

-- visitas_base (was {public})
DROP POLICY IF EXISTS "Access visitas by base" ON public.visitas_base;
DROP POLICY IF EXISTS "Manage visitas by base" ON public.visitas_base;

CREATE POLICY "Access visitas by base" ON public.visitas_base FOR SELECT TO authenticated
USING (public.can_access_base(auth.uid(), base_nombre));

CREATE POLICY "Manage visitas by base" ON public.visitas_base FOR ALL TO authenticated
USING (public.can_access_base(auth.uid(), base_nombre))
WITH CHECK (public.can_access_base(auth.uid(), base_nombre));

-- 4) Revoke EXECUTE on SECURITY DEFINER helper/recalc functions from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(public.app_role, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_base(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_base(text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_admin_base(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_admin_base(text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_gestor(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gestor_can_manage_user(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_plan_1201(uuid, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_plan_1603(uuid, date) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_base(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_base(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_base(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_base(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestor_can_manage_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_plan_1201(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_plan_1603(uuid, date) TO authenticated;