/** Único usuario con acceso al módulo de Conocimiento IA. */
export const CONOCIMIENTO_OWNER_EMAIL = 'javier.alonso@renfe.es';

export function canAccessConocimiento(email?: string | null) {
  return (email || '').trim().toLowerCase() === CONOCIMIENTO_OWNER_EMAIL;
}
