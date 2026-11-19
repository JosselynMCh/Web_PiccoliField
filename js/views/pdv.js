import { S, settle, normPersona } from '../data.js';
import { CONFIG } from '../config.js';
import { esc, num, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, badge, label, avatar, pick, fmtDate, validCoord, mapsLink,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast, debounce } from '../ui.js';

let root, pdvs = [], alertas = [], personas = [], map, busy = false, view = 'lista';
const f = { q: '', tipo: '', estado: '' };

export async function render(container) {
  root = container; view = 'lista'; Object.assign(f, { q: '', tipo: '', estado: '' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) await load(); }
export function destroy() { map?.remove(); map = null; root = null; }

async function load() {
  busy = true;
  const { data, errors } = await settle({ pdv: () => S.puntosVenta(), supPdv: () => S.pdvSupervision(), al: S.alertas, per: S.impulsadores });
  busy = false;
  if (!root) return;
  if (!data.pdv && !data.supPdv) { root.innerHTML = errorHTML((errors.pdv || errors.supPdv)?.message || 'Error', 'btn-retry'); root.querySelector('#btn-retry').onclick = () => render(root); return; }
  const listPdv = [];
  const findPdv = (p) => listPdv.find(x =>
    (p.id && x.id && String(x.id) === String(p.id)) ||
    (p.codigo && x.codigo && String(x.codigo).toLowerCase() === String(p.codigo).toLowerCase()) ||
    (p.nombre && x.nombre && x.nombre.trim().toLowerCase() === p.nombre.trim().toLowerCase())
  );
  [...(data.pdv || []), ...(data.supPdv || [])].forEach(p => {
    const existing = findPdv(p);
    const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    if (existing) Object.assign(existing, clean);
    else listPdv.push({ ...clean });
  });
  pdvs = listPdv; alertas = data.al || []; personas = data.per || [];
  frame(); draw();
}

function frame() {
  if (root.querySelector('#pv-body')) return;
  root.innerHTML = `
    ${pageHeader('Puntos de Venta y Responsables', 'PDV de tipo VENTA (stands propios) y DISTRIBUCIÓN. Asigne o reasigne responsables y consulte el historial de cada punto.')}
    <div id="pv-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3 items-center">
      <div class="inline-flex bg-stone-100 rounded-xl p-1 text-xs font-bold" id="pv-tabs"><button data-v="lista" class="px-3 py-1.5 rounded-lg">Lista</button><button data-v="mapa" class="px-3 py-1.5 rounded-lg">Mapa</button></div>
      <input id="pv-q" class="${inputCls} sm:w-56" placeholder="Buscar por nombre o dirección...">
      <select id="pv-tipo" class="${inputCls} sm:w-40"><option value="">Todos los tipos</option><option value="VENTA">VENTA</option><option value="DISTRIBUCION">DISTRIBUCIÓN</option></select>
      <select id="pv-estado" class="${inputCls} sm:w-40"><option value="">Todos los estados</option><option>ACTIVO</option><option>INACTIVO</option><option>CLAUSURADO</option></select>
    </div><div id="pv-body"></div>`;
  root.querySelector('#pv-tabs').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; draw(); } };
  root.querySelector('#pv-q').oninput = debounce(e => { f.q = e.target.value.toLowerCase(); draw(); });
  root.querySelector('#pv-tipo').onchange = e => { f.tipo = e.target.value; draw(); };
  root.querySelector('#pv-estado').onchange = e => { f.estado = e.target.value; draw(); };
}

const tipoOf = (p) => p.tipo.startsWith('DIST') ? 'DISTRIBUCION' : p.tipo.startsWith('VENT') ? 'VENTA' : p.tipo;
const alertsOf = (p) => alertas.filter(a => a.estado === 'PENDIENTE' && ((a.idPdv && String(a.idPdv) === String(p.id)) || (a.local && a.local === p.nombre)));

