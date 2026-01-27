import {
  Maquinista,
  Certificacion,
  BaseCertificacion,
  MaquinistaCertificacion,
  CertificacionMaquinistaVista,
  Expediente1603,
  Plantilla1603,
  Plan1603,
  Actuacion1603,
  Expediente1201,
  CatalogoHito1201,
  Programacion1201,
  Actuacion1201,
  Usuario,
  EstadoCertificacionMaquinista,
  EstadoBloque1603,
  Base,
} from '@/types';
import { addDays, addMonths, differenceInDays, isAfter, isBefore, isWithinInterval } from 'date-fns';

// ===== USUARIOS MOCK =====
export const usuariosMock: Usuario[] = [
  { id: 'u1', nombre: 'Carlos Martínez', email: 'carlos.martinez@renfe.es', rol: 'Mando', base: 'Madrid-Chamartín' },
  { id: 'u2', nombre: 'Ana García', email: 'ana.garcia@renfe.es', rol: 'Admin' },
];

// ===== MAQUINISTAS MOCK =====
export const maquinistasMock: Maquinista[] = [
  {
    id: 'm1',
    matricula: '12345A',
    nombreApellidos: 'Juan Pérez López',
    base: 'Madrid-Chamartín',
    activo: true,
    observaciones: 'Maquinista senior con 15 años de experiencia',
    createdAt: new Date('2023-01-15'),
    createdBy: 'u2',
    updatedAt: new Date('2024-06-01'),
    updatedBy: 'u1',
  },
  {
    id: 'm2',
    matricula: '23456B',
    nombreApellidos: 'María González Ruiz',
    base: 'Madrid-Chamartín',
    activo: true,
    observaciones: 'Incorporación reciente, en vigilancia PE 16.03',
    createdAt: new Date('2024-01-10'),
    createdBy: 'u2',
    updatedAt: new Date('2024-01-10'),
    updatedBy: 'u2',
  },
  {
    id: 'm3',
    matricula: '34567C',
    nombreApellidos: 'Pedro Sánchez García',
    base: 'Barcelona-Sants',
    activo: true,
    observaciones: 'Expediente 12.01 abierto por incidencia',
    createdAt: new Date('2020-05-20'),
    createdBy: 'u2',
    updatedAt: new Date('2024-10-15'),
    updatedBy: 'u1',
  },
];

// ===== CATÁLOGO DE CERTIFICACIONES =====
export const certificacionesMock: Certificacion[] = [
  { id: 'c1', tipo: 'linea', nombre: 'Túnel de Guadarrama', descripcion: 'Certificación para conducción en el túnel de alta velocidad Guadarrama', activo: true },
  { id: 'c2', tipo: 'linea', nombre: 'Variante de Pajares', descripcion: 'Certificación para la variante de Pajares', activo: true },
  { id: 'c3', tipo: 'linea', nombre: 'LAV Madrid-Sevilla Km 100-150', descripcion: 'Tramo específico de la línea AVE Madrid-Sevilla', activo: true },
  { id: 'c4', tipo: 'vehiculo', nombre: 'Serie 100 (AVE)', descripcion: 'Certificación vehículo Serie 100', activo: true },
  { id: 'c5', tipo: 'vehiculo', nombre: 'Serie 112 (AVE S-112)', descripcion: 'Certificación vehículo Serie 112', activo: true },
  { id: 'c6', tipo: 'vehiculo', nombre: 'Serie 103 (AVE S-103)', descripcion: 'Certificación vehículo Serie 103', activo: true },
  { id: 'c7', tipo: 'linea', nombre: 'Túnel del Pertús', descripcion: 'Certificación para el túnel internacional Francia-España', activo: true },
];

