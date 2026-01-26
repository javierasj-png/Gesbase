// Tipos para el módulo de Control de Partes

export type TipoParte = 'Incidencia' | 'Retraso' | 'Avería' | 'Seguridad' | 'Otro';
export type EstadoParte = 'Nuevo' | 'En revisión' | 'Cerrado';

export interface CampoExtraido<T = string | number | null> {
  valor: T;
  confianza: number;
}

export interface ParteExtraido {
  numeroParte: CampoExtraido<string | null>;
  fechaParte: CampoExtraido<string | null>;
  horaParte: CampoExtraido<string | null>;
  horaInicio: CampoExtraido<string | null>;
  horaFin: CampoExtraido<string | null>;
  base: CampoExtraido<string | null>;
  maquinista: CampoExtraido<string | null>;
  maquinistaId: CampoExtraido<string | null>;
  trenServicio: CampoExtraido<string | null>;
  lineaTramo: CampoExtraido<string | null>;
  tipoParte: CampoExtraido<TipoParte | null>;
  descripcionHechos: CampoExtraido<string | null>;
  minutosRetraso: CampoExtraido<number | null>;
  causa: CampoExtraido<string | null>;
  accionesTomadas: CampoExtraido<string | null>;
  firmante: CampoExtraido<string | null>;
  observaciones: CampoExtraido<string | null>;
}

export interface DudaConflicto {
  campo: string;
  motivo: string;
  necesito: string;
}

export interface RegistroListo {
  numero_parte: string | null;
  fecha_parte: string | null;
  hora_parte: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  base: string | null;
  maquinista_texto: string | null;
  maquinista_id: string | null;
  tren_servicio: string | null;
  linea_tramo: string | null;
  tipo_parte: TipoParte;
  descripcion_hechos: string | null;
  minutos_retraso: number;
  causa: string | null;
  acciones_tomadas: string | null;
  firmante: string | null;
  observaciones: string | null;
  fuente_archivo: string | null;
}

export interface ExtraccionResult {
  success: boolean;
  parteExtraido?: ParteExtraido;
  confianzaGlobal?: number;
  dudas?: DudaConflicto[];
  registroListo?: RegistroListo;
  rawResponse?: string;
  error?: string;
}

export interface Parte {
  id: string;
  numero_parte: string | null;
  fecha_parte: string | null;
  hora_parte: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  base: string | null;
  maquinista_texto: string | null;
  maquinista_id: string | null;
  tren_servicio: string | null;
  linea_tramo: string | null;
  tipo_parte: TipoParte;
  descripcion_hechos: string | null;
  minutos_retraso: number;
  causa: string | null;
  acciones_tomadas: string | null;
  firmante: string | null;
  observaciones: string | null;
  fuente_archivo: string | null;
  archivo_url: string | null;
  estado: EstadoParte;
  responsable: string | null;
  dudas_conflictos: string | null;
  confianza_global: number;
  datos_extraidos: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}
