import { S, settle } from '../data.js';
import { esc, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, badge, label, fmtDate, validCoord, mapsLink,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast, debounce } from '../ui.js';

let root, items = [], personas = [], busy = false, view = 'kanban';
const f = { q: '', estado: '', zona: '', tipo: '' };

const ESTADOS = ['NUEVO', 'EN_NEGOCIACION', 'CONVERTIDO', 'DESCARTADO'];

const ESTADO_LABELS = {
  NUEVO: 'Nuevo',
  EN_NEGOCIACION: 'En Negociación',
  CONVERTIDO: 'Convertido',
  DESCARTADO: 'Descartado'
};

const COLS = {
  NUEVO: 'border-sky-400',
  EN_NEGOCIACION: 'border-amber-400',
  CONVERTIDO: 'border-emerald-500',
  DESCARTADO: 'border-rose-400'
};

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
  root.innerHTML = `${pageHeader('Prospectos y Puntos de Distribución', 'Pipeline de puntos de distribución gestionados por promotores, con estado comercial, ubicación y asignación.')}
    <div id="pr-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3 items-center">
      <div class="inline-flex bg-stone-100 rounded-xl p-1 text-xs font-bold" id="pr-tabs"><button data-v="kanban" class="px-3 py-1.5 rounded-lg">Pipeline</button><button data-v="lista" class="px-3 py-1.5 rounded-lg">Lista</button></div>
      <input id="pr-q" class="${inputCls} sm:w-52" placeholder="Buscar nombre o dirección...">
      <select id="pr-estado" class="${inputCls} sm:w-44"><option value="">Todos los estados</option>${ESTADOS.map(e => `<option value="${e}">${ESTADO_LABELS[e]}</option>`).join('')}</select>
      <select id="pr-zona" class="${inputCls} sm:w-44"><option value="">Todas las zonas</option></select>
      <select id="pr-tipo" class="${inputCls} sm:w-40"><option value="">Todos los tipos</option></select></div><div id="pr-body"></div>`;

  root.querySelector('#pr-tabs').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; draw(); } };
  root.querySelector('#pr-q').oninput = debounce(e => { f.q = e.target.value.toLowerCase(); draw(); });
  ['estado', 'zona', 'tipo'].forEach(k => root.querySelector('#pr-' + k).onchange = e => { f[k] = e.target.value; draw(); });
}