function draw() {
  root.querySelectorAll('#pv-tabs button').forEach(b => b.className = 'px-3 py-1.5 rounded-lg ' + (b.dataset.v === view ? 'bg-white shadow text-brand-chocolate' : 'text-stone-500'));
  const c = (fn) => pdvs.filter(fn).length;
  root.querySelector('#pv-kpis').innerHTML = kpi('Total PDV', pdvs.length, 'fa-store', 'text-brand-gold') + kpi('Activos', c(p => p.estado === 'ACTIVO'), 'fa-circle-check', 'text-emerald-600') +
    kpi('Venta / Distribución', `${c(p => tipoOf(p) === 'VENTA')} / ${c(p => tipoOf(p) === 'DISTRIBUCION')}`, 'fa-shop', 'text-sky-600') + kpi('Con alertas de stock', c(p => alertsOf(p).length), 'fa-triangle-exclamation', 'text-rose-600');
  const rows = pdvs.filter(p => (!f.q || (p.nombre + p.direccion).toLowerCase().includes(f.q)) && (!f.tipo || tipoOf(p) === f.tipo) && (!f.estado || p.estado === f.estado));
  const body = root.querySelector('#pv-body');
  if (view === 'mapa') return drawMap(body, rows);
  map?.remove(); map = null;
  if (!rows.length) { body.innerHTML = card(emptyHTML('No hay puntos de venta con esos filtros.', 'fa-store-slash')); return; }
  body.innerHTML = `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${rows.map((p, i) => { const al = alertsOf(p).length; return `
    <div class="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-col gap-2">
      <div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="text-[10px] font-bold text-stone-400">${esc(p.codigo || 'PDV-' + p.id)}</div><div class="text-sm font-black truncate">${esc(p.nombre)}</div></div>${estadoBadge(p.estado || '—')}</div>
      <div class="text-xs text-stone-500 truncate"><i class="fa-solid fa-location-dot mr-1"></i>${esc(p.direccion || 'Sin dirección')}${p.distrito ? ` · <b>${esc(p.distrito)}</b>` : ''}</div>
      <div class="text-xs text-stone-700 flex items-center gap-2 min-w-0">${avatar(p.responsable || '?', { id: p.idUsuario, src: p.fotoResponsable, size: 'w-6 h-6 text-[10px]' })}<div class="truncate"><b>${esc(p.responsable || 'Sin responsable')}</b>${p.rolResponsable ? ` <span class="text-[10px] text-stone-400">(${esc(p.rolResponsable)})</span>` : ''}</div></div>
      <div class="flex flex-wrap gap-1.5">${p.tipo ? badge(tipoOf(p), tipoOf(p) === 'VENTA' ? 'brand' : 'info') : ''}${al ? badge(`${al} alerta${al > 1 ? 's' : ''} de stock`, 'bad') : ''}</div>
      <button data-i="${i}" class="mt-2 px-3 py-2 rounded-xl bg-brand-chocolate text-white text-xs font-bold">Ver responsable, stock e historial</button></div>`; }).join('')}</div>`;
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => detail(rows[+b.dataset.i]));
}

