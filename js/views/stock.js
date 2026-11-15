import { S, settle } from '../data.js';
import { api } from '../api.js';
import { esc, num, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, badge, label, avatar, resolveImg, fmtDateTime,
  inputCls, btnGhost, btnOk, btnDanger, openModal, closeModal, modalHeader, toast, debounce } from '../ui.js';

let root, alertas = [], busy = false;
const f = { q: '', estado: '', nivel: '' };

export async function render(container) {
  root = container; Object.assign(f, { q: '', estado: '', nivel: '' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) await load(); }
export function destroy() { root = null; }

async function load() {
  busy = true;
  let data, err;
  try { data = await S.alertas(); } catch (e) { err = e; }
  busy = false;
  if (!root) return;
  if (err) { root.innerHTML = errorHTML(err.message, 'btn-retry'); root.querySelector('#btn-retry').onclick = () => render(root); return; }
  alertas = data.sort((a, b) => String(b.fechaEmision + b.horaEmision).localeCompare(String(a.fechaEmision + a.horaEmision)));
  frame(); draw();
}

function frame() {
  if (root.querySelector('#st-body')) return;
  root.innerHTML = `
    ${pageHeader('Stock y Alertas con Evidencia', 'Alertas de stock bajo y quiebre con severidad, evidencia fotográfica (marca de agua y hash SHA-256) y atención con comentario.',
      `<button id="st-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
    <div id="st-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
    <div id="st-rank" class="mb-4"></div>
    <div class="flex flex-wrap gap-2 mb-3">
      <input id="st-q" class="${inputCls} sm:w-56" placeholder="Buscar producto o punto de venta...">
      <select id="st-estado" class="${inputCls} sm:w-40"><option value="">Todos los estados</option><option>PENDIENTE</option><option>ATENDIDA</option><option>IGNORADA</option></select>
      <select id="st-nivel" class="${inputCls} sm:w-40"><option value="">Toda severidad</option><option>ALTA</option><option>MEDIA</option><option>BAJA</option></select>
    </div><div id="st-body"></div>`;
  root.querySelector('#st-refresh').onclick = () => load();
  root.querySelector('#st-q').oninput = debounce(e => { f.q = e.target.value.toLowerCase(); draw(); });
  root.querySelector('#st-estado').onchange = e => { f.estado = e.target.value; draw(); };
  root.querySelector('#st-nivel').onchange = e => { f.nivel = e.target.value; draw(); };
}

const isCritical = (a) => a.nivel === 'ALTA' || a.tipo.includes('AGOTADO');

function draw() {
  const c = (fn) => alertas.filter(fn).length;
  root.querySelector('#st-kpis').innerHTML = kpi('Alertas totales', alertas.length, 'fa-bell', 'text-brand-gold') + kpi('Pendientes', c(a => a.estado === 'PENDIENTE'), 'fa-hourglass-half', 'text-amber-600') +
    kpi('Críticas / agotados', c(a => a.estado === 'PENDIENTE' && isCritical(a)), 'fa-triangle-exclamation', 'text-rose-600') + kpi('Atendidas', c(a => a.estado === 'ATENDIDA'), 'fa-circle-check', 'text-emerald-600');
  const by = {};
  alertas.filter(a => a.estado === 'PENDIENTE').forEach(a => { by[a.producto] = (by[a.producto] || 0) + 1; });
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5);
  root.querySelector('#st-rank').innerHTML = top.length ? card(`<div class="p-4"><h3 class="text-xs font-black mb-2">Ranking de quiebres por producto (pendientes)</h3><div class="flex flex-wrap gap-2">${top.map(([p, n]) => `<span class="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold">${esc(p)} · ${n}</span>`).join('')}</div></div>`) : '';
  const rows = alertas.filter(a => (!f.q || (a.producto + a.local).toLowerCase().includes(f.q)) && (!f.estado || a.estado === f.estado) && (!f.nivel || a.nivel === f.nivel));
  const body = root.querySelector('#st-body');
  if (!rows.length) { body.innerHTML = card(emptyHTML('No hay alertas con esos filtros.', 'fa-bell-slash')); return; }
  body.innerHTML = card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr>
    <th class="p-3 text-left">Producto</th><th class="p-3 text-left">Punto de venta</th><th class="p-3 text-left">Tipo</th><th class="p-3 text-left">Severidad</th><th class="p-3 text-left">Estado</th><th class="p-3 text-left">Emisión</th><th class="p-3 text-left">Atención</th><th></th></tr></thead>
    <tbody class="divide-y divide-stone-100">${rows.map((a, i) => `<tr class="hover:bg-brand-ivory/50 ${a.estado === 'PENDIENTE' && isCritical(a) ? 'bg-rose-50/40' : ''}">
      <td class="p-3 font-bold">${esc(a.producto)}</td><td class="p-3">${esc(a.local)}</td><td class="p-3">${esc(label(a.tipo) || '—')}</td>
      <td class="p-3">${estadoBadge(a.nivel || '—')}</td><td class="p-3">${estadoBadge(a.estado)}</td>
      <td class="p-3 whitespace-nowrap">${fmtDateTime(a.fechaEmision ? `${a.fechaEmision} ${a.horaEmision || ''}`.trim() : '')}</td>
      <td class="p-3 whitespace-nowrap">${a.fechaAtencion ? fmtDateTime(`${a.fechaAtencion} ${a.horaAtencion || ''}`.trim()) : '—'}</td>
      <td class="p-3 text-right"><button data-i="${i}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">${a.estado === 'PENDIENTE' ? 'Atender' : 'Ver'}</button></td></tr>`).join('')}</tbody></table></div>`);
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => detail(rows[+b.dataset.i]));
}

