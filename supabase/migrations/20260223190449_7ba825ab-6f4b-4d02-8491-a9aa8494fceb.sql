
-- Fix visitas-base storage policies to enforce base-level access control

-- Drop existing weak policies
DROP POLICY IF EXISTS "Access visita files" ON storage.objects;
DROP POLICY IF EXISTS "Upload visita files" ON storage.objects;
DROP POLICY IF EXISTS "Delete visita files" ON storage.objects;

-- SELECT: require auth + base access via visitas_base record
CREATE POLICY "Authenticated users read visitas from accessible bases"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'visitas-base' AND
    EXISTS (
      SELECT 1 FROM public.visitas_base v
      WHERE v.archivo_url = name
        AND public.can_access_base(auth.uid(), v.base_nombre)
    )
  );

-- INSERT: authenticated users can upload (base access validated at app level when creating visita record)
CREATE POLICY "Authenticated users upload visita files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'visitas-base');

-- DELETE: require auth + base access
CREATE POLICY "Authorized users delete visita files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'visitas-base' AND
    EXISTS (
      SELECT 1 FROM public.visitas_base v
      WHERE v.archivo_url = name
        AND public.can_access_base(auth.uid(), v.base_nombre)
    )
  );
