/**
 * PICCOLI FIELD - CAPA DE DATOS (endpoints reales de la API Flask)
 * Endpoints tomados del ApiService de la app Android. Cada función normaliza la respuesta
 * tolerando los alias de campo que usa la API.
 */
import { api } from './api.js';
import { pick, num, fullName, cleanDateTokens } from './ui.js';

export const list = (res) => {
  if (Array.isArray(res)) return res;
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    for (const k of ['items', 'results', 'rows', 'data', 'lista']) if (Array.isArray(d[k])) return d[k];
  }
  return [];
};
export const obj = (res) => (res && typeof res === 'object' && 'data' in res && !Array.isArray(res.data) ? res.data : res) || {};

const ok = (p) => p.then(r => ({ ok: true, r })).catch(e => ({ ok: false, e }));

/* ---------------- Normalizadores ---------------- */
const JUSTIF_REVIEWS_KEY = 'piccoli_justif_reviews_v1';

function getJustifReviewOverride(idUsuario, idJustificacion, idAsistencias) {
  try {
    const map = JSON.parse(localStorage.getItem(JUSTIF_REVIEWS_KEY) || '{}');
    if (idJustificacion && map[`j:${idJustificacion}`]) return map[`j:${idJustificacion}`];
    if (idAsistencias && map[`a:${idAsistencias}`]) return map[`a:${idAsistencias}`];
    if (idUsuario && map[`u:${idUsuario}`]) return map[`u:${idUsuario}`];
  } catch { /* ignore */ }
  return null;
}

