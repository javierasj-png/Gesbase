import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export type PlanAnualFiltro = 'cumplen' | 'pendientes' | 'todos';

interface MaquinistaRow {
  matricula: string;
  nombre: string;
  apellidos: string;
  base: string;
  redes: string[];
  acompRequeridos: number;
  // Por red
  kmPorRed: Record<string, number>;
  acompPorRed: Record<string, number>;
  // Alcohol
  alcoholCount: number;
  cumple: boolean;
}

interface ExportArgs {
  baseFilter?: string;
  isAdmin: boolean;
  assignedBases: string[];
  filtro: PlanAnualFiltro;
}

export async function exportPlanAnualMatriz({ baseFilter, isAdmin, assignedBases, filtro }: ExportArgs) {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  // 1. Maquinistas filtrados
  const { data: maquinistas } = await supabase
    .from('maquinistas')
    .select('id, matricula, nombre, apellidos, activo, base');

  const maqsFiltrados = (maquinistas || []).filter((m: any) => {
    if (!m.activo) return false;
    if (baseFilter && baseFilter !== 'all' && m.base !== baseFilter) return false;
    if (!isAdmin && !assignedBases.includes(m.base)) return false;
    return true;
  });

  if (maqsFiltrados.length === 0) {
    return downloadCsv([], filtro);
  }

  const maqIds = maqsFiltrados.map((m: any) => m.id);
  const basesUnicas = [...new Set(maqsFiltrados.map((m: any) => m.base))];

  // 2. Config redes por base
  const { data: basesConduccion } = await supabase
    .from('bases_conduccion')
    .select('nombre, redes')
    .in('nombre', basesUnicas);

  const baseRedesMap = new Map<string, string[]>();
  for (const b of basesConduccion || []) {
    const r = b.redes === 'ambas' ? ['convencional', 'av'] : b.redes === 'av' ? ['av'] : ['convencional'];
    baseRedesMap.set(b.nombre, r);
  }

  // 3. Actuaciones plan anual
  const { data: allPlanAnual } = await supabase
    .from('actuaciones_plan_anual')
    .select('maquinista_id, tipo, red, km_recorridos')
    .in('maquinista_id', maqIds)
    .eq('anio', currentYear);

  // 4. Actuaciones PE 16.03 del año
  const { data: allExp1603 } = await supabase
    .from('expedientes_1603')
    .select('id, maquinista_id')
    .in('maquinista_id', maqIds);

  let acts1603: { expediente_id: string; tipo: string; km_recorridos: number | null }[] = [];
  if (allExp1603 && allExp1603.length > 0) {
    const expIds = allExp1603.map((e: any) => e.id);
    const { data: a } = await supabase
      .from('actuaciones_1603')
      .select('expediente_id, tipo, km_recorridos')
      .in('expediente_id', expIds)
      .gte('fecha_real', yearStart)
      .lte('fecha_real', yearEnd);
    acts1603 = a || [];
  }
  const expToMaq = new Map<string, string>();
  (allExp1603 || []).forEach((e: any) => expToMaq.set(e.id, e.maquinista_id));

  // 5. PE 12.01 en últimos 3 años -> determina nº acompañamientos requeridos
  const threeYearsAgo = `${currentYear - 3}-01-01`;
  const { data: recientes1201 } = await supabase
    .from('expedientes_1201')
    .select('maquinista_id')
    .in('maquinista_id', maqIds)
    .gte('fecha_primer_servicio', threeYearsAgo);
  const maqsCon1201 = new Set((recientes1201 || []).map((e: any) => e.maquinista_id));

  // 6. Evaluar por maquinista
  const rows: MaquinistaRow[] = [];
  for (const maq of maqsFiltrados) {
    const redes = baseRedesMap.get(maq.base) || ['convencional'];
    const acompReq = maqsCon1201.has(maq.id) ? 2 : 1;

    const planActs = (allPlanAnual || [])
      .filter((a: any) => a.maquinista_id === maq.id)
      .map((a: any) => ({ tipo: a.tipo, red: a.red, km: a.km_recorridos ? Number(a.km_recorridos) : 0, src: 'plan' as const }));
    const pe1603Acts = acts1603
      .filter((a) => expToMaq.get(a.expediente_id) === maq.id)
      .map((a) => ({ tipo: a.tipo, red: null as string | null, km: a.km_recorridos ? Number(a.km_recorridos) : 0, src: 'pe1603' as const }));
    const allActs = [...planActs, ...pe1603Acts];

    const kmPorRed: Record<string, number> = {};
    const acompPorRed: Record<string, number> = {};
    let cumple = true;
    for (const red of redes) {
      const regs = allActs.filter((a) => a.tipo === 'registro' && (a.red === red || (a.src === 'pe1603' && a.red === null)));
      const km = regs.reduce((s, a) => s + a.km, 0);
      kmPorRed[red] = km;
      if (km < 100) cumple = false;

      const acomps = allActs.filter((a) => a.tipo === 'acompanamiento' && (a.red === red || (a.src === 'pe1603' && a.red === null)));
      acompPorRed[red] = acomps.length;
      if (acomps.length < acompReq) cumple = false;
    }
    const alcoholCount = allActs.filter((a) => a.tipo === 'alcohol').length;
    if (alcoholCount < 1) cumple = false;

    rows.push({
      matricula: maq.matricula || '',
      nombre: maq.nombre || '',
      apellidos: maq.apellidos || '',
      base: maq.base,
      redes,
      acompRequeridos: acompReq,
      kmPorRed,
      acompPorRed,
      alcoholCount,
      cumple,
    });
  }

  // 7. Filtrar por modo
  const filtered = rows.filter((r) => {
    if (filtro === 'cumplen') return r.cumple;
    if (filtro === 'pendientes') return !r.cumple;
    return true;
  });

  // Ordenar por base y apellidos
  filtered.sort((a, b) => a.base.localeCompare(b.base) || a.apellidos.localeCompare(b.apellidos));

  downloadCsv(filtered, filtro);
}

