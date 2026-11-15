import { S } from '../data.js';
import { api } from '../api.js';
import { esc, pick, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, badge, label, fmtDateTime, resolveImg,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast, debounce, hydrateImages } from '../ui.js';

let root, items = [], path = '', unavailable = false, busy = false;
const f = { q: '', tipo: '', sev: '', estado: '' };
const TIPOS = ['PDV_CERRADO', 'PRODUCTO_DANADO_VENCIDO', 'EXHIBICION_INCORRECTA', 'ACTIVIDAD_COMPETENCIA', 'ACCESO_SEGURIDAD', 'PROBLEMA_PERSONAL', 'OTRO'];
const ESTADOS = ['ABIERTO', 'EN_PROCESO', 'RESUELTO'];

const norm = (r) => ({ raw: r, id: pick(r, 'idIncidencias', 'idIncidencia', 'id'), tipo: String(pick(r, 'tipo') || 'OTRO').toUpperCase(), sev: String(pick(r, 'severidad') || '').toUpperCase(),
  desc: pick(r, 'descripcion') || '', estado: String(pick(r, 'estado') || 'ABIERTO').toUpperCase().replace(/ /g, '_'), local: pick(r, 'local_nombre', 'puntoVenta', 'pdv', 'punto_venta') || '—',
  usuario: pick(r, 'usuario', 'reportado_por', 'impulsador_nombre', 'nombre') || '', fecha: pick(r, 'fecha', 'fecha_hora', 'created_at'), foto: pick(r, 'foto', 'url_foto', 'ruta_foto', 'evidencia'), hash: pick(r, 'hash', 'hash_sha256') });

export async function render(container) {
  root = container; Object.assign(f, { q: '', tipo: '', sev: '', estado: '' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy && !unavailable) await load(); }
export function destroy() { root = null; }

async function load() {
  busy = true;
  try {
    const r = await S.probe(['supervision/incidencias', 'incidencias']);
    path = r.path; items = r.items.map(norm); unavailable = false;
    frame(); draw();
  } catch (e) {
    if (!root) return;
    if (e.unavailable) { unavailable = true; notice(); }
    else { root.innerHTML = errorHTML(e.message, 'btn-retry'); root.querySelector('#btn-retry').onclick = () => render(root); }
  } finally { busy = false; }
}

function notice() {
  root.innerHTML = pageHeader('Incidencias en Campo', 'Seguimiento de incidencias reportadas por los impulsadores.', `<button id="in-retry" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Reintentar</button>`) +
    card(`<div class="p-8 text-center max-w-xl mx-auto"><div class="w-14 h-14 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl mb-3"><i class="fa-solid fa-plug-circle-exclamation"></i></div>
      <h3 class="text-sm font-black mb-1">La API aún no expone el listado de incidencias</h3>
      <p class="text-xs text-stone-600 mb-3">Se probaron <code>GET /supervision/incidencias</code> y <code>GET /incidencias</code> y ninguno existe en el backend desplegado. Hoy la API solo permite <i>registrar</i> incidencias (<code>POST /impulsador/incidencias</code>) desde la app del impulsador.</p>
      <p class="text-xs text-stone-600">En cuanto el backend publique el endpoint de consulta, esta pantalla lo detecta sola (filtros por PDV, tipo, severidad, evidencia y cambio de estado con comentario), sin cambios en el panel.</p></div>`);
  root.querySelector('#in-retry').onclick = () => render(root);
}

function frame() {
  if (root.querySelector('#in-body')) return;
  root.innerHTML = `${pageHeader('Incidencias en Campo', 'Consulte incidencias por punto de venta, tipo y severidad; cambie su estado y deje comentarios de seguimiento.', `<button id="in-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
    <div id="in-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3">
      <input id="in-q" class="${inputCls} !w-52" placeholder="Buscar PDV o descripción...">
      <select id="in-tipo" class="${inputCls} !w-48"><option value="">Todos los tipos</option>${TIPOS.map(t => `<option value="${t}">${label(t)}</option>`).join('')}</select>
      <select id="in-sev" class="${inputCls} !w-36"><option value="">Toda severidad</option><option>ALTA</option><option>MEDIA</option><option>BAJA</option></select>
      <select id="in-est" class="${inputCls} !w-40"><option value="">Todos los estados</option>${ESTADOS.map(t => `<option value="${t}">${label(t)}</option>`).join('')}</select>
    </div><div id="in-body"></div>`;
  root.querySelector('#in-refresh').onclick = () => load();
  root.querySelector('#in-q').oninput = debounce(e => { f.q = e.target.value.toLowerCase(); draw(); });
  root.querySelector('#in-tipo').onchange = e => { f.tipo = e.target.value; draw(); };
  root.querySelector('#in-sev').onchange = e => { f.sev = e.target.value; draw(); };
  root.querySelector('#in-est').onchange = e => { f.estado = e.target.value; draw(); };
}

function draw() {
  const c = (fn) => items.filter(fn).length;
  root.querySelector('#in-kpis').innerHTML = kpi('Total', items.length, 'fa-triangle-exclamation', 'text-brand-gold') + kpi('Abiertas', c(i => i.estado === 'ABIERTO'), 'fa-folder-open', 'text-rose-600') +
    kpi('En proceso', c(i => i.estado === 'EN_PROCESO'), 'fa-spinner', 'text-amber-600') + kpi('Resueltas', c(i => i.estado === 'RESUELTO'), 'fa-circle-check', 'text-emerald-600');
  const rows = items.filter(i => (!f.q || (i.local + i.desc).toLowerCase().includes(f.q)) && (!f.tipo || i.tipo === f.tipo) && (!f.sev || i.sev === f.sev) && (!f.estado || i.estado === f.estado));
  const body = root.querySelector('#in-body');
  if (!rows.length) { body.innerHTML = card(emptyHTML('No hay incidencias con esos filtros.', 'fa-clipboard-check')); return; }
  body.innerHTML = card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr><th class="p-3 text-left">Tipo</th><th class="p-3 text-left">Punto de venta</th><th class="p-3 text-left">Severidad</th><th class="p-3 text-left">Estado</th><th class="p-3 text-left">Fecha</th><th></th></tr></thead>
    <tbody class="divide-y divide-stone-100">${rows.map((r, i) => `<tr class="hover:bg-brand-ivory/50"><td class="p-3 font-bold">${esc(label(r.tipo))}</td><td class="p-3">${esc(r.local)}</td><td class="p-3">${estadoBadge(r.sev || '—')}</td><td class="p-3">${estadoBadge(r.estado)}</td><td class="p-3">${fmtDateTime(r.fecha)}</td>
      <td class="p-3 text-right"><button data-i="${i}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">Gestionar</button></td></tr>`).join('')}</tbody></table></div>`);
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => manage(rows[+b.dataset.i]));
}

