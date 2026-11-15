import { S } from '../data.js';
import { esc, pick, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, label, fmtDateTime, avatar,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast, debounce } from '../ui.js';

let root, items = [], tiposCat = [], busy = false;
const f = { q: '', tipo: '', sev: '', estado: '' };
const DEFAULT_TIPOS = ['PRODUCTO_DANADO', 'PDV_CERRADO', 'PRODUCTO_DANADO_VENCIDO', 'EXHIBICION_INCORRECTA', 'ACTIVIDAD_COMPETENCIA', 'ACCESO_SEGURIDAD', 'PROBLEMA_PERSONAL', 'OTRO'];
const ESTADOS = ['ABIERTO', 'EN_PROCESO', 'RESUELTO'];

export async function render(container) {
  root = container; Object.assign(f, { q: '', tipo: '', sev: '', estado: '' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) await load(); }
export function destroy() { root = null; }

async function load() {
  busy = true;
  try {
    const [inc, tps] = await Promise.all([S.incidencias(), S.tiposIncidencia()]);
    items = inc || [];
    const fromApi = (tps || []).map(x => typeof x === 'string' ? x.toUpperCase() : String(pick(x, 'codigo', 'tipo', 'nombre') || '').toUpperCase()).filter(Boolean);
    tiposCat = [...new Set([...fromApi, ...items.map(i => i.tipo).filter(Boolean), ...DEFAULT_TIPOS])];
    frame(); draw();
  } catch (e) {
    if (!root) return;
    root.innerHTML = errorHTML(e.message, 'btn-retry');
    root.querySelector('#btn-retry')?.addEventListener('click', () => render(root));
  } finally { busy = false; }
}

function frame() {
  if (root.querySelector('#in-body')) return;
  root.innerHTML = `${pageHeader('Incidencias en Campo', 'Consulte incidencias reportadas por punto de venta, tipo y severidad; atienda o resuelva dejando comentarios de seguimiento.', `<button id="in-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
    <div id="in-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3">
      <input id="in-q" class="${inputCls} sm:w-52" placeholder="Buscar PDV, usuario o descripción...">
      <select id="in-tipo" class="${inputCls} sm:w-48"><option value="">Todos los tipos</option>${tiposCat.map(t => `<option value="${esc(t)}">${esc(label(t))}</option>`).join('')}</select>
      <select id="in-sev" class="${inputCls} sm:w-36"><option value="">Toda severidad</option><option>ALTA</option><option>MEDIA</option><option>BAJA</option></select>
      <select id="in-est" class="${inputCls} sm:w-40"><option value="">Todos los estados</option>${ESTADOS.map(t => `<option value="${t}">${label(t)}</option>`).join('')}</select>
    </div><div id="in-body"></div>`;
  root.querySelector('#in-refresh').onclick = () => load();
  root.querySelector('#in-q').oninput = debounce(e => { f.q = e.target.value.toLowerCase(); draw(); });
  root.querySelector('#in-tipo').onchange = e => { f.tipo = e.target.value; draw(); };
  root.querySelector('#in-sev').onchange = e => { f.sev = e.target.value; draw(); };
  root.querySelector('#in-est').onchange = e => { f.estado = e.target.value; draw(); };
}

function draw() {
  const c = (fn) => items.filter(fn).length;
  root.querySelector('#in-kpis').innerHTML =
    kpi('Total incidencias', items.length, 'fa-triangle-exclamation', 'text-brand-gold') +
    kpi('Abiertas / Pendientes', c(i => ['ABIERTO', 'PENDIENTE'].includes(i.estado)), 'fa-folder-open', 'text-rose-600') +
    kpi('En proceso', c(i => i.estado === 'EN_PROCESO'), 'fa-spinner', 'text-amber-600') +
    kpi('Resueltas / Atendidas', c(i => ['RESUELTO', 'ATENDIDA', 'ATENDIDO'].includes(i.estado)), 'fa-circle-check', 'text-emerald-600');
  const rows = items.filter(i => (!f.q || (i.local + i.desc + i.usuario).toLowerCase().includes(f.q)) && (!f.tipo || i.tipo === f.tipo) && (!f.sev || i.sev === f.sev) && (!f.estado || i.estado === f.estado));
  const body = root.querySelector('#in-body');
  if (!rows.length) { body.innerHTML = card(emptyHTML('No hay incidencias registradas con esos filtros.', 'fa-clipboard-check')); return; }
  body.innerHTML = card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr><th class="p-3 text-left">Tipo</th><th class="p-3 text-left">Punto de venta</th><th class="p-3 text-left">Reportado por</th><th class="p-3 text-left">Severidad</th><th class="p-3 text-left">Estado</th><th class="p-3 text-left">Fecha</th><th></th></tr></thead>
    <tbody class="divide-y divide-stone-100">${rows.map((r, i) => `<tr class="hover:bg-brand-ivory/50"><td class="p-3 font-bold">${esc(label(r.tipo))}</td><td class="p-3">${esc(r.local)}</td><td class="p-3"><div class="flex items-center gap-2">${avatar(r.usuario || '?', { id: r.idUsuario, src: r.fotoUsuario, size: 'w-7 h-7 text-[10px]' })}<span>${esc(r.usuario || '—')}</span></div></td><td class="p-3">${estadoBadge(r.sev || '—')}</td><td class="p-3">${estadoBadge(r.estado)}</td><td class="p-3 whitespace-nowrap">${fmtDateTime(r.fecha)}</td>
      <td class="p-3 text-right"><button data-i="${i}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">Atender / Detalle</button></td></tr>`).join('')}</tbody></table></div>`);
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => manage(rows[+b.dataset.i]));
}

