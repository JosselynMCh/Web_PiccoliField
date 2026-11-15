/**
 * PICCOLI FIELD - UTILIDADES DE INTERFAZ (Tailwind)
 */
import { CONFIG } from './config.js';
import { api } from './api.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pick = (o, ...keys) => {
  if (!o) return undefined;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

export const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
export const money = (n) => 'S/ ' + num(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (a, b) => (b > 0 ? Math.min(999, Math.round((a / b) * 100)) : 0);

export function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d)) return esc(v);
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function fmtTime(v) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d)) return esc(String(v).slice(-8, -3) || v);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

export function fullName(o) {
  if (!o) return '';
  const direct = pick(o, 'nombre_completo', 'nombreCompleto', 'impulsador_nombre', 'responsable_nombre');
  if (direct) return direct;
  const n = [pick(o, 'nombres', 'nombre'), o.apePaterno, o.apeMaterno].filter(Boolean).join(' ');
  return n || '';
}
export const initials = (s) => (String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();

const BADGES = {
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-100 text-amber-800 border-amber-200',
  bad: 'bg-rose-100 text-rose-800 border-rose-200',
  info: 'bg-sky-100 text-sky-800 border-sky-200',
  neutral: 'bg-stone-100 text-stone-700 border-stone-200',
  brand: 'bg-brand-ivory text-brand-chocolate border-brand-gold/50'
};
export const badge = (text, kind = 'neutral') =>
  `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${BADGES[kind] || BADGES.neutral}">${esc(text)}</span>`;

export function estadoKind(e) {
  const s = String(e || '').toUpperCase().replace(/[ _-]/g, '');
  if (['ATIEMPO', 'ACTIVO', 'APROBADA', 'ATENDIDA', 'OPTIMO', 'CONVERTIDO', 'RESUELTO', 'ENTREGADO', 'PRESENTE', 'OK'].includes(s)) return 'ok';
  if (['TARDANZA', 'PENDIENTE', 'BAJO', 'MEDIA', 'MEDIO', 'ENPROCESO', 'ENPREPARACION', 'NEGOCIACION', 'CONTACTADO', 'REGISTRADO', 'ABIERTO'].includes(s)) return 'warn';
  if (['FALTA', 'INACTIVO', 'CLAUSURADO', 'RECHAZADA', 'RECHAZADO', 'AGOTADO', 'ALTA', 'ALTO', 'DESCARTADO', 'CANCELADO', 'IGNORADA'].includes(s)) return 'bad';
  if (['NUEVO', 'BAJA'].includes(s)) return 'info';
  return 'neutral';
}
export const estadoBadge = (e) => badge(String(e || '—').replace(/_/g, ' '), estadoKind(e));
export const label = (e) => String(e || '—').replace(/_/g, ' ');

/* ---------- Estados de UI: Loading / Empty / Error ---------- */
export const loadingHTML = (msg = 'Cargando datos desde la API...') => `
  <div class="flex flex-col items-center justify-center py-16 text-stone-500">
    <i class="fa-solid fa-circle-notch fa-spin text-2xl text-brand-gold mb-3"></i><p class="text-sm font-medium">${esc(msg)}</p>
  </div>`;
export const emptyHTML = (msg = 'No hay registros para mostrar.', icon = 'fa-inbox') => `
  <div class="flex flex-col items-center justify-center py-14 text-stone-400">
    <i class="fa-solid ${icon} text-3xl mb-3"></i><p class="text-sm font-medium text-stone-500">${esc(msg)}</p>
  </div>`;
export const errorHTML = (msg, retryId = 'btn-retry') => `
  <div class="flex flex-col items-center justify-center py-14 text-center px-4">
    <div class="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xl mb-3"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <p class="text-sm font-bold text-stone-800 mb-1">No se pudo cargar la información</p>
    <p class="text-xs text-stone-500 max-w-md mb-4">${esc(msg)}</p>
    <button id="${retryId}" class="px-4 py-2 rounded-xl bg-brand-chocolate text-white text-xs font-bold hover:bg-brand-dark"><i class="fa-solid fa-rotate-right mr-1"></i> Reintentar</button>
  </div>`;

/* ---------- Componentes ---------- */
export const pageHeader = (title, subtitle, actions = '') => `
  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
    <div class="min-w-0"><h2 class="text-lg sm:text-xl font-black text-brand-dark tracking-tight">${esc(title)}</h2>
    <p class="text-xs text-stone-500 mt-0.5 max-w-2xl">${esc(subtitle)}</p></div>
    ${actions ? `<div class="flex flex-wrap items-center gap-2 shrink-0">${actions}</div>` : ''}
  </div>`;

export const kpi = (labelTxt, value, icon, color = 'text-brand-chocolate', sub = '') => `
  <div class="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-xs min-w-0">
    <div class="flex items-center justify-between gap-1.5 mb-2">
      <span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-stone-500 truncate">${esc(labelTxt)}</span>
      <span class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-brand-ivory flex items-center justify-center shrink-0 ${color}"><i class="fa-solid ${icon} text-xs sm:text-sm"></i></span>
    </div>
    <div class="text-lg sm:text-2xl font-black text-brand-dark leading-none truncate">${value}</div>
    ${sub ? `<div class="text-[10px] sm:text-[11px] text-stone-500 mt-1.5 truncate">${sub}</div>` : ''}
  </div>`;

export const card = (inner, cls = '') => `<div class="bg-white rounded-2xl border border-stone-200 shadow-xs ${cls}">${inner}</div>`;

export const progressBar = (value, max) => {
  const p = pct(value, max);
  const color = p >= 100 ? 'bg-emerald-500' : p >= 60 ? 'bg-brand-gold' : 'bg-rose-400';
  return `<div class="w-full"><div class="flex justify-between text-[10px] font-bold text-stone-500 mb-0.5"><span>${p}%</span><span>${num(value)}/${num(max)}</span></div>
    <div class="h-2 rounded-full bg-stone-200 overflow-hidden"><div class="h-full ${color}" style="width:${Math.min(100, p)}%"></div></div></div>`;
};

export const inputCls = 'w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold';
export const btnPrimary = 'px-3.5 py-2 rounded-xl bg-brand-chocolate hover:bg-brand-dark text-white text-xs font-bold transition inline-flex items-center gap-1.5';
export const btnGhost = 'px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-bold transition inline-flex items-center gap-1.5';
export const btnDanger = 'px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5';
export const btnOk = 'px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5';

/* ---------- Modal y toast ---------- */
export function openModal(html, wide = false) {
  const m = document.getElementById('modal-container');
  m.innerHTML = `<div class="bg-white rounded-2xl ${wide ? 'max-w-4xl' : 'max-w-xl'} w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 m-auto">${html}</div>`;
  m.classList.remove('hidden'); m.classList.add('flex');
  hydrateImages(m);
}
export function closeModal() {
  const m = document.getElementById('modal-container');
  m.innerHTML = ''; m.classList.add('hidden'); m.classList.remove('flex');
}
export const isModalOpen = () => !document.getElementById('modal-container')?.classList.contains('hidden');
export const modalHeader = (title, sub = '') => `
  <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-brand-ivory/60 sticky top-0 z-10">
    <div><h3 class="text-sm font-black text-brand-dark">${title}</h3>${sub ? `<p class="text-[11px] text-stone-500 mt-0.5">${sub}</p>` : ''}</div>
    <button data-close-modal class="w-8 h-8 rounded-lg hover:bg-stone-200 text-stone-500"><i class="fa-solid fa-xmark"></i></button>
  </div>`;

export function toast(msg, type = 'success') {
  const t = document.getElementById('app-toast'); if (!t) return;
  document.getElementById('app-toast-message').textContent = msg;
  const icon = document.getElementById('app-toast-icon');
  icon.className = type === 'success' ? 'fa-solid fa-circle-check text-emerald-400'
    : type === 'error' ? 'fa-solid fa-circle-xmark text-rose-400' : 'fa-solid fa-circle-info text-amber-400';
  t.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'), 3800);
}

/* ---------- Imágenes (URL directa, ruta relativa o endpoint protegido con JWT) ---------- */
const apiOrigin = () => api.getEffectiveBaseUrl().replace(/\/api$/i, '');

export function resolveImg(v) {
  if (!v || typeof v !== 'string') return '';
  if (/^(data:|https?:\/\/|blob:)/i.test(v)) return v;
  if (/^[A-Za-z0-9+/=]{200,}$/.test(v)) return `data:image/jpeg;base64,${v}`;
  return `${apiOrigin()}/${v.replace(/^\/+/, '')}`;
}

/** <img data-src="url|ruta"> o <img data-auth="endpoint"> -> carga con JWT si hace falta */
export function hydrateImages(root = document) {
  root.querySelectorAll('img[data-auth],img[data-src]').forEach(async (img) => {
    if (img.dataset.loaded) return;
    img.dataset.loaded = '1';
    const fallback = () => {
      const wrap = img.closest('[data-img-wrap]');
      img.style.display = 'none';
      if (wrap) wrap.querySelector('[data-img-fallback]')?.classList.remove('hidden');
    };
    try {
      if (img.dataset.auth) img.src = await api.blobUrl(img.dataset.auth);
      else {
        const u = resolveImg(img.dataset.src);
        if (!u) return fallback();
        // Intento directo; si falla (requiere JWT) se reintenta autenticado
        img.onerror = async () => {
          img.onerror = fallback;
          try { img.src = await api.blobUrl(u); } catch { fallback(); }
        };
        img.src = u;
      }
    } catch { fallback(); }
  });
}

export function avatar(name, { auth, src, size = 'w-9 h-9' } = {}) {
  const has = auth || src;
  return `<span data-img-wrap class="relative inline-flex ${size} rounded-full overflow-hidden bg-brand-gold text-brand-dark font-black text-xs items-center justify-center shrink-0">
    ${has ? `<img ${auth ? `data-auth="${esc(auth)}"` : `data-src="${esc(src)}"`} class="w-full h-full object-cover" alt="">` : ''}
    <span data-img-fallback class="${has ? 'hidden' : ''}">${esc(initials(name))}</span></span>`;
}

/* ---------- Varios ---------- */
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = [...rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set())];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '\uFEFF' + [cols.map(q).join(','), ...rows.map(r => cols.map(c => q(typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : r[c])).join(','))].join('\r\n');
}

export const mapsLink = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
export const validCoord = (lat, lng) => Number.isFinite(+lat) && Number.isFinite(+lng) && (+lat !== 0 || +lng !== 0);

export function distanceKm(a, b, c, d) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (c - a) * rad, dLng = (d - b) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Delegación global para cerrar modales */
document.addEventListener('click', (e) => {
  if (e.target.closest?.('[data-close-modal]')) closeModal();
  else if (e.target.id === 'modal-container') closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
