import {
  Maquinista,
  Certificacion,
  CertificacionPorBase,
  AccionCertificacion,
  PlanCertificacion,
  Expediente1603,
  Plantilla1603,
  Plan1603,
  Actuacion1603,
  Expediente1201,
  CatalogoHito1201,
  Programacion1201,
  Actuacion1201,
  Usuario,
  EstadoPlanCertificacion,
  EstadoBloque1603,
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
  { id: 'c1', tipo: 'Infra', codigo: 'INF-001', nombre: 'Túnel de Guadarrama', activo: true },
  { id: 'c2', tipo: 'Infra', codigo: 'INF-002', nombre: 'Variante de Pajares', activo: true },
  { id: 'c3', tipo: 'Infra', codigo: 'INF-003', nombre: 'LAV Madrid-Sevilla Km 100-150', activo: true },
  { id: 'c4', tipo: 'Serie', codigo: 'SER-100', nombre: 'Serie 100 (AVE)', activo: true },
  { id: 'c5', tipo: 'Serie', codigo: 'SER-112', nombre: 'Serie 112 (AVE S-112)', activo: true },
  { id: 'c6', tipo: 'Serie', codigo: 'SER-103', nombre: 'Serie 103 (AVE S-103)', activo: true },
  { id: 'c7', tipo: 'Infra', codigo: 'INF-004', nombre: 'Túnel del Pertús', activo: true },
];

// ===== CERTIFICACIONES POR BASE (con vigilar) =====
export const certificacionesPorBaseMock: CertificacionPorBase[] = [
  // Madrid-Chamartín
  { id: 'cb1', base: 'Madrid-Chamartín', certificacionId: 'c1', activa: true, vigilar: true },
  { id: 'cb2', base: 'Madrid-Chamartín', certificacionId: 'c2', activa: true, vigilar: true },
  { id: 'cb3', base: 'Madrid-Chamartín', certificacionId: 'c4', activa: true, vigilar: true },
  { id: 'cb4', base: 'Madrid-Chamartín', certificacionId: 'c5', activa: true, vigilar: false }, // No vigilar
  { id: 'cb5', base: 'Madrid-Chamartín', certificacionId: 'c6', activa: true, vigilar: false }, // No vigilar
  // Barcelona-Sants
  { id: 'cb6', base: 'Barcelona-Sants', certificacionId: 'c1', activa: true, vigilar: true },
  { id: 'cb7', base: 'Barcelona-Sants', certificacionId: 'c3', activa: true, vigilar: false },
  { id: 'cb8', base: 'Barcelona-Sants', certificacionId: 'c4', activa: true, vigilar: true },
  { id: 'cb9', base: 'Barcelona-Sants', certificacionId: 'c7', activa: true, vigilar: true },
  // Sevilla-Santa Justa
  { id: 'cb10', base: 'Sevilla-Santa Justa', certificacionId: 'c3', activa: true, vigilar: true },
  { id: 'cb11', base: 'Sevilla-Santa Justa', certificacionId: 'c4', activa: true, vigilar: true },
];

// ===== ACCIONES DE CERTIFICACIÓN (EVIDENCIAS) =====
const hoy = new Date();
export const accionesCertificacionMock: AccionCertificacion[] = [
  {
    id: 'au1',
    maquinistaId: 'm1',
    certificacionId: 'c1',
    tipoAccion: 'Conducción',
    fechaAccion: addDays(hoy, -30),
    observaciones: 'Servicio AVE 3456 Madrid-Segovia',
    createdAt: addDays(hoy, -30),
    createdBy: 'u1',
    updatedAt: addDays(hoy, -30),
    updatedBy: 'u1',
  },
  {
    id: 'au2',
    maquinistaId: 'm1',
    certificacionId: 'c2',
    tipoAccion: 'Paso',
    fechaAccion: addDays(hoy, -350),
    observaciones: 'Paso por variante en servicio León',
    createdAt: addDays(hoy, -350),
    createdBy: 'u1',
    updatedAt: addDays(hoy, -350),
    updatedBy: 'u1',
  },
  {
    id: 'au3',
    maquinistaId: 'm1',
    certificacionId: 'c4',
    tipoAccion: 'Conducción',
    fechaAccion: addDays(hoy, -380),
    observaciones: 'Servicio regular S100',
    createdAt: addDays(hoy, -380),
    createdBy: 'u1',
    updatedAt: addDays(hoy, -380),
    updatedBy: 'u1',
  },
  {
    id: 'au4',
    maquinistaId: 'm3',
    certificacionId: 'c1',
    tipoAccion: 'Conducción',
    fechaAccion: addDays(hoy, -60),
    createdAt: addDays(hoy, -60),
    createdBy: 'u1',
    updatedAt: addDays(hoy, -60),
    updatedBy: 'u1',
  },
];

