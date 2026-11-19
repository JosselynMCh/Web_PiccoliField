import { S, settle } from '../data.js';
import { esc, num, money, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, progressBar, avatar, pick, pct, fmtDate,
  inputCls, btnGhost, btnPrimary, openModal, closeModal, modalHeader, toast } from '../ui.js';

let root, vend = [], pdvs = [], busy = false, charts = [];

export async function render(container) {
  root = container;
  root.innerHTML = loadingHTML(); await load();
}
export async function refresh() { if (root && !busy) { await load(true); } }
export function destroy() { charts.forEach(c => c.destroy()); charts = []; root = null; }

async function load() {
  busy = true;
  const { data, errors } = await settle({ vend: S.vendedores, pdv: () => S.puntosVenta(), resumen: S.resumen });
  busy = false;
  if (!root) return;
  if (!data.vend) { root.innerHTML = errorHTML(errors.vend?.message || 'Error', 'btn-retry'); root.querySelector('#btn-retry').onclick = () => render(root); return; }
  vend = data.vend.slice().sort((a, b) => b.vendido - a.vendido);
  pdvs = data.pdv || [];
  root._monto = data.resumen?.monto_total_ventas;
  draw();
}

function draw() {
  if (!root) return;
  const totalUds = vend.reduce((s, v) => s + v.vendido, 0);
  const conMeta = vend.filter(v => v.meta > 0);
  const cumplen = conMeta.filter(v => v.vendido >= v.meta).length;
  root.innerHTML = `
    ${pageHeader('Ventas y Metas de Impulsadores', 'Monto vendido, ranking y avance de cada impulsador frente a su meta mensual, rendimiento histórico y reasignación de sede.')}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      ${kpi('Monto total vendido', money(root._monto), 'fa-sack-dollar', 'text-emerald-600')}
      ${kpi('Unidades vendidas', totalUds, 'fa-bottle-water', 'text-brand-gold')}
      ${kpi('Impulsadores', vend.length, 'fa-users', 'text-sky-600')}
      ${kpi('Cumplen meta', `${cumplen}/${conMeta.length}`, 'fa-bullseye', 'text-emerald-600')}
    </div>
    <div id="v-body"></div>`;
  drawRanking();
}