// ===== CERTIFICACIONES POR BASE (BaseCertificacion) =====
export let baseCertificacionesMock: BaseCertificacion[] = [
  // Madrid-Chamartín
  { id: 'bc1', baseId: 'Madrid-Chamartín', certificacionId: 'c1', vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: true },
  { id: 'bc2', baseId: 'Madrid-Chamartín', certificacionId: 'c2', vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: false },
  { id: 'bc3', baseId: 'Madrid-Chamartín', certificacionId: 'c4', vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: true },
  { id: 'bc4', baseId: 'Madrid-Chamartín', certificacionId: 'c5', vigilarVencimiento: false, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: false },
  { id: 'bc5', baseId: 'Madrid-Chamartín', certificacionId: 'c6', vigilarVencimiento: false, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: false },
  // Barcelona-Sants
  { id: 'bc6', baseId: 'Barcelona-Sants', certificacionId: 'c1', vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: true },
  { id: 'bc7', baseId: 'Barcelona-Sants', certificacionId: 'c3', vigilarVencimiento: false, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: false },
  { id: 'bc8', baseId: 'Barcelona-Sants', certificacionId: 'c4', vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: true },
  { id: 'bc9', baseId: 'Barcelona-Sants', certificacionId: 'c7', vigilarVencimiento: true, periodoInactividadMeses: 18, avisoDias: 90, obligatoria: true },
  // Sevilla-Santa Justa
  { id: 'bc10', baseId: 'Sevilla-Santa Justa', certificacionId: 'c3', vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: true },
  { id: 'bc11', baseId: 'Sevilla-Santa Justa', certificacionId: 'c4', vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, obligatoria: false },
];

// ===== FUNCIÓN PARA ACTUALIZAR CERTIFICACIONES POR BASE =====
export function actualizarBaseCertificaciones(baseId: Base, nuevasCertificaciones: BaseCertificacion[]): void {
  // Eliminar las certificaciones existentes de esta base
  baseCertificacionesMock = baseCertificacionesMock.filter(bc => bc.baseId !== baseId);
  // Añadir las nuevas
  baseCertificacionesMock.push(...nuevasCertificaciones);
}

// ===== CERTIFICACIONES DE MAQUINISTAS =====
const hoy = new Date();
export const maquinistaCertificacionesMock: MaquinistaCertificacion[] = [
  // Juan Pérez (m1) - Madrid
  { id: 'mc1', maquinistaId: 'm1', baseId: 'Madrid-Chamartín', certificacionId: 'c1', fechaUltimoServicio: addDays(hoy, -30), vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, estado: 'Vigente' },
  { id: 'mc2', maquinistaId: 'm1', baseId: 'Madrid-Chamartín', certificacionId: 'c2', fechaUltimoServicio: addDays(hoy, -350), vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, estado: 'Próxima a vencer' },
  { id: 'mc3', maquinistaId: 'm1', baseId: 'Madrid-Chamartín', certificacionId: 'c4', fechaUltimoServicio: addDays(hoy, -380), vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, estado: 'Vencida' },
  { id: 'mc4', maquinistaId: 'm1', baseId: 'Madrid-Chamartín', certificacionId: 'c5', fechaUltimoServicio: addDays(hoy, -400), vigilarVencimiento: false, periodoInactividadMeses: 12, avisoDias: 60, estado: 'No aplica' },
  { id: 'mc5', maquinistaId: 'm1', baseId: 'Madrid-Chamartín', certificacionId: 'c6', fechaUltimoServicio: null, vigilarVencimiento: false, periodoInactividadMeses: 12, avisoDias: 60, estado: 'No aplica' },
  // María González (m2) - Madrid
  { id: 'mc6', maquinistaId: 'm2', baseId: 'Madrid-Chamartín', certificacionId: 'c1', fechaUltimoServicio: null, vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, estado: 'Vencida' },
  { id: 'mc7', maquinistaId: 'm2', baseId: 'Madrid-Chamartín', certificacionId: 'c4', fechaUltimoServicio: addDays(hoy, -60), vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, estado: 'Vigente' },
  // Pedro Sánchez (m3) - Barcelona
  { id: 'mc8', maquinistaId: 'm3', baseId: 'Barcelona-Sants', certificacionId: 'c1', fechaUltimoServicio: addDays(hoy, -60), vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, estado: 'Vigente' },
  { id: 'mc9', maquinistaId: 'm3', baseId: 'Barcelona-Sants', certificacionId: 'c4', fechaUltimoServicio: addDays(hoy, -200), vigilarVencimiento: true, periodoInactividadMeses: 12, avisoDias: 60, estado: 'Vigente' },
  { id: 'mc10', maquinistaId: 'm3', baseId: 'Barcelona-Sants', certificacionId: 'c7', fechaUltimoServicio: addDays(hoy, -500), vigilarVencimiento: true, periodoInactividadMeses: 18, avisoDias: 90, estado: 'Próxima a vencer' },
];