function drawMap(body, rows) {
  body.innerHTML = card(`<div id="pv-map" class="h-[360px] sm:h-[540px] rounded-2xl"></div>`);
  map?.remove();
  map = L.map('pv-map').setView(CONFIG.MAP_DEFAULT_CENTER, CONFIG.MAP_DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const cl = L.markerClusterGroup(), pts = [];
  rows.filter(p => validCoord(p.lat, p.lng)).forEach(p => {
    const al = alertsOf(p).length;
    const col = al ? '#f43f5e' : p.estado === 'ACTIVO' ? (tipoOf(p) === 'VENTA' ? '#4A2B1C' : '#0ea5e9') : '#a8a29e';
    const m = L.marker([+p.lat, +p.lng], { icon: L.divIcon({ className: '', iconSize: [28, 28], html: `<div style="background:${col}" class="w-7 h-7 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[11px]"><i class="fa-solid ${tipoOf(p) === 'VENTA' ? 'fa-store' : 'fa-truck'}"></i></div>` }) });
    m.bindPopup(`<b>${esc(p.nombre)}</b><br>${esc(p.direccion)}<br>${label(p.estado)} · ${esc(tipoOf(p))}${al ? `<br><b style="color:#e11d48">${al} alerta(s) de stock</b>` : ''}<br><a target="_blank" href="${mapsLink(p.lat, p.lng)}">Cómo llegar</a>`);
    cl.addLayer(m); pts.push([+p.lat, +p.lng]);
    if (p.radio) L.circle([+p.lat, +p.lng], { radius: p.radio, color: col, weight: 1, fillOpacity: .06 }).addTo(map);
  });
  map.addLayer(cl); if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  setTimeout(() => map?.invalidateSize(), 150);
}

async function detail(p) {
  openModal(modalHeader(esc(p.nombre), esc(p.direccion)) + `<div class="p-5">${loadingHTML('Consultando responsable, stock e historial...')}</div>`, true);
  const { data } = await settle({ det: () => S.pdvDetalle(p.id), stock: () => S.pdvStock(p.id), hist: () => S.pdvHistorial(p.id) });
  const d = data.det || {}, hist = data.hist || [];
  const prods = (data.stock && data.stock.length) ? data.stock : (d.productos || []);
  const respNombre = d.impulsador_nombre || d.promotor_asignado || p.responsable, respId = d.idImpulsador || d.idResponsable || p.idUsuario;
  const respCorreo = d.impulsador_correo || d.correo_responsable || p.correoResponsable || '';
  const al = alertsOf(p);
  openModal(modalHeader(esc(pick(d, 'puntoVenta') || p.nombre), `${esc(pick(d, 'direccion') || p.direccion)} · ${esc(d.distrito || p.distrito || '')}`) + `
    <div class="p-5 space-y-4 text-xs">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Estado</div>${estadoBadge(d.estado || p.estado)}</div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Tipo</div><b>${esc(label(d.tipo || p.tipo))}</b></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Geocerca</div><b>${num(d.radio_geocerca, p.radio) || '—'} m</b></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Coordenadas</div>${validCoord(d.latitud ?? p.lat, d.longitud ?? p.lng) ? `<a class="text-sky-700 font-bold" target="_blank" href="${mapsLink(d.latitud ?? p.lat, d.longitud ?? p.lng)}">Cómo llegar</a>` : '—'}</div></div>
      <div class="p-4 rounded-xl border border-brand-gold/40 bg-brand-ivory flex flex-wrap sm:flex-nowrap items-center gap-3">
        ${avatar(respNombre || 'Sin asignar', { id: respId, src: d.url_foto || d.foto_perfil || p.fotoResponsable, size: 'w-12 h-12' })}
        <div class="flex-1 min-w-0"><div class="text-[10px] uppercase font-bold text-stone-500">Responsable actual</div><div class="text-sm font-black truncate">${esc(respNombre || 'Sin responsable asignado')}</div>
          <div class="text-stone-500 truncate">${esc(respCorreo)} ${d.impulsador_meta ? `· Meta: ${d.impulsador_meta}` : ''}</div></div>
        <button id="pv-reasignar" class="${btnPrimary}"><i class="fa-solid fa-user-pen"></i> ${respNombre ? 'Reasignar' : 'Asignar'}</button></div>
      ${al.length ? `<div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900"><b>${al.length} alerta(s) de stock pendientes:</b> ${al.map(a => esc(a.producto)).join(', ')}. <a href="#stock" data-close-modal class="font-black underline">Atender</a></div>` : ''}
      <div class="grid md:grid-cols-2 gap-4">
        <div><h4 class="font-black mb-2">Stock actual de productos en PDV</h4>${prods.length ? `<div class="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-60 overflow-y-auto">${prods.map(x => {
          const stActual = pick(x, 'stock_actual', 'stock', 'cantidad');
          const stMin = pick(x, 'stock_minimo', 'minimo');
          return `<div class="p-2.5 flex justify-between items-center gap-2"><span class="truncate">${esc(pick(x, 'producto', 'nombre_producto', 'nombre'))} <span class="text-stone-400">${esc(x.sku || x.codigo_barras || '')}</span></span><span class="whitespace-nowrap">${stActual !== undefined ? `<b class="${num(stActual) <= num(stMin, 0) ? 'text-rose-600' : 'text-emerald-700'}">stock: ${stActual}</b> · ` : ''}<b>mín. ${stMin ?? '—'}</b></span></div>`;
        }).join('')}</div>` : emptyHTML('Sin productos asociados')}</div>
        <div><h4 class="font-black mb-2">Historial de responsables</h4>${hist.length ? `<div class="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-60 overflow-y-auto">${hist.map(h => `<div class="p-2.5"><div class="flex justify-between"><b>${esc(h.impulsador_nombre || h.nombre || '—')}</b>${h.es_actual ? badge('Actual', 'ok') : ''}</div><div class="text-stone-500">${esc(h.impulsador_rol || h.rol || '')} · ${esc(fmtDate(h.fecha_inicio))} → ${esc(h.fecha_fin ? fmtDate(h.fecha_fin) : 'actual')}</div>${h.motivo ? `<div class="text-stone-500 italic">“${esc(h.motivo)}”</div>` : ''}${h.registrado_por ? `<div class="text-[10px] text-stone-400">Registrado por ${esc(h.registrado_por)}</div>` : ''}</div>`).join('')}</div>` : emptyHTML('Sin historial de asignaciones')}</div></div>
    </div>`, true);
  document.getElementById('pv-reasignar')?.addEventListener('click', () => reassign(p, d));
}

function reassign(p, d) {
  const t = tipoOf({ tipo: String(d.tipo || p.tipo).toUpperCase() });
  const want = t === 'VENTA' ? 'IMPULSADOR' : t === 'DISTRIBUCION' ? 'PROMOTOR' : '';
  const cand = personas.filter(x => !want || x.rol === want || !x.rol).filter(x => x.id !== d.idImpulsador);
  openModal(modalHeader('Asignar responsable', esc(p.nombre)) + `
    <div class="p-5 space-y-3 text-xs">
      <div class="p-3 rounded-xl bg-stone-50">Responsable actual: <b>${esc(d.impulsador_nombre || 'ninguno')}</b>. En puntos ${esc(label(t))} corresponde un <b>${want || 'responsable'}</b>.</div>
      <div><label class="font-black block mb-1">Nuevo responsable *</label>
        <select id="ra-user" class="${inputCls}"><option value="">Seleccione...</option>${cand.map(x => `<option value="${x.id}">${esc(x.nombre)} — ${esc(x.rol || '')}${x.local ? ' · ' + esc(x.local) : ''}</option>`).join('')}</select>
        ${cand.length ? '' : '<div class="mt-1 text-amber-700">No hay candidatos disponibles con ese rol en la API.</div>'}</div>
      <div><label class="font-black block mb-1">Motivo del cambio *</label><textarea id="ra-mot" rows="3" class="${inputCls}" placeholder="Ej.: Rotación de personal, cobertura de vacaciones..."></textarea></div>
      <div id="ra-err" class="text-rose-600 font-bold hidden"></div>
      <div class="flex justify-end gap-2"><button data-close-modal class="${btnGhost}">Cancelar</button><button id="ra-ok" class="${btnPrimary}">Confirmar asignación</button></div></div>`);
  document.getElementById('ra-ok').onclick = async () => {
    const u = document.getElementById('ra-user').value, m = document.getElementById('ra-mot').value.trim(), err = document.getElementById('ra-err');
    if (!u || !m) { err.textContent = 'Seleccione un responsable e indique el motivo.'; err.classList.remove('hidden'); return; }
    const btn = document.getElementById('ra-ok'); btn.disabled = true;
    try { await S.reasignar(+u, +p.id, m); toast('Responsable asignado. Se cerró la asignación anterior y se abrió la nueva.'); closeModal(); await load(); }
    catch (e) { err.textContent = e.message; err.classList.remove('hidden'); btn.disabled = false; }
  };
}
