# PiccoliField — Panel Web del Administrador

Cliente web (HTML5 + CSS3 + JavaScript ES modules, **sin framework ni build**) que consume la **API REST Flask real** de PiccoliField con el mismo JWT que la app Android. No usa datos de prueba ni accede a la base de datos.

- API: `https://piccolifield-api-smkc.onrender.com/api` (cambiable en **Ajustes**)
- Acceso: **solo rol ADMINISTRADOR**. Otro rol → "Acceso solo para administradores", se descarta el token.
- Token en `sessionStorage`; un `401` borra la sesión y vuelve al login (centralizado en `js/api.js`).

## Ejecutar
```bash
python server.py     # o: npm start
```
Abrir `http://localhost:3000` (o abrir `index.html` con Live Server mientras `python server.py` está activo) e ingresar con una cuenta ADMINISTRADOR real.

> **Nota sobre CORS:** El backend en Render (`https://piccolifield-api-smkc.onrender.com/api`) no incluye la cabecera `Access-Control-Allow-Origin` en las respuestas preflight `OPTIONS`. Por ello, `server.py` sirve los archivos estáticos del panel y reenvía transparentemente `/api/*` hacia Render agregando las cabeceras CORS para el navegador, sin base de datos ni lógica propia.

## Módulos y endpoints reales utilizados
| Vista | Endpoints (del `ApiService` de la app) | Funciones |
|---|---|---|
| Login | `POST /auth/login`, `GET /perfil` | Validación local, rol ADMIN, logout |
| Supervisión | `/supervision/resumen`, `/supervision/vendedores`, `/asistencias/resumen`, `/asistencias/recientes`, `/supervision/alertas`, `/puntos-venta`, `/prospectos` | KPIs, asistencia del día, ranking vs meta, gráficos |
| Asistencia | `/asistencias/recientes`, `/colaboradores`, `/historial/{id}`, `/puntos-venta` | En vivo, colaboradores, mapa con geocercas, filtros zona/fecha/estado/persona, marcaciones observadas |
| Justificaciones | `/asistencias/colaboradores`, `POST /asistencias/justificacion/revisar` | Ver sustento, aprobar/rechazar con comentario |
| Ventas y pedidos | `/supervision/vendedores[/{id}[/rendimiento-historico]]`, `/pedidos?idPdv`, `PUT /pedidos/{id}/estado`, `/productos` | Ranking, detalle, histórico, pedidos por PDV |
| Puntos de venta | `/puntos-venta`, `/supervision/puntos-venta/{id}[/historial]`, `POST /supervision/reasignar-impulsador` | Lista/mapa, responsable actual, historial, reasignación con motivo |
| Stock y alertas | `/supervision/alertas[/{id}]`, `PUT /supervision/alertas/{id}/atender\|ignorar`, `/supervision/productos/{id}/foto` | Severidad, foto con marca de agua, SHA-256 calculado en el navegador, atender/ignorar |
| Incidencias | `GET /supervision/incidencias` ó `/incidencias` (autodetección) | Si el backend no lo expone, la vista lo informa |
| Prospectos | `/prospectos[/{id}]`, `PUT …/estado`, `PUT …/asignar`, `/seguimientos` | Pipeline, asignar promotor, seguimientos, fachada |
| Mapa general | PDV, prospectos, asistencia | Capas conmutables, clustering, zonas sin presencia **calculadas** (cobertura a ≤1.5 km de un PDV) |
| Personal | `/supervision/impulsadores`, `/asistencias/colaboradores` | Directorio, meta, rendimiento, reasignación |
| Reportes | datos reales de la API | CSV / JSON con filtro de fechas |
| Ajustes | — | URL de API, prueba de conexión, sesión |

## Actualización periódica (sin recargar)
Polling inteligente (15 s por defecto) con cabecera `If-None-Match`/`ETag`, pausa con pestaña oculta o modal abierto, y refresco solo de la vista activa. Justificación en `JUSTIFICACION_TECNICA_ACTUALIZACION.md`.

## Limitaciones conocidas de la API actual
No existen (en el cliente Android ni en la propuesta) endpoints para: alta/edición de usuarios, aprobación de dispositivos, configuración de horarios/geocercas, importación ERP ni listado de incidencias. El panel no simula esas funciones: las muestra como no disponibles y las activará al detectar el endpoint (incidencias).