function drawRanking() {
  const body = root.querySelector('#v-body');
  if (!vend.length) { body.innerHTML = card(emptyHTML('No hay ventas registradas todavía.', 'fa-chart-simple')); return; }
  body.innerHTML = `<div class="grid lg:grid-cols-3 gap-4">
    ${card(`<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500"><tr><th class="p-3 w-10">#</th><th class="p-3 text-left">Impulsador</th><th class="p-3 text-left">Punto de venta</th><th class="p-3 text-right">Vendido</th><th class="p-3 w-48 text-left">Avance vs meta</th><th></th></tr></thead>
      <tbody class="divide-y divide-stone-100">${vend.map((v, i) => `<tr class="hover:bg-brand-ivory/50">
        <td class="p-3 text-center font-black ${i < 3 ? 'text-brand-gold' : 'text-stone-400'}">${i + 1}</td>
        <td class="p-3"><div class="flex items-center gap-2">${avatar(v.nombre, { id: v.id, src: v.foto })}<b>${esc(v.nombre)}</b></div></td>
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
  openModal(modalHeader(esc(v.nombre), esc(v.local)) + `<div class="p-5">${loadingHTML('Consultando detalle, rendimiento histórico y asignaciones...')}</div>`, true);
  const anio = new Date().getFullYear();
  const { data } = await settle({
    det: () => S.vendedorDetalle(v.id),
    rend: () => S.rendimiento(v.id, anio),
    histAsig: () => S.vendedorHistorialAsignaciones(v.id)
  });
  const d = data.det || {}, r = data.rend || {};
  const meses = r.avance_mensual?.length ? r.avance_mensual : (r.desempeno_mensual || []);
  const prods = d.productos_vendidos || [];
  const hist = (data.histAsig && data.histAsig.length) ? data.histAsig : (r.historial_asignaciones || []);
  const pdvsVenta = pdvs.filter(x => !x.tipo.startsWith('DIST'));

  openModal(modalHeader(esc(d.nombre || v.nombre), esc(d.local_pertenece || v.local)) + `
    <div class="p-5 space-y-4 text-xs">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Vendido</div><div class="text-lg font-black">${num(pick(d, 'cantidadVendida', 'monto_vendido'), v.vendido)}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Meta</div><div class="text-lg font-black">${num(d.meta_asignada, v.meta)}</div></div>
        <div class="p-3 rounded-xl bg-stone-50"><div class="text-[10px] uppercase font-bold text-stone-500">Logro</div><div class="text-lg font-black">${Math.round(num(d.porcentaje_logro, pct(v.vendido, v.meta)))}%</div></div></div>
      <div class="grid md:grid-cols-2 gap-4">
        <div><h4 class="font-black mb-2">Productos vendidos</h4>${prods.length ? `<div class="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-56 overflow-y-auto">${prods.map(p => `<div class="p-2.5 flex justify-between"><span>${esc(p.nombre_producto || p.producto)}</span><b>${p.cantidad_vendida ?? p.cantidad ?? 0}</b></div>`).join('')}</div>` : emptyHTML('Sin productos vendidos')}</div>
        <div><h4 class="font-black mb-2">Rendimiento mensual ${anio}</h4>${meses.length ? '<div class="h-56"><canvas id="m-ch"></canvas></div>' : emptyHTML('Sin histórico disponible')}</div></div>
      <div><h4 class="font-black mb-2">Historial de asignaciones</h4>${hist.length ? `<div class="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-44 overflow-y-auto">${hist.map(h => `<div class="p-2.5 flex flex-wrap justify-between gap-2"><div><b>${esc(h.puntoVenta || h.local_nombre || h.local || '—')}</b>${h.motivo ? `<div class="text-[11px] text-stone-500 italic">“${esc(h.motivo)}”</div>` : ''}</div><span>${esc(fmtDate(h.fecha_inicio))} → ${esc(h.fecha_fin ? fmtDate(h.fecha_fin) : 'actual')}</span></div>`).join('')}</div>` : emptyHTML('Sin asignaciones previas')}</div>
      <div class="p-3 rounded-xl bg-brand-ivory border border-brand-gold/30">
        <h4 class="font-black mb-2">Reasignar colaborador a otro punto de venta</h4>
        <div class="flex flex-wrap gap-2">
          <select id="ve-pdv" class="${inputCls} flex-1"><option value="">Seleccione PDV...</option>${pdvsVenta.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select>
          <input id="ve-mot" class="${inputCls} flex-1" placeholder="Motivo (ej.: Reasignación por rotación estratégica)">
          <button id="ve-reasignar" class="${btnPrimary}">Reasignar</button>
        </div>
        <div id="ve-err" class="text-rose-600 font-bold mt-1 hidden"></div>
      </div>
    </div>`, true);

  document.getElementById('ve-reasignar')?.addEventListener('click', async () => {
    const idPdv = document.getElementById('ve-pdv').value;
    const motivo = document.getElementById('ve-mot').value.trim();
    const err = document.getElementById('ve-err');
    if (!idPdv || !motivo) { err.textContent = 'Seleccione el punto de venta e indique el motivo.'; err.classList.remove('hidden'); return; }
    const btn = document.getElementById('ve-reasignar'); btn.disabled = true;
    try {
      await S.reasignarVendedor(+v.id, +idPdv, motivo);
      toast('Colaborador reasignado correctamente');
      closeModal();
      await load();
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden'); btn.disabled = false;
    }
  });

  const cv = document.getElementById('m-ch');
  if (cv && window.Chart) {
    const ch = new Chart(cv, { type: 'bar', data: { labels: meses.map(m => m.mes_nombre || m.mes_anio || m.mes),
      datasets: [{ label: 'Vendido', data: meses.map(m => num(m.monto_vendido ?? m.cantidad_vendida)), backgroundColor: '#C99A32' },
        { label: 'Meta', type: 'line', data: meses.map(m => num(pick(m, 'meta_mensual', 'meta_asignada', 'meta_ventas_asignada'))), borderColor: '#4A2B1C', tension: .3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } } } });
    charts.push(ch);
  }
}
