import { S, settle } from '../data.js';
import { esc, num, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, badge, label, avatar, fmtDateTime, resolveImg, validCoord, mapsLink,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast, debounce, dateOnly } from '../ui.js';

let root, items = [], personas = [], busy = false, view = 'kanban';
const f = { q: '', estado: '', zona: '', tipo: '' };
const ESTADOS = ['NUEVO', 'CONTACTADO', 'NEGOCIACION', 'CONVERTIDO', 'RECHAZADO'];
const COLS = { NUEVO: 'border-sky-400', CONTACTADO: 'border-indigo-400', NEGOCIACION: 'border-amber-400', CONVERTIDO: 'border-emerald-500', RECHAZADO: 'border-rose-400' };

export async function render(container) {
  root = container; view = 'kanban'; Object.assign(f, { q: '', estado: '', zona: '', tipo: '' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) await load(); }
export function destroy() { root = null; }

async function load() {
  busy = true;
  const { data, errors } = await settle({ p: () => S.prospectos(), per: S.impulsadores });
  busy = false;
  if (!root) return;
  if (!data.p) { root.innerHTML = errorHTML(errors.p?.message || 'Error', 'btn-retry'); root.querySelector('#btn-retry').onclick = () => render(root); return; }
  items = data.p; personas = data.per || [];
  frame(); draw();
}

function frame() {
  if (root.querySelector('#pr-body')) return;
  root.innerHTML = `${pageHeader('Prospectos y Oportunidades', 'Pipeline Nuevo → Negociación → Convertido / Rechazado. Asigne promotores, registre seguimientos y vea la foto de fachada.',
    `<button id="pr-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
    <div id="pr-kpis" class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3 items-center">
      <div class="inline-flex bg-stone-100 rounded-xl p-1 text-xs font-bold" id="pr-tabs"><button data-v="kanban" class="px-3 py-1.5 rounded-lg">Pipeline</button><button data-v="lista" class="px-3 py-1.5 rounded-lg">Lista</button></div>
      <input id="pr-q" class="${inputCls} !w-52" placeholder="Buscar nombre o dirección...">
      <select id="pr-estado" class="${inputCls} !w-40"><option value="">Todos los estados</option>${ESTADOS.map(e => `<option value="${e}">${label(e)}</option>`).join('')}</select>
      <select id="pr-zona" class="${inputCls} !w-44"><option value="">Todas las zonas</option></select>
      <select id="pr-tipo" class="${inputCls} !w-40"><option value="">Todos los tipos</option></select></div><div id="pr-body"></div>`;
  root.querySelector('#pr-refresh').onclick = () => load();
  root.querySelector('#pr-tabs').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; draw(); } };
  root.querySelector('#pr-q').oninput = debounce(e => { f.q = e.target.value.toLowerCase(); draw(); });
  ['estado', 'zona', 'tipo'].forEach(k => root.querySelector('#pr-' + k).onchange = e => { f[k] = e.target.value; draw(); });
}

function fillSelect(id, values, cur, all) {
  const el = root.querySelector(id);
  if (el.options.length - 1 === values.length) return;
  el.innerHTML = `<option value="">${all}</option>` + values.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function draw() {
  root.querySelectorAll('#pr-tabs button').forEach(b => b.className = 'px-3 py-1.5 rounded-lg ' + (b.dataset.v === view ? 'bg-white shadow text-brand-chocolate' : 'text-stone-500'));
  fillSelect('#pr-zona', [...new Set(items.map(p => p.zona))].sort(), f.zona, 'Todas las zonas');
  fillSelect('#pr-tipo', [...new Set(items.map(p => p.tipo).filter(Boolean))].sort(), f.tipo, 'Todos los tipos');
  const c = (e) => items.filter(p => p.estado === e).length;
  const conv = items.length ? Math.round((c('CONVERTIDO') / items.length) * 100) : 0;
  const dias = items.map(p => p.fecha ? (Date.now() - new Date(String(p.fecha).replace(' ', 'T'))) / 864e5 : NaN).filter(Number.isFinite);
  const prom = dias.length ? (dias.reduce((a, b) => a + b, 0) / dias.length).toFixed(1) + ' d' : '—';
  const fromPdvBanner = items.some(p => p._fromPdv)
    ? `<div class="col-span-2 lg:col-span-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs"><i class="fa-solid fa-circle-info mr-1"></i> El servidor en Render aún no expone la ruta <code>/api/prospectos</code> (HTTP 404). Mostrando los locales de <b>DISTRIBUCIÓN</b> convertidos y asignados a Promotores desde <code>/api/puntos-venta</code>.</div>`
    : '';
  root.querySelector('#pr-kpis').innerHTML = fromPdvBanner + kpi('Total prospectos', items.length, 'fa-shop', 'text-brand-gold') + kpi('Nuevos', c('NUEVO'), 'fa-sparkles', 'text-sky-600') +
    kpi('En negociación', c('NEGOCIACION') + c('CONTACTADO'), 'fa-handshake', 'text-amber-600') + kpi('Tasa de conversión', conv + '%', 'fa-percent', 'text-emerald-600', `${c('CONVERTIDO')} convertidos`) + kpi('Tiempo prom. pipeline', prom, 'fa-hourglass-half', 'text-stone-600');
  const rows = items.filter(p => (!f.q || (p.nombre + p.direccion).toLowerCase().includes(f.q)) && (!f.estado || p.estado === f.estado) && (!f.zona || p.zona === f.zona) && (!f.tipo || p.tipo === f.tipo));
  const body = root.querySelector('#pr-body');
  if (!rows.length) { body.innerHTML = card(emptyHTML('No hay prospectos con esos filtros.', 'fa-shop-slash')); return; }
  if (view === 'lista') {
    body.innerHTML = card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr><th class="p-3 text-left">Prospecto</th><th class="p-3 text-left">Tipo</th><th class="p-3 text-left">Zona</th><th class="p-3 text-left">Promotor</th><th class="p-3 text-left">Estado</th><th></th></tr></thead>
      <tbody class="divide-y divide-stone-100">${rows.map((p, i) => `<tr class="hover:bg-brand-ivory/50"><td class="p-3"><b>${esc(p.nombre)}</b><div class="text-stone-500">${esc(p.direccion)}</div></td><td class="p-3">${esc(p.tipo || '—')}</td><td class="p-3">${esc(p.zona)}</td><td class="p-3">${esc(p.promotor || 'Sin asignar')}</td><td class="p-3">${estadoBadge(p.estado)}</td>
        <td class="p-3 text-right"><button data-id="${p.id}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">Detalle</button></td></tr>`).join('')}</tbody></table></div>`);
  } else {
    const cols = [...ESTADOS, ...[...new Set(rows.map(p => p.estado))].filter(e => !ESTADOS.includes(e))];
    body.innerHTML = `<div class="grid md:grid-cols-3 xl:grid-cols-5 gap-3">${cols.map(e => { const it = rows.filter(p => p.estado === e); return `
      <div class="bg-stone-100/70 rounded-2xl p-2 border-t-4 ${COLS[e] || 'border-stone-400'}"><div class="flex justify-between px-2 py-1.5"><b class="text-xs">${esc(label(e))}</b><span class="text-[11px] font-bold text-stone-500">${it.length}</span></div>
        <div class="space-y-2 max-h-[560px] overflow-y-auto">${it.length ? it.map(p => `<button data-id="${p.id}" class="w-full text-left bg-white rounded-xl border border-stone-200 p-3 hover:border-brand-gold shadow-xs">
          <div class="text-xs font-black truncate">${esc(p.nombre)}</div><div class="text-[11px] text-stone-500 truncate">${esc(p.zona)} · ${esc(p.tipo || '—')}</div><div class="text-[11px] mt-1 text-stone-600 truncate"><i class="fa-solid fa-user-tie mr-1"></i>${esc(p.promotor || 'Sin asignar')}</div></button>`).join('') : '<div class="text-center text-[11px] text-stone-400 py-4">Vacío</div>'}</div></div>`; }).join('')}</div>`;
  }
  body.querySelectorAll('[data-id]').forEach(b => b.onclick = () => detail(items.find(p => String(p.id) === b.dataset.id)));
}

