import { describe, it, expect } from 'vitest';
import { readDocFile } from '@/lib/docReglamentaria/readFile';

const csv = 'Referencia,Título,Subcarpeta,F. Entrada Vigor,Incluidos,Recibidos,Abiertos,Leidos\nD-1,Circulación ñ,AVISOS,,1,0,0,2\n';
const fileOf = (bytes: Uint8Array) => {
  const f = new File([bytes as BlobPart], 'Seguimiento docs. area Irún.csv');
  if (!f.arrayBuffer) (f as any).arrayBuffer = async () => bytes.buffer;
  return f;
};

describe('readDocFile CSV', () => {
  it('conserva tildes en CSV UTF-8', async () => {
    const r = await readDocFile(fileOf(new TextEncoder().encode(csv)));
    expect(r.agregados[0].titulo).toBe('Circulación ñ');
  });
  it('acepta CSV en Windows-1252', async () => {
    const bytes = Uint8Array.from([...csv].map(c => c.charCodeAt(0)));
    const r = await readDocFile(fileOf(bytes));
    expect(r.agregados[0].titulo).toBe('Circulación ñ');
  });
});
