// Umbrales oficiales de cumplimiento SGS
// <50% Insuficiente (rojo) · 50-65% Mejorable (naranja) · 65-80% Aceptable (amarillo) · >80% Satisfactorio (verde)

export type NivelCumplimiento = 'insuficiente' | 'mejorable' | 'aceptable' | 'satisfactorio';

export interface UmbralInfo {
  nivel: NivelCumplimiento;
  label: string;
  // Tailwind utility classes (semantic tokens)
  bgClass: string;
  textClass: string;
  badgeClass: string;
  // RGB tuple para jsPDF
  rgb: [number, number, number];
}

export const UMBRALES = {
  satisfactorio: 80, // > 80
  aceptable: 65,     // 65 — 80
  mejorable: 50,     // 50 — 65
  // < 50 insuficiente
} as const;

export function getNivelCumplimiento(pct: number): NivelCumplimiento {
  if (pct > UMBRALES.satisfactorio) return 'satisfactorio';
  if (pct >= UMBRALES.aceptable) return 'aceptable';
  if (pct >= UMBRALES.mejorable) return 'mejorable';
  return 'insuficiente';
}

export function getUmbralInfo(pct: number): UmbralInfo {
  const nivel = getNivelCumplimiento(pct);
  switch (nivel) {
    case 'satisfactorio':
      return {
        nivel, label: 'Satisfactorio',
        bgClass: 'bg-status-ok-bg', textClass: 'text-status-ok',
        badgeClass: 'bg-status-ok text-primary-foreground',
        rgb: [34, 197, 94],
      };
    case 'aceptable':
      return {
        nivel, label: 'Aceptable',
        bgClass: 'bg-cumpl-aceptable-bg', textClass: 'text-cumpl-aceptable',
        badgeClass: 'bg-cumpl-aceptable text-primary-foreground',
        rgb: [234, 179, 8],
      };
    case 'mejorable':
      return {
        nivel, label: 'Mejorable',
        bgClass: 'bg-cumpl-mejorable-bg', textClass: 'text-cumpl-mejorable',
        badgeClass: 'bg-cumpl-mejorable text-primary-foreground',
        rgb: [249, 115, 22],
      };
    case 'insuficiente':
      return {
        nivel, label: 'Insuficiente',
        bgClass: 'bg-status-vencido-bg', textClass: 'text-status-vencido',
        badgeClass: 'bg-status-vencido text-primary-foreground',
        rgb: [239, 68, 68],
      };
  }
}

// Helpers cortos para jsPDF
export function getCumplimientoRGB(pct: number): [number, number, number] {
  return getUmbralInfo(pct).rgb;
}
