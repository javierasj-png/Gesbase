import * as XLSX from 'xlsx';
import { parseMatrix, type ResultadoLectura } from './parser';

/** Lee Excel/CSV como texto (las matrículas no se convierten en números) y lo interpreta. */
export async function readDocFile(file: File): Promise<ResultadoLectura> {
  const buf = await file.arrayBuffer();
  let matrix: unknown[][];
  try {
    const wb = XLSX.read(buf, { type: 'array', raw: true, cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false });
  } catch {
    return {
      modo: null, fechaSondeo: '', baseOrigen: '', agregados: [], resumenes: [], detalle: [],
      errores: ['No se puede leer el archivo: formato inválido.'], avisos: [],
    };
  }
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return parseMatrix(matrix, { name: path });
}
