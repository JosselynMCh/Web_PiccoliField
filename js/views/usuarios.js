import { S, settle } from '../data.js';
import { esc, num, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, badge, label, avatar, progressBar, pick, fmtDateTime, dateOnly,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast, debounce } from '../ui.js';

let root, people = [], pdvs = [], busy = false;
const f = { q: '', rol: '' };

export async function render(container) {
  root = container; Object.assign(f, { q: '', rol: '' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) await load(); }
export function destroy() { root = null; }

async function load() {
  busy = true;
  const { data, errors } = await settle({ imp: S.impulsadores, col: S.asistColaboradores, vend: S.vendedores, pdv: () => S.puntosVenta() });
  busy = false;
  if (!root) return;
  if (!data.imp && !data.col) { root.innerHTML = errorHTML((errors.imp || errors.col)?.message || 'Error', 'btn-retry'); root.querySelector('#btn-retry').onclick = () => render(root); return; }
  const map = new Map();
  (data.imp || []).forEach(p => map.set(String(p.id), { ...p }));
  (data.col || []).forEach(c => {
    const k = String(c.idUsuario), cur = map.get(k) || { id: c.idUsuario, nombre: c.nombre, rol: (c.rol || '').toUpperCase(), correo: '', meta: 0, local: c.sede, foto: c.foto };
    cur.asist = c; if (!cur.local || cur.local === '—') cur.local = c.sede; map.set(k, cur);
  });
  (data.vend || []).forEach(v => { const p = map.get(String(v.id)); if (p) { p.vendido = v.vendido; p.meta = p.meta || v.meta; } });
  people = [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  pdvs = data.pdv || [];
  frame(); draw();
}

function frame() {
  if (root.querySelector('#us-body')) return;
  root.innerHTML = `${pageHeader('Personal y Dispositivos', 'Directorio del personal de campo con rol, sede, meta mensual, rendimiento y estado de asistencia. Reasigne a un punto de venta desde la ficha.', `<button id="us-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
    <div id="us-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3"><input id="us-q" class="${inputCls} sm:w-60" placeholder="Buscar por nombre, correo o sede..."><select id="us-rol" class="${inputCls} sm:w-44"><option value="">Todos los roles</option><option>ADMINISTRADOR</option><option>PROMOTOR</option><option>IMPULSADOR</option><option>TRABAJADOR</option></select></div>
    <div id="us-body"></div>
    <div class="mt-4 p-3 rounded-xl bg-stone-100 text-[11px] text-stone-600"><i class="fa-solid fa-circle-info mr-1"></i> La API actual no expone altas/ediciones de usuarios ni aprobación de dispositivos (solo el propio usuario actualiza su dispositivo con <code>PUT /dispositivo</code>). Este directorio se construye con <code>/supervision/impulsadores</code>, <code>/asistencias/colaboradores</code> y <code>/supervision/vendedores</code>.</div>`;
  root.querySelector('#us-refresh').onclick = () => load();
  root.querySelector('#us-q').oninput = debounce(e => { f.q = e.target.value.toLowerCase(); draw(); });
  root.querySelector('#us-rol').onchange = e => { f.rol = e.target.value; draw(); };
}

function draw() {
  const c = (r) => people.filter(p => p.rol === r).length;
  root.querySelector('#us-kpis').innerHTML = kpi('Personal total', people.length, 'fa-users', 'text-brand-gold') + kpi('Impulsadores', c('IMPULSADOR'), 'fa-person-booth', 'text-sky-600') + kpi('Promotores', c('PROMOTOR'), 'fa-truck-fast', 'text-amber-600') + kpi('Sin asignación de PDV', people.filter(p => p.rol === 'IMPULSADOR' && !p.idPdv && !p.local).length, 'fa-link-slash', 'text-rose-600');
  const rows = people.filter(p => (!f.q || (p.nombre + p.correo + (p.local || '')).toLowerCase().includes(f.q)) && (!f.rol || p.rol === f.rol));
  const body = root.querySelector('#us-body');
  if (!rows.length) { body.innerHTML = card(emptyHTML('No se encontró personal con esos filtros.', 'fa-users-slash')); return; }
  body.innerHTML = card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr><th class="p-3 text-left">Colaborador</th><th class="p-3 text-left">Rol</th><th class="p-3 text-left">Sede / PDV</th><th class="p-3 w-44 text-left">Meta mensual</th><th class="p-3 text-left">Asistencia</th><th></th></tr></thead>
    <tbody class="divide-y divide-stone-100">${rows.map((p, i) => `<tr class="hover:bg-brand-ivory/50"><td class="p-3"><div class="flex items-center gap-2">${avatar(p.nombre, { auth: p.id ? `supervision/impulsadores/${p.id}/foto` : '', src: p.foto })}<div><b>${esc(p.nombre)}</b><div class="text-stone-500">${esc(p.correo)}</div></div></div></td>
      <td class="p-3">${badge(p.rol || '—', p.rol === 'ADMINISTRADOR' ? 'brand' : p.rol === 'PROMOTOR' ? 'warn' : 'info')}</td><td class="p-3">${esc(p.local || '—')}</td>
      <td class="p-3">${p.meta ? progressBar(num(p.vendido), p.meta) : '<span class="text-stone-400">—</span>'}</td><td class="p-3">${p.asist ? estadoBadge(p.asist.estado === 'A_TIEMPO' ? 'A TIEMPO' : p.asist.estado) : '<span class="text-stone-400">—</span>'}</td>
      <td class="p-3 text-right"><button data-i="${i}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">Ficha</button></td></tr>`).join('')}</tbody></table></div>`);
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => ficha(rows[+b.dataset.i]));
}

