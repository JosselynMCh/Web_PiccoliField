import { S, settle } from '../data.js';
import { esc, card, pageHeader, loadingHTML, emptyHTML, inputCls, btnPrimary, btnGhost, downloadFile, toCSV, toast, todayISO, dateOnly } from '../ui.js';

let root, last = null;

const REPORTS = {
  asistencia: { icon: 'fa-user-clock', title: 'Asistencia', desc: 'Marcaciones, estado, tardanza y ubicación', dateField: 'fecha',
    fetch: async () => { const [a, b] = await Promise.all([S.asistColaboradores(), S.asistRecientes()]); const m = new Map(); [...b, ...a].forEach(r => m.set(`${r.idUsuario}|${r.fecha}|${r.tipo}`, r));
      return [...m.values()].map(r => ({ colaborador: r.nombre, sede: r.sede, tipo: r.tipo, estado: r.estado, fecha_hora: r.fecha, minutos_tardanza: r.minutos, latitud: r.lat, longitud: r.lng, justificacion_estado: r.justificacion?.estado || '', justificacion_motivo: r.justificacion?.motivo || '', fecha: r.fecha })); } },
  stock: { icon: 'fa-boxes-stacked', title: 'Stock y alertas', desc: 'Alertas de stock con severidad y estado', dateField: 'fecha_emision',
    fetch: async () => (await S.alertas()).map(a => ({ id: a.id, producto: a.producto, punto_venta: a.local, tipo: a.tipo, severidad: a.nivel, estado: a.estado, fecha_emision: a.fechaEmision, hora_emision: a.horaEmision, fecha_atencion: a.fechaAtencion, comentario: a.comentario })) },
  prospectos: { icon: 'fa-filter-circle-dollar', title: 'Prospectos', desc: 'Pipeline comercial y promotores', dateField: 'fecha',
    fetch: async () => (await S.prospectos()).map(p => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, zona: p.zona, direccion: p.direccion, telefono: p.telefono, estado: p.estado, promotor: p.promotor || '', latitud: p.lat, longitud: p.lng, fecha: p.fecha })) },
  ventas: { icon: 'fa-sack-dollar', title: 'Ventas e impulsadores', desc: 'Ranking y avance frente a la meta', dateField: null,
    fetch: async () => (await S.vendedores()).map(v => ({ posicion: v.posicion, impulsador: v.nombre, punto_venta: v.local, unidades_vendidas: v.vendido, meta: v.meta, avance_pct: v.meta ? Math.round(v.vendido / v.meta * 100) : '' })) },
  pdv: { icon: 'fa-store', title: 'Puntos de venta', desc: 'Catálogo de PDV con tipo, estado y responsable', dateField: null,
    fetch: async () => (await S.puntosVenta()).map(p => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, tipo: p.tipo, estado: p.estado, direccion: p.direccion, latitud: p.lat, longitud: p.lng, radio_geocerca: p.radio })) }
};

export async function render(container) {
  root = container; last = null;
  root.innerHTML = `${pageHeader('Reportes y Exportación', 'Descargue datos reales de la API en CSV (Excel) o JSON, con filtro opcional por rango de fechas.')}
    <div class="grid md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">${Object.entries(REPORTS).map(([k, r]) => `
      <button data-k="${k}" class="text-left bg-white rounded-2xl border border-stone-200 p-4 hover:border-brand-gold shadow-xs"><i class="fa-solid ${r.icon} text-brand-gold text-lg mb-2"></i><div class="text-sm font-black">${r.title}</div><div class="text-[11px] text-stone-500">${r.desc}</div></button>`).join('')}</div>
    <div id="rp-panel"></div>`;
  root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => open(b.dataset.k));
}
export function destroy() { root = null; }

async function open(k) {
  const r = REPORTS[k];
  root.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('!border-brand-gold', b.dataset.k === k));
  const panel = root.querySelector('#rp-panel');
  panel.innerHTML = card(loadingHTML(`Consultando ${r.title.toLowerCase()} en la API...`));
  let rows;
  try { rows = await r.fetch(); } catch (e) { panel.innerHTML = card(`<div class="p-6 text-center text-rose-700 text-xs font-bold">${esc(e.message)}</div>`); return; }
  last = { k, rows, r };
  show();
}

function show() {
  const { k, rows, r } = last;
  const panel = root.querySelector('#rp-panel');
  panel.innerHTML = card(`<div class="p-4 border-b border-stone-100 flex flex-wrap items-center gap-2">
      <h3 class="text-sm font-black mr-auto">${r.title} <span class="text-stone-400 font-bold text-xs" id="rp-count"></span></h3>
      ${r.dateField ? `<input id="rp-d1" type="date" class="${inputCls} sm:w-36"><span class="text-xs text-stone-400">a</span><input id="rp-d2" type="date" class="${inputCls} sm:w-36">` : ''}
      <button id="rp-csv" class="${btnPrimary}"><i class="fa-solid fa-file-csv"></i> CSV</button><button id="rp-json" class="${btnGhost}"><i class="fa-solid fa-file-code"></i> JSON</button></div>
    <div id="rp-table"></div>`);
  const apply = () => {
    const d1 = panel.querySelector('#rp-d1')?.value, d2 = panel.querySelector('#rp-d2')?.value;
    const out = rows.filter(x => { if (!r.dateField || (!d1 && !d2)) return true; const d = dateOnly(x[r.dateField]); return d && (!d1 || d >= d1) && (!d2 || d <= d2); });
    panel.querySelector('#rp-count').textContent = `· ${out.length} registros`;
    const t = panel.querySelector('#rp-table');
    if (!out.length) t.innerHTML = emptyHTML('No hay registros en el rango seleccionado.'); else {
      const cols = Object.keys(out[0]).slice(0, 8);
      t.innerHTML = `<div class="overflow-x-auto max-h-96"><table class="w-full text-xs"><thead class="bg-stone-50 text-[10px] uppercase text-stone-500 sticky top-0"><tr>${cols.map(c => `<th class="p-2.5 text-left">${esc(c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead>
        <tbody class="divide-y divide-stone-100">${out.slice(0, 100).map(o => `<tr>${cols.map(c => `<td class="p-2.5">${esc(o[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${out.length > 100 ? `<div class="p-2 text-center text-[11px] text-stone-500 bg-stone-50">Vista previa de 100 filas; la descarga incluye las ${out.length}.</div>` : ''}`;
    }
    last.out = out;
  };
  apply();
  panel.querySelectorAll('input[type=date]').forEach(i => i.onchange = apply);
  const name = (ext) => `piccolifield_${k}_${todayISO()}.${ext}`;
  panel.querySelector('#rp-csv').onclick = () => { if (!last.out.length) return toast('No hay datos para exportar', 'error'); downloadFile(name('csv'), toCSV(last.out), 'text/csv;charset=utf-8'); toast('CSV descargado'); };
  panel.querySelector('#rp-json').onclick = () => { if (!last.out.length) return toast('No hay datos para exportar', 'error'); downloadFile(name('json'), JSON.stringify(last.out, null, 2), 'application/json'); toast('JSON descargado'); };
}
