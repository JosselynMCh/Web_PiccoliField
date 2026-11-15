import { S, settle } from '../data.js';
import { esc, num, money, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, progressBar, estadoBadge, label, avatar, pick, pct, fmtDateTime,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast, debounce, dateOnly } from '../ui.js';

let root, tab = 'ranking', vend = [], pdvs = [], productos = [], pedidos = null, busy = false, charts = [];
const f = { q: '', pdv: '', estado: '' };
export const PEDIDO_ESTADOS = ['REGISTRADO', 'EN_PREPARACION', 'ENTREGADO', 'CANCELADO'];

export async function render(container) {
  root = container; tab = 'ranking'; pedidos = null; Object.assign(f, { q: '', pdv: '', estado: '' });
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) { await load(true); } }
export function destroy() { charts.forEach(c => c.destroy()); charts = []; root = null; }

async function load() {
  busy = true;
  const { data, errors } = await settle({ vend: S.vendedores, pdv: () => S.puntosVenta(), prod: () => S.productos(), resumen: S.resumen });
  busy = false;
  if (!root) return;
  if (!data.vend) { root.innerHTML = errorHTML(errors.vend?.message || 'Error', 'btn-retry'); root.querySelector('#btn-retry').onclick = () => render(root); return; }
  vend = data.vend.slice().sort((a, b) => b.vendido - a.vendido); pdvs = data.pdv || []; productos = data.prod || [];
  root._monto = data.resumen?.monto_total_ventas;
  if (tab === 'pedidos' && pedidos) await loadPedidos();
  draw();
}

function draw() {
  if (!root) return;
  const totalUds = vend.reduce((s, v) => s + v.vendido, 0);
  const conMeta = vend.filter(v => v.meta > 0);
  const cumplen = conMeta.filter(v => v.vendido >= v.meta).length;
  root.innerHTML = `
    ${pageHeader('Ventas, Metas y Pedidos', 'Monto vendido, ranking y avance de cada impulsador frente a su meta mensual, y pedidos de distribución por punto de venta.',
      `<button id="v-refresh" class="${btnGhost}"><i class="fa-solid fa-rotate"></i> Actualizar</button>`)}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      ${kpi('Monto total vendido', money(root._monto), 'fa-sack-dollar', 'text-emerald-600')}
      ${kpi('Unidades vendidas', totalUds, 'fa-bottle-water', 'text-brand-gold')}
      ${kpi('Impulsadores', vend.length, 'fa-users', 'text-sky-600')}
      ${kpi('Cumplen meta', `${cumplen}/${conMeta.length}`, 'fa-bullseye', 'text-emerald-600')}
    </div>
    <div class="inline-flex bg-stone-100 rounded-xl p-1 text-xs font-bold mb-3">
      ${['ranking', 'pedidos'].map(t => `<button data-tab="${t}" class="px-4 py-1.5 rounded-lg ${tab === t ? 'bg-white shadow text-brand-chocolate' : 'text-stone-500'}">${t === 'ranking' ? 'Ranking y metas' : 'Pedidos de distribución'}</button>`).join('')}
    </div><div id="v-body"></div>`;
  root.querySelector('#v-refresh').onclick = () => load();
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = async () => { tab = b.dataset.tab; if (tab === 'pedidos' && !pedidos) { draw(); await loadPedidos(); } draw(); });
  if (tab === 'ranking') drawRanking(); else drawPedidos();
}

