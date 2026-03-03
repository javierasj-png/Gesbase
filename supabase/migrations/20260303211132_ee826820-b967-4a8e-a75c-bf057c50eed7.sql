-- Fix visitas-base INSERT policy: require authentication
DROP POLICY IF EXISTS "Authenticated users upload visita files" ON storage.objects;

CREATE POLICY "Authenticated users upload visita files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'visitas-base' AND auth.uid() IS NOT NULL);
