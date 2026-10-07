ALTER TABLE public.doc_actuaciones DROP CONSTRAINT doc_actuaciones_estado_check;
UPDATE public.doc_actuaciones SET estado = CASE
 WHEN estado ~* '(mmii|mando intermedio|liberad)' THEN 'Exclusión del cómputo validada'
 WHEN estado ~* '(baja|vacacion|incidencia)' THEN 'Situación temporal - recuperación pendiente'
 WHEN no_computa THEN 'Exclusión del cómputo validada'
 ELSE 'Seguimiento ordinario' END
WHERE estado NOT IN ('Seguimiento ordinario','Situación temporal - recuperación pendiente','Exclusión del cómputo validada','Estado de la base comunicado');
ALTER TABLE public.doc_actuaciones ADD CONSTRAINT doc_actuaciones_estado_check CHECK (estado IN ('Seguimiento ordinario','Situación temporal - recuperación pendiente','Exclusión del cómputo validada','Estado de la base comunicado'));