import { S } from '../data.js';
import { AuthService } from '../auth.js';
import { esc, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, badge, label, avatar, fmtDateTime, dateOnly, todayISO,
  inputCls, btnGhost, btnPrimary, btnOk, btnDanger, openModal, closeModal, modalHeader, toast, debounce } from '../ui.js';

let root, items = [], colaboradores = [], busy = false;
const filt = { q: '', estado: '', fecha: '' };

export async function render(container) {
  root = container; Object.assign(filt, { q: '', estado: '', fecha: '' });
  root.innerHTML = loadingHTML('Consultando justificaciones de todos los colaboradores...');
  await load();
}
export async function refresh() { if (root && !busy) await load(true); }
export function destroy() { root = null; }

async function load() {
  busy = true;
  try {
    const res = await S.todasJustificaciones();
    items = res.items || [];
    colaboradores = res.colaboradores || [];
    if (!root) return;
    frame(); draw();
  } catch (e) {
    if (!root) return;
    root.innerHTML = errorHTML(e.message || 'Error al cargar justificaciones', 'btn-retry');
    root.querySelector('#btn-retry')?.addEventListener('click', () => render(root));
  } finally {
    busy = false;
  }
}

function frame() {
  if (root.querySelector('#j-body')) return;
  root.innerHTML = `
    ${pageHeader('Justificaciones de Asistencia', 'Consulte todas las justificaciones registradas por los colaboradores (del día e históricas por usuario) y apruebe o rechace con comentario.',
      `<div class="flex flex-wrap gap-2">
        <button id="j-new" class="${btnPrimary}"><i class="fa-solid fa-plus"></i> Registrar justificación</button>
        <button id="j-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>
      </div>`)}
    <div id="j-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3">
      <input id="j-q" class="${inputCls} sm:w-60" placeholder="Buscar colaborador, motivo o sede...">
      <select id="j-estado" class="${inputCls} sm:w-44"><option value="">Todos los estados</option><option value="PENDIENTE">Pendiente</option><option value="APROBADA">Aprobada</option><option value="RECHAZADA">Rechazada</option></select>
      <input id="j-fecha" type="date" class="${inputCls} sm:w-40">
      <button id="j-clear" class="${btnGhost}">Limpiar filtros</button>
    </div><div id="j-body"></div>`;
  root.querySelector('#j-refresh').onclick = () => load();
  root.querySelector('#j-new').onclick = () => openNewModal();
  root.querySelector('#j-q').oninput = debounce(e => { filt.q = e.target.value.toLowerCase(); draw(); });
  root.querySelector('#j-estado').onchange = e => { filt.estado = e.target.value; draw(); };
  root.querySelector('#j-fecha').onchange = e => { filt.fecha = e.target.value; draw(); };
  root.querySelector('#j-clear').onclick = () => {
    Object.assign(filt, { q: '', estado: '', fecha: '' });
    ['j-q', 'j-estado', 'j-fecha'].forEach(id => { const el = root.querySelector('#' + id); if (el) el.value = ''; });
    draw();
  };
}