// ===== FUNCIÓN PARA CALCULAR ESTADO DE CERTIFICACIÓN =====
export function calcularEstadoCertificacion(
  fechaUltimoServicio: Date | null,
  vigilarVencimiento: boolean,
  periodoInactividadMeses: number,
  avisoDias: number
): { estado: EstadoCertificacionMaquinista; fechaVencimiento: Date | null; diasRestantes: number | null } {
  if (!vigilarVencimiento) {
    return { estado: 'No aplica', fechaVencimiento: null, diasRestantes: null };
  }

  if (!fechaUltimoServicio) {
    return { estado: 'Vencida', fechaVencimiento: null, diasRestantes: null };
  }

  const fechaVencimiento = addMonths(fechaUltimoServicio, periodoInactividadMeses);
  const diasRestantes = differenceInDays(fechaVencimiento, hoy);

  if (diasRestantes < 0) {
    return { estado: 'Vencida', fechaVencimiento, diasRestantes };
  }

  if (diasRestantes <= avisoDias) {
    return { estado: 'Próxima a vencer', fechaVencimiento, diasRestantes };
  }

  return { estado: 'Vigente', fechaVencimiento, diasRestantes };
}

// ===== FUNCIÓN PARA OBTENER CERTIFICACIONES DE UN MAQUINISTA =====
export function obtenerCertificacionesMaquinista(maquinistaId: string): CertificacionMaquinistaVista[] {
  const maquinista = maquinistasMock.find(m => m.id === maquinistaId);
  if (!maquinista) return [];

  return maquinistaCertificacionesMock
    .filter(mc => mc.maquinistaId === maquinistaId)
    .map(mc => {
      const certificacion = certificacionesMock.find(c => c.id === mc.certificacionId);
      const baseCert = baseCertificacionesMock.find(
        bc => bc.baseId === mc.baseId && bc.certificacionId === mc.certificacionId
      );
      
      const { estado, fechaVencimiento, diasRestantes } = calcularEstadoCertificacion(
        mc.fechaUltimoServicio,
        mc.vigilarVencimiento,
        mc.periodoInactividadMeses,
        mc.avisoDias
      );

      return {
        ...mc,
        estado,
        certificacion: certificacion!,
        maquinista,
        fechaEstimadaVencimiento: fechaVencimiento,
        diasRestantes,
        obligatoria: baseCert?.obligatoria ?? false,
      };
    })
    .filter(mc => mc.certificacion);
}

// ===== FUNCIÓN PARA OBTENER TODAS LAS CERTIFICACIONES CON ESTADO =====
export function obtenerTodasCertificaciones(): CertificacionMaquinistaVista[] {
  const todas: CertificacionMaquinistaVista[] = [];

  maquinistasMock.filter(m => m.activo).forEach(maquinista => {
    const certs = obtenerCertificacionesMaquinista(maquinista.id);
    todas.push(...certs);
  });

  return todas;
}

