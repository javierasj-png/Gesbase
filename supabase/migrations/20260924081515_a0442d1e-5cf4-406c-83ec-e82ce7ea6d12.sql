CREATE OR REPLACE FUNCTION public.doc_importar_sondeo(
  _fecha date, _base text, _modo text, _nombre_archivo text, _filas jsonb, _reemplazar boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  h text; prev public.doc_sondeos%ROWTYPE; prev_n int; new_id uuid; n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF _fecha IS NULL OR _base IS NULL OR _modo NOT IN ('agregado','resumen_maquinista','detalle_agente') THEN
    RAISE EXCEPTION 'Datos del sondeo incompletos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bases_conduccion WHERE nombre = _base) THEN
    RAISE EXCEPTION 'La base % no existe en Gesbase', _base;
  END IF;
  IF NOT public.can_access_base(uid, _base) THEN
    RAISE EXCEPTION 'Sin permiso sobre la base %', _base USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_filas) <> 'array' OR jsonb_array_length(_filas) = 0 THEN
    RAISE EXCEPTION 'El sondeo no contiene registros';
  END IF;

  h := encode(sha256(convert_to(_filas::text, 'UTF8')), 'hex');

  SELECT * INTO prev FROM doc_sondeos WHERE fecha_sondeo=_fecha AND base_nombre=_base AND modo=_modo FOR UPDATE;
  IF FOUND THEN
    IF prev.hash_archivo = h THEN
      RETURN jsonb_build_object('estado','ya_importado','sondeo_id',prev.id,'archivo',prev.nombre_archivo,'fecha_importacion',prev.created_at);
    END IF;
    SELECT CASE _modo
      WHEN 'agregado' THEN (SELECT count(*) FROM doc_registros_agregados WHERE sondeo_id=prev.id)
      WHEN 'resumen_maquinista' THEN (SELECT count(*) FROM doc_resumenes_maquinista WHERE sondeo_id=prev.id)
      ELSE (SELECT count(*) FROM doc_detalle_agente WHERE sondeo_id=prev.id) END INTO prev_n;
    IF NOT _reemplazar THEN
      RETURN jsonb_build_object('estado','requiere_confirmacion','sondeo_id',prev.id,'archivo',prev.nombre_archivo,
        'fecha_importacion',prev.created_at,'registros_actuales',prev_n,'registros_nuevos',jsonb_array_length(_filas));
    END IF;
    DELETE FROM doc_sondeos WHERE id = prev.id; -- cascada a sus registros; se revierte si falla lo siguiente
  END IF;

  INSERT INTO doc_sondeos(fecha_sondeo, base_nombre, modo, nombre_archivo, hash_archivo, created_by, updated_by)
  VALUES (_fecha, _base, _modo, _nombre_archivo, h, uid, uid) RETURNING id INTO new_id;

  IF _modo = 'agregado' THEN
    INSERT INTO doc_registros_agregados(sondeo_id, referencia, titulo, tipo_documento, fecha_vigor, incluidos, recibidos, abiertos, leidos)
    SELECT new_id, f->>'referencia', f->>'titulo', f->>'tipo', NULL,
      (f->>'incluidos')::int, (f->>'recibidos')::int, (f->>'abiertos')::int, (f->>'leidos')::int
    FROM jsonb_array_elements(_filas) f;
  ELSIF _modo = 'resumen_maquinista' THEN
    INSERT INTO doc_resumenes_maquinista(sondeo_id, maquinista_id, matricula, nombre, incluidos, recibidos, abiertos, leidos, asignados, leidos_total)
    SELECT new_id, (SELECT m.id FROM maquinistas m WHERE m.matricula = f->>'matricula' AND m.base = _base LIMIT 1),
      f->>'matricula', f->>'nombre', (f->>'incluidos')::int, (f->>'recibidos')::int, (f->>'abiertos')::int, (f->>'leidos')::int,
      (f->>'asignados')::int, (f->>'leidosTotal')::int
    FROM jsonb_array_elements(_filas) f;
  ELSE
    INSERT INTO doc_detalle_agente(sondeo_id, maquinista_id, matricula, nombre, referencia, titulo, tipo_documento, estado)
    SELECT new_id, (SELECT m.id FROM maquinistas m WHERE m.matricula = f->>'matricula' AND m.base = _base LIMIT 1),
      f->>'matricula', f->>'nombre', f->>'referencia', f->>'titulo', f->>'tipo', f->>'estado'
    FROM jsonb_array_elements(_filas) f;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;

  RETURN jsonb_build_object('estado', CASE WHEN prev.id IS NULL THEN 'importado' ELSE 'reemplazado' END,
    'sondeo_id', new_id, 'registros', n);
END $$;
REVOKE EXECUTE ON FUNCTION public.doc_importar_sondeo(date,text,text,text,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doc_importar_sondeo(date,text,text,text,jsonb,boolean) TO authenticated;