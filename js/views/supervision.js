import { S, settle } from '../data.js';
import { api } from '../api.js';
import { esc, num, money, kpi, card, pageHeader, loadingHTML, errorHTML, emptyHTML, progressBar, badge, estadoBadge, label, avatar, fmtDateTime, btnGhost, pct } from '../ui.js';

let root, charts = [], state = null, busy = false;

export async function render(container) {
  root = container;
  root.innerHTML = loadingHTML();
  await load(true);
}
export async function refresh() { if (root && !busy) await load(false); }
export function destroy() { charts.forEach(c => c.destroy()); charts = []; root = null; }

async function load(first) {
  busy = true;
  const { data, errors } = await settle({
    resumen: S.resumen, vendedores: S.vendedores, asist: S.asistResumen, recientes: S.asistRecientes,
    alertas: S.alertas, pdv: () => S.puntosVenta(), prospectos: () => S.prospectos(), impulsadores: S.impulsadores
  });
  busy = false;
  if (!root) return;
  if (Object.keys(data).length === 0) {
    root.innerHTML = errorHTML(Object.values(errors)[0]?.message || 'Sin respuesta de la API', 'btn-retry');
    root.querySelector('#btn-retry')?.addEventListener('click', () => render(root));
    return;
  }
  state = { data, errors };
  draw();
}

