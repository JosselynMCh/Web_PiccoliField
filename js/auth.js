/**
 * PICCOLI FIELD - AUTENTICACIÓN (solo rol ADMINISTRADOR)
 */
import { CONFIG } from './config.js';
import { api } from './api.js';

export class AuthService {
  static getUser() {
    try { return JSON.parse(sessionStorage.getItem(CONFIG.USER_KEY) || 'null'); } catch { return null; }
  }

  static isAuthenticated() {
    const u = this.getUser();
    return !!api.getToken() && !!u && CONFIG.ALLOWED_ROLES.includes((u.rol || '').toUpperCase());
  }

  static requireAuth() {
    if (!this.isAuthenticated()) {
      api.clearSession();
      window.location.href = 'index.html?error=unauthorized';
      return false;
    }
    return true;
  }

  static extractToken(r) {
    if (!r) return '';
    const d = r.data;
    if (typeof d === 'string') return d;
    return d?.access_token || d?.token || r.access_token || r.token || '';
  }

  static extractUser(r) {
    const d = r?.data && typeof r.data === 'object' ? r.data : null;
    return r?.user || r?.usuario || d?.user || d?.usuario || d || {};
  }

  static async login(correo, password) {
    correo = (correo || '').trim();
    password = (password || '').trim();
    if (!correo || !password) throw new Error('Debe completar el correo electrónico y la contraseña.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('Ingrese un correo electrónico válido.');

    let r;
    try {
      // Mismo cuerpo que envía la app Android (LoginRequest)
      r = await api.post('auth/login', { email: correo, correo, usuario: correo, password }, { auth: false });
    } catch (e) {
      if (e.status === 401 || e.status === 400 || e.status === 404) throw new Error(e.message || 'Credenciales incorrectas.');
      throw e;
    }

    const token = this.extractToken(r);
    const u = this.extractUser(r);
    let rol = String(u.rol || u.role || '').toUpperCase();
    let perfil = u;

    if (!token) throw new Error(r?.message || 'El servidor no devolvió un token de sesión.');

    // Si el login no trae el rol, consultarlo en GET /perfil con el token recibido
    if (!rol) {
      try {
        api.setToken(token);
        const p = await api.get('perfil');
        perfil = p?.data || p || {};
        rol = String(perfil.rol || perfil.role || '').toUpperCase();
      } catch { /* se valida abajo */ }
    }

    if (!CONFIG.ALLOWED_ROLES.includes(rol)) {
      api.clearSession();
      throw new Error(`Acceso solo para administradores.${rol ? ` Su rol (${rol}) no tiene permisos en este panel.` : ''}`);
    }

    const nombre = [perfil.nombres || perfil.nombre, perfil.apePaterno, perfil.apeMaterno].filter(Boolean).join(' ') || correo;
    const user = {
      id: perfil.idUsuario ?? perfil.id_usuario ?? perfil.usuarioId ?? perfil.id ?? null,
      nombre, rol, correo: perfil.correo || perfil.email || correo,
      sede: perfil.sede || '', distrito: perfil.distrito || ''
    };
    api.setToken(token);
    sessionStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    return { token, user };
  }

  static async logout() {
    try { await api.post('auth/logout', {}); } catch { /* el backend puede no exponer logout */ }
    api.clearSession();
    window.location.href = 'index.html?msg=logged_out';
  }
}