function fillSelect(sel, vals, cur, placeholder) {
  const el = root.querySelector(sel);
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>${vals.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('')}`;
}

function draw() {
  root.querySelectorAll('#pr-tabs button').forEach(b => b.className = 'px-3 py-1.5 rounded-lg ' + (b.dataset.v === view ? 'bg-white shadow text-brand-chocolate' : 'text-stone-500'));
  fillSelect('#pr-zona', [...new Set(items.map(p => p.zona))].sort(), f.zona, 'Todas las zonas');
  fillSelect('#pr-tipo', [...new Set(items.map(p => p.tipo).filter(Boolean))].sort(), f.tipo, 'Todos los tipos');
  const c = (e) => items.filter(p => p.estado === e).length;
  const conv = items.length ? Math.round((c('CONVERTIDO') / items.length) * 100) : 0;
  root.querySelector('#pr-kpis').innerHTML =
    kpi('Total prospectos', items.length, 'fa-shop', 'text-brand-gold') +
    kpi('Nuevos', c('NUEVO'), 'fa-sparkles', 'text-sky-600') +
    kpi('En negociación', c('EN_NEGOCIACION'), 'fa-handshake', 'text-amber-600') +
    kpi('Convertidos (PDV)', `${c('CONVERTIDO')} (${conv}%)`, 'fa-circle-check', 'text-emerald-600');
  const rows = items.filter(p => (!f.q || (p.nombre + p.direccion).toLowerCase().includes(f.q)) && (!f.estado || p.estado === f.estado) && (!f.zona || p.zona === f.zona) && (!f.tipo || p.tipo === f.tipo));
  const body = root.querySelector('#pr-body');
  if (!rows.length) { body.innerHTML = card(emptyHTML('No hay registros con esos filtros.', 'fa-shop-slash')); return; }
  if (view === 'lista') {
    body.innerHTML = card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr><th class="p-3 text-left">Punto / Prospecto</th><th class="p-3 text-left">Tipo</th><th class="p-3 text-left">Zona</th><th class="p-3 text-left">Promotor / Responsable</th><th class="p-3 text-left">Estado</th><th></th></tr></thead>
      <tbody class="divide-y divide-stone-100">${rows.map(p => `<tr class="hover:bg-brand-ivory/50"><td class="p-3"><b>${esc(p.nombre)}</b><div class="text-stone-500">${esc(p.direccion)}</div></td><td class="p-3">${esc(p.tipo || '—')}</td><td class="p-3">${esc(p.zona)}</td><td class="p-3">${esc(p.promotor || 'Sin asignar')}</td><td class="p-3">${estadoBadge(p.estado)}</td>
        <td class="p-3 text-right"><button data-id="${p.id}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">Detalle</button></td></tr>`).join('')}</tbody></table></div>`);
  } else {
    const cols = [...ESTADOS, ...[...new Set(rows.map(p => p.estado))].filter(e => !ESTADOS.includes(e))];
    body.innerHTML = `<div class="grid md:grid-cols-2 xl:grid-cols-4 gap-3">${cols.map(e => { const it = rows.filter(p => p.estado === e); return `
      <div class="bg-stone-100/70 rounded-2xl p-2 border-t-4 ${COLS[e] || 'border-stone-400'}"><div class="flex justify-between px-2 py-1.5"><b class="text-xs">${esc(ESTADO_LABELS[e] || label(e))}</b><span class="text-[11px] font-bold text-stone-500">${it.length}</span></div>
        <div class="space-y-2 max-h-[560px] overflow-y-auto">${it.length ? it.map(p => `<button data-id="${p.id}" class="w-full text-left bg-white rounded-xl border border-stone-200 p-3 hover:border-brand-gold shadow-xs">
          <div class="text-xs font-black truncate">${esc(p.nombre)}</div><div class="text-[11px] text-stone-500 truncate">${esc(p.zona)} · ${esc(p.tipo || '—')}</div><div class="text-[11px] mt-1 text-stone-600 truncate"><i class="fa-solid fa-user-tie mr-1"></i>${esc(p.promotor || 'Sin asignar')}</div></button>`).join('') : '<div class="text-center text-[11px] text-stone-400 py-4">Vacío</div>'}</div></div>`; }).join('')}</div>`;
  }
  body.querySelectorAll('[data-id]').forEach(b => b.onclick = () => detail(items.find(p => String(p.id) === b.dataset.id)));
}

