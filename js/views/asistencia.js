import { S, settle } from '../data.js';
import { CONFIG } from '../config.js';
import { esc, num, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, label, avatar, fmtDateTime, fmtTime, dateOnly,
  inputCls, btnGhost, btnPrimary, validCoord, mapsLink, openModal, modalHeader, badge, pct, debounce } from '../ui.js';

const MAX_ACC = 45;
let root, st, map, layer, busy = false;
const filt = { q: '', estado: '', sede: '', fecha: '', tab: 'vivo' };

export async function render(container) {
  root = container; Object.assign(filt, { q: '', estado: '', sede: '', fecha: '', tab: 'vivo' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) await load(true); }
export function destroy() { map?.remove(); map = null; root = null; }

async function load(silent) {
  busy = true;
  const { data, errors } = await settle({ resumen: S.asistResumen, recientes: S.asistRecientes, colab: S.asistColaboradores, pdv: () => S.puntosVenta() });
  busy = false;
  if (!root) return;
  if (!data.recientes && !data.colab) {
    root.innerHTML = errorHTML((errors.recientes || errors.colab)?.message || 'Error', 'btn-retry');
    root.querySelector('#btn-retry')?.addEventListener('click', () => render(root)); return;
  }
  st = data; frame(); draw();
}

function frame() {
  if (root.querySelector('#as-body')) return;
  root.innerHTML = `
    ${pageHeader('Asistencia en Vivo', 'Personal con estado (puntual, tardanza, falta), hora y ubicación de la marcación. Filtros por zona, fecha, estado y persona.',
      `<button id="as-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
    <div id="as-kpis" class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3 items-center">
      <div class="inline-flex bg-stone-100 rounded-xl p-1 text-xs font-bold" id="as-tabs">
        <button data-tab="vivo" class="px-3 py-1.5 rounded-lg">En vivo</button>
        <button data-tab="colab" class="px-3 py-1.5 rounded-lg">Colaboradores</button>
        <button data-tab="mapa" class="px-3 py-1.5 rounded-lg">Mapa</button>
      </div>
      <input id="f-q" class="${inputCls} !w-52" placeholder="Buscar persona...">
      <select id="f-estado" class="${inputCls} !w-40"><option value="">Todos los estados</option><option value="A_TIEMPO">Puntual</option><option value="TARDANZA">Tardanza</option><option value="FALTA">Falta</option></select>
      <select id="f-sede" class="${inputCls} !w-52"><option value="">Todas las zonas / sedes</option></select>
      <input id="f-fecha" type="date" class="${inputCls} !w-40">
      <button id="f-clear" class="${btnGhost}">Limpiar</button>
    </div>
    <div id="as-body"></div>`;
  root.querySelector('#as-refresh').onclick = () => load();
  root.querySelector('#as-tabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { filt.tab = b.dataset.tab; draw(); } };
  root.querySelector('#f-q').oninput = debounce((e) => { filt.q = e.target.value.toLowerCase(); draw(); });
  root.querySelector('#f-estado').onchange = (e) => { filt.estado = e.target.value; draw(); };
  root.querySelector('#f-sede').onchange = (e) => { filt.sede = e.target.value; draw(); };
  root.querySelector('#f-fecha').onchange = (e) => { filt.fecha = e.target.value; draw(); };
  root.querySelector('#f-clear').onclick = () => {
    Object.assign(filt, { q: '', estado: '', sede: '', fecha: '' });
    ['f-q', 'f-estado', 'f-sede', 'f-fecha'].forEach(i => root.querySelector('#' + i).value = ''); draw();
  };
}

function source() { return filt.tab === 'colab' ? (st.colab || st.recientes || []) : (st.recientes || st.colab || []); }

function filtered() {
  return source().filter(r =>
    (!filt.q || r.nombre.toLowerCase().includes(filt.q) || r.sede.toLowerCase().includes(filt.q)) &&
    (!filt.estado || r.estado === filt.estado) &&
    (!filt.sede || r.sede === filt.sede) &&
    (!filt.fecha || dateOnly(r.fecha) === filt.fecha));
}

function draw() {
  if (!root) return;
  root.querySelectorAll('#as-tabs button').forEach(b => {
    const on = b.dataset.tab === filt.tab;
    b.className = 'px-3 py-1.5 rounded-lg ' + (on ? 'bg-white shadow text-brand-chocolate' : 'text-stone-500');
  });
  const all = [...(st.colab || []), ...(st.recientes || [])];
  const sedes = [...new Set(all.map(r => r.sede).filter(s => s && s !== '—'))].sort();
  const sel = root.querySelector('#f-sede');
  if (sel.options.length - 1 !== sedes.length) sel.innerHTML = `<option value="">Todas las zonas / sedes</option>` + sedes.map(s => `<option ${filt.sede === s ? 'selected' : ''}>${esc(s)}</option>`).join('');

  const rows = filtered();
  const a = st.resumen || {};
  const base = st.recientes || [];
  const c = (e) => base.filter(x => x.estado === e).length;
  const aT = num(a.aTiempo ?? a.a_tiempo, c('A_TIEMPO')), tar = num(a.tardanzas, c('TARDANZA')), fal = num(a.faltas, c('FALTA'));
  const pres = num(a.presentes, aT + tar), tot = num(a.total, base.length);
  root.querySelector('#as-kpis').innerHTML =
    kpi('% Asistencia', num(a.porcentaje, pct(pres, tot)) + '%', 'fa-user-check', 'text-brand-gold', `${pres} presentes de ${tot}`) +
    kpi('Puntuales', aT, 'fa-circle-check', 'text-emerald-600') + kpi('Tardanzas', tar, 'fa-clock', 'text-amber-600') +
    kpi('Faltas', fal, 'fa-user-xmark', 'text-rose-600') + kpi('Observadas (GPS)', base.filter(observada).length, 'fa-location-crosshairs', 'text-rose-500', `Precisión > ${MAX_ACC} m`);

  const body = root.querySelector('#as-body');
  if (filt.tab === 'mapa') return drawMap(body, rows);
  map?.remove(); map = null;
  if (!rows.length) { body.innerHTML = card(emptyHTML('No hay marcaciones que coincidan con los filtros.', 'fa-user-clock')); return; }
  body.innerHTML = card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-stone-500 uppercase text-[10px]"><tr>
    <th class="p-3 text-left">Colaborador</th><th class="p-3 text-left">Sede / Punto</th><th class="p-3 text-left">Tipo</th><th class="p-3 text-left">Estado</th>
    <th class="p-3 text-left">Hora</th><th class="p-3 text-left">Tardanza</th><th class="p-3 text-left">Ubicación</th><th class="p-3"></th></tr></thead><tbody class="divide-y divide-stone-100">
    ${rows.map((r, i) => `<tr class="hover:bg-brand-ivory/50 ${observada(r) ? 'bg-rose-50/40' : ''}">
      <td class="p-3"><div class="flex items-center gap-2">${avatar(r.nombre, { src: r.foto })}<span class="font-bold">${esc(r.nombre)}</span></div></td>
      <td class="p-3">${esc(r.sede)}</td><td class="p-3">${r.tipo ? badge(r.tipo, r.tipo === 'INGRESO' ? 'info' : 'neutral') : '—'}</td>
      <td class="p-3">${estadoBadge(r.estado === 'A_TIEMPO' ? 'A TIEMPO' : r.estado)} ${r.justificacion ? badge('Justif.: ' + label(r.justificacion.estado), 'brand') : ''}</td>
      <td class="p-3 whitespace-nowrap">${fmtDateTime(r.fecha)}</td><td class="p-3">${r.minutos ? r.minutos + ' min' : '—'}</td>
      <td class="p-3">${validCoord(r.lat, r.lng) ? `<a target="_blank" class="text-sky-700 font-bold" href="${mapsLink(r.lat, r.lng)}"><i class="fa-solid fa-location-dot"></i> Ver</a>` : '—'}${observada(r) ? ' ' + badge('Observada', 'bad') : ''}</td>
      <td class="p-3 text-right"><button data-i="${i}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">Detalle</button></td></tr>`).join('')}
    </tbody></table></div>`);
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => detail(rows[+b.dataset.i]));
}