function escapeCsv(value: string | number): string {
  const s = String(value ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const REDES_POSIBLES = ['convencional', 'av'];

function downloadCsv(rows: MaquinistaRow[], filtro: PlanAnualFiltro) {
  const headers = [
    'Matrícula',
    'Nombre',
    'Apellidos',
    'Base',
    'Acomp. requeridos',
    ...REDES_POSIBLES.flatMap((r) => [
      `KM Registros ${r === 'av' ? 'AV' : 'Convencional'}`,
      `KM ≥100 ${r === 'av' ? 'AV' : 'Convencional'}`,
      `Acompañamientos ${r === 'av' ? 'AV' : 'Convencional'}`,
      `Acomp. OK ${r === 'av' ? 'AV' : 'Convencional'}`,
    ]),
    'Alcohol (≥1)',
    'Alcohol OK',
    'CUMPLE',
  ];

  const body = rows.map((r) => {
    const cells: (string | number)[] = [
      r.matricula,
      r.nombre,
      r.apellidos,
      r.base,
      r.acompRequeridos,
    ];
    for (const red of REDES_POSIBLES) {
      if (r.redes.includes(red)) {
        const km = r.kmPorRed[red] ?? 0;
        const ac = r.acompPorRed[red] ?? 0;
        cells.push(km, km >= 100 ? 'Sí' : 'No', ac, ac >= r.acompRequeridos ? 'Sí' : 'No');
      } else {
        cells.push('N/A', 'N/A', 'N/A', 'N/A');
      }
    }
    cells.push(r.alcoholCount, r.alcoholCount >= 1 ? 'Sí' : 'No', r.cumple ? 'Sí' : 'No');
    return cells.map(escapeCsv).join(';');
  });

  const csv = '\uFEFF' + [headers.join(';'), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `plan_anual_${filtro}_${format(new Date(), 'yyyyMMdd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
