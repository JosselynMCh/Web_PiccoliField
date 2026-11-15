import { S, settle } from '../data.js';
import { CONFIG } from '../config.js';
import { esc, kpi, card, pageHeader, loadingHTML, errorHTML, label, validCoord, mapsLink, distanceKm, btnGhost, fmtTime } from '../ui.js';

let root, map, busy = false, ctl;

export async function render(container) {
  root = container; root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) await load(true); }
export function destroy() { map?.remove(); map = null; root = null; }

const PCOL = { NUEVO: '#38bdf8', CONTACTADO: '#6366f1', NEGOCIACION: '#f59e0b', CONVERTIDO: '#10b981', RECHAZADO: '#a8a29e' };

async function load(keepView) {
  busy = true;
  const { data, errors } = await settle({ pdv: () => S.puntosVenta(), pro: () => S.prospectos(), al: S.alertas, asis: S.asistRecientes });
  busy = false;
  if (!root) return;
  if (!data.pdv && !data.pro) { root.innerHTML = errorHTML((errors.pdv || errors.pro)?.message || 'Error', 'btn-retry'); root.querySelector('#btn-retry').onclick = () => render(root); return; }
  draw(data, keepView);
}

/** Cobertura por zona: % de prospectos a menos de COVERAGE_RADIUS_KM de algún PDV activo */
function coverage(pdv, pro) {
  const R = CONFIG.COVERAGE_RADIUS_KM;
  const act = pdv.filter(p => validCoord(p.lat, p.lng));
  const zones = {};
  pro.filter(p => validCoord(p.lat, p.lng)).forEach(p => { (zones[p.zona] ||= []).push(p); });
  return Object.entries(zones).map(([zona, ps]) => {
    const lat = ps.reduce((s, p) => s + +p.lat, 0) / ps.length, lng = ps.reduce((s, p) => s + +p.lng, 0) / ps.length;
    const cubiertos = ps.filter(p => act.some(d => distanceKm(+p.lat, +p.lng, +d.lat, +d.lng) <= R)).length;
    const radio = Math.max(500, Math.max(...ps.map(p => distanceKm(lat, lng, +p.lat, +p.lng))) * 1000 + 300);
    return { zona, lat, lng, total: ps.length, cubiertos, pct: Math.round((cubiertos / ps.length) * 100), radio };
  }).sort((a, b) => a.pct - b.pct);
}