// ===== REGISTRAR SERVICIO (actualiza fecha último servicio) =====
export function registrarServicio(
  maquinistaCertificacionId: string,
  fechaServicio: Date
): MaquinistaCertificacion | null {
  const index = maquinistaCertificacionesMock.findIndex(mc => mc.id === maquinistaCertificacionId);
  if (index === -1) return null;

  const mc = maquinistaCertificacionesMock[index];
  const { estado } = calcularEstadoCertificacion(
    fechaServicio,
    mc.vigilarVencimiento,
    mc.periodoInactividadMeses,
    mc.avisoDias
  );

  maquinistaCertificacionesMock[index] = {
    ...mc,
    fechaUltimoServicio: fechaServicio,
    estado,
  };

  return maquinistaCertificacionesMock[index];
}

// ===== ASIGNAR CERTIFICACIÓN A MAQUINISTA (hereda de base) =====
export function asignarCertificacionAMaquinista(
  maquinistaId: string,
  certificacionId: string
): MaquinistaCertificacion | null {
  const maquinista = maquinistasMock.find(m => m.id === maquinistaId);
  if (!maquinista) return null;

  // Verificar duplicado
  const yaExiste = maquinistaCertificacionesMock.some(
    mc => mc.maquinistaId === maquinistaId && mc.certificacionId === certificacionId && mc.baseId === maquinista.base
  );
  if (yaExiste) return null;

  // Obtener configuración de la base
  const baseCert = baseCertificacionesMock.find(
    bc => bc.baseId === maquinista.base && bc.certificacionId === certificacionId
  );

  const nuevaCert: MaquinistaCertificacion = {
    id: `mc-${Date.now()}`,
    maquinistaId,
    baseId: maquinista.base,
    certificacionId,
    fechaUltimoServicio: null,
    vigilarVencimiento: baseCert?.vigilarVencimiento ?? true,
    periodoInactividadMeses: baseCert?.periodoInactividadMeses ?? 12,
    avisoDias: baseCert?.avisoDias ?? 60,
    estado: baseCert?.vigilarVencimiento !== false ? 'Vencida' : 'No aplica',
  };

  maquinistaCertificacionesMock.push(nuevaCert);
  return nuevaCert;
}

// ===== PLANTILLA 16.03 =====
export const plantilla1603Mock: Plantilla1603[] = [
  // ACOMPAÑAMIENTOS (5 bloques)
  { id: 'pl1', tipo: 'Acompañamiento', etiqueta: 'Primera Quincena', orden: 1, offsetInicioDias: 0, offsetFinDias: 15 },
  { id: 'pl2', tipo: 'Acompañamiento', etiqueta: 'Primer Trimestre', orden: 2, offsetInicioDias: 16, offsetFinDias: 90 },
  { id: 'pl3', tipo: 'Acompañamiento', etiqueta: 'Primer Semestre', orden: 3, offsetInicioDias: 91, offsetFinDias: 182 },
  { id: 'pl4', tipo: 'Acompañamiento', etiqueta: 'Segundo Semestre', orden: 4, offsetInicioDias: 183, offsetFinDias: 365 },
  { id: 'pl5', tipo: 'Acompañamiento', etiqueta: 'Tercer Semestre', orden: 5, offsetInicioDias: 366, offsetFinDias: 547 },
  
  // REGISTROS - Primer Año (4 trimestres)
  { id: 'pl6', tipo: 'Registro', etiqueta: 'Primer Trimestre', orden: 1, offsetInicioDias: 0, offsetFinDias: 90 },
  { id: 'pl7', tipo: 'Registro', etiqueta: 'Segundo Trimestre', orden: 2, offsetInicioDias: 91, offsetFinDias: 182 },
  { id: 'pl8', tipo: 'Registro', etiqueta: 'Tercer Trimestre', orden: 3, offsetInicioDias: 183, offsetFinDias: 273 },
  { id: 'pl9', tipo: 'Registro', etiqueta: 'Cuarto Trimestre', orden: 4, offsetInicioDias: 274, offsetFinDias: 365 },
  
  // REGISTROS - Segundo Año (2 semestres)
  { id: 'pl10', tipo: 'Registro', etiqueta: 'Primer Semestre (2º Año)', orden: 5, offsetInicioDias: 366, offsetFinDias: 547 },
  { id: 'pl11', tipo: 'Registro', etiqueta: 'Segundo Semestre (2º Año)', orden: 6, offsetInicioDias: 548, offsetFinDias: 730 },
  
  // REGISTROS - Tercer Año (2 semestres)
  { id: 'pl12', tipo: 'Registro', etiqueta: 'Primer Semestre (3er Año)', orden: 7, offsetInicioDias: 731, offsetFinDias: 912 },
  { id: 'pl13', tipo: 'Registro', etiqueta: 'Segundo Semestre (3er Año)', orden: 8, offsetInicioDias: 913, offsetFinDias: 1095 },
  
  // ALCOHOL (1 por año)
  { id: 'pl14', tipo: 'Alcohol', etiqueta: '1er Año', orden: 1, offsetInicioDias: 0, offsetFinDias: 365 },
  { id: 'pl15', tipo: 'Alcohol', etiqueta: '2º Año', orden: 2, offsetInicioDias: 366, offsetFinDias: 730 },
  { id: 'pl16', tipo: 'Alcohol', etiqueta: '3er Año', orden: 3, offsetInicioDias: 731, offsetFinDias: 1095 },
  
  // DROGAS (1 por año)
  { id: 'pl17', tipo: 'Drogas', etiqueta: '1er Año', orden: 1, offsetInicioDias: 0, offsetFinDias: 365 },
  { id: 'pl18', tipo: 'Drogas', etiqueta: '2º Año', orden: 2, offsetInicioDias: 366, offsetFinDias: 730 },
  { id: 'pl19', tipo: 'Drogas', etiqueta: '3er Año', orden: 3, offsetInicioDias: 731, offsetFinDias: 1095 },
];

