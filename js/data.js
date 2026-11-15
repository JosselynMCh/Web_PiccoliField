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
export function normAsistencia(r) {
  const just = pick(r, 'justificacion', 'descripcionJustificacion');
  const motivo = pick(r, 'motivoJustificacion', 'motivo_justificacion');
  const estadoJ = pick(r, 'estadoJustificacion', 'estado_justificacion');
  return {
    raw: r,
    id: pick(r, 'idAsistencias', 'id'),
    idUsuario: pick(r, 'idUsuario', 'id_usuario'),
    nombre: fullName(r) || 'Sin nombre',
    foto: pick(r, 'foto_perfil', 'url_foto'),
    sede: pick(r, 'sede', 'local', 'punto_venta') || '—',
    rol: pick(r, 'rol'),
    estado: String(pick(r, 'estado', 'estado_asistencia') || 'SIN_MARCAR').toUpperCase(),
    tipo: pick(r, 'tipo') || '',
    fecha: pick(r, 'fecha_hora_servidor', 'fecha_hora_dispositivo', 'fecha_hora', 'fecha'),
    fechaDisp: pick(r, 'fecha_hora_dispositivo'),
    minutos: num(pick(r, 'minutos_tardanza')),
    lat: pick(r, 'latitud', 'lat'), lng: pick(r, 'longitud', 'lng'),
    precision: pick(r, 'precision', 'precision_gps', 'accuracy'),
    justificacion: (just || motivo || estadoJ) ? {
      motivo, descripcion: just, estado: String(estadoJ || 'PENDIENTE').toUpperCase(),
      fecha: pick(r, 'fechaJustificacion', 'fecha_justificacion'),
      sustento: pick(r, 'rutaSustento', 'ruta_sustento')
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

/* ---------------- Servicios ---------------- */
export const S = {
  // Supervisión
  resumen: async () => obj(await api.get('supervision/resumen')),
  vendedores: async () => list(await api.get('supervision/vendedores')).map(normVendedor),
  vendedorDetalle: async (id) => obj(await api.get(`supervision/vendedores/${id}`)),
  rendimiento: async (id, anio) => obj(await api.get(`supervision/vendedores/${id}/rendimiento-historico`, { anio })),
  impulsadores: async () => list(await api.get('supervision/impulsadores')).map(normPersona),
  alertas: async () => list(await api.get('supervision/alertas')).map(normAlerta),
  alertaDetalle: async (id) => normAlerta(obj(await api.get(`supervision/alertas/${id}`))),
  atenderAlerta: (id, comentario) => api.put(`supervision/alertas/${id}/atender`, { comentario }),
  ignorarAlerta: (id, comentario) => api.put(`supervision/alertas/${id}/ignorar`, { comentario }),
  pdvSupervision: async (estado) => list(await api.get('supervision/puntos-venta', { estado })).map(normPdv),
  pdvDetalle: async (id) => {
    try { return obj(await api.get(`supervision/puntos-venta/${id}`)); }
    catch { return obj(await api.get(`puntos-venta/${id}`)); }
  },
  pdvHistorial: async (id) => {
    try { return list(await api.get(`supervision/puntos-venta/${id}/historial`)); }
    catch { return []; }
  },
  reasignar: (idUsuario, idPuntosVenta, motivo) => api.post('supervision/reasignar-impulsador', { idUsuario, idPuntosVenta, motivo }),
  reasignarVendedor: (idUsuario, idPuntosVenta, motivo) => api.post(`supervision/vendedores/${idUsuario}/reasignar`, { idPuntosVenta, motivo }),

  // Puntos de venta / pedidos / productos
  puntosVenta: async (q = {}) => list(await api.get('puntos-venta', q)).map(normPdv),
  puntoVenta: async (id) => normPdv(obj(await api.get(`puntos-venta/${id}`))),
  pedidos: async (idPdv) => list(await api.get('pedidos', { idPdv })),
  estadoPedido: (id, estado) => api.put(`pedidos/${id}/estado`, { estado }),
  productos: async (estado) => list(await api.get('productos', { estado })),

  // Asistencias
  asistResumen: async () => obj(await api.get('asistencias/resumen')),
  asistRecientes: async () => list(await api.get('asistencias/recientes')).map(normAsistencia),
  asistColaboradores: async () => list(await api.get('asistencias/colaboradores')).map(normAsistencia),
  asistHistorial: async (id) => list(await api.get(`asistencias/historial/${id}`)),
  justificacion: async (id) => normAsistencia(obj(await api.get(`asistencias/justificacion/${id}`))),
  revisarJustificacion: (idUsuario, idRevisor, estado, comentarioRevision) =>
    api.post('asistencias/justificacion/revisar', { idUsuario, idRevisor, estado, comentarioRevision }),

  // Prospectos (si el backend en Render devuelve 404 en /prospectos, sincroniza los PDV de DISTRIBUCIÓN gestionados por Promotores)
  prospectos: async (q = {}) => {
    try {
      return list(await api.get('prospectos', q)).map(normProspecto);
    } catch (e) {
      if (e.status === 404) {
        const pdvs = list(await api.get('puntos-venta')).filter(p => String(p.tipo || '').toUpperCase().includes('DISTRIB'));
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
            promotor: p.promotor_asignado || p.responsable_nombre,
            idPromotor: p.idResponsable,
            notas: `Código PDV: ${p.codigo || '—'} · Correo promotor: ${p.correo_responsable || '—'}`
          }),
          _fromPdv: true
        }));
      }
      throw e;
    }
  },
  prospecto: async (id) => obj(await api.get(`prospectos/${id}`)),
  prospectoEstado: (id, estado, motivo) => api.put(`prospectos/${id}/estado`, { estado, ...(motivo ? { motivo, comentario: motivo } : {}) }),
  prospectoAsignar: (id, idUsuario, motivo) => api.put(`prospectos/${id}/asignar`, { idUsuario, idPromotor: idUsuario, motivo: motivo || 'Asignación desde panel web' }),
  seguimientos: async (id) => list(await api.get(`prospectos/${id}/seguimientos`)),
  addSeguimiento: (id, notas) => api.post(`prospectos/${id}/seguimientos`, { notas, idProspecto: id, fecha: new Date().toISOString().slice(0, 10) }),

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

  // Opcionales: la app Android no los consume; se prueban y se informa si el backend no los expone
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
