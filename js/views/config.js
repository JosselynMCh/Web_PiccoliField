import { api } from '../api.js';
import { CONFIG } from '../config.js';
import { AuthService } from '../auth.js';
import { esc, card, pageHeader, inputCls, btnPrimary, btnGhost, toast, badge } from '../ui.js';

let root;
export async function render(container) {
  root = container;
  const u = AuthService.getUser() || {};
  root.innerHTML = `${pageHeader('Ajustes del Panel', 'Conexión con la API REST, actualización periódica y sesión. Estos ajustes se guardan en este navegador.')}
    <div class="grid lg:grid-cols-2 gap-4">
      ${card(`<div class="p-5 space-y-3 text-xs"><h3 class="text-sm font-black">Conexión con la API</h3>
        <div><label class="font-black block mb-1">URL base de la API</label><input id="cf-url" class="${inputCls}" value="${esc(CONFIG.API_BASE_URL)}"></div>
        <div class="flex gap-2"><button id="cf-save" class="${btnPrimary}">Guardar</button><button id="cf-test" class="${btnGhost}"><i class="fa-solid fa-plug"></i> Probar conexión</button><button id="cf-reset" class="${btnGhost}">Restablecer</button></div>
        <div id="cf-result" class="p-3 rounded-xl bg-stone-50 hidden"></div></div>`)}
      ${card(`<div class="p-5 space-y-3 text-xs"><h3 class="text-sm font-black">Actualización periódica</h3>
        <p class="text-stone-600">El panel usa <b>polling inteligente con ETag</b>: consulta cada <b>${CONFIG.POLLING_INTERVAL_SECONDS}s</b> enviando <code>If-None-Match</code> (la API puede responder <code>304</code> sin cuerpo), se pausa con la pestaña oculta o un formulario abierto y refresca solo la vista activa, sin recargar la página.</p>
        <p class="text-stone-500">Se eligió sobre SSE/WebSocket porque la API REST existente no expone canales push y <code>EventSource</code> no permite enviar el JWT en cabecera. Detalle en <code>JUSTIFICACION_TECNICA_ACTUALIZACION.md</code>.</p>
        <div>${badge('ETag: ' + (api.useEtag ? 'activo' : 'desactivado (CORS)'), api.useEtag ? 'ok' : 'warn')}</div></div>`)}
      ${card(`<div class="p-5 space-y-2 text-xs"><h3 class="text-sm font-black">Sesión</h3>
        <div><b>${esc(u.nombre || '')}</b> ${badge(u.rol || '', 'brand')}</div><div class="text-stone-500">${esc(u.correo || '')}</div>
        <div class="text-stone-500">JWT guardado en <code>sessionStorage</code> (se borra al cerrar la pestaña o ante un 401).</div>
        <button id="cf-logout" class="${btnGhost} mt-2"><i class="fa-solid fa-power-off"></i> Cerrar sesión</button></div>`)}
      ${card(`<div class="p-5 space-y-2 text-xs"><h3 class="text-sm font-black">Alcance de la API detectado</h3>
        <p class="text-stone-600">Módulos conectados: autenticación, supervisión, asistencias, justificaciones, puntos de venta, pedidos, productos, alertas de stock y prospectos.</p>
        <p class="text-stone-500">Configuración de horarios/geocercas, importación ERP y administración de usuarios no están expuestos por la API actual; cuando existan se integrarán en esta sección.</p></div>`)}
    </div>`;
  const out = root.querySelector('#cf-result');
  const say = (h) => { out.classList.remove('hidden'); out.innerHTML = h; };
  root.querySelector('#cf-save').onclick = () => {
    const v = root.querySelector('#cf-url').value.trim();
    if (!/^https?:\/\//i.test(v)) return toast('Ingrese una URL válida (http/https)', 'error');
    localStorage.setItem('piccoli_api_url', v.replace(/\/+$/, '')); toast('URL guardada');
  };
  root.querySelector('#cf-reset').onclick = () => { localStorage.removeItem('piccoli_api_url'); root.querySelector('#cf-url').value = CONFIG.DEFAULT_API; toast('URL restablecida'); };
  root.querySelector('#cf-test').onclick = async () => {
    say('<i class="fa-solid fa-circle-notch fa-spin"></i> Probando (Render puede tardar si estaba dormido)...');
    const t0 = performance.now();
    try { const r = await api.get('perfil'); say(`<b class="text-emerald-700">Conexión correcta</b> en ${Math.round(performance.now() - t0)} ms. Sesión válida para <b>${esc(r?.data?.correo || r?.data?.nombres || u.correo || '')}</b>.`); }
    catch (e) { say(`<b class="text-rose-700">Falló:</b> ${esc(e.message)}`); }
  };
  root.querySelector('#cf-logout').onclick = () => AuthService.logout();
}
export function destroy() { root = null; }