// ===== EXPEDIENTES 16.03 MOCK =====
const fechaPrimerServicio = new Date('2024-01-15');
export const expedientes1603Mock: Expediente1603[] = [
  {
    id: 'e1603-1',
    maquinistaId: 'm2',
    fechaPrimerServicioDependencia: fechaPrimerServicio,
    fechaInicio: fechaPrimerServicio,
    fechaFinPrevista: addMonths(fechaPrimerServicio, 36),
    estado: 'Activo',
    observaciones: 'Vigilancia estándar nuevo acceso',
    createdAt: new Date('2024-01-15'),
    createdBy: 'u1',
    updatedAt: new Date('2024-01-15'),
    updatedBy: 'u1',
  },
];

// ===== PLAN 16.03 (GENERADO) =====
export function generarPlan1603(expediente: Expediente1603): Plan1603[] {
  const origen = expediente.fechaPrimerServicioDependencia;
  
  return plantilla1603Mock.map(plantilla => {
    const inicioVentana = addDays(origen, plantilla.offsetInicioDias);
    const finVentana = addDays(origen, plantilla.offsetFinDias);
    
    let estado: EstadoBloque1603 = 'Pendiente';
    
    if (isBefore(hoy, inicioVentana)) {
      estado = 'Pendiente';
    } else if (isWithinInterval(hoy, { start: inicioVentana, end: finVentana })) {
      estado = 'En ventana';
    } else if (isAfter(hoy, finVentana)) {
      estado = 'Vencida';
    }
    
    return {
      id: `plan-${expediente.id}-${plantilla.id}`,
      expediente1603Id: expediente.id,
      tipo: plantilla.tipo,
      etiqueta: plantilla.etiqueta,
      orden: plantilla.orden,
      inicioVentana,
      finVentana,
      estado,
      updatedAt: hoy,
      updatedBy: 'system',
    };
  });
}