async function detail(p) {
  openModal(modalHeader(esc(p.nombre), esc(p.direccion)) + `<div class="p-5">${loadingHTML('Cargando detalle e historial...')}</div>`, true);
  const { data } = await settle({ hist: () => S.pdvHistorial(p.id) });
  const hist = data.hist || [];
  const cand = personas.filter(x => x.rol === 'PROMOTOR').length ? personas.filter(x => x.rol === 'PROMOTOR') : personas;
  openModal(modalHeader(esc(p.nombre), `${esc(p.direccion)} · ${esc(p.zona)}`) + `
    <div class="p-5 space-y-4 text-xs">
      <div class="space-y-2">
        <div class="flex gap-2 flex-wrap">${estadoBadge(p.estado)} ${p.tipo ? badge(p.tipo, 'brand') : ''}</div>
        <div><i class="fa-solid fa-user-tie text-stone-400 w-4"></i> Promotor / Responsable actual: <b>${esc(p.promotor || 'Sin asignar')}</b></div>
        ${validCoord(p.lat, p.lng) ? `<div><a class="text-sky-700 font-bold" target="_blank" href="${mapsLink(p.lat, p.lng)}"><i class="fa-solid fa-location-dot w-4"></i> Ver ubicación en Google Maps</a></div>` : ''}
        ${p.notas ? `<div class="p-2.5 rounded-xl bg-stone-50">${esc(p.notas)}</div>` : ''}
      </div>

      <!-- Cambiar estado de Prospecto -->
      <div class="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
        <label class="font-black block">Cambiar estado del prospecto</label>
        <div class="grid sm:grid-cols-2 gap-2">
          <select id="pr-status-sel" class="${inputCls}">
            ${ESTADOS.map(e => `<option value="${e}" ${e === p.estado ? 'selected' : ''}>${ESTADO_LABELS[e]}</option>`).join('')}
          </select>
          <input id="pr-motivo-desc" class="${inputCls} ${p.estado === 'DESCARTADO' ? '' : 'hidden'}" placeholder="Motivo de descarte..." value="${esc(p.raw?.motivo_descarte || '')}">
        </div>
        <button id="pr-statusbtn" class="${btnPrimary} w-full justify-center">Actualizar estado en BD</button>
      </div>

      <!-- Reasignar promotor -->
      <div class="p-3 rounded-xl bg-brand-ivory border border-brand-gold/30 space-y-2">
        <label class="font-black block">Reasignar responsable del punto</label>
        <div class="grid sm:grid-cols-2 gap-2">
          <select id="pr-asg" class="${inputCls}"><option value="">Seleccione colaborador...</option>${cand.map(x => `<option value="${x.id}" ${String(x.id) === String(p.idPromotor) ? 'selected' : ''}>${esc(x.nombre)}${x.rol ? ' — ' + x.rol : ''}</option>`).join('')}</select>
          <input id="pr-mot" class="${inputCls}" placeholder="Motivo de asignación / rotación">
        </div>
        <button id="pr-asgbtn" class="${btnPrimary} w-full justify-center">Confirmar asignación</button>
      </div>

      <div id="pr-err" class="text-rose-600 font-bold hidden"></div>

      <div><h4 class="font-black mb-2">Historial de asignaciones</h4>
        ${hist.length ? `<div class="space-y-2 max-h-52 overflow-y-auto border-l-2 border-brand-gold pl-3">${hist.map(h => `<div><div class="font-bold">${esc(h.impulsador_nombre || h.nombre || '—')} <span class="text-stone-400 font-normal">${esc(fmtDate(h.fecha_inicio))} → ${esc(h.fecha_fin ? fmtDate(h.fecha_fin) : 'actual')}</span></div><div class="text-stone-600">${esc(h.motivo || '')}</div></div>`).join('')}</div>` : emptyHTML('Sin historial de asignaciones previas')}
      </div>
    </div>`, true);

  const err = (m) => { const e = document.getElementById('pr-err'); e.textContent = m; e.classList.remove('hidden'); };

  // Toggle input motivo de descarte
  document.getElementById('pr-status-sel').onchange = (e) => {
    const m = document.getElementById('pr-motivo-desc');
    if (e.target.value === 'DESCARTADO') m.classList.remove('hidden');
    else m.classList.add('hidden');
  };

  // Botón Cambiar Estado
  document.getElementById('pr-statusbtn').onclick = async () => {
    const st = document.getElementById('pr-status-sel').value;
    const mot = document.getElementById('pr-motivo-desc').value.trim();
    const btn = document.getElementById('pr-statusbtn'); btn.disabled = true;
    try {
      await S.cambiarEstadoProspecto(p.id, st, mot);
      toast(st === 'CONVERTIDO' ? '¡Prospecto convertido a Punto de Venta!' : `Estado actualizado a ${ESTADO_LABELS[st] || st}`);
      closeModal();
      await load();
    } catch (e) {
      err(e.message || 'Error al cambiar estado'); btn.disabled = false;
    }
  };

  // Botón Reasignar
  document.getElementById('pr-asgbtn').onclick = async () => {
    const u = document.getElementById('pr-asg').value;
    const mot = document.getElementById('pr-mot').value.trim() || 'Asignación desde panel web';
    if (!u) return err('Seleccione un colaborador.');
    const btn = document.getElementById('pr-asgbtn'); btn.disabled = true;
    try {
      await S.reasignar(+u, +p.id, mot);
      toast('Responsable asignado correctamente');
      closeModal();
      await load();
    } catch (e) {
      err(e.message); btn.disabled = false;
    }
  };
}
