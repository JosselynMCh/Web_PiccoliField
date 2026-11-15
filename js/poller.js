/**
 * PICCOLI FIELD - ACTUALIZACIÓN PERIÓDICA (polling + ETag + Page Visibility)
 * Cada vista expone refresh(); el poller la invoca cada N segundos sin recargar la página.
 * Se pausa con la pestaña oculta y mientras haya un modal abierto (no pisa formularios).
 */
import { CONFIG } from './config.js';
import { isModalOpen } from './ui.js';

class Poller {
  constructor() {
    this.interval = CONFIG.POLLING_INTERVAL_SECONDS;
    this.remaining = this.interval;
    this.fetching = false;
    this.lastSync = null;
    this.handler = null;
    this.paused = false;
  }

  init(handler) {
    this.handler = handler;
    const sel = document.getElementById('select-poller-freq');
    if (sel) {
      if (![...sel.options].some(o => +o.value === this.interval)) sel.add(new Option(`Cada ${this.interval}s`, this.interval));
      sel.value = String(this.interval);
      sel.addEventListener('change', () => {
        this.interval = +sel.value; this.remaining = this.interval;
        localStorage.setItem('piccoli_poll_s', this.interval);
      });
    }
    document.getElementById('btn-poller-sync-now')?.addEventListener('click', () => this.sync(true));
    document.getElementById('btn-poller-pause')?.addEventListener('click', () => {
      this.paused = !this.paused; this.render();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(false); this.render(); });
    setInterval(() => this.tick(), 1000);
    this.render();
  }

  resetCountdown() { this.remaining = this.interval; }

  async tick() {
    if (document.hidden || this.paused) return this.render();
    this.remaining--;
    if (this.remaining <= 0) { this.remaining = this.interval; await this.sync(false); }
    this.render();
  }

  async sync(force) {
    if (this.fetching || !this.handler) return;
    if (!force && isModalOpen()) return; // no interrumpir formularios abiertos
    this.fetching = true; this.render();
    try { await this.handler(force); this.lastSync = new Date(); }
    catch (e) { console.warn('[poller]', e.message); }
    finally { this.fetching = false; this.remaining = this.interval; this.render(); }
  }

  render() {
    const label = document.getElementById('poller-countdown-label');
    const dot = document.getElementById('poller-badge-indicator');
    const text = document.getElementById('poller-badge-text');
    const icon = document.getElementById('poller-sync-icon');
    const pauseIcon = document.getElementById('btn-poller-pause');
    if (icon) icon.classList.toggle('fa-spin', this.fetching);
    if (pauseIcon) pauseIcon.innerHTML = `<i class="fa-solid ${this.paused ? 'fa-play' : 'fa-pause'} text-xs"></i>`;
    let state = 'live';
    if (document.hidden) state = 'hidden'; else if (this.paused) state = 'paused';
    if (dot) dot.className = 'w-2 h-2 rounded-full ' + (state === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500');
    if (text) text.textContent = state === 'live' ? 'En vivo' : state === 'paused' ? 'Pausado' : 'Pestaña oculta';
    if (label) {
      const at = this.lastSync ? this.lastSync.toLocaleTimeString('es-PE') : '—';
      label.textContent = this.fetching ? 'Sincronizando...' : `Actualizado ${at} · próx. ${state === 'live' ? this.remaining + 's' : '—'}`;
    }
  }
}

export const poller = new Poller();
