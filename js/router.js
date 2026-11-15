/**
 * PICCOLI FIELD - ROUTER SPA POR HASH
 * Cada vista exporta: render(container), refresh() [opcional], destroy() [opcional]
 */
import { errorHTML } from './ui.js?v=7';

const ROUTES = {
  supervision: ['Supervisión General', () => import('./views/supervision.js?v=7')],
  asistencia: ['Asistencia en Vivo', () => import('./views/asistencia.js?v=7')],
  justificaciones: ['Justificaciones', () => import('./views/justificaciones.js?v=7')],
  ventas: ['Ventas y Metas de Impulsadores', () => import('./views/ventas.js?v=7')],
  pdv: ['Puntos de Venta y Responsables', () => import('./views/pdv.js?v=7')],
  stock: ['Stock y Alertas con Evidencia', () => import('./views/stock.js?v=7')],
  incidencias: ['Incidencias en Campo', () => import('./views/incidencias.js?v=7')],
  prospectos: ['Prospectos y Oportunidades', () => import('./views/prospectos.js?v=7')],
  mapa: ['Mapa General', () => import('./views/mapa.js?v=7')],
  usuarios: ['Personal y Dispositivos', () => import('./views/usuarios.js?v=7')],
  reportes: ['Reportes y Exportación', () => import('./views/reportes.js?v=7')]
};

class Router {
  constructor() { this.mod = null; this.route = null; this.token = 0; }

  init() {
    window.addEventListener('hashchange', () => this.go());
    this.go();
  }

  async go() {
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const route = ROUTES[hash] ? hash : 'supervision';
    const my = ++this.token;
    const container = document.getElementById('view-container');
    if (!container) return;

    try { this.mod?.destroy?.(); } catch { /* noop */ }
    this.mod = null; this.route = route;

    document.querySelectorAll('.sidebar-link').forEach(l => {
      const on = l.dataset.route === route;
      l.classList.toggle('bg-brand-chocolate', on);
      l.classList.toggle('text-white', on);
      l.classList.toggle('text-stone-300', !on);
    });
    const title = document.getElementById('topbar-page-title');
    if (title) title.textContent = ROUTES[route][0];
    document.getElementById('app-sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-backdrop')?.classList.add('hidden');

    container.innerHTML = '';
    try {
      const mod = await ROUTES[route][1]();
      if (my !== this.token) return;
      this.mod = mod;
      await mod.render(container);
      container.parentElement?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    } catch (e) {
      console.error(e);
      container.innerHTML = errorHTML(e.message, 'btn-router-retry');
      document.getElementById('btn-router-retry')?.addEventListener('click', () => this.go());
    }
  }

  async refresh() {
    if (this.mod?.refresh) await this.mod.refresh();
  }
}

export const router = new Router();