function draw(d, keepView) {
  const pdv = d.pdv || [], pro = d.pro || [], al = d.al || [], asis = d.asis || [];
  const view = keepView && map ? { c: map.getCenter(), z: map.getZoom() } : null;
  const zonas = coverage(pdv, pro);
  const sinPres = zonas.filter(z => z.pct < 100);
  if (!root.querySelector('#mp-map')) {
    root.innerHTML = `${pageHeader('Mapa General', 'PDV por tipo y estado, prospectos por etapa, marcaciones de asistencia y zonas sin presencia (análisis de cobertura calculado con datos reales).', `<button id="mp-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
      <div id="mp-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
      <div class="grid lg:grid-cols-4 gap-4"><div class="lg:col-span-3 bg-white rounded-2xl border border-stone-200 overflow-hidden"><div id="mp-map" class="h-[380px] sm:h-[600px]"></div></div>
      <div id="mp-side" class="bg-white rounded-2xl border border-stone-200 p-4 max-h-[600px] overflow-y-auto"></div></div>`;
    root.querySelector('#mp-refresh').onclick = () => load(true);
  }
  root.querySelector('#mp-kpis').innerHTML = kpi('PDV en mapa', pdv.filter(p => validCoord(p.lat, p.lng)).length, 'fa-store', 'text-brand-gold', `${pdv.length} totales`) +
    kpi('Prospectos en mapa', pro.filter(p => validCoord(p.lat, p.lng)).length, 'fa-shop', 'text-sky-600', `${pro.length} totales`) +
    kpi('PDV con alerta de stock', pdv.filter(p => al.some(a => a.estado === 'PENDIENTE' && ((a.idPdv && String(a.idPdv) === String(p.id)) || a.local === p.nombre))).length, 'fa-triangle-exclamation', 'text-rose-600') +
    kpi('Zonas sin cobertura total', sinPres.length, 'fa-radar', 'text-amber-600', `Radio de cobertura: ${CONFIG.COVERAGE_RADIUS_KM} km`);
  root.querySelector('#mp-side').innerHTML = `<h3 class="text-xs font-black mb-1">Zonas con prospectos sin presencia</h3><p class="text-[11px] text-stone-500 mb-3">% de prospectos de la zona a ≤ ${CONFIG.COVERAGE_RADIUS_KM} km de un PDV.</p>` +
    (zonas.length ? zonas.map(z => `<button data-z="${z.lat},${z.lng}" class="w-full text-left mb-2 p-2.5 rounded-xl border ${z.pct < 50 ? 'border-rose-200 bg-rose-50' : z.pct < 100 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}">
      <div class="flex justify-between text-xs font-bold"><span class="truncate">${esc(z.zona)}</span><span>${z.pct}%</span></div><div class="text-[11px] text-stone-600">${z.cubiertos}/${z.total} prospectos cubiertos</div></button>`).join('') : '<div class="text-xs text-stone-400">Sin prospectos georreferenciados para calcular cobertura.</div>') +
    `<h3 class="text-xs font-black mt-4 mb-2">Leyenda</h3><div class="text-[11px] space-y-1 text-stone-600"><div>🟤 PDV venta activo · 🔵 PDV distribución activo</div><div>🔴 PDV con alerta de stock · ⚪ inactivo/clausurado</div><div>Prospectos: celeste nuevo · índigo contactado · ámbar negociación · verde convertido · gris rechazado</div></div>`;

  map?.remove();
  map = L.map('mp-map').setView(view?.c || CONFIG.MAP_DEFAULT_CENTER, view?.z || CONFIG.MAP_DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = [];

  const gPdv = L.markerClusterGroup(), gPro = L.markerClusterGroup(), gAsis = L.markerClusterGroup(), gZon = L.layerGroup(), gGeo = L.layerGroup();
  pdv.filter(p => validCoord(p.lat, p.lng)).forEach(p => {
    const nal = al.filter(a => a.estado === 'PENDIENTE' && ((a.idPdv && String(a.idPdv) === String(p.id)) || a.local === p.nombre)).length;
    const dist = p.tipo.startsWith('DIST');
    const col = nal ? '#f43f5e' : p.estado === 'ACTIVO' ? (dist ? '#0ea5e9' : '#4A2B1C') : '#a8a29e';
    L.marker([+p.lat, +p.lng], { icon: L.divIcon({ className: '', iconSize: [28, 28], html: `<div style="background:${col}" class="w-7 h-7 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[11px]"><i class="fa-solid ${dist ? 'fa-truck' : 'fa-store'}"></i></div>` }) })
      .bindPopup(`<b>${esc(p.nombre)}</b><br>${esc(p.direccion)}<br>${label(p.tipo) || 'PDV'} · ${label(p.estado)}${p.responsable ? `<br>Responsable: ${esc(p.responsable)}` : ''}${nal ? `<br><b style="color:#e11d48">${nal} alerta(s) de stock</b>` : ''}<br><a target="_blank" href="${mapsLink(p.lat, p.lng)}">Cómo llegar</a> · <a href="#pdv">Ver PDV</a>`).addTo(gPdv);
    if (p.radio) L.circle([+p.lat, +p.lng], { radius: p.radio, color: col, weight: 1, fillOpacity: .07 }).bindPopup(`Geocerca de ${esc(p.nombre)}: ${p.radio} m`).addTo(gGeo);
    pts.push([+p.lat, +p.lng]);
  });
  pro.filter(p => validCoord(p.lat, p.lng)).forEach(p => {
    const col = PCOL[p.estado] || '#78716c';
    L.marker([+p.lat, +p.lng], { icon: L.divIcon({ className: '', iconSize: [22, 22], html: `<div style="background:${col}" class="w-5 h-5 rotate-45 rounded-sm border-2 border-white shadow"></div>` }) })
      .bindPopup(`<b>${esc(p.nombre)}</b><br>${esc(p.direccion)}<br>${label(p.estado)} · ${esc(p.tipo || '')}<br>Promotor: ${esc(p.promotor || 'Sin asignar')}<br><a target="_blank" href="${mapsLink(p.lat, p.lng)}">Cómo llegar</a> · <a href="#prospectos">Ver pipeline</a>`).addTo(gPro);
    pts.push([+p.lat, +p.lng]);
  });
  asis.filter(a => validCoord(a.lat, a.lng)).forEach(a => {
    const col = a.estado === 'A_TIEMPO' ? '#10b981' : a.estado === 'TARDANZA' ? '#f59e0b' : '#f43f5e';
    L.circleMarker([+a.lat, +a.lng], { radius: 7, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }).bindPopup(`<b>${esc(a.nombre)}</b><br>${esc(a.sede)}<br>${label(a.estado)} · ${fmtTime(a.fecha)}`).addTo(gAsis);
  });
  zonas.filter(z => z.pct < 100).forEach(z => L.circle([z.lat, z.lng], { radius: z.radio, color: '#e11d48', dashArray: '6 6', weight: 2, fillColor: '#f43f5e', fillOpacity: .12 })
    .bindPopup(`<b>${esc(z.zona)}</b><br>Cobertura: <b>${z.pct}%</b> (${z.cubiertos}/${z.total} prospectos)<br>${z.pct === 0 ? 'Zona sin presencia de PDV' : 'Cobertura parcial'}`).addTo(gZon));

  [gPdv, gPro, gGeo, gZon].forEach(g => g.addTo(map));
  ctl = L.control.layers(null, { 'Puntos de venta': gPdv, 'Prospectos': gPro, 'Sedes / geocercas': gGeo, 'Marcaciones de asistencia': gAsis, 'Zonas sin presencia': gZon }, { collapsed: window.innerWidth < 640 }).addTo(map);
  if (!view && pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  root.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const [la, ln] = b.dataset.z.split(',').map(Number); map.setView([la, ln], 14); });
  setTimeout(() => map?.invalidateSize(), 150);
}