// ===== ACTUACIONES 16.03 MOCK =====
export const actuaciones1603Mock: Actuacion1603[] = [
  {
    id: 'act1603-1',
    expediente1603Id: 'e1603-1',
    tipo: 'Acompañamiento',
    fechaReal: new Date('2024-01-20'),
    resultado: 'Satisfactorio',
    observaciones: 'Acompañamiento inicial realizado sin incidencias',
    createdAt: new Date('2024-01-20'),
    createdBy: 'u1',
    updatedAt: new Date('2024-01-20'),
    updatedBy: 'u1',
  },
  {
    id: 'act1603-2',
    expediente1603Id: 'e1603-1',
    tipo: 'Registro',
    fechaReal: new Date('2024-01-22'),
    resultado: 'Sin hallazgos',
    observaciones: 'Registro gráfico revisado',
    createdAt: new Date('2024-01-22'),
    createdBy: 'u1',
    updatedAt: new Date('2024-01-22'),
    updatedBy: 'u1',
  },
  {
    id: 'act1603-3',
    expediente1603Id: 'e1603-1',
    tipo: 'Acompañamiento',
    fechaReal: new Date('2024-03-15'),
    resultado: 'Satisfactorio',
    observaciones: 'Segundo acompañamiento 1er trimestre',
    createdAt: new Date('2024-03-15'),
    createdBy: 'u1',
    updatedAt: new Date('2024-03-15'),
    updatedBy: 'u1',
  },
];

// ===== CATÁLOGO HITOS 12.01 =====
export const catalogoHitos1201Mock: CatalogoHito1201[] = [
  { id: 'h1', bloque: 'Acompañamientos', etiqueta: 'Día 1', orden: 1, offsetDias: 0 },
  { id: 'h2', bloque: 'Acompañamientos', etiqueta: 'A los 7 días', orden: 2, offsetDias: 7 },
  { id: 'h3', bloque: 'Acompañamientos', etiqueta: 'A los 23 días', orden: 3, offsetDias: 23 },
  { id: 'h4', bloque: 'Registros', etiqueta: 'Día 1', orden: 1, offsetDias: 0 },
  { id: 'h5', bloque: 'Registros', etiqueta: 'A los 7 días', orden: 2, offsetDias: 7 },
  { id: 'h6', bloque: 'Registros', etiqueta: 'A los 23 días', orden: 3, offsetDias: 23 },
];

// ===== EXPEDIENTES 12.01 MOCK =====
const fechaSuceso = new Date('2024-10-01');
const fecha1erServicioTrasSuceso = new Date('2024-10-10');
export const expedientes1201Mock: Expediente1201[] = [
  {
    id: 'e1201-1',
    maquinistaId: 'm3',
    idSuceso: 'SUC-2024-0089',
    fechaSuceso,
    fechaPrimerServicioTrasSuceso: fecha1erServicioTrasSuceso,
    fechaAperturaFicha: new Date('2024-10-10'),
    estado: 'Abierta',
    observaciones: 'Incidencia de rebase de señal en modo degradado',
    createdAt: new Date('2024-10-10'),
    createdBy: 'u1',
    updatedAt: new Date('2024-10-10'),
    updatedBy: 'u1',
  },
];

// ===== PROGRAMACIÓN 12.01 MOCK (AD-HOC) =====
export const programacion1201Mock: Programacion1201[] = [
  {
    id: 'prog1201-1',
    expediente1201Id: 'e1201-1',
    bloque: 'Acompañamientos',
    etiqueta: 'Día 1',
    fechaObjetivo: addDays(fecha1erServicioTrasSuceso, 0),
    programadoPor: 'u1',
    programadoAt: new Date('2024-10-10'),
    observacionesProgramacion: 'Acompañamiento inmediato tras incorporación',
  },
  {
    id: 'prog1201-2',
    expediente1201Id: 'e1201-1',
    bloque: 'Acompañamientos',
    etiqueta: 'A los 7 días',
    fechaObjetivo: addDays(fecha1erServicioTrasSuceso, 7),
    programadoPor: 'u1',
    programadoAt: new Date('2024-10-10'),
  },
  {
    id: 'prog1201-3',
    expediente1201Id: 'e1201-1',
    bloque: 'Registros',
    etiqueta: 'Día 1',
    fechaObjetivo: addDays(fecha1erServicioTrasSuceso, 0),
    programadoPor: 'u1',
    programadoAt: new Date('2024-10-10'),
  },
];