const observada = (r) => r.precision !== undefined && num(r.precision) > MAX_ACC;

function drawMap(body, rows) {
  const withGeo = rows.filter(r => validCoord(r.lat, r.lng));
  body.innerHTML = card(`<div class="p-3 text-[11px] text-stone-500">${withGeo.length} de ${rows.length} marcaciones con ubicación. Círculo = rango de asistencia (geocerca) de la sede.</div><div id="as-map" class="h-[520px] rounded-b-2xl"></div>`);
  map?.remove();
  map = L.map('as-map').setView(CONFIG.MAP_DEFAULT_CENTER, CONFIG.MAP_DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = [];
  (st.pdv || []).forEach(p => {
    if (!validCoord(p.lat, p.lng)) return;
    if (!rows.some(r => r.sede && p.nombre && (p.nombre.toLowerCase().includes(r.sede.toLowerCase()) || r.sede.toLowerCase().includes(p.nombre.toLowerCase())))) return;
    L.circle([p.lat, p.lng], { radius: p.radio || 100, color: '#10b981', fillOpacity: .12 }).bindPopup(`<b>Rango de asistencia</b><br>${esc(p.nombre)}<br>Radio: ${p.radio || 100} m`).addTo(map);
    pts.push([+p.lat, +p.lng]);
  });
  const cluster = L.markerClusterGroup();
  withGeo.forEach(r => {
    const col = r.estado === 'A_TIEMPO' ? '#10b981' : r.estado === 'TARDANZA' ? '#f59e0b' : '#f43f5e';
    const m = L.marker([+r.lat, +r.lng], { icon: L.divIcon({ className: '', iconSize: [26, 26], html: `<div style="background:${col}" class="w-6 h-6 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[10px] font-black">${esc(r.nombre[0])}</div>` }) });
    m.bindPopup(`<b>${esc(r.nombre)}</b><br>${esc(r.sede)}<br>${label(r.estado)} · ${fmtTime(r.fecha)}<br><a target="_blank" href="${mapsLink(r.lat, r.lng)}">Cómo llegar</a>`);
    cluster.addLayer(m); pts.push([+r.lat, +r.lng]);
  });
  map.addLayer(cluster);
  if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
  setTimeout(() => map?.invalidateSize(), 150);
}

async function detail(r) {
  openModal(modalHeader(esc(r.nombre), esc(r.sede)) + `<div class="p-5">${loadingHTML('Cargando historial de turnos...')}</div>`, true);
  let hist = [];
  try { hist = await S.asistHistorial(r.idUsuario); } catch (e) { /* se muestra vacío */ }
  const j = r.justificacion;
  openModal(modalHeader(esc(r.nombre), `${esc(r.sede)} · ${esc(label(r.estado))}`) + `
    <div class="p-5 space-y-4">
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Última marcación</div>${fmtDateTime(r.fecha)}</div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Hora del dispositivo</div>${fmtDateTime(r.fechaDisp)}</div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Tardanza</div>${r.minutos || 0} min</div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Ubicación</div>${validCoord(r.lat, r.lng) ? `<a class="text-sky-700 font-bold" target="_blank" href="${mapsLink(r.lat, r.lng)}">${(+r.lat).toFixed(5)}, ${(+r.lng).toFixed(5)}</a>` : 'Sin coordenadas'}</div>
      </div>
      ${j ? `<div class="p-3 rounded-xl border border-brand-gold/40 bg-brand-ivory text-xs"><b>Justificación (${label(j.estado)})</b><br>${esc(j.motivo || '')} ${esc(j.descripcion || '')}<br><a class="text-brand-caramel font-bold" href="#justificaciones" data-close-modal>Revisar en Justificaciones →</a></div>` : ''}
      <div><h4 class="text-xs font-black mb-2">Historial de turnos</h4>
      ${hist.length ? `<div class="max-h-60 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100 text-xs">${hist.map(h => `<div class="p-2.5 flex justify-between"><span>${badge(h.tipo || '—', h.tipo === 'INGRESO' ? 'info' : 'neutral')} <span class="text-stone-500">${esc(h.id_turno || '')}</span></span><span>${fmtDateTime(h.fecha_hora)}</span></div>`).join('')}</div>` : emptyHTML('Sin historial de turnos')}</div>
    </div>`, true);
}