function draw() {
  const c = (s) => items.filter(i => i.justificacion.estado === s).length;
  root.querySelector('#j-kpis').innerHTML =
    kpi('Total justificaciones', items.length, 'fa-file-signature', 'text-brand-gold') +
    kpi('Pendientes', c('PENDIENTE'), 'fa-hourglass-half', 'text-amber-600') +
    kpi('Aprobadas', c('APROBADA'), 'fa-circle-check', 'text-emerald-600') +
    kpi('Rechazadas', c('RECHAZADA'), 'fa-circle-xmark', 'text-rose-600');

  const rows = items.filter(i =>
    (!filt.q || (i.nombre + ' ' + i.sede + ' ' + (i.justificacion.motivo || '') + ' ' + (i.justificacion.descripcion || '')).toLowerCase().includes(filt.q)) &&
    (!filt.estado || i.justificacion.estado === filt.estado) &&
    (!filt.fecha || dateOnly(i.justificacion.fecha || i.fecha) === filt.fecha)
  );
  const body = root.querySelector('#j-body');
  if (!rows.length) {
    body.innerHTML = card(emptyHTML('No hay justificaciones que coincidan con los filtros seleccionados.', 'fa-file-signature'));
    return;
  }
  body.innerHTML = `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${rows.map((r, i) => `
    <div class="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-col gap-3">
      <div class="flex items-center gap-2.5">
        ${avatar(r.nombre, { id: r.idUsuario, src: r.foto, size: 'w-10 h-10' })}
        <div class="flex-1 min-w-0">
          <div class="text-sm font-black truncate">${esc(r.nombre)}</div>
          <div class="text-[11px] text-stone-500 truncate">${esc(r.sede !== '—' ? r.sede : (r.rol || 'Colaborador'))} ${r.rol && r.sede !== '—' ? `· ${esc(r.rol)}` : ''}</div>
        </div>
        ${estadoBadge(r.justificacion.estado)}
      </div>
      <div class="text-xs bg-stone-50 rounded-xl p-3 border border-stone-100">
        <div class="font-black text-brand-dark mb-0.5">${esc(r.justificacion.motivo || 'Sin motivo especificado')}</div>
        <div class="text-stone-600 line-clamp-3">${esc(r.justificacion.descripcion || 'Sin descripción adicional')}</div>
      </div>
      ${r.justificacion.comentarioAdmin ? `<div class="text-[11px] px-2.5 py-1.5 rounded-lg bg-brand-ivory border border-brand-gold/30 text-stone-700 truncate"><i class="fa-solid fa-comment-dots mr-1 text-brand-gold"></i><b>Revisión:</b> ${esc(r.justificacion.comentarioAdmin)}</div>` : ''}
      <div class="text-[11px] text-stone-500 flex justify-between items-center mt-auto pt-1 border-t border-stone-100">
        <span>${estadoLbl(r)}</span>
        <span><i class="fa-regular fa-calendar mr-1"></i>${fmtDateTime(r.justificacion.fecha || r.fecha)}</span>
      </div>
      <button data-i="${i}" class="px-3 py-2 rounded-xl bg-brand-chocolate text-white text-xs font-bold hover:bg-brand-dark transition-colors">
        ${r.justificacion.estado === 'PENDIENTE' ? '<i class="fa-solid fa-gavel mr-1"></i> Revisar (Aprobar / Rechazar)' : '<i class="fa-solid fa-eye mr-1"></i> Ver detalle / Actualizar revisión'}
      </button>
    </div>`).join('')}</div>`;
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => review(rows[+b.dataset.i]));
}

const estadoLbl = (r) => {
  const est = r.estado === 'A_TIEMPO' ? 'A TIEMPO' : (r.estado || 'REGISTRO');
  return `<b>${esc(label(est))}</b>${r.minutos ? ` · ${r.minutos} min` : ''}`;
};

