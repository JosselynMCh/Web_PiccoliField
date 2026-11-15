/**
 * PICCOLI FIELD - CONFIGURACIÓN CENTRAL DEL PANEL WEB
 * Consume SIEMPRE la API REST real en Render: https://piccolifield-api-smkc.onrender.com/api
 */
const RENDER_API = 'https://piccolifield-api-smkc.onrender.com/api';
const LOCAL_PROXY_API = 'http://127.0.0.1:3000/api';

export const CONFIG = {
  RENDER_API,
  LOCAL_PROXY_API,

  get DEFAULT_API() {
    if (typeof window !== 'undefined') {
      const isLocalOtherPort = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000';
      return isLocalOtherPort ? LOCAL_PROXY_API : `${window.location.origin}/api`;
    }
    return RENDER_API;
  },

  // En Vercel (mediante vercel.json rewrites) y en server.py (puerto 3000), usa /api del mismo origen
  // para evitar cualquier bloqueo CORS del navegador. En Live Server local (ej. 5500), usa 127.0.0.1:3000/api.
  get API_BASE_URL() {
    const saved = (localStorage.getItem('piccoli_api_url') || '').trim().replace(/\/+$/, '');
    if (saved && !saved.includes('piccolifield-api-smkc.onrender.com')) {
      return saved;
    }
    return this.DEFAULT_API;
  },

  get POLLING_INTERVAL_SECONDS() {
    const v = parseInt(localStorage.getItem('piccoli_poll_s') || '15', 10);
    return Number.isFinite(v) && v >= 5 ? v : 15;
  },

  // Timeout alto: el plan gratuito de Render tarda en despertar en frío
  REQUEST_TIMEOUT_MS: 70000,

  TOKEN_KEY: 'piccoli_admin_jwt',
  USER_KEY: 'piccoli_admin_user',

  ALLOWED_ROLES: ['ADMINISTRADOR'],

  // Cobertura: un PDV cubre una zona si está a menos de estos km de un prospecto
  COVERAGE_RADIUS_KM: 1.5,

  MAP_DEFAULT_CENTER: [-6.7714, -79.8409], // Chiclayo, Lambayeque
  MAP_DEFAULT_ZOOM: 12
};
