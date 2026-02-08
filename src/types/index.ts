// ===== TIPOS Y MODELOS DE DATOS =====

// Enums
export type TipoCertificacion = 'vehiculo' | 'linea';
export type TipoAccion = 'Paso' | 'Conducción';
export type EstadoCertificacionMaquinista = 'Vigente' | 'Próxima a vencer' | 'Vencida' | 'No aplica';
export type EstadoExpediente = 'Activo' | 'Cerrado';
export type EstadoFicha1201 = 'Abierta' | 'Cerrada';
export type TipoActuacion1603 = 'Acompañamiento' | 'Registro' | 'Alcohol' | 'Drogas';
export type EstadoBloque1603 = 'Pendiente' | 'En ventana' | 'Vencida' | 'Cumplida';
export type Bloque1201 = 'Acompañamientos' | 'Registros';
export type Etiqueta1201 = 'Día 1' | 'Día 7' | 'Día 23' | 'Día 30' | 'Día 40';
export type EstadoCelda1201 = 'No procede' | 'Pendiente' | 'Cumplida';
export type Base = 'Madrid-Chamartín' | 'Barcelona-Sants' | 'Sevilla-Santa Justa' | 'Valencia-Joaquín Sorolla';
export type AppRole = 'admin' | 'gestor' | 'mando';

// Auditoría
export interface Auditable {
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

// 1) Maquinistas
export interface Maquinista extends Auditable {
  id: string;
  matricula: string;
  nombreApellidos: string;
  base: Base;
  activo: boolean;
  observaciones?: string;
}

// 2) Catálogo de Certificaciones
export interface Certificacion {
  id: string;
  nombre: string;
  tipo: TipoCertificacion;
  descripcion?: string;
  activo: boolean;
}

// 3) Certificaciones por Base (BaseCertificacion)
export interface BaseCertificacion {
  id: string;
  baseId: Base;
  certificacionId: string;
  vigilarVencimiento: boolean;
  periodoInactividadMeses: number; // default 12
  avisoDias: number; // default 90
  obligatoria: boolean; // default false
}

// 4) Certificaciones del Maquinista (MaquinistaCertificacion)
export interface MaquinistaCertificacion {
  id: string;
  maquinistaId: string;
  baseId: Base;
  certificacionId: string;
  fechaUltimoServicio: Date | null;
  vigilarVencimiento: boolean; // copiado de BaseCertificacion al asignar
  periodoInactividadMeses: number; // copiado al asignar
  avisoDias: number; // copiado al asignar
  estado: EstadoCertificacionMaquinista;
}

// 5) Vista de Certificación con datos extendidos (para UI)
export interface CertificacionMaquinistaVista extends MaquinistaCertificacion {
  certificacion: Certificacion;
  maquinista?: Maquinista;
  fechaEstimadaVencimiento: Date | null;
  diasRestantes: number | null;
  obligatoria: boolean;
}

// ===== PE 16.03 (Nuevo Acceso) =====

// 6) Expedientes 16.03
export interface Expediente1603 extends Auditable {
  id: string;
  maquinistaId: string;
  fechaPrimerServicioDependencia: Date;
  fechaInicio: Date;
  fechaFinPrevista: Date;
  estado: EstadoExpediente;
  observaciones?: string;
}

// 7) Plantilla 16.03
export interface Plantilla1603 {
  id: string;
  tipo: TipoActuacion1603;
  etiqueta: string;
  orden: number;
  offsetInicioDias: number;
  offsetFinDias: number;
}

// 8) Plan 16.03 (generado por expediente)
export interface Plan1603 {
  id: string;
  expediente1603Id: string;
  tipo: TipoActuacion1603;
  etiqueta: string;
  orden: number;
  inicioVentana: Date;
  finVentana: Date;
  estado: EstadoBloque1603;
  actuacionId?: string;
  updatedAt: Date;
  updatedBy: string;
}

// 9) Actuaciones 16.03
export interface Actuacion1603 extends Auditable {
  id: string;
  expediente1603Id: string;
  tipo: TipoActuacion1603;
  fechaReal: Date;
  resultado?: string;
  observaciones?: string;
  adjuntos?: string[];
}

// ===== PE 12.01 (Factor Humano) =====

// 10) Expedientes 12.01
export interface Expediente1201 extends Auditable {
  id: string;
  maquinistaId: string;
  idSuceso: string;
  fechaSuceso?: Date;
  fechaPrimerServicioTrasSuceso: Date;
  fechaAperturaFicha: Date;
  fechaCierreFicha?: Date;
  estado: EstadoFicha1201;
  observaciones?: string;
}

// 11) Catálogo de Hitos 12.01
export interface CatalogoHito1201 {
  id: string;
  bloque: Bloque1201;
  etiqueta: Etiqueta1201;
  orden: number;
  offsetDias: number;
}

// 12) Programación 12.01 (ad-hoc)
export interface Programacion1201 {
  id: string;
  expediente1201Id: string;
  bloque: Bloque1201;
  etiqueta: Etiqueta1201;
  fechaObjetivo: Date;
  programadoPor: string;
  programadoAt: Date;
  observacionesProgramacion?: string;
}

// 13) Actuaciones 12.01
export interface Actuacion1201 extends Auditable {
  id: string;
  expediente1201Id: string;
  bloque: Bloque1201;
  etiqueta?: Etiqueta1201;
  fechaReal: Date;
  resultado?: string;
  observaciones?: string;
  adjuntos?: string[];
}

// ===== Vistas / DTOs =====

export interface CeldaVista1201 {
  bloque: Bloque1201;
  etiqueta: Etiqueta1201;
  fechaObjetivo: Date;
  estado: EstadoCelda1201;
  programacion?: Programacion1201;
  actuacion?: Actuacion1201;
}

export interface KPIs {
  totalMaquinistas: number;
  maquinistasActivos: number;
  certVencido: number;
  certProximo: number;
  certSinEvidencia: number;
  exp1603Activos: number;
  exp1603Vencidas: number;
  exp1603EnVentana: number;
  exp1201Abiertas: number;
  exp1201Pendientes: number;
}

// Usuario con perfil y roles
export interface UserProfile {
  id: string;
  email: string;
  nombre?: string;
  apellidos?: string;
}

export interface UserWithAccess {
  profile: UserProfile;
  roles: AppRole[];
  assignedBases: Base[];
  isAdmin: boolean;
  isGestor: boolean;
  status: 'pending' | 'active';
}