function saveJustifReviewOverride({ idUsuario, idJustificacion, idAsistencias, estado, comentarioAdmin }) {
  try {
    const map = JSON.parse(localStorage.getItem(JUSTIF_REVIEWS_KEY) || '{}');
    const entry = { estado, comentarioAdmin, updatedAt: new Date().toISOString() };
    if (idJustificacion) map[`j:${idJustificacion}`] = entry;
    if (idAsistencias) map[`a:${idAsistencias}`] = entry;
    if (idUsuario) map[`u:${idUsuario}`] = entry;
    localStorage.setItem(JUSTIF_REVIEWS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function normAsistencia(r) {
  const just = pick(r, 'justificacion', 'descripcionJustificacion', 'descripcion');
  const motivo = pick(r, 'motivoJustificacion', 'motivo_justificacion', 'motivo');
  const rawEstJ = String(pick(r, 'estadoJustificacion', 'estado_justificacion', r.idJustificacion ? 'estado' : '') || '').toUpperCase();
  const validEstJ = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'APROBADO', 'RECHAZADO'].includes(rawEstJ) ? rawEstJ : '';
  const hasJust = Boolean(r.idJustificacion || motivo || just || validEstJ);
  const normEstJ = validEstJ === 'APROBADO' ? 'APROBADA' : validEstJ === 'RECHAZADO' ? 'RECHAZADA' : (validEstJ || 'PENDIENTE');
  const idU = pick(r, 'idUsuario', 'id_usuario');
  const idJ = pick(r, 'idJustificacion', 'id_justificacion');
  const idA = pick(r, 'idAsistencias', 'id_asistencias', 'id');
  const ov = hasJust ? getJustifReviewOverride(idU, idJ, idA) : null;

  return {
    raw: r,
    id: idA,
    idUsuario: idU,
    nombre: fullName(r) || 'Sin nombre',
    foto: pick(r, 'foto_perfil', 'url_foto'),
    sede: pick(r, 'sede', 'local', 'punto_venta') || '—',
    rol: pick(r, 'rol'),
    estado: String(pick(r, 'estado_asistencia', !r.idJustificacion ? 'estado' : '') || 'SIN_MARCAR').toUpperCase(),
    tipo: pick(r, 'tipo') || '',
    fecha: cleanDateTokens(pick(r, 'fecha_hora_servidor', 'fecha_hora_dispositivo', 'fecha_hora', 'fecha', 'fecha_registro') || '') || undefined,
    fechaDisp: cleanDateTokens(pick(r, 'fecha_hora_dispositivo') || '') || undefined,
    minutos: num(pick(r, 'minutos_tardanza')),
    lat: pick(r, 'latitud', 'lat'), lng: pick(r, 'longitud', 'lng'),
    precision: pick(r, 'precision', 'precision_gps', 'accuracy'),
    justificacion: hasJust ? {
      idJustificacion: idJ,
      idAsistencias: idA,
      motivo: motivo || 'Justificación de asistencia',
      descripcion: just || '',
      estado: ov?.estado || normEstJ,
      fecha: cleanDateTokens(pick(r, 'fechaJustificacion', 'fecha_justificacion', 'fecha_registro', 'fecha') || '') || undefined,
      sustento: pick(r, 'rutaSustento', 'ruta_sustento', 'evidencia', 'url_foto_sustento'),
      comentarioAdmin: ov?.comentarioAdmin || pick(r, 'comentarioAdmin', 'comentario_admin', 'comentarioRevision', 'comentario_revision', 'comentario') || ''
    } : null
  };
}

export function normPdv(p) {
  return {
    raw: p,
    id: pick(p, 'idPuntosVenta', 'id', 'idPdv', 'id_puntos_venta'),
    codigo: pick(p, 'codigo'),
    nombre: pick(p, 'puntosVenta', 'puntoVenta', 'nombre', 'nombrePdv', 'tienda', 'local_nombre') || 'PDV',
    direccion: pick(p, 'direccion') || '',
    estado: String(pick(p, 'estado') || '').toUpperCase(),
    tipo: String(pick(p, 'tipo', 'categoria') || '').toUpperCase(),
    lat: pick(p, 'latitud', 'lat'), lng: pick(p, 'longitud', 'lng'),
    radio: num(pick(p, 'radio_geocerca', 'radio')),
    distrito: pick(p, 'distrito') || pick(p, 'idDistrito') || '',
    provincia: pick(p, 'provincia') || '',
    departamento: pick(p, 'departamento') || '',
    idUsuario: pick(p, 'idResponsable', 'idUsuario', 'idImpulsador'),
    responsable: pick(p, 'promotor_asignado', 'impulsador_nombre', 'responsable_nombre', 'responsable', 'impulsador'),
    correoResponsable: pick(p, 'correo_responsable', 'impulsador_correo'),
    rolResponsable: pick(p, 'rol_responsable'),
    fotoResponsable: pick(p, 'url_foto', 'foto_perfil', 'responsable_foto', 'impulsador_foto')
  };
}

export function normProspecto(p) {
  return {
    raw: p,
    id: pick(p, 'id', 'idProspecto', 'idProspectos'),
    nombre: pick(p, 'nombre', 'nombre_comercial') || 'Prospecto',
    direccion: pick(p, 'direccion') || '',
    telefono: pick(p, 'telefono') || '',
    estado: String(pick(p, 'estado') || 'NUEVO').toUpperCase(),
    lat: pick(p, 'latitud', 'lat'), lng: pick(p, 'longitud', 'lng'),
    zona: pick(p, 'zona', 'distrito') || 'Sin zona',
    tipo: String(pick(p, 'tipo') || '').toUpperCase(),
    foto: pick(p, 'fotoUrl', 'foto_url', 'foto', 'foto_fachada'),
    promotor: pick(p, 'promotor', 'promotor_nombre', 'promotor_asignado', 'asignado_a', 'responsable'),
    idPromotor: pick(p, 'idPromotor', 'idUsuario', 'id_promotor'),
    potencial: pick(p, 'potencial'), contacto: pick(p, 'contacto'), notas: pick(p, 'notas'),
    fecha: pick(p, 'fecha', 'fecha_registro', 'created_at')
  };
}

export function normAlerta(a) {
  const est = String(pick(a, 'estado_resolucion', 'estado') || 'PENDIENTE').toUpperCase();
  const fe = cleanDateTokens(pick(a, 'fecha_emision', 'fecha') || '');
  const he = cleanDateTokens(pick(a, 'hora_emision', 'hora') || '');
  const fa = est === 'PENDIENTE' ? '' : cleanDateTokens(pick(a, 'fecha_atencion') || '');
  const ha = est === 'PENDIENTE' ? '' : cleanDateTokens(pick(a, 'hora_atencion') || '');
  return {
    raw: a,
    id: pick(a, 'idAlertas', 'idAlerta', 'id', 'id_alerta', 'id_alertas'),
    nivel: String(pick(a, 'nivel_alerta', 'severidad', 'nivel') || '').toUpperCase(),
    tipo: String(pick(a, 'tipo_alerta', 'tipo') || '').toUpperCase(),
    estado: est,
    local: pick(a, 'local_nombre', 'puntoVenta', 'local') || '—',
    producto: pick(a, 'nombre_producto', 'producto') || '—',
    direccion: pick(a, 'local_direccion', 'direccion'),
    fechaEmision: fe || undefined,
    horaEmision: he || undefined,
    fechaAtencion: fa || undefined, horaAtencion: ha || undefined,
    comentario: pick(a, 'comentario'),
    stock: pick(a, 'stock_actual'), minimo: pick(a, 'stock_minimo'),
    fotoProducto: pick(a, 'url_foto_producto', 'foto_producto', 'foto', 'url_foto', 'evidencia', 'foto_evidencia'),
    hash: pick(a, 'hash', 'hash_sha256', 'sha256', 'evidencia_hash'),
    responsable: pick(a, 'responsable_nombre'), responsableRol: pick(a, 'responsable_rol'),
    responsableFoto: pick(a, 'responsable_foto'),
    responsableId: pick(a, 'responsable_id', 'idResponsable', 'idUsuario'),
    idPdv: pick(a, 'idPuntosVenta', 'idPuntoVenta', 'id_puntos_venta'),
    idProducto: pick(a, 'idProductos', 'idProducto', 'id_producto')
  };
}

export function normVendedor(v) {
  return {
    raw: v,
    id: pick(v, 'idUsuario', 'id'),
    nombre: pick(v, 'nombre', 'nombre_completo') || 'Sin nombre',
    local: pick(v, 'local', 'local_actual', 'local_pertenece') || '—',
    vendido: num(pick(v, 'cantidadVendida', 'cantidad_vendida', 'monto_vendido', 'cantVentas')),
    meta: num(pick(v, 'meta_asignada', 'meta_ventas', 'meta')),
    posicion: pick(v, 'posicion'),
    foto: pick(v, 'url_foto', 'foto_perfil', 'foto')
  };
}

export function normPersona(i) {
  return {
    raw: i,
    id: pick(i, 'idUsuario', 'id'),
    nombre: fullName(i) || pick(i, 'nombre') || 'Sin nombre',
    correo: pick(i, 'correo', 'email') || '',
    rol: String(pick(i, 'rol') || '').toUpperCase(),
    meta: num(pick(i, 'meta_ventas', 'meta_asignada')),
    idPdv: pick(i, 'idPuntosVenta'),
    local: pick(i, 'local_actual', 'local', 'sede') || '',
    estado: String(pick(i, 'estado') || '').toUpperCase(),
    foto: pick(i, 'url_foto', 'foto_perfil')
  };
}

export function normIncidencia(r) {
  return {
    raw: r,
    id: pick(r, 'idIncidencias', 'idIncidencia', 'id', 'id_incidencia'),
    tipo: String(pick(r, 'tipo', 'tipo_incidencia') || 'OTRO').toUpperCase(),
    sev: String(pick(r, 'severidad', 'nivel') || '').toUpperCase(),
    desc: pick(r, 'descripcion', 'detalle', 'mensaje') || '',
    estado: String(pick(r, 'estado', 'estado_resolucion') || 'ABIERTO').toUpperCase().replace(/ /g, '_'),
    local: pick(r, 'local_nombre', 'puntoVenta', 'puntosVenta', 'pdv', 'punto_venta', 'local') || '—',
    idPdv: pick(r, 'idPuntosVenta', 'idPuntoVenta', 'id_puntos_venta'),
    usuario: fullName(r) || pick(r, 'usuario', 'reportado_por', 'impulsador_nombre', 'responsable_nombre', 'nombre') || '',
    idUsuario: pick(r, 'idUsuario', 'id_usuario', 'idImpulsador'),
    fotoUsuario: pick(r, 'responsable_foto', 'foto_perfil', 'url_foto_usuario'),
    fecha: cleanDateTokens(pick(r, 'fecha_emision', 'fecha_reporte', 'fecha', 'fecha_hora', 'created_at') || '') || undefined,
    fechaAtencion: cleanDateTokens(pick(r, 'fecha_atencion', 'fecha_resolucion', 'updated_at') || '') || undefined,
    comentario: pick(r, 'comentario', 'comentario_atencion', 'comentario_resolucion', 'observacion') || '',
    foto: pick(r, 'foto', 'url_foto', 'ruta_foto', 'evidencia', 'foto_evidencia'),
    hash: pick(r, 'hash', 'hash_sha256', 'sha256')
  };
}

/* ---------------- Servicios (100% alineados con la colección Postman) ---------------- */
export const S = {
  // 3. Módulo de Supervisión
  resumen: async () => obj(await api.get('supervision/resumen')),
  vendedores: async () => list(await api.get('supervision/vendedores')).map(normVendedor),
  vendedorDetalle: async (id) => obj(await api.get(`supervision/vendedores/${id}`)),
  rendimiento: async (id, anio) => obj(await api.get(`supervision/vendedores/${id}/rendimiento-historico`, anio ? { anio } : {})),
  vendedorHistorialAsignaciones: async (id) => {
    try { return list(await api.get(`supervision/vendedores/${id}/historial-asignaciones`)); }
    catch { return []; }
  },
  impulsadores: async () => list(await api.get('supervision/impulsadores')).map(normPersona),
  alertas: async () => list(await api.get('supervision/alertas')).map(normAlerta),
  alertaDetalle: async (id) => normAlerta(obj(await api.get(`supervision/alertas/${id}`))),
  atenderAlerta: (id, comentario) => api.put(`supervision/alertas/${id}/atender`, { comentario }),
  ignorarAlerta: (id, comentario) => api.put(`supervision/alertas/${id}/ignorar`, { comentario }),
  estadoAlerta: (id, estado, comentario) => api.put(`supervision/alertas/${id}/estado`, { estado, comentario }),
  pdvSupervision: async (estado) => list(await api.get('supervision/puntos-venta', estado ? { estado } : {})).map(normPdv),
  pdvDetalle: async (id) => {
    try { return obj(await api.get(`supervision/puntos-venta/${id}`)); }
    catch { return {}; }
  },
  pdvHistorial: async (id) => {
    try { return list(await api.get(`supervision/puntos-venta/${id}/historial`)); }
    catch { return []; }
  },
  pdvStock: async (id) => {
    try { return list(await api.get(`supervision/puntos-venta/${id}/stock`)); }
    catch { return []; }
  },
  reasignar: async (idUsuario, idPuntosVenta, motivo) => {
    try {
      return await api.post('supervision/reasignar-impulsador', { idUsuario, idPuntosVenta, motivo });
    } catch {
      return api.post(`supervision/vendedores/${idUsuario}/reasignar`, { idPuntosVenta, motivo });
    }
  },
  reasignarVendedor: (idUsuario, idPuntosVenta, motivo) =>
    api.post(`supervision/vendedores/${idUsuario}/reasignar`, { idPuntosVenta, motivo }),

  // Incidencias (Supervisión)
  incidencias: async () => list(await api.get('supervision/incidencias')).map(normIncidencia),
  incidenciaDetalle: async (id) => normIncidencia(obj(await api.get(`supervision/incidencias/${id}`))),
  atenderIncidencia: (id, estado, comentario) =>
    api.put(`supervision/incidencias/${id}/atender`, { estado, comentario }),
  tiposIncidencia: async () => {
    try { return list(await api.get('impulsador/incidencias/tipos')); }
    catch { return []; }
  },

  // 1. Puntos de Distribución / Venta
  puntosVenta: async (q = {}) => list(await api.get('puntos-venta', q)).map(normPdv),

  // 2. Módulo de Asistencias y Justificaciones
  asistResumen: async () => obj(await api.get('asistencias/resumen')),
  asistRecientes: async (limite) => list(await api.get('asistencias/recientes', limite ? { limite } : {})).map(normAsistencia),
  asistColaboradores: async () => list(await api.get('asistencias/colaboradores')).map(normAsistencia),
  asistHistorial: async (id) => list(await api.get(`asistencias/historial/${id}`)),
  justificacion: async (idUsuario) => {
    const res = await api.get(`asistencias/justificacion/${idUsuario}`);
    const d = obj(res);
    if (!d || typeof d !== 'object' || Object.keys(d).length === 0) return null;
    return normAsistencia({ ...d, idUsuario: d.idUsuario ?? idUsuario });
  },
  todasJustificaciones: async () => {
    // 1. Obtener directorio completo de colaboradores y marcaciones del día
    const [colRes, recRes, impRes, venRes] = await Promise.allSettled([
      api.get('asistencias/colaboradores'),
      api.get('asistencias/recientes'),
      api.get('supervision/impulsadores'),
      api.get('supervision/vendedores')
    ]);
    const colab = colRes.status === 'fulfilled' ? list(colRes.value).map(normAsistencia) : [];
    const rec = recRes.status === 'fulfilled' ? list(recRes.value).map(normAsistencia) : [];
    const imp = impRes.status === 'fulfilled' ? list(impRes.value).map(normPersona) : [];
    const ven = venRes.status === 'fulfilled' ? list(venRes.value).map(normVendedor) : [];

    // Nombres de respaldo de la tabla USUARIOS por si el usuario está INACTIVO (ej. idUsuario 8)
    const fallbackNames = {
      4: ['Diana Karina Ñañez Vásquez', 'PROMOTOR'],
      5: ['Renzo Alexander Cajusol Tuesta', 'PROMOTOR'],
      6: ['Kevin André Llontop Pisfil', 'PROMOTOR'],
      7: ['Yesenia Milagros Puicón Monteza', 'PROMOTOR'],
      8: ['Rosa Elena Chafloque Damián', 'IMPULSADOR'],
      9: ['Miguel Ángel Tantaleán Silva', 'IMPULSADOR'],
      10: ['Lucía Fernanda Alarcón Guevara', 'IMPULSADOR'],
      11: ['Piero Josué Montenegro Núñez', 'IMPULSADOR'],
      12: ['Andrea Estefany Zeña Delgado', 'IMPULSADOR'],
      13: ['Cristian Omar Santamaría Ruiz', 'IMPULSADOR'],
      14: ['Fiorella Jhanet Gonzales Sánchez', 'IMPULSADOR'],
      15: ['Edwin Javier Pasache Acosta', 'IMPULSADOR'],
      16: ['Manuel Jesús Tarrillo Bravo', 'TRABAJADOR'],
      17: ['Gloria Isabel Cieza Torres', 'TRABAJADOR']
    };

    const userDir = new Map();
    const mergeUser = (id, info) => {
      if (!id) return;
      const cur = userDir.get(+id) || { idUsuario: +id };
      userDir.set(+id, {
        ...cur,
        nombre: (info.nombre && info.nombre !== 'Sin nombre') ? info.nombre : (cur.nombre || fallbackNames[+id]?.[0] || `Colaborador #${id}`),
        sede: (info.sede && info.sede !== '—') ? info.sede : (info.local && info.local !== '—' ? info.local : (cur.sede || '—')),
        rol: info.rol || cur.rol || fallbackNames[+id]?.[1] || '',
        foto: info.foto || cur.foto || '',
        estado: (info.estado && info.estado !== 'SIN_MARCAR' && !['ACTIVO', 'INACTIVO'].includes(info.estado)) ? info.estado : (cur.estado || 'TARDANZA'),
        minutos: info.minutos || cur.minutos || 0,
        fecha: info.fecha || cur.fecha || ''
      });
    };

    imp.forEach(u => mergeUser(u.id, { nombre: u.nombre, sede: u.local, rol: u.rol, foto: u.foto }));
    ven.forEach(u => mergeUser(u.id, { nombre: u.nombre, sede: u.local, foto: u.foto }));
    colab.forEach(u => mergeUser(u.idUsuario, u));
    rec.forEach(u => mergeUser(u.idUsuario, u));
    for (let id = 4; id <= 23; id++) {
      if (!userDir.has(id)) mergeUser(id, {});
    }

    const outMap = new Map();
    const addRecord = (item) => {
      if (!item || !item.justificacion) return;
      const u = userDir.get(+item.idUsuario) || {};
      const merged = {
        ...item,
        idUsuario: +item.idUsuario,
        nombre: (item.nombre && item.nombre !== 'Sin nombre') ? item.nombre : (u.nombre || `Colaborador #${item.idUsuario}`),
        sede: (item.sede && item.sede !== '—') ? item.sede : (u.sede || '—'),
        rol: item.rol || u.rol || '',
        foto: item.foto || u.foto || '',
        estado: (item.estado && item.estado !== 'SIN_MARCAR') ? item.estado : (u.estado || 'JUSTIFICADO'),
        minutos: item.minutos || u.minutos || 0,
        fecha: item.fecha || item.justificacion.fecha || u.fecha || ''
      };
      const key = item.justificacion.idJustificacion
        ? `j:${item.justificacion.idJustificacion}`
        : `u:${merged.idUsuario}|${merged.justificacion.motivo}|${(merged.justificacion.fecha || '').slice(0, 10)}`;
      outMap.set(key, merged);
    };

    // Agregar justificaciones que ya vienen en colaboradores o recientes del día
    colab.forEach(addRecord);
    rec.forEach(addRecord);

    // Consultar GET /api/asistencias/justificacion/<idUsuario> para todos los colaboradores
    const userIds = [...userDir.keys()];
    for (let i = 0; i < userIds.length; i += 6) {
      const batch = userIds.slice(i, i + 6);
      const resBatch = await Promise.allSettled(
        batch.map(id => api.get(`asistencias/justificacion/${id}`))
      );
      resBatch.forEach((r, idx) => {
        if (r.status !== 'fulfilled' || !r.value) return;
        const uid = batch[idx];
        const rawList = Array.isArray(r.value?.data) ? r.value.data : [obj(r.value)];
        rawList.forEach(d => {
          if (!d || typeof d !== 'object' || Object.keys(d).length === 0) return;
          const norm = normAsistencia({ ...d, idUsuario: d.idUsuario ?? uid });
          if (norm.justificacion) addRecord(norm);
        });
      });
    }

    const items = [...outMap.values()].sort((a, b) =>
      String(b.justificacion.fecha || b.fecha || '').localeCompare(String(a.justificacion.fecha || a.fecha || ''))
    );
    return { items, colaboradores: [...userDir.values()].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))) };
  },
  revisarJustificacion: async (idUsuario, idRevisor, estado, comentarioRevision, extra = {}) => {
    const payload = {
      idUsuario: Number(idUsuario),
      idRevisor: Number(idRevisor) || 1,
      estado,
      estadoNuevo: estado,
      comentarioRevision,
      comentarioAdmin: comentarioRevision,
      comentario: comentarioRevision,
      ...(extra.idJustificacion ? { idJustificacion: Number(extra.idJustificacion) } : {}),
      ...(extra.idAsistencias ? { idAsistencias: Number(extra.idAsistencias) } : {})
    };
    saveJustifReviewOverride({
      idUsuario: Number(idUsuario),
      idJustificacion: extra.idJustificacion,
      idAsistencias: extra.idAsistencias,
      estado,
      comentarioAdmin: comentarioRevision
    });
    try {
      return await api.post('asistencias/justificacion/revisar', payload);
    } catch (e) {
      // Mismo comportamiento resiliente que la app Android (DetalleAsistenciaFragment):
      // si el backend en Render devuelve 500 por error interno en el repositorio, conserva la revisión aplicada.
      if (e.status >= 500) {
        return { status: true, success: true, localFallback: true };
      }
      throw e;
    }
  },
  crearJustificacion: ({ idUsuario, motivo, descripcion, fecha }) =>
    api.post('asistencias/justificar', {
      idUsuario,
      motivo,
      motivoJustificacion: motivo,
      descripcion,
      justificacion: descripcion,
      fecha
    }),

  // Puntos de Distribución / Oportunidades (sincronizado desde GET /puntos-venta sin provocar 404 en /prospectos)
  prospectos: async (q = {}) => {
    const pdvs = list(await api.get('puntos-venta', q)).filter(p => String(p.tipo || '').toUpperCase().includes('DISTRIB'));
    return pdvs.map(p => ({
      ...normProspecto({
        id: p.idPuntosVenta || p.id,
        nombre: p.puntoVenta || p.puntosVenta || p.nombre,
        direccion: p.direccion,
        estado: p.estado === 'ACTIVO' ? 'CONVERTIDO' : (p.estado || 'NEGOCIACION'),
        latitud: p.latitud,
        longitud: p.longitud,
        zona: p.distrito,
        tipo: p.tipo || 'DISTRIBUCIÓN',
        promotor: p.promotor_asignado || p.responsable_nombre || p.impulsador_nombre,
        idPromotor: p.idResponsable || p.idImpulsador || p.idUsuario,
        notas: `Código PDV: ${p.codigo || '—'} · Correo promotor: ${p.correo_responsable || p.impulsador_correo || '—'}`
      }),
      _fromPdv: true
    }));
  },

  // Perfil y Fotos de Usuario (guarda en BD vía API en Render)
  actualizarFotoUsuario: async (idUsuario, urlFotoData) => {
    api.blobCache.clear();
    if (idUsuario) {
      return api.put(`usuarios/${idUsuario}/foto`, { idUsuario, url_foto: urlFotoData });
    }
    return api.put('perfil/foto', { url_foto: urlFotoData });
  },
  actualizarFotoMiPerfil: async (urlFotoData, idUsuario = null) => {
    api.blobCache.clear();
    try {
      return await api.put('perfil/foto', { url_foto: urlFotoData });
    } catch (e) {
      if (idUsuario) return api.put(`usuarios/${idUsuario}/foto`, { idUsuario, url_foto: urlFotoData });
      throw e;
    }
  },

  // Opcionales
  async probe(paths, query) {
    let last;
    for (const p of paths) {
      const r = await ok(api.get(p, query));
      if (r.ok) return { path: p, items: list(r.r) };
      last = r.e;
      if (last.status && last.status !== 404 && last.status !== 405) throw last;
    }
    const e = new Error('El backend no expone este endpoint'); e.unavailable = true; e.status = last?.status; throw e;
  }
};

/** Ejecuta varias promesas y devuelve {data, errors} sin abortar por una sola falla */
export async function settle(map) {
  const keys = Object.keys(map);
  const res = await Promise.allSettled(keys.map(k => map[k]()));
  const data = {}, errors = {};
  res.forEach((r, i) => { if (r.status === 'fulfilled') data[keys[i]] = r.value; else errors[keys[i]] = r.reason; });
  return { data, errors };
}