// ===== ACTUACIONES 12.01 MOCK =====
export const actuaciones1201Mock: Actuacion1201[] = [
  {
    id: 'act1201-1',
    expediente1201Id: 'e1201-1',
    bloque: 'Acompañamientos',
    etiqueta: 'Día 1',
    fechaReal: new Date('2024-10-10'),
    resultado: 'Satisfactorio',
    observaciones: 'Acompañamiento realizado durante primer servicio',
    createdAt: new Date('2024-10-10'),
    createdBy: 'u1',
    updatedAt: new Date('2024-10-10'),
    updatedBy: 'u1',
  },
  {
    id: 'act1201-2',
    expediente1201Id: 'e1201-1',
    bloque: 'Registros',
    etiqueta: 'Día 1',
    fechaReal: new Date('2024-10-10'),
    resultado: 'Sin hallazgos',
    observaciones: 'Registro gráfico del primer servicio revisado',
    createdAt: new Date('2024-10-10'),
    createdBy: 'u1',
    updatedAt: new Date('2024-10-10'),
    updatedBy: 'u1',
  },
];

// ===== CALCULAR KPIs =====
export function calcularKPIs(baseFilter?: string): import('@/types').KPIs {
  const todasCerts = obtenerTodasCertificaciones();
  const maquinistasFiltrados = baseFilter 
    ? maquinistasMock.filter(m => m.base === baseFilter)
    : maquinistasMock;
  
  // Solo considerar las certificaciones con vigilarVencimiento=true para KPIs
  const certsFiltradas = (baseFilter
    ? todasCerts.filter(c => maquinistasFiltrados.some(m => m.id === c.maquinistaId))
    : todasCerts
  ).filter(c => c.vigilarVencimiento);
  
  const exp1603Filtrados = baseFilter
    ? expedientes1603Mock.filter(e => maquinistasFiltrados.some(m => m.id === e.maquinistaId))
    : expedientes1603Mock;
  
  const exp1201Filtrados = baseFilter
    ? expedientes1201Mock.filter(e => maquinistasFiltrados.some(m => m.id === e.maquinistaId))
    : expedientes1201Mock;
  
  // Calcular bloques vencidos/en ventana para 16.03
  let bloques1603Vencidas = 0;
  let bloques1603EnVentana = 0;
  
  exp1603Filtrados.filter(e => e.estado === 'Activo').forEach(exp => {
    const plan = generarPlan1603(exp);
    plan.forEach(bloque => {
      if (bloque.estado === 'Vencida') bloques1603Vencidas++;
      if (bloque.estado === 'En ventana') bloques1603EnVentana++;
    });
  });
  
  return {
    totalMaquinistas: maquinistasFiltrados.length,
    maquinistasActivos: maquinistasFiltrados.filter(m => m.activo).length,
    certVencido: certsFiltradas.filter(c => c.estado === 'Vencida').length,
    certProximo: certsFiltradas.filter(c => c.estado === 'Próxima a vencer').length,
    certSinEvidencia: certsFiltradas.filter(c => c.fechaUltimoServicio === null && c.vigilarVencimiento).length,
    exp1603Activos: exp1603Filtrados.filter(e => e.estado === 'Activo').length,
    exp1603Vencidas: bloques1603Vencidas,
    exp1603EnVentana: bloques1603EnVentana,
    exp1201Abiertas: exp1201Filtrados.filter(e => e.estado === 'Abierta').length,
    exp1201Pendientes: programacion1201Mock.filter(p => 
      exp1201Filtrados.some(e => e.id === p.expediente1201Id) &&
      !actuaciones1201Mock.some(a => 
        a.expediente1201Id === p.expediente1201Id && 
        a.bloque === p.bloque && 
        a.etiqueta === p.etiqueta
      )
    ).length,
  };
}