function draw() {
  const { data: d, errors } = state;
  const r = d.resumen || {};
  const a = d.asist || {};
  const alertas = d.alertas || [];
  const pendientes = alertas.filter(x => x.estado === 'PENDIENTE');
  const criticas = pendientes.filter(x => ['ALTA', 'CRITICA', 'CRÍTICA'].includes(x.nivel) || x.tipo.includes('AGOTADO')).length;
  const pdv = d.pdv || [];
  const pdvActivos = num(r.cantidad_pdv_activos, pdv.filter(p => p.estado === 'ACTIVO').length);

  const recientes = d.recientes || [];
  const cnt = (e) => recientes.filter(x => x.estado === e).length;
  const aTiempo = num(a.aTiempo ?? a.a_tiempo, cnt('A_TIEMPO'));
  const tardanzas = num(a.tardanzas, cnt('TARDANZA'));
  const faltas = num(a.faltas, cnt('FALTA'));
  const presentes = num(a.presentes, aTiempo + tardanzas);
  const total = num(a.total, recientes.length);
  const sinMarcar = Math.max(0, num(a.sin_marcar ?? a.sinMarcar, total - presentes - faltas));
  const porcentaje = num(a.porcentaje, pct(presentes, total));

  const vend = (d.vendedores || []).slice().sort((x, y) => y.vendido - x.vendido);
  const prosp = d.prospectos || [];
  const porEstado = {};
  prosp.forEach(p => { porEstado[p.estado] = (porEstado[p.estado] || 0) + 1; });
  const conv = prosp.length ? Math.round(((porEstado.CONVERTIDO || 0) / prosp.length) * 100) : 0;
  const warnErr = Object.keys(errors).length
    ? `<div class="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Algunos módulos no respondieron: ${Object.entries(errors).map(([k, e]) => `<b>${esc(k)}</b> (${esc(e.message)})`).join(', ')}</div>` : '';

  root.innerHTML = `
    ${pageHeader('Supervisión General', 'Resumen operativo en vivo del día: asistencia, ventas, puntos activos, alertas de stock y oportunidades comerciales.',
      `<span class="text-[11px] text-stone-500"><i class="fa-regular fa-clock mr-1"></i>${new Date().toLocaleString('es-PE')}</span>`)}
    ${warnErr}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      ${kpi('Monto total vendido', money(r.monto_total_ventas), 'fa-sack-dollar', 'text-emerald-600', 'Acumulado de ventas registradas')}
      ${kpi('Puntos activos', pdvActivos, 'fa-store', 'text-sky-600', `${pdv.length} PDV registrados`)}
      ${kpi('Alertas de stock', num(r.cantidad_alertas, pendientes.length), 'fa-bell', 'text-rose-600', `${pendientes.length} pendientes · ${criticas} críticas`)}
      ${kpi('Asistencia hoy', porcentaje + '%', 'fa-user-check', 'text-brand-gold', `${presentes} presentes de ${total}`)}
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
      ${kpi('Puntuales', aTiempo, 'fa-circle-check', 'text-emerald-600')}
      ${kpi('Tardanzas', tardanzas, 'fa-clock', 'text-amber-600')}
      ${kpi('Faltas', faltas, 'fa-user-xmark', 'text-rose-600')}
      ${kpi('Sin marcar', sinMarcar, 'fa-circle-question', 'text-stone-500')}
      ${kpi('Oportunidades', prosp.length, 'fa-filter-circle-dollar', 'text-brand-caramel', `Conversión: ${conv}%`)}
    </div>

    <div class="grid lg:grid-cols-3 gap-4 mb-5">
      ${card(`<div class="p-4 border-b border-stone-100 flex items-center justify-between"><h3 class="text-sm font-black">Ranking de mejores impulsadores</h3><a href="#ventas" class="text-[11px] font-bold text-brand-caramel">Ver detalle →</a></div>
        <div class="p-4 space-y-3 max-h-[420px] overflow-y-auto" id="ranking">
        ${vend.length ? vend.slice(0, 8).map((v, i) => `
          <div class="flex items-center gap-3">
            <span class="w-6 text-center font-black ${i < 3 ? 'text-brand-gold' : 'text-stone-400'}">${i + 1}</span>
            ${avatar(v.nombre, { auth: v.id ? `supervision/impulsadores/${v.id}/foto` : '' })}
            <div class="flex-1 min-w-0"><div class="flex justify-between gap-2"><span class="text-xs font-bold truncate">${esc(v.nombre)}</span><span class="text-xs font-black">${v.vendido} uds</span></div>
              <div class="text-[10px] text-stone-500 truncate mb-1">${esc(v.local)}</div>${v.meta ? progressBar(v.vendido, v.meta) : '<span class="text-[10px] text-stone-400">Sin meta asignada</span>'}</div>
          </div>`).join('') : emptyHTML('Aún no hay ventas registradas.')}
        </div>`, 'lg:col-span-2')}
      ${card(`<div class="p-4 border-b border-stone-100"><h3 class="text-sm font-black">Asistencia del día</h3></div>
        <div class="p-4"><div class="h-52"><canvas id="ch-asist"></canvas></div></div>`)}
    </div>

    <div class="grid lg:grid-cols-3 gap-4">
      ${card(`<div class="p-4 border-b border-stone-100 flex justify-between"><h3 class="text-sm font-black">Alertas de stock recientes</h3><a href="#stock" class="text-[11px] font-bold text-brand-caramel">Gestionar →</a></div>
        <div class="divide-y divide-stone-100 max-h-80 overflow-y-auto">${pendientes.length ? pendientes.slice(0, 6).map(x => `
          <div class="p-3 flex items-center gap-3"><div class="flex-1 min-w-0"><div class="text-xs font-bold truncate">${esc(x.producto)}</div>
          <div class="text-[11px] text-stone-500 truncate">${esc(x.local)} · ${esc(fmtDateTime(x.fechaEmision ? x.fechaEmision + ' ' + (x.horaEmision || '') : ''))}</div></div>
          ${estadoBadge(x.nivel || x.tipo)}</div>`).join('') : emptyHTML('Sin alertas pendientes 🎉')}</div>`)}
      ${card(`<div class="p-4 border-b border-stone-100"><h3 class="text-sm font-black">Oportunidades por estado</h3></div>
        <div class="p-4"><div class="h-56"><canvas id="ch-pros"></canvas></div></div>`)}
      ${card(`<div class="p-4 border-b border-stone-100"><h3 class="text-sm font-black">Ventas por impulsador (unidades)</h3></div>
        <div class="p-4"><div class="h-56"><canvas id="ch-vend"></canvas></div></div>`)}
    </div>`;

  charts.forEach(c => c.destroy()); charts = [];
  if (!window.Chart) return;
  const brand = ['#10b981', '#f59e0b', '#f43f5e', '#a8a29e'];
  charts.push(new Chart(root.querySelector('#ch-asist'), { type: 'doughnut',
    data: { labels: ['Puntuales', 'Tardanzas', 'Faltas', 'Sin marcar'], datasets: [{ data: [aTiempo, tardanzas, faltas, sinMarcar], backgroundColor: brand }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } } }));
  const keys = Object.keys(porEstado);
  charts.push(new Chart(root.querySelector('#ch-pros'), { type: 'doughnut',
    data: { labels: keys.map(label), datasets: [{ data: keys.map(k => porEstado[k]), backgroundColor: ['#38bdf8', '#f59e0b', '#a78bfa', '#10b981', '#f43f5e', '#a8a29e'] }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } } }));
  const top = vend.slice(0, 8);
  charts.push(new Chart(root.querySelector('#ch-vend'), { type: 'bar',
    data: { labels: top.map(v => v.nombre.split(' ')[0]), datasets: [{ label: 'Vendido', data: top.map(v => v.vendido), backgroundColor: '#C99A32' }, { label: 'Meta', data: top.map(v => v.meta), backgroundColor: '#4A2B1C' }] },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } } } }));
}
