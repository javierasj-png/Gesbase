
-- 1) Tighten 'partes' storage policies: restrict to authenticated role and add base-scoped checks on writes
DROP POLICY IF EXISTS "Authenticated users can upload partes files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read partes files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete partes files" ON storage.objects;
DROP POLICY IF EXISTS partes_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS partes_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS partes_update_authenticated ON storage.objects;
DROP POLICY IF EXISTS partes_delete_authenticated ON storage.objects;

CREATE POLICY "partes_select_auth_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'partes'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.partes p
      WHERE p.archivo_url = storage.objects.name
        AND (p.base IS NULL OR public.can_access_base(auth.uid(), p.base))
    )
    OR NOT EXISTS (SELECT 1 FROM public.partes p WHERE p.archivo_url = storage.objects.name)
  )
);

CREATE POLICY "partes_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'partes' AND auth.uid() IS NOT NULL);

CREATE POLICY "partes_update_auth_scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'partes'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.partes p
      WHERE p.archivo_url = storage.objects.name
        AND (p.base IS NULL OR public.can_access_base(auth.uid(), p.base))
    )
  )
)
WITH CHECK (bucket_id = 'partes');

CREATE POLICY "partes_delete_auth_scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'partes'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.partes p
      WHERE p.archivo_url = storage.objects.name
        AND (p.base IS NULL OR public.can_access_base(auth.uid(), p.base))
    )
  )
);

UPDATE storage.buckets SET public = false WHERE id = 'partes';

-- 2) Revoke EXECUTE from anon/public on SECURITY DEFINER helper functions.
-- These are only meant to be called by RLS policies (table owner context) or by authenticated users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(public.app_role, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_gestor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_base(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_base(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_admin_base(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_admin_base(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gestor_can_manage_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_plan_1201(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_plan_1603(uuid, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_base(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_base(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_base(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_base(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestor_can_manage_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_plan_1201(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_plan_1603(uuid, date) TO authenticated;