function review(r) {
  const j = r.justificacion;
  openModal(modalHeader('Justificación de ' + esc(r.nombre), `${esc(r.sede !== '—' ? r.sede : (r.rol || 'Colaborador'))} · ID Usuario #${r.idUsuario}`) + `
    <div class="p-5 space-y-3.5 text-xs">
      <div class="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
        ${avatar(r.nombre, { id: r.idUsuario, src: r.foto, size: 'w-12 h-12' })}
        <div class="flex-1 min-w-0">
          <div class="text-sm font-black truncate">${esc(r.nombre)}</div>
          <div class="text-stone-500">${esc(r.rol || 'COLABORADOR')} · ${esc(r.sede)}</div>
        </div>
        ${estadoBadge(j.estado)}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] font-bold uppercase text-stone-500">Estado de marcación</div>${estadoLbl(r)} ${j.idAsistencias ? `<span class="text-stone-400">· Asist. #${j.idAsistencias}</span>` : ''}</div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] font-bold uppercase text-stone-500">Fecha de registro</div>${fmtDateTime(j.fecha || r.fecha)}</div>
      </div>
      <div class="p-3.5 rounded-xl bg-brand-ivory border border-brand-gold/30">
        <div class="text-[10px] font-bold uppercase text-stone-500 mb-0.5">Motivo</div>
        <div class="font-black text-sm mb-2">${esc(j.motivo || '—')}</div>
        <div class="text-[10px] font-bold uppercase text-stone-500 mb-0.5">Descripción / Sustento</div>
        <div class="text-stone-700">${esc(j.descripcion || 'Sin descripción')}</div>
      </div>
      ${j.sustento ? `<div><div class="font-black mb-1">Foto de sustento</div>
        <div data-img-wrap><img data-src="${esc(j.sustento)}" class="w-full max-h-72 object-contain rounded-xl border border-stone-200 bg-stone-50" alt="Sustento">
          <div data-img-fallback class="hidden p-4 text-center text-stone-500 bg-stone-50 rounded-xl">No se pudo cargar la imagen de sustento.</div></div></div>` : ''}
      <div>
        <label class="font-black block mb-1">Comentario del Administrador *</label>
        <textarea id="j-com" rows="3" class="${inputCls}" placeholder="Indique el motivo de aprobación o rechazo...">${esc(j.comentarioAdmin || '')}</textarea>
      </div>
      <div id="j-err" class="text-rose-600 font-bold hidden"></div>
      <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-stone-100">
        <button data-close-modal class="${btnGhost}">Cerrar</button>
        <button id="j-rej" class="${btnDanger}"><i class="fa-solid fa-xmark"></i> Rechazar</button>
        <button id="j-ok" class="${btnOk}"><i class="fa-solid fa-check"></i> Aprobar</button>
      </div>
    </div>`, true);

  const send = async (estado) => {
    const com = document.getElementById('j-com').value.trim();
    const err = document.getElementById('j-err');
    if (!com) { err.textContent = 'El comentario del administrador es obligatorio.'; err.classList.remove('hidden'); return; }
    document.querySelectorAll('#j-ok,#j-rej').forEach(b => b.disabled = true);
    try {
      await S.revisarJustificacion(r.idUsuario, AuthService.getUser()?.id, estado, com, {
        idJustificacion: j.idJustificacion,
        idAsistencias: j.idAsistencias || r.id
      });
      toast(`Justificación ${estado.toLowerCase()} correctamente`);
      closeModal();
      await load();
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden');
      document.querySelectorAll('#j-ok,#j-rej').forEach(b => b.disabled = false);
    }
  };
  document.getElementById('j-ok').onclick = () => send('APROBADA');
  document.getElementById('j-rej').onclick = () => send('RECHAZADA');
}

function openNewModal() {
  openModal(modalHeader('Registrar Justificación', 'Envía una justificación para un colaborador (POST /api/asistencias/justificar)') + `
    <div class="p-5 space-y-3 text-xs">
      <div>
        <label class="font-black block mb-1">Colaborador *</label>
        <select id="nj-user" class="${inputCls}">
          <option value="">Seleccione colaborador...</option>
          ${colaboradores.map(c => `<option value="${c.idUsuario}">${esc(c.nombre)} (${esc(c.rol || 'COLABORADOR')} · ID #${c.idUsuario})</option>`).join('')}
        </select>
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="font-black block mb-1">Motivo *</label>
          <input id="nj-mot" class="${inputCls}" placeholder="Ej.: Cita médica programada">
        </div>
        <div>
          <label class="font-black block mb-1">Fecha *</label>
          <input id="nj-fec" type="date" value="${todayISO()}" class="${inputCls}">
        </div>
      </div>
      <div>
        <label class="font-black block mb-1">Descripción detallada *</label>
        <textarea id="nj-desc" rows="3" class="${inputCls}" placeholder="Detalle el sustento de la inasistencia o tardanza..."></textarea>
      </div>
      <div id="nj-err" class="text-rose-600 font-bold hidden"></div>
      <div class="flex justify-end gap-2 pt-2">
        <button data-close-modal class="${btnGhost}">Cancelar</button>
        <button id="nj-save" class="${btnPrimary}"><i class="fa-solid fa-paper-plane"></i> Registrar justificación</button>
      </div>
    </div>`);

  document.getElementById('nj-save').onclick = async () => {
    const idUsuario = +document.getElementById('nj-user').value;
    const motivo = document.getElementById('nj-mot').value.trim();
    const fecha = document.getElementById('nj-fec').value;
    const descripcion = document.getElementById('nj-desc').value.trim();
    const err = document.getElementById('nj-err');
    if (!idUsuario || !motivo || !descripcion) {
      err.textContent = 'Seleccione el colaborador y complete el motivo y la descripción.';
      err.classList.remove('hidden');
      return;
    }
    const btn = document.getElementById('nj-save'); btn.disabled = true;
    try {
      await S.crearJustificacion({ idUsuario, motivo, descripcion, fecha });
      toast('Justificación registrada correctamente');
      closeModal();
      await load();
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden'); btn.disabled = false;
    }
  };
}
