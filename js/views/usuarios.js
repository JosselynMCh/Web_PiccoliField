import { S, settle } from '../data.js';
import { AuthService } from '../auth.js';
import { esc, num, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, estadoBadge, badge, label, avatar, progressBar, pick, fmtDateTime,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast, debounce, getCustomAvatar, setCustomAvatar } from '../ui.js';

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
  const { data, errors } = await settle({
    imp: S.impulsadores,
    col: S.asistColaboradores,
    rec: S.asistRecientes,
    vend: S.vendedores,
    pdv: () => S.puntosVenta()
  });
  busy = false;
  if (!root) return;
  if (!data.imp && !data.col && !data.rec) {
    root.innerHTML = errorHTML((errors.imp || errors.col || errors.rec)?.message || 'Error', 'btn-retry');
    root.querySelector('#btn-retry').onclick = () => render(root);
    return;
  }
  const map = new Map();

  // 1) Administrador en sesión (desde GET /perfil)
  const admin = AuthService.getUser();
  if (admin && (admin.id || admin.correo)) {
    const k = String(admin.id || admin.correo);
    map.set(k, {
      id: admin.id,
      nombre: admin.nombre || 'Administrador',
      correo: admin.correo || '',
      rol: 'ADMINISTRADOR',
      meta: 0,
      local: admin.sede || 'Sede Central',
      foto: admin.foto || ''
    });
  }

  // 2) Impulsadores y personal de supervisión (incluye url_foto)
  (data.imp || []).forEach(p => {
    const k = String(p.id);
    const prev = map.get(k) || {};
    map.set(k, { ...prev, ...p, foto: p.foto || prev.foto || '' });
  });

  // 3) Colaboradores y asistencias recientes (incluye foto_perfil = url_foto)
  [...(data.col || []), ...(data.rec || [])].forEach(c => {
    const k = String(c.idUsuario || c.nombre);
    const cur = map.get(k) || {
      id: c.idUsuario,
      nombre: c.nombre,
      rol: (c.rol || 'TRABAJADOR').toUpperCase(),
      correo: '',
      meta: 0,
      local: c.sede,
      foto: c.foto || ''
    };
    if (!cur.asist || (c.fecha && (!cur.asist.fecha || String(c.fecha) > String(cur.asist.fecha)))) cur.asist = c;
    if (!cur.local || cur.local === '—') cur.local = c.sede;
    if (!cur.foto && c.foto) cur.foto = c.foto;
    if (!cur.rol && c.rol) cur.rol = String(c.rol).toUpperCase();
    map.set(k, cur);
  });

  // 4) Promotores e impulsadores asignados en puntos de venta
  (data.pdv || []).forEach(pv => {
    if (!pv.idUsuario && !pv.responsable) return;
    const k = String(pv.idUsuario || pv.responsable);
    const cur = map.get(k) || {
      id: pv.idUsuario,
      nombre: pv.responsable,
      correo: pv.correoResponsable || '',
      rol: (pv.rolResponsable || (pv.tipo.startsWith('DIST') ? 'PROMOTOR' : 'IMPULSADOR')).toUpperCase(),
      meta: 0,
      local: pv.nombre,
      foto: pv.fotoResponsable || ''
    };
    if (!cur.correo && pv.correoResponsable) cur.correo = pv.correoResponsable;
    if (!cur.rol && pv.rolResponsable) cur.rol = pv.rolResponsable.toUpperCase();
    if (!cur.local || cur.local === '—') cur.local = pv.nombre;
    if (!cur.foto && pv.fotoResponsable) cur.foto = pv.fotoResponsable;
    map.set(k, cur);
  });

  // 5) Ventas y metas
  (data.vend || []).forEach(v => {
    const p = map.get(String(v.id));
    if (p) {
      p.vendido = v.vendido;
      p.meta = p.meta || v.meta;
      if (!p.foto && v.foto) p.foto = v.foto;
    }
  });

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
    <tbody class="divide-y divide-stone-100">${rows.map((p, i) => `<tr class="hover:bg-brand-ivory/50"><td class="p-3"><div class="flex items-center gap-2.5">${avatar(p.nombre, { id: p.id, src: p.foto, size: 'w-10 h-10' })}<div><b>${esc(p.nombre)}</b><div class="text-stone-500">${esc(p.correo || '—')}</div>${p.foto ? `<div class="text-[10px] text-stone-400 font-mono truncate max-w-[200px]" title="${esc(p.foto)}">${esc(p.foto)}</div>` : ''}</div></div></td>
      <td class="p-3">${badge(p.rol || '—', p.rol === 'ADMINISTRADOR' ? 'brand' : p.rol === 'PROMOTOR' ? 'warn' : 'info')}</td><td class="p-3">${esc(p.local || '—')}</td>
      <td class="p-3">${p.meta ? progressBar(num(p.vendido), p.meta) : '<span class="text-stone-400">—</span>'}</td><td class="p-3">${p.asist ? estadoBadge(p.asist.estado === 'A_TIEMPO' ? 'A TIEMPO' : p.asist.estado) : '<span class="text-stone-400">—</span>'}</td>
      <td class="p-3 text-right"><button data-i="${i}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">Ficha / Foto</button></td></tr>`).join('')}</tbody></table></div>`);
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => ficha(rows[+b.dataset.i]));
}

async function ficha(p) {
  openModal(modalHeader(esc(p.nombre), esc(p.rol)) + `<div class="p-5">${loadingHTML('Cargando ficha...')}</div>`, true);
  const { data } = await settle({
    det: () => (p.rol === 'IMPULSADOR' && p.id ? S.vendedorDetalle(p.id) : Promise.resolve({})),
    hist: () => (p.id ? S.asistHistorial(p.id) : Promise.resolve([]))
  });
  const d = data.det || {}, hist = data.hist || [];
  const customFoto = getCustomAvatar(p.id, p.nombre);
  openModal(modalHeader(esc(p.nombre), `${esc(p.rol)} ${p.correo ? '· ' + esc(p.correo) : ''}`) + `
    <div class="p-5 space-y-4 text-xs">
      <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
        <div class="flex items-center gap-3 min-w-0">
          <div id="fu-avatar-box">${avatar(p.nombre, { id: p.id, src: p.foto, size: 'w-16 h-16 text-base' })}</div>
          <div class="min-w-0">
            <div class="text-sm font-black truncate">${esc(p.nombre)}</div>
            <div class="text-stone-500 truncate">${esc(p.local || 'Sin sede asignada')}</div>
            <div class="text-[10px] text-stone-400 font-mono truncate mt-0.5">url_foto API: ${esc(p.foto || (p.id ? `supervision/impulsadores/${p.id}/foto` : 'uploads/perfiles/default'))}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <label class="${btnPrimary} cursor-pointer">
            <i class="fa-solid fa-camera"></i> Subir foto
            <input id="fu-file" type="file" accept="image/*" class="hidden">
          </label>
          ${customFoto ? `<button id="fu-clear-foto" class="${btnGhost}"><i class="fa-solid fa-rotate-left"></i> Usar foto API</button>` : ''}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3"><div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Meta</div><div class="text-lg font-black">${p.meta || '—'}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Vendido</div><div class="text-lg font-black">${num(pick(d, 'cantidadVendida', 'monto_vendido'), num(p.vendido))}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Logro</div><div class="text-lg font-black">${d.porcentaje_logro != null ? Math.round(d.porcentaje_logro) + '%' : '—'}</div></div></div>
      <div><h4 class="font-black mb-2">Últimos turnos</h4>${hist.length ? `<div class="max-h-44 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100">${hist.slice(0, 30).map(h => `<div class="p-2.5 flex justify-between">${badge(h.tipo || '—', h.tipo === 'INGRESO' ? 'info' : 'neutral')}<span>${fmtDateTime(h.fecha_hora)}</span></div>`).join('')}</div>` : emptyHTML('Sin marcaciones registradas')}</div>
      ${p.rol === 'IMPULSADOR' ? `<div class="p-3 rounded-xl bg-brand-ivory border border-brand-gold/30"><h4 class="font-black mb-2">Reasignar a un punto de venta</h4>
        <div class="flex flex-wrap gap-2"><select id="fu-pdv" class="${inputCls} flex-1"><option value="">Seleccione PDV...</option>${pdvs.filter(x => !x.tipo.startsWith('DIST')).map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select>
        <input id="fu-mot" class="${inputCls} flex-1" placeholder="Motivo del cambio"><button id="fu-ok" class="${btnPrimary}">Reasignar</button></div><div id="fu-err" class="text-rose-600 font-bold mt-1 hidden"></div></div>` : ''}
    </div>`, true);

  document.getElementById('fu-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const dataUrl = cv.toDataURL('image/jpeg', 0.85);
        setCustomAvatar({ id: p.id, name: p.nombre }, dataUrl);
        p.foto = dataUrl;
        try {
          if (p.id) {
            const res = await S.actualizarFotoUsuario(p.id, dataUrl);
            if (res?.data?.url_foto) p.foto = res.data.url_foto;
          }
          toast('Foto guardada en la base de datos (url_foto)');
        } catch {
          toast('Foto actualizada en este navegador (recuerde hacer deploy del backend en Render)', 'info');
        }
        window.dispatchEvent(new CustomEvent('piccoli:avatar-updated'));
        ficha(p);
        draw();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('fu-clear-foto')?.addEventListener('click', () => {
    setCustomAvatar({ id: p.id, name: p.nombre }, '');
    window.dispatchEvent(new CustomEvent('piccoli:avatar-updated'));
    toast('Se restauró la foto de la API (url_foto)');
    ficha(p);
    draw();
  });

  document.getElementById('fu-ok')?.addEventListener('click', async () => {
    const pdv = document.getElementById('fu-pdv').value, mot = document.getElementById('fu-mot').value.trim(), err = document.getElementById('fu-err');
    if (!pdv || !mot) { err.textContent = 'Seleccione el PDV e indique el motivo.'; err.classList.remove('hidden'); return; }
    try { await S.reasignar(+p.id, +pdv, mot); toast('Impulsador reasignado'); closeModal(); await load(); } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
  });
}