async function ficha(p) {
  openModal(modalHeader(esc(p.nombre), esc(p.rol)) + `<div class="p-5">${loadingHTML('Cargando ficha...')}</div>`, true);
  const { data } = await settle({ det: () => (p.rol === 'IMPULSADOR' ? S.vendedorDetalle(p.id) : Promise.resolve({})), hist: () => S.asistHistorial(p.id) });
  const d = data.det || {}, hist = data.hist || [];
  openModal(modalHeader(esc(p.nombre), `${esc(p.rol)} · ${esc(p.correo)}`) + `
    <div class="p-5 space-y-4 text-xs">
      <div class="flex items-center gap-3">${avatar(p.nombre, { auth: p.id ? `supervision/impulsadores/${p.id}/foto` : '', size: 'w-14 h-14' })}<div><div class="text-sm font-black">${esc(p.nombre)}</div><div class="text-stone-500">${esc(p.local || 'Sin sede asignada')}</div></div></div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3"><div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Meta</div><div class="text-lg font-black">${p.meta || '—'}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Vendido</div><div class="text-lg font-black">${num(pick(d, 'cantidadVendida', 'monto_vendido'), num(p.vendido))}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Logro</div><div class="text-lg font-black">${d.porcentaje_logro != null ? Math.round(d.porcentaje_logro) + '%' : '—'}</div></div></div>
      <div><h4 class="font-black mb-2">Últimos turnos</h4>${hist.length ? `<div class="max-h-44 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100">${hist.slice(0, 30).map(h => `<div class="p-2.5 flex justify-between">${badge(h.tipo || '—', h.tipo === 'INGRESO' ? 'info' : 'neutral')}<span>${fmtDateTime(h.fecha_hora)}</span></div>`).join('')}</div>` : emptyHTML('Sin marcaciones registradas')}</div>
      ${p.rol === 'IMPULSADOR' ? `<div class="p-3 rounded-xl bg-brand-ivory border border-brand-gold/30"><h4 class="font-black mb-2">Reasignar a un punto de venta</h4>
        <div class="flex flex-wrap gap-2"><select id="fu-pdv" class="${inputCls} flex-1"><option value="">Seleccione PDV...</option>${pdvs.filter(x => !x.tipo.startsWith('DIST')).map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select>
        <input id="fu-mot" class="${inputCls} flex-1" placeholder="Motivo del cambio"><button id="fu-ok" class="${btnPrimary}">Reasignar</button></div><div id="fu-err" class="text-rose-600 font-bold mt-1 hidden"></div></div>` : ''}
    </div>`, true);
  document.getElementById('fu-ok')?.addEventListener('click', async () => {
    const pdv = document.getElementById('fu-pdv').value, mot = document.getElementById('fu-mot').value.trim(), err = document.getElementById('fu-err');
    if (!pdv || !mot) { err.textContent = 'Seleccione el PDV e indique el motivo.'; err.classList.remove('hidden'); return; }
    try { await S.reasignar(+p.id, +pdv, mot); toast('Impulsador reasignado'); closeModal(); await load(); } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
  });
}
