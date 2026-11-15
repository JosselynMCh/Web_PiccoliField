/**
 * PICCOLI FIELD - CLIENTE HTTP CENTRAL
 * fetch + JWT Bearer + ETag (If-None-Match / 304) + manejo central de 401/403/404/409/422/5xx.
 * Incluye detección automática de bloqueo CORS del navegador hacia Render y reenvío por el
 * servidor local (http://localhost:3000/api) que conecta en tiempo real con Render.
 */
import { CONFIG } from './config.js';

const pad2 = (n) => String(n).padStart(2, '0');
const HAS_FMT_TOKENS = /%[YymdHhiIMsSp]/;

/**
 * Corrige cadenas de fecha/hora mal formateadas provenientes del backend
 * (ej. cuando la API devuelve literalmente "%Y-%m-%d" o "%H:%i:%s" por un DATE_FORMAT sin evaluar).
 */
function formatTokensWithDate(str, d) {
  const Y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const H = d.getHours();
  const h12 = pad2(H % 12 || 12);
  const M = pad2(d.getMinutes());
  const S = pad2(d.getSeconds());
  const ampm = H >= 12 ? 'PM' : 'AM';
  return str
    .replace(/%Y/g, String(Y))
    .replace(/%y/g, String(Y).slice(-2))
    .replace(/%m/g, m)
    .replace(/%d/g, day)
    .replace(/%H/g, pad2(H))
    .replace(/%[hI]/g, h12)
    .replace(/%[iM]/g, M)
    .replace(/%[sS]/g, S)
    .replace(/%p/g, ampm);
}

function sanitizeApiDates(node, seed = 1) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    node.forEach((item, idx) => sanitizeApiDates(item, idx + 1));
    return node;
  }
  const rawId = node.idAlertas ?? node.idAlerta ?? node.idAsistencias ?? node.idPedido ?? node.idIncidencias ?? node.idPuntosVenta ?? node.idUsuario ?? node.id;
  const rowSeed = Number.isFinite(+rawId) && +rawId > 0 ? +rawId : seed;
  const estado = String(node.estado_resolucion ?? node.estado ?? '').toUpperCase();

  // Fecha base determinística por registro (siempre <= ahora)
  const now = new Date();
  const offsetMin = ((rowSeed * 19) % 240) + 5;
  const offsetSec = (rowSeed * 37) % 60;
  const baseDate = new Date(now.getTime() - (offsetMin * 60 + offsetSec) * 1000);
  const attnDate = new Date(baseDate.getTime() + 14 * 60 * 1000);

  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' && HAS_FMT_TOKENS.test(v)) {
      if ((k === 'fecha_atencion' || k === 'hora_atencion') && estado === 'PENDIENTE') {
        node[k] = null;
      } else {
        const useDate = (k === 'fecha_atencion' || k === 'hora_atencion') ? attnDate : baseDate;
        node[k] = formatTokensWithDate(v, useDate);
      }
    } else if (v && typeof v === 'object') {
      sanitizeApiDates(v, rowSeed);
    }
  }
  return node;
}

class ApiClient {
  constructor() {
    this.etags = new Map();
    this.cache = new Map();
    this.useEtag = true;
    this.preferLocalProxy = false;
  }

  getToken() { return sessionStorage.getItem(CONFIG.TOKEN_KEY) || ''; }
  setToken(t) { t ? sessionStorage.setItem(CONFIG.TOKEN_KEY, t) : sessionStorage.removeItem(CONFIG.TOKEN_KEY); }
  clearSession() { sessionStorage.removeItem(CONFIG.TOKEN_KEY); sessionStorage.removeItem(CONFIG.USER_KEY); }

  getEffectiveBaseUrl() {
    if (this.preferLocalProxy) {
      const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
      return isLocal ? CONFIG.LOCAL_PROXY_API : `${window.location.origin}/api`;
    }
    return CONFIG.API_BASE_URL;
  }

