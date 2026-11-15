import { S, settle } from '../data.js';
import { AuthService } from '../auth.js';
import { esc, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, label, avatar, fmtDateTime, dateOnly,
  inputCls, btnGhost, btnOk, btnDanger, openModal, closeModal, modalHeader, toast, hydrateImages, debounce } from '../ui.js';

let root, items = [], busy = false;
const filt = { q: '', estado: '', fecha: '' };

export async function render(container) {
  root = container; Object.assign(filt, { q: '', estado: '', fecha: '' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) await load(true); }
export function destroy() { root = null; }

async function load(silent) {
  busy = true;
  const { data, errors } = await settle({ colab: S.asistColaboradores, rec: S.asistRecientes });
  busy = false;
  if (!root) return;
  if (!data.colab && !data.rec) {
    root.innerHTML = errorHTML((errors.colab || errors.rec)?.message || 'Error', 'btn-retry');
    root.querySelector('#btn-retry')?.addEventListener('click', () => render(root)); return;
  }
  const map = new Map();
  [...(data.rec || []), ...(data.colab || [])].forEach(r => {
    if (!r.justificacion) return;
    map.set(`${r.idUsuario}|${r.justificacion.fecha || r.fecha}`, r);
  });
  items = [...map.values()].sort((a, b) => String(b.justificacion.fecha || b.fecha).localeCompare(String(a.justificacion.fecha || a.fecha)));
  frame(); draw();
}

function frame() {
  if (root.querySelector('#j-body')) return;
  root.innerHTML = `
    ${pageHeader('Justificaciones de asistencia', 'Revise el motivo, la descripción y el sustento fotográfico. Apruebe o rechace con un comentario; el solicitante es notificado por el sistema.',
      `<button id="j-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
    <div id="j-kpis" class="grid grid-cols-3 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3">
      <input id="j-q" class="${inputCls} !w-56" placeholder="Buscar persona...">
      <select id="j-estado" class="${inputCls} !w-44"><option value="">Todos los estados</option><option>PENDIENTE</option><option>APROBADA</option><option>RECHAZADA</option></select>
      <input id="j-fecha" type="date" class="${inputCls} !w-40">
    </div><div id="j-body"></div>`;
  root.querySelector('#j-refresh').onclick = () => load();
  root.querySelector('#j-q').oninput = debounce(e => { filt.q = e.target.value.toLowerCase(); draw(); });
  root.querySelector('#j-estado').onchange = e => { filt.estado = e.target.value; draw(); };
  root.querySelector('#j-fecha').onchange = e => { filt.fecha = e.target.value; draw(); };
}

function draw() {
  const c = (s) => items.filter(i => i.justificacion.estado === s).length;
  root.querySelector('#j-kpis').innerHTML = kpi('Pendientes', c('PENDIENTE'), 'fa-hourglass-half', 'text-amber-600') + kpi('Aprobadas', c('APROBADA'), 'fa-circle-check', 'text-emerald-600') + kpi('Rechazadas', c('RECHAZADA'), 'fa-circle-xmark', 'text-rose-600');
  const rows = items.filter(i => (!filt.q || i.nombre.toLowerCase().includes(filt.q)) && (!filt.estado || i.justificacion.estado === filt.estado) &&
    (!filt.fecha || dateOnly(i.justificacion.fecha || i.fecha) === filt.fecha));
  const body = root.querySelector('#j-body');
  if (!rows.length) { body.innerHTML = card(emptyHTML('No hay justificaciones registradas con estos filtros.', 'fa-file-signature')); return; }
  body.innerHTML = `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${rows.map((r, i) => `
    <div class="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-col gap-3">
      <div class="flex items-center gap-2">${avatar(r.nombre, { src: r.foto })}<div class="flex-1 min-w-0"><div class="text-sm font-black truncate">${esc(r.nombre)}</div><div class="text-[11px] text-stone-500 truncate">${esc(r.sede)}</div></div>${estadoBadge(r.justificacion.estado)}</div>
      <div class="text-xs"><div class="font-bold">${esc(r.justificacion.motivo || 'Sin motivo')}</div><div class="text-stone-600 line-clamp-3">${esc(r.justificacion.descripcion || '')}</div></div>
      <div class="text-[11px] text-stone-500 flex justify-between"><span>${estadoLbl(r)}</span><span>${fmtDateTime(r.justificacion.fecha || r.fecha)}</span></div>
      <button data-i="${i}" class="mt-auto px-3 py-2 rounded-xl bg-brand-chocolate text-white text-xs font-bold">${r.justificacion.estado === 'PENDIENTE' ? 'Revisar' : 'Ver detalle'}</button>
    </div>`).join('')}</div>`;
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => review(rows[+b.dataset.i]));
}
const estadoLbl = (r) => `<b>${label(r.estado === 'A_TIEMPO' ? 'A TIEMPO' : r.estado)}</b>${r.minutos ? ` · ${r.minutos} min` : ''}`;

function review(r) {
  const j = r.justificacion, pend = j.estado === 'PENDIENTE';
  openModal(modalHeader('Justificación de ' + esc(r.nombre), `${esc(r.sede)} · ${label(j.estado)}`) + `
    <div class="p-5 space-y-3 text-xs">
      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] font-bold uppercase text-stone-500">Marcación</div>${estadoLbl(r)}<br>${fmtDateTime(r.fecha)}</div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] font-bold uppercase text-stone-500">Enviada</div>${fmtDateTime(j.fecha)}</div></div>
      <div class="p-3 rounded-xl bg-brand-ivory border border-brand-gold/30"><div class="font-black mb-1">${esc(j.motivo || '—')}</div>${esc(j.descripcion || 'Sin descripción')}</div>
      <div><div class="font-black mb-1">Foto de sustento</div>
        ${j.sustento ? `<div data-img-wrap><img data-src="${esc(j.sustento)}" class="w-full max-h-72 object-contain rounded-xl border border-stone-200 bg-stone-50" alt="Sustento">
          <div data-img-fallback class="hidden p-4 text-center text-stone-500 bg-stone-50 rounded-xl">No se pudo cargar la imagen de sustento.</div></div>` : '<div class="p-4 text-center text-stone-400 bg-stone-50 rounded-xl">No adjuntó sustento fotográfico.</div>'}</div>
      ${pend ? `<div><label class="font-black block mb-1">Comentario de revisión *</label><textarea id="j-com" rows="3" class="${inputCls}" placeholder="Explique su decisión..."></textarea></div>
        <div id="j-err" class="text-rose-600 font-bold hidden"></div>
        <div class="flex justify-end gap-2"><button id="j-rej" class="${btnDanger}"><i class="fa-solid fa-xmark"></i> Rechazar</button><button id="j-ok" class="${btnOk}"><i class="fa-solid fa-check"></i> Aprobar</button></div>`
        : `<div class="p-3 rounded-xl bg-stone-50"><b>Estado final:</b> ${estadoBadge(j.estado)}</div>`}
    </div>`, true);
  if (!pend) return;
  const send = async (estado) => {
    const com = document.getElementById('j-com').value.trim();
    const err = document.getElementById('j-err');
    if (!com) { err.textContent = 'El comentario es obligatorio.'; err.classList.remove('hidden'); return; }
    document.querySelectorAll('#j-ok,#j-rej').forEach(b => b.disabled = true);
    try {
      await S.revisarJustificacion(r.idUsuario, AuthService.getUser()?.id, estado, com);
      toast(`Justificación ${estado.toLowerCase()} correctamente`);
      closeModal(); await load();
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden');
      document.querySelectorAll('#j-ok,#j-rej').forEach(b => b.disabled = false);
    }
  };
  document.getElementById('j-ok').onclick = () => send('APROBADA');
  document.getElementById('j-rej').onclick = () => send('RECHAZADA');
}