// ===== FUNCIÓN PARA CALCULAR PLAN CERTIFICACIÓN =====
export function calcularPlanCertificacion(): PlanCertificacion[] {
  const plan: PlanCertificacion[] = [];
  
  maquinistasMock.filter(m => m.activo).forEach(maquinista => {
    // Obtener certificaciones de la base del maquinista
    const certificacionesBase = certificacionesPorBaseMock
      .filter(cb => cb.base === maquinista.base && cb.activa)
      .map(cb => {
        const cert = certificacionesMock.find(c => c.id === cb.certificacionId);
        return cert ? { ...cert, vigilar: cb.vigilar } : null;
      })
      .filter((c): c is Certificacion & { vigilar: boolean } => c !== null && c.activo);
    
    certificacionesBase.forEach(certConVigilar => {
      const acciones = accionesCertificacionMock.filter(
        a => a.maquinistaId === maquinista.id && a.certificacionId === certConVigilar.id
      );
      
      const fechaUltima = acciones.length > 0 
        ? acciones.reduce((max, a) => isAfter(a.fechaAccion, max) ? a.fechaAccion : max, acciones[0].fechaAccion)
        : null;
      
      const fechaVencimiento = fechaUltima ? addMonths(fechaUltima, 12) : null;
      
      let estado: EstadoPlanCertificacion = 'Sin evidencia';
      let diasRestantes: number | null = null;
      
      if (fechaUltima && fechaVencimiento) {
        diasRestantes = differenceInDays(fechaVencimiento, hoy);
        
        if (diasRestantes < 0) {
          estado = 'Vencido';
        } else if (diasRestantes <= 30) {
          estado = 'Próximo';
        } else {
          estado = 'OK';
        }
      }
      
      plan.push({
        id: `pc-${maquinista.id}-${certConVigilar.id}`,
        maquinistaId: maquinista.id,
        certificacionId: certConVigilar.id,
        certificacion: certConVigilar,
        fechaUltima,
        fechaVencimiento,
        estado,
        diasRestantes,
        vigilar: certConVigilar.vigilar, // Heredado de la base
        updatedAt: hoy,
        updatedBy: 'system',
      });
    });
  });
  
  return plan;
}

// ===== PLANTILLA 16.03 =====
// Según imagen: ACOMPAÑAMIENTOS (5 bloques) + REGISTROS (10 bloques: 4 trim 1er año + 2 sem 2º año + 2 sem 3er año)
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
  const planCert = calcularPlanCertificacion();
  const maquinistasFiltrados = baseFilter 
    ? maquinistasMock.filter(m => m.base === baseFilter)
    : maquinistasMock;
  
  // Solo considerar las certificaciones con vigilar=true para KPIs
  const planCertFiltrado = (baseFilter
    ? planCert.filter(p => maquinistasFiltrados.some(m => m.id === p.maquinistaId))
    : planCert
  ).filter(p => p.vigilar);
  
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
    certVencido: planCertFiltrado.filter(p => p.estado === 'Vencido').length,
    certProximo: planCertFiltrado.filter(p => p.estado === 'Próximo').length,
    certSinEvidencia: planCertFiltrado.filter(p => p.estado === 'Sin evidencia').length,
    exp1603Activos: exp1603Filtrados.filter(e => e.estado === 'Activo').length,
    exp1603Vencidas: bloques1603Vencidas,
    exp1603EnVentana: bloques1603EnVentana,
    exp1201Abiertas: exp1201Filtrados.filter(e => e.estado === 'Abierta').length,
    exp1201Pendientes: programacion1201Mock.filter(p => 
      exp1201Filtrados.some(e => e.id === p.expediente1201Id) &&
      !actuaciones1201Mock.some(a => a.expediente1201Id === p.expediente1201Id && a.bloque === p.bloque && a.etiqueta === p.etiqueta)
    ).length,
  };
}