function manage(r) {
  openModal(modalHeader(esc(label(r.tipo)), `${esc(r.local)} · ${esc(r.usuario)}`) + `
    <div class="p-5 space-y-3 text-xs">
      <div class="flex gap-2">${estadoBadge(r.sev || '—')} ${estadoBadge(r.estado)}</div>
      <div class="p-3 rounded-xl bg-stone-50">${esc(r.desc || 'Sin descripción')}</div>
      ${r.foto ? `<div data-img-wrap><img data-src="${esc(r.foto)}" class="w-full max-h-64 object-contain rounded-xl border border-stone-200" alt="Evidencia"><div data-img-fallback class="hidden p-4 text-center text-stone-400 bg-stone-50 rounded-xl">Evidencia no disponible</div></div>${r.hash ? `<div class="p-2 rounded-lg bg-stone-900 text-emerald-300 font-mono text-[10px] break-all">SHA-256: ${esc(r.hash)}</div>` : ''}` : ''}
      <div class="grid grid-cols-2 gap-3"><div><label class="font-black block mb-1">Nuevo estado</label><select id="in-new" class="${inputCls}">${ESTADOS.map(e => `<option value="${e}" ${e === r.estado ? 'selected' : ''}>${label(e)}</option>`).join('')}</select></div></div>
      <div><label class="font-black block mb-1">Comentario *</label><textarea id="in-com" rows="3" class="${inputCls}"></textarea></div>
      <div id="in-err" class="text-rose-600 font-bold hidden"></div>
      <div class="flex justify-end gap-2"><button data-close-modal class="${btnGhost}">Cancelar</button><button id="in-save" class="${btnPrimary}">Guardar</button></div></div>`);
  document.getElementById('in-save').onclick = async () => {
    const com = document.getElementById('in-com').value.trim(), err = document.getElementById('in-err');
    if (!com) { err.textContent = 'Agregue un comentario.'; err.classList.remove('hidden'); return; }
    try { await api.put(`${path.replace(/^supervision\//, '')}/${r.id}/estado`, { estado: document.getElementById('in-new').value, comentario: com }); toast('Incidencia actualizada'); closeModal(); await load(); }
    catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
  };
}