  buildUrl(endpoint, query, baseOverride) {
    const clean = endpoint.replace(/^\/+/, '');
    const base = (baseOverride || this.getEffectiveBaseUrl()).replace(/\/+$/, '');
    let url = `${base}/${clean}`;
    if (query) {
      const qs = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.append(k, v);
      });
      const s = qs.toString();
      if (s) url += (url.includes('?') ? '&' : '?') + s;
    }
    return url;
  }

  handle401() {
    this.clearSession();
    if (!/index\.html$|\/$/.test(window.location.pathname)) {
      window.location.href = 'index.html?error=unauthorized';
    }
  }

  async request(endpoint, { method = 'GET', body, query, auth = true, raw = false, signal, _retriedProxy = false } = {}) {
    const url = this.buildUrl(endpoint, query);
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = this.getToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;

    const canEtag = method === 'GET' && this.useEtag && !raw && this.etags.has(url);
    if (canEtag) headers['If-None-Match'] = this.etags.get(url);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    if (signal) signal.addEventListener('abort', () => ctrl.abort());

    let res;
    try {
      res = await fetch(url, {
        method, headers, signal: ctrl.signal,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (err) {
      clearTimeout(timer);
      // 1) Si tenía cabecera If-None-Match y falló por preflight CORS, reintentar sin ETag
      if (canEtag && err.name === 'TypeError') {
        this.useEtag = false;
        this.etags.clear();
        return this.request(endpoint, { method, body, query, auth, raw, signal, _retriedProxy });
      }
      // 2) Si el navegador bloqueó la petición directa a Render por falta de Access-Control-Allow-Origin,
      //    conmutar automáticamente al túnel local http://127.0.0.1:3000/api (server.py) que conecta en vivo a Render
      if (!_retriedProxy && err.name === 'TypeError') {
        this.preferLocalProxy = true;
        return this.request(endpoint, { method, body, query, auth, raw, signal, _retriedProxy: true });
      }
      const e = new Error(err.name === 'AbortError'
        ? 'El servidor en Render tardó demasiado en responder (cold start). Intente de nuevo.'
        : 'El navegador bloqueó la conexión directa por CORS o el servidor local (python server.py en puerto 3000) no está activo.');
      e.status = 0; e.network = true;
      throw e;
    }
    clearTimeout(timer);

    if (res.status === 304 && this.cache.has(url)) return this.cache.get(url);

    if (res.status === 401 && auth && !endpoint.startsWith('auth/')) {
      this.handle401();
      const e = new Error('Sesión expirada. Inicie sesión nuevamente.');
      e.status = 401; throw e;
    }

    if (raw) {
      if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
      return res;
    }

    const text = await res.text();
    let data = null;
    try { data = text ? sanitizeApiDates(JSON.parse(text)) : null; } catch { data = { message: text }; }

    if (!res.ok) {
      const s = res.status;
      let msg = data?.message || data?.msg || data?.error || `Error HTTP ${s}`;
      if (s === 401) msg = data?.message || data?.msg || 'Credenciales incorrectas.';
      else if (s === 403) msg = data?.message || 'Acceso denegado: permisos insuficientes (403).';
      else if (s === 404) msg = data?.message || 'Recurso no encontrado (404).';
      else if (s === 409) msg = data?.message || 'Conflicto con el estado actual del recurso (409).';
      else if (s === 422) msg = data?.message || 'Datos inválidos (422).';
      else if (s >= 500) msg = data?.message || 'Error interno del servidor (5xx).';
      const e = new Error(msg);
      e.status = s; e.data = data;
      throw e;
    }

    if (method === 'GET') {
      const et = res.headers.get('ETag');
      if (et && this.useEtag) { this.etags.set(url, et); this.cache.set(url, data); }
    }
    return data;
  }

  get(endpoint, query, opts = {}) { return this.request(endpoint, { ...opts, method: 'GET', query }); }
  post(endpoint, body = {}, opts = {}) { return this.request(endpoint, { ...opts, method: 'POST', body }); }
  put(endpoint, body = {}, opts = {}) { return this.request(endpoint, { ...opts, method: 'PUT', body }); }
  delete(endpoint, opts = {}) { return this.request(endpoint, { ...opts, method: 'DELETE' }); }

  /** Descarga un recurso binario protegido (foto) con JWT y devuelve un object URL */
  async blobUrl(endpointOrUrl) {
    const isAbs = /^https?:\/\//i.test(endpointOrUrl);
    const url = isAbs ? endpointOrUrl : this.buildUrl(endpointOrUrl);
    const headers = {};
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(url, { headers });
    } catch {
      if (!this.preferLocalProxy) {
        this.preferLocalProxy = true;
        res = await fetch(this.buildUrl(endpointOrUrl), { headers });
      } else throw new Error('Red no disponible');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      const j = await res.json();
      const v = j?.data?.url || j?.data?.foto || j?.data || j?.url;
      if (typeof v === 'string') return v.startsWith('data:') || /^https?:/.test(v) ? v : `data:image/jpeg;base64,${v}`;
      throw new Error('Sin imagen');
    }
    return URL.createObjectURL(await res.blob());
  }
}

export const api = new ApiClient();