function drawRanking() {
  const body = root.querySelector('#v-body');
  if (!vend.length) { body.innerHTML = card(emptyHTML('No hay ventas registradas todavía.', 'fa-chart-simple')); return; }
  body.innerHTML = `<div class="grid lg:grid-cols-3 gap-4">
    ${card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr><th class="p-3 w-10">#</th><th class="p-3 text-left">Impulsador</th><th class="p-3 text-left">Punto de venta</th><th class="p-3 text-right">Vendido</th><th class="p-3 w-48 text-left">Avance vs meta</th><th></th></tr></thead>
      <tbody class="divide-y divide-stone-100">${vend.map((v, i) => `<tr class="hover:bg-brand-ivory/50">
        <td class="p-3 text-center font-black ${i < 3 ? 'text-brand-gold' : 'text-stone-400'}">${i + 1}</td>
        <td class="p-3"><div class="flex items-center gap-2">${avatar(v.nombre, { auth: v.id ? `supervision/impulsadores/${v.id}/foto` : '' })}<b>${esc(v.nombre)}</b></div></td>
        <td class="p-3">${esc(v.local)}</td><td class="p-3 text-right font-black">${v.vendido}</td>
        <td class="p-3">${v.meta ? progressBar(v.vendido, v.meta) : '<span class="text-stone-400">Sin meta</span>'}</td>
        <td class="p-3 text-right"><button data-i="${i}" class="px-2.5 py-1 rounded-lg bg-brand-chocolate text-white text-[11px] font-bold">Detalle</button></td></tr>`).join('')}</tbody></table></div>`, 'lg:col-span-2')}
    ${card(`<div class="p-4 border-b border-stone-100"><h3 class="text-sm font-black">Vendido vs meta</h3></div><div class="p-4 h-80"><canvas id="v-ch"></canvas></div>`)}</div>`;
  body.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => detail(vend[+b.dataset.i]));
  charts.forEach(c => c.destroy()); charts = [];
  const t = vend.slice(0, 10);
  if (window.Chart) charts.push(new Chart(body.querySelector('#v-ch'), { type: 'bar', data: { labels: t.map(v => v.nombre.split(' ')[0]),
    datasets: [{ label: 'Vendido', data: t.map(v => v.vendido), backgroundColor: '#C99A32' }, { label: 'Meta', data: t.map(v => v.meta), backgroundColor: '#4A2B1C' }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } } } }));
}

async function detail(v) {
  openModal(modalHeader(esc(v.nombre), esc(v.local)) + `<div class="p-5">${loadingHTML('Consultando detalle y rendimiento histórico...')}</div>`, true);
  const anio = new Date().getFullYear();
  const { data } = await settle({ det: () => S.vendedorDetalle(v.id), rend: () => S.rendimiento(v.id, anio) });
  const d = data.det || {}, r = data.rend || {};
  const meses = r.avance_mensual?.length ? r.avance_mensual : (r.desempeno_mensual || []);
  const prods = d.productos_vendidos || [];
  const hist = r.historial_asignaciones || [];
  openModal(modalHeader(esc(d.nombre || v.nombre), esc(d.local_pertenece || v.local)) + `
    <div class="p-5 space-y-4 text-xs">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Vendido</div><div class="text-lg font-black">${num(pick(d, 'cantidadVendida', 'monto_vendido'), v.vendido)}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Meta</div><div class="text-lg font-black">${num(d.meta_asignada, v.meta)}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Logro</div><div class="text-lg font-black">${Math.round(num(d.porcentaje_logro, pct(v.vendido, v.meta)))}%</div></div></div>
      <div class="grid md:grid-cols-2 gap-4">
        <div><h4 class="font-black mb-2">Productos vendidos</h4>${prods.length ? `<div class="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-56 overflow-y-auto">${prods.map(p => `<div class="p-2.5 flex justify-between"><span>${esc(p.nombre_producto)}</span><b>${p.cantidad_vendida}</b></div>`).join('')}</div>` : emptyHTML('Sin productos vendidos')}</div>
        <div><h4 class="font-black mb-2">Rendimiento mensual ${anio}</h4>${meses.length ? '<div class="h-56"><canvas id="m-ch"></canvas></div>' : emptyHTML('Sin histórico disponible')}</div></div>
      ${hist.length ? `<div><h4 class="font-black mb-2">Historial de asignaciones</h4><div class="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-44 overflow-y-auto">${hist.map(h => `<div class="p-2.5 flex justify-between gap-2"><b>${esc(h.puntoVenta || '')}</b><span>${esc(dateOnly(h.fecha_inicio))} → ${esc(dateOnly(h.fecha_fin) || 'actual')}</span></div>`).join('')}</div></div>` : ''}
    </div>`, true);
  const cv = document.getElementById('m-ch');
  if (cv && window.Chart) {
    const ch = new Chart(cv, { type: 'bar', data: { labels: meses.map(m => m.mes_nombre || m.mes_anio || m.mes),
      datasets: [{ label: 'Vendido', data: meses.map(m => num(m.monto_vendido)), backgroundColor: '#C99A32' },
        { label: 'Meta', type: 'line', data: meses.map(m => num(pick(m, 'meta_mensual', 'meta_asignada', 'meta_ventas_asignada'))), borderColor: '#4A2B1C', tension: .3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } } } });
    charts.push(ch);
  }
}

/* ---------------- Pedidos ---------------- */
async function loadPedidos() {
  const ids = pdvs.map(p => p.id).filter(Boolean);
  const out = [];
  for (let i = 0; i < ids.length; i += 6) {
    const chunk = ids.slice(i, i + 6);
    const rs = await Promise.allSettled(chunk.map(id => S.pedidos(id)));
    rs.forEach((r, k) => { if (r.status === 'fulfilled') r.value.forEach(p => out.push({ ...p, _pdv: chunk[k] })); });
  }
  pedidos = out;
}

function drawPedidos() {
  const body = root.querySelector('#v-body');
  if (!pedidos) { body.innerHTML = card(loadingHTML('Consultando pedidos de todos los puntos de venta...')); return; }
  const pn = (id) => pdvs.find(p => String(p.id) === String(id))?.nombre || 'PDV ' + id;
  const prodN = (id) => { const p = productos.find(x => String(pick(x, 'idProductos', 'id')) === String(id)); return pick(p, 'producto', 'nombre') || 'Producto ' + id; };
  const rows = pedidos.map(p => ({ raw: p, id: pick(p, 'idPedido', 'id'), pdv: pick(p, 'idPuntosVenta') ?? p._pdv, prod: pick(p, 'producto', 'nombre_producto') || prodN(pick(p, 'idProductos')),
    cant: num(pick(p, 'cantSolicitada', 'cantidad')), fecha: p.fecha, estado: String(pick(p, 'estado', 'estado_pedido', 'estadoDespacho') || 'REGISTRADO').toUpperCase().replace(/ /g, '_') }))
    .filter(r => (!f.pdv || String(r.pdv) === f.pdv) && (!f.estado || r.estado === f.estado) && (!f.q || (r.prod + pn(r.pdv)).toLowerCase().includes(f.q)));
  body.innerHTML = `<div class="flex flex-wrap gap-2 mb-3">
    <input id="p-q" value="${esc(f.q)}" class="${inputCls} sm:w-52" placeholder="Buscar producto o PDV...">
    <select id="p-pdv" class="${inputCls} sm:w-56"><option value="">Todos los PDV</option>${pdvs.map(p => `<option value="${p.id}" ${f.pdv == p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
    <select id="p-est" class="${inputCls} sm:w-44"><option value="">Todos los estados</option>${PEDIDO_ESTADOS.map(e => `<option value="${e}" ${f.estado === e ? 'selected' : ''}>${label(e)}</option>`).join('')}</select></div>
    ${card(rows.length ? `<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr><th class="p-3 text-left">Nº</th><th class="p-3 text-left">Punto de venta</th><th class="p-3 text-left">Producto</th><th class="p-3 text-right">Cantidad</th><th class="p-3 text-left">Fecha</th><th class="p-3 text-left">Estado</th></tr></thead>
    <tbody class="divide-y divide-stone-100">${rows.map(r => `<tr class="hover:bg-brand-ivory/50"><td class="p-3 font-black">#${r.id}</td><td class="p-3">${esc(pn(r.pdv))}</td><td class="p-3">${esc(r.prod)}</td><td class="p-3 text-right font-bold">${r.cant}</td><td class="p-3">${fmtDateTime(r.fecha)}</td>
      <td class="p-3"><select data-id="${r.id}" data-prev="${r.estado}" class="px-2 py-1 rounded-lg border border-stone-300 text-[11px] font-bold">${[...new Set([r.estado, ...PEDIDO_ESTADOS])].map(e => `<option value="${e}" ${e === r.estado ? 'selected' : ''}>${label(e)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`
      : emptyHTML('No hay pedidos registrados para los filtros seleccionados.', 'fa-truck-ramp-box'))}`;
  body.querySelector('#p-q').oninput = debounce(e => { f.q = e.target.value.toLowerCase(); drawPedidos(); });
  body.querySelector('#p-pdv').onchange = e => { f.pdv = e.target.value; drawPedidos(); };
  body.querySelector('#p-est').onchange = e => { f.estado = e.target.value; drawPedidos(); };
  body.querySelectorAll('select[data-id]').forEach(s => s.onchange = async () => {
    s.disabled = true;
    try { await S.estadoPedido(s.dataset.id, s.value); toast(`Pedido #${s.dataset.id} → ${label(s.value)}`); await loadPedidos(); drawPedidos(); }
    catch (e) { toast(e.message, 'error'); s.value = s.dataset.prev; s.disabled = false; }
  });
}