async function manage(r0) {
  openModal(modalHeader(esc(label(r0.tipo)), esc(r0.local)) + `<div class="p-5">${loadingHTML('Consultando detalle de incidencia...')}</div>`, true);
  let r = r0;
  try {
    const det = await S.incidenciaDetalle(r0.id);
    r = { ...r0, ...Object.fromEntries(Object.entries(det).filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'raw')) };
  } catch { /* usa datos de la lista */ }

  openModal(modalHeader(esc(label(r.tipo)), `${esc(r.local)} ${r.usuario ? '· ' + esc(r.usuario) : ''}`) + `
    <div class="p-5 space-y-3 text-xs">
      <div class="flex flex-wrap items-center gap-2">${estadoBadge(r.sev || '—')} ${estadoBadge(r.estado)} <span class="text-stone-400 ml-auto">${fmtDateTime(r.fecha)}</span></div>
      ${r.usuario ? `<div class="p-3 rounded-xl bg-brand-ivory border border-brand-gold/30 flex items-center gap-3">${avatar(r.usuario, { id: r.idUsuario, src: r.fotoUsuario, size: 'w-9 h-9' })}<div><div class="text-[10px] uppercase font-bold text-stone-500">Reportado por</div><b>${esc(r.usuario)}</b></div></div>` : ''}
      <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500 mb-1">Descripción</div>${esc(r.desc || 'Sin descripción')}</div>
      ${r.comentario ? `<div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900"><div class="text-[10px] uppercase font-bold mb-0.5">Respuesta / Seguimiento</div>${esc(r.comentario)} ${r.fechaAtencion ? `<div class="text-[10px] text-emerald-700 mt-1">${fmtDateTime(r.fechaAtencion)}</div>` : ''}</div>` : ''}
      ${r.foto ? `<div data-img-wrap><img data-src="${esc(r.foto)}" class="w-full max-h-64 object-contain rounded-xl border border-stone-200" alt="Evidencia"><div data-img-fallback class="hidden p-4 text-center text-stone-400 bg-stone-50 rounded-xl">Evidencia no disponible</div></div>${r.hash ? `<div class="p-2 rounded-lg bg-stone-900 text-emerald-300 font-mono text-[10px] break-all">SHA-256: ${esc(r.hash)}</div>` : ''}` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100">
        <div><label class="font-black block mb-1">Nuevo estado</label><select id="in-new" class="${inputCls}">${[...new Set(['RESUELTO', ...ESTADOS, r.estado])].map(e => `<option value="${e}" ${e === (r.estado === 'ABIERTO' ? 'RESUELTO' : r.estado) ? 'selected' : ''}>${label(e)}</option>`).join('')}</select></div>
      </div>
      <div><label class="font-black block mb-1">Comentario de atención *</label><textarea id="in-com" rows="3" class="${inputCls}" placeholder="Ej.: Se coordinó con logística y se enviaron botellas de reemplazo...">${esc(r.comentario || '')}</textarea></div>
      <div id="in-err" class="text-rose-600 font-bold hidden"></div>
      <div class="flex justify-end gap-2"><button data-close-modal class="${btnGhost}">Cancelar</button><button id="in-save" class="${btnPrimary}">Guardar atención</button></div>
    </div>`, true);

  document.getElementById('in-save').onclick = async () => {
    const com = document.getElementById('in-com').value.trim(), err = document.getElementById('in-err');
    const nuevoEstado = document.getElementById('in-new').value;
    if (!com) { err.textContent = 'Agregue un comentario de atención.'; err.classList.remove('hidden'); return; }
    const btn = document.getElementById('in-save'); btn.disabled = true;
    try {
      await S.atenderIncidencia(r.id, nuevoEstado, com);
      toast('Incidencia atendida correctamente');
      closeModal();
      await load();
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden'); btn.disabled = false;
    }
  };
}