async function detail(p) {
  openModal(modalHeader(esc(p.nombre), esc(p.direccion)) + `<div class="p-5">${loadingHTML('Cargando detalle y línea de tiempo...')}</div>`, true);
  const { data } = await settle({ seg: () => S.seguimientos(p.id) });
  const seg = data.seg || [];
  const cand = personas.filter(x => x.rol === 'PROMOTOR').length ? personas.filter(x => x.rol === 'PROMOTOR') : personas;
  openModal(modalHeader(esc(p.nombre), `${esc(p.direccion)} · ${esc(p.zona)}`) + `
    <div class="p-5 space-y-4 text-xs">
      <div class="grid md:grid-cols-3 gap-4">
        <div class="md:col-span-2 space-y-2">
          <div class="flex gap-2 flex-wrap">${estadoBadge(p.estado)} ${p.tipo ? badge(p.tipo, 'brand') : ''} ${p.potencial ? badge('Potencial ' + p.potencial, 'info') : ''}</div>
          <div><i class="fa-solid fa-phone text-stone-400 w-4"></i> ${esc(p.telefono || 'Sin teléfono')} ${p.contacto ? '· ' + esc(p.contacto) : ''}</div>
          <div><i class="fa-solid fa-user-tie text-stone-400 w-4"></i> Promotor: <b>${esc(p.promotor || 'Sin asignar')}</b></div>
          ${validCoord(p.lat, p.lng) ? `<a class="text-sky-700 font-bold" target="_blank" href="${mapsLink(p.lat, p.lng)}"><i class="fa-solid fa-location-dot w-4"></i> Cómo llegar</a>` : ''}
          ${p.notas ? `<div class="p-2 rounded-lg bg-stone-50">${esc(p.notas)}</div>` : ''}</div>
        <div data-img-wrap>${p.foto ? `<img data-src="${esc(p.foto)}" class="w-full h-36 object-cover rounded-xl border border-stone-200" alt="Fachada">` : ''}<div data-img-fallback class="${p.foto ? 'hidden' : ''} h-36 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center text-center p-2">Sin foto de fachada</div></div></div>
      <div class="grid md:grid-cols-2 gap-3 p-3 rounded-xl bg-brand-ivory border border-brand-gold/30">
        <div><label class="font-black block mb-1">Mover en el pipeline</label><select id="pr-new" class="${inputCls}">${ESTADOS.map(e => `<option value="${e}" ${e === p.estado ? 'selected' : ''}>${label(e)}</option>`).join('')}</select>
          <input id="pr-mot" class="${inputCls} mt-2" placeholder="Motivo (obligatorio si se rechaza)"><button id="pr-set" class="${btnPrimary} mt-2 w-full justify-center">Actualizar estado</button></div>
        <div><label class="font-black block mb-1">Asignar promotor</label><select id="pr-asg" class="${inputCls}"><option value="">Seleccione...</option>${cand.map(x => `<option value="${x.id}" ${String(x.id) === String(p.idPromotor) ? 'selected' : ''}>${esc(x.nombre)}${x.rol ? ' — ' + x.rol : ''}</option>`).join('')}</select>
          <button id="pr-asgbtn" class="${btnPrimary} mt-2 w-full justify-center">Asignar</button></div></div>
      <div id="pr-err" class="text-rose-600 font-bold hidden"></div>
      <div><h4 class="font-black mb-2">Línea de tiempo y seguimientos</h4>
        ${seg.length ? `<div class="space-y-2 max-h-52 overflow-y-auto border-l-2 border-brand-gold pl-3">${seg.map(s => `<div><div class="font-bold">${esc(s.estadoNuevo ? `${label(s.estadoAnterior || '—')} → ${label(s.estadoNuevo)}` : 'Seguimiento')} <span class="text-stone-400 font-normal">${esc(dateOnly(s.fecha))}</span></div><div class="text-stone-600">${esc(s.notas || '')}</div></div>`).join('')}</div>` : emptyHTML('Aún no hay seguimientos registrados')}
        <div class="flex gap-2 mt-2"><input id="pr-seg" class="${inputCls}" placeholder="Registrar actividad (llamada, visita, propuesta...)"><button id="pr-segbtn" class="${btnGhost}">Agregar</button></div></div></div>`, true);

  const err = (m) => { const e = document.getElementById('pr-err'); e.textContent = m; e.classList.remove('hidden'); };
  document.getElementById('pr-set').onclick = async () => {
    const st = document.getElementById('pr-new').value, mot = document.getElementById('pr-mot').value.trim();
    if (st === p.estado) return err('Seleccione un estado distinto al actual.');
    if (st === 'RECHAZADO' && !mot) return err('Indique el motivo del rechazo.');
    try { await S.prospectoEstado(p.id, st, mot); toast(`Prospecto → ${label(st)}`); closeModal(); await load(); } catch (e) { err(e.message); }
  };
  document.getElementById('pr-asgbtn').onclick = async () => {
    const u = document.getElementById('pr-asg').value; if (!u) return err('Seleccione un promotor.');
    try { await S.prospectoAsignar(p.id, +u); toast('Promotor asignado'); closeModal(); await load(); } catch (e) { err(e.message); }
  };
  document.getElementById('pr-segbtn').onclick = async () => {
    const n = document.getElementById('pr-seg').value.trim(); if (!n) return err('Escriba la actividad realizada.');
    try { await S.addSeguimiento(p.id, n); toast('Seguimiento registrado'); detail(p); } catch (e) { err(e.message); }
  };
}