async function fetchBlob(src) {
  const url = /^https?:\/\//.test(src) ? src : api.buildUrl(src);
  const tryFetch = async (auth) => {
    const r = await fetch(url, { headers: auth ? { Authorization: `Bearer ${api.getToken()}` } : {} });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json')) { const j = await r.json(); const v = j?.data?.url || j?.data?.foto || (typeof j?.data === 'string' ? j.data : ''); if (!v) throw new Error('Sin imagen'); return fetchBlob(v.startsWith('data:') ? v : v.startsWith('http') ? v : `data:image/jpeg;base64,${v}`); }
    return r.blob();
  };
  if (src.startsWith('data:')) return (await fetch(src)).blob();
  try { return await tryFetch(false); } catch { return tryFetch(true); }
}

async function sha256(blob) {
  const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function detail(a0) {
  openModal(modalHeader('Alerta de stock', esc(a0.local)) + `<div class="p-5">${loadingHTML('Cargando detalle de la alerta y evidencia...')}</div>`, true);
  let a = a0;
  try { const d = await S.alertaDetalle(a0.id); a = { ...a0, ...Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'raw')) }; } catch { /* usa datos de la lista */ }
  const pend = a.estado === 'PENDIENTE';
  openModal(modalHeader(esc(a.producto), `${esc(a.local)} ${a.direccion ? '· ' + esc(a.direccion) : ''}`) + `
    <div class="p-5 space-y-4 text-xs">
      <div class="flex flex-wrap gap-2 items-center">${estadoBadge(a.nivel || '—')} ${estadoBadge(a.estado)} ${badge(label(a.tipo) || 'ALERTA', 'neutral')}</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Stock actual</div><div class="text-lg font-black ${num(a.stock) <= 0 ? 'text-rose-600' : ''}">${a.stock ?? '—'}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Stock mínimo</div><div class="text-lg font-black">${a.minimo ?? '—'}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Emitida</div>${fmtDateTime(a.fechaEmision ? `${a.fechaEmision} ${a.horaEmision || ''}`.trim() : '')}</div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Atendida</div>${a.fechaAtencion ? fmtDateTime(`${a.fechaAtencion} ${a.horaAtencion || ''}`.trim()) : '—'}</div></div>
      <div class="grid md:grid-cols-2 gap-4">
        <div><h4 class="font-black mb-2">Evidencia fotográfica</h4>
          <div id="ev-box" class="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-50 min-h-40 flex items-center justify-center text-stone-400">${loadingHTML('Cargando foto...')}</div>
          <div class="mt-2 p-2 rounded-lg bg-stone-900 text-emerald-300 font-mono text-[10px] break-all" id="ev-hash">SHA-256: calculando...</div></div>
        <div class="space-y-3">
          <div class="p-3 rounded-xl border border-brand-gold/40 bg-brand-ivory flex items-center gap-3">${avatar(a.responsable || '?', { auth: a.responsableId ? `supervision/impulsadores/${a.responsableId}/foto` : '', src: a.responsableFoto })}
            <div><div class="text-[10px] uppercase font-bold text-stone-500">Reportado por</div><b>${esc(a.responsable || 'No registrado')}</b><div class="text-stone-500">${esc(a.responsableRol || '')}</div></div></div>
          ${a.comentario ? `<div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500 mb-1">Comentario</div>${esc(a.comentario)}</div>` : ''}
          ${pend ? `<div><label class="font-black block mb-1">Comentario de atención *</label><textarea id="al-com" rows="3" class="${inputCls}" placeholder="Acción tomada: reposición, coordinación con almacén..."></textarea></div><div id="al-err" class="text-rose-600 font-bold hidden"></div>` : ''}</div></div>
      ${pend ? `<div class="flex justify-end gap-2"><button id="al-ign" class="${btnDanger}"><i class="fa-solid fa-ban"></i> Ignorar</button><button id="al-ok" class="${btnOk}"><i class="fa-solid fa-check"></i> Atender alerta</button></div>` : ''}
    </div>`, true);

  // Evidencia: foto de la alerta o foto del producto; hash SHA-256 calculado sobre los bytes reales
  const candidates = [a.fotoProducto && resolveImg(a.fotoProducto), a.idProducto && `supervision/productos/${a.idProducto}/foto`].filter(Boolean);
  const box = document.getElementById('ev-box'), hashEl = document.getElementById('ev-hash');
  let done = false;
  for (const src of candidates) {
    try {
      const blob = await fetchBlob(src);
      const url = URL.createObjectURL(blob);
      box.innerHTML = `<img src="${url}" class="w-full max-h-72 object-contain cursor-zoom-in" alt="Evidencia" id="ev-img">
        <div class="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] font-bold px-2 py-1 flex justify-between"><span>PICCOLIFIELD · ${esc(a.local)}</span><span>${esc(a.fechaEmision || '')} ${esc(a.horaEmision || '')}</span></div>`;
      document.getElementById('ev-img').onclick = () => window.open(url, '_blank');
      const server = a.hash ? `<br><span class="text-stone-400">Registrado:</span> ${esc(a.hash)}` : '';
      hashEl.innerHTML = `SHA-256 (verificado en navegador): ${await sha256(blob)}${server}`;
      done = true; break;
    } catch { /* siguiente candidato */ }
  }
  if (!done) { box.innerHTML = '<div class="p-6 text-center">La API no entregó una foto de evidencia para esta alerta.</div>'; hashEl.textContent = a.hash ? 'SHA-256 registrado: ' + a.hash : 'SHA-256: sin evidencia disponible'; }

  if (pend) {
    const send = async (kind) => {
      const com = document.getElementById('al-com').value.trim(), err = document.getElementById('al-err');
      if (!com) { err.textContent = 'El comentario es obligatorio.'; err.classList.remove('hidden'); return; }
      document.querySelectorAll('#al-ok,#al-ign').forEach(b => b.disabled = true);
      try { await (kind === 'atender' ? S.atenderAlerta(a.id, com) : S.ignorarAlerta(a.id, com)); toast(kind === 'atender' ? 'Alerta atendida' : 'Alerta ignorada'); closeModal(); await load(); }
      catch (e) { err.textContent = e.message; err.classList.remove('hidden'); document.querySelectorAll('#al-ok,#al-ign').forEach(b => b.disabled = false); }
    };
    document.getElementById('al-ok').onclick = () => send('atender');
    document.getElementById('al-ign').onclick = () => send('ignorar');
  }
}
