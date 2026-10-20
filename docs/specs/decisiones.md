# TRIKIPELUDOS — Decisiones de stack (Fase 0)

> Fecha: 2026-10-19 · Estado: **aprobado en brainstorming**
> Referencia: `docs/specs/trikipeludos-spec.md` §11 (stack) y §12 (Fase 0).

---

## 1. Reconocimiento

`peludos/` está vacío y no es repositorio git. Las convenciones se tomaron de:

| Fuente | Qué es | Relevancia |
|---|---|---|
| **`github.com/ebor94/mantix` (rama `main`, HEAD `d133203`)** | Repo real de `mantix-backend`: API Express única que aloja todos los módulos bajo `/api/<modulo>` | **Fuente de verdad del backend** |
| `apps/mantix/mantix-backend` (copia local) | Copia **desactualizada** del mismo backend (sin `.git`, sin pruebas, sin `sv/`, `identity/`, `rules/`) | Solo referencia; no se trabaja aquí |
| `votaciones-frontend` | App Vue de un evento con login propio y vista admin | El análogo más cercano en frontend |
| `mantix-frontend`, `cym-frontend`, `afiliacion-frontend`, `r44Proveedores-frontend` | SPAs Vue servidas bajo subpaths (`/mantix/`, `/cym/`, `/afiliados/`, `/elecciones/`) | Convenciones de frontend y despliegue |
| `r44Proveedores-frontend/CLAUDE_serfunorte.md` | Contexto: BD `serfuweb`, API pública `https://mantix-api.losolivoscucuta.com:8444/api` | Red y prefijos |

### 1.1 Stack confirmado (remoto `ebor94/mantix`)

**Backend**
- Node.js + Express 4, **CommonJS**, sin TypeScript.
- Sequelize 6 + `mysql2`, **instancia central** en `src/models/index.js` (`config/database.js`, `freezeTableName: true`, `timezone: '-05:00'`) y `sequelize.sync({ alter: false })` al arrancar. Los módulos registran sus modelos en esa instancia (el módulo `sv` lo dice explícito) y además tienen un pool `mysql2` propio para SQL crudo (`sv/config/db.js`, `h360/config/db.js`).
- Modelos: fábrica `(sequelize, DataTypes) => sequelize.define(...)` + `associate(models)`, `tableName` explícito con prefijo del módulo.
- **Una sola base `serfuweb`**, módulos separados por prefijo (`sv_`, `r44_`, `cym_`, `votacion_`). Vistas `v_<modulo>_*`.
- **Plantilla de módulo moderno: `src/sv/`** → `{config,controllers,jobs,middleware,migrations,models,routes,scripts,services,utils,validations}`; migraciones **numeradas** `src/sv/migrations/001_cfg.sql … 999_seed.sql`, aplicadas por `node src/sv/scripts/setup.js` (ejecuta los `.sql` en orden con `multipleStatements`).
- Respuestas (`sv/utils/response.js`): `{ success: true, data }` / `{ success: false, error: <código>, message, errors? }`.
- Auth por módulo: `sv/middleware/svAuth.js`, `svAuthorize.js`, `sv/utils/jwt.js`; global `auth`/`authorize`. JWT (`jsonwebtoken`) + `bcryptjs`.
- Seguridad global: `helmet`, `cors` (`origin: '*'`), `express-rate-limit` en `/api/` (1000/15 min por IP), `trust proxy`.
- Archivos: `multer` a `uploads/<modulo>/`, `express.static('/uploads')`; `sharp`.
- Ya instalados: `csv-parse`, `exceljs`, `joi`, `express-validator`, `winston`, `pdfkit`, `swagger-jsdoc`.
- **Pruebas: Jest 29 + Supertest**, archivos `*.test.js` en carpetas **`__tests__` junto al código** (ej. `src/services/__tests__/…`). Pruebas unitarias puras, sin BD. Sin `jest.config` (configuración por defecto).
- `.gitignore` ignora `*.sql` salvo excepciones explícitas (`!src/sv/migrations/*.sql`, `!src/scripts/*.sql`).
- Despliegue: `scripts/deploy-mantix.sh` → `git reset --hard origin/main`, `npm ci --omit=dev` si cambió el lock, reinicio PM2 `mantix-backend`, health check con rollback. **No ejecuta migraciones.**
- PM2: **una sola instancia (fork)** — confirmado por ti.

**Frontend (`votaciones-frontend` y demás)**
- Vue 3.5 (`<script setup>`, JS), Vite 7, Pinia 3, Vue Router 4, Tailwind 3.4, `@heroicons/vue`, `vue-toastification`, `axios` con interceptores, alias `@`, proxy a `localhost:3020`, `base` = subpath. Sin pruebas ni PWA.

**Transversal**
- Sin ESLint ni Prettier. Socket.IO no se usa en ningún proyecto. Local: Node 26 y Docker 29; sin MySQL ni PM2 locales.

---

## 2. Decisiones

Leyenda: ✅ coincide con §11/repo · ⚠️ desviación respecto a §11 · 🟡 pendiente

### D1 ✅ (aprobada) Backend como módulo `src/trk/` dentro de `mantix-backend`
- Estructura calcada de `sv/`: `src/trk/{config,controllers,middleware,migrations,models,routes,scripts,services,sockets,utils,validations}` y `__tests__/` junto a cada carpeta.
- Montaje en `src/routes/index.js`: `router.use('/trk/v1', trkRoutes); // ← Módulo TRIKIPELUDOS` → rutas en `/api/trk/v1/…`.
- Cambios fuera de `src/trk/`: esa línea, el registro de modelos en `src/models/index.js`, el arranque de Socket.IO en `server.js` (D4), la exención del limitador en `src/app.js` (D10), las excepciones en `.gitignore` (D7) y scripts en `package.json`.
- **Frontend:** app aparte, en `peludos/` (que además guarda `docs/`).

### D2 ✅ (aprobada) Base `serfuweb` con prefijo `trk_`
- Sin base `trikipeludos` ni usuario `trk_app` (§8.0 se ajusta al repo). Conexión `DB_*` existente.
- Respaldo RNF-7: `mysqldump serfuweb` de las tablas/vistas `trk_*` + `tar` de fotos.

### D3 ✅ Sequelize central (convención del repo)
- Los modelos TRK se registran en la instancia central de `src/models/index.js`, como `sv`. Modelos sin prefijo (`Participante`) con `tableName: 'trk_participantes'`, `freezeTableName: true`, `createdAt: 'created_at'`, `updatedAt: 'updated_at'`.
- Pool `mysql2` propio en `src/trk/config/db.js` para SQL crudo (ranking vía `trk_vw_ranking`, transacciones del importador), como `sv`.
- **Riesgo:** `sync()` crearía tablas TRK con índices/FK con nombres de Sequelize si arranca **antes** de migrar. Mitigación: las migraciones se aplican antes del primer despliegue (D15) y un test verifica que todo modelo TRK tiene su tabla en las migraciones.

### D4 ✅ Socket.IO en `mantix-backend` (instancia única confirmada)
- `server.js`: `app.listen(PORT)` → `const server = http.createServer(app); require('./src/trk/sockets').attach(server); server.listen(PORT)`.
- Namespace **`/trk`**, rooms por rol. Fallback: long-polling de Socket.IO + refresco REST si el socket cae.
- PM2 en fork → sin sticky sessions ni adaptador.

### D5 ✅ Frontend: Vue 3 + Vite + Pinia + Vue Router + Tailwind 3
- Como `votaciones-frontend`. `base: '/trikipeludos/'`. Paleta Halloween (RNF-8) en `theme.extend.colors`.

### D6 ⚠️ Nombres de BD según §8.0 (vistas `trk_vw_`)
- El repo usa `v_<modulo>_*`; gana §8.0 por tu regla explícita. Igual para `idx_trk_`, `uq_trk_`, `fk_trk_`, `trk_sp_`, `trk_fn_`.

### D7 ✅ Migraciones como `sv`
- `src/trk/migrations/001_*.sql … 999_seed.sql` + runner `node src/trk/scripts/setup.js` (patrón de `sv/scripts/setup.js`), mejorado con tabla `trk_migraciones` para no re-ejecutar. Script `npm run trk:setup`.
- Seed de categorías, rúbricas y criterios como datos SQL (regla no negociable).
- `.gitignore`: agregar `!src/trk/migrations/*.sql`.

### D8 ⚠️ Pruebas: Jest + Supertest (no Vitest en backend)
- Repo → Jest 29 + Supertest, `__tests__/` junto al código.
- **Unitarias** (sin BD, como las existentes): cálculo de ranking, normalización del importador, filtrado de campos.
- **Integración** (nuevo): MySQL 8 en Docker, base `serfuweb_test` solo con migraciones TRK, para las pruebas de §13 que necesitan SQL real (únicos, idempotencia, vista de ranking, auditoría). Se marcan `*.int.test.js` y corren con `npm run test:trk:int`; `npm test` sigue igual para Mantix.
- **Frontend:** Vitest + @vue/test-utils. **E2E:** Playwright a 360 px.

### D9 ✅ Respuestas, errores, logs y códigos de API
- Formato de `sv`: `{ success: true, data }` / `{ success: false, error: 'TRK-CAL-003', message }`. El campo `error` del repo lleva el código TRK.
- Encabezado `X-TRK-API: TRK-<MÓD>-<NNN>` en toda respuesta TRK; el mismo código va a logs (`logger.child({ modulo: 'trk', api_codigo })`) y a `trk_auditoria.api_codigo`.
- `errorHandler` propio al final del router TRK; los manejadores globales no se tocan.

### D10 ⚠️ Auth sobre usuarios y roles de Mantix + PIN, limitador y CORS
- **Sin tabla `trk_usuarios`** (pedido tuyo en el brainstorming): todos los actores son filas de `usuarios` con su rol en `roles`. Permisos en `roles.permisos.trk` y chequeo con el **`requirePermiso('trk', acción)` existente**. Roles nuevos `TRK_CABINA`, `TRK_COMENTARISTA`, `TRK_JURADO`; los roles admin existentes reciben `trk` con `JSON_MERGE_PATCH` (patrón `rol_cajero_migration.sql`).
- **Admin** entra con el login de Mantix (`/api/auth/login`, LDAP/local). **Operativos** entran con PIN (`TRK-AUTH-001`); el PIN y `token_version` viven en `trk_accesos` (extensión 1:1 de `usuarios`, porque `email`/`password` son NOT NULL). Usuarios operativos con correo sintético y contraseña aleatoria inutilizable.
- Token de PIN firmado con **`TRK_JWT_SECRET`** y `scope: 'trk'`: no sirve en el resto de la API de Mantix. `trkAuth` acepta ambos tokens.
- **Limitador global** (1000/15 min por IP) y `strictRateLimit` (10/15 min por IP) bloquearían el evento entero detrás de una IP pública: `/api/trk/` se exime del global y el login con PIN usa un limitador propio con clave IP + usuario (5/min).
- **CORS** global `'*'` se mantiene; riesgo aceptado (Bearer, sin cookies).

### D11 ⚠️ Fotos con nombre UUID
- `TRK_FOTOS_PATH` (por defecto `uploads/trk/fotos`, servido por el `express.static` existente), nombre `<uuid>.jpg`. Sharp quita EXIF/GPS y limita a 1600 px.

### D12 ⚠️ Dependencias nuevas
| Paquete | Dónde | Para qué |
|---|---|---|
| `socket.io` | mantix-backend | Tiempo real (RNF-2) |
| `socket.io-client`, `vuedraggable`, `vite-plugin-pwa` | frontend | Tiempo real, reordenar cola, shell offline |
| `vitest`, `@vue/test-utils`, `@playwright/test`, `fake-indexeddb` | frontend (dev) | Pruebas |

`csv-parse` y `exceljs` ya están en el backend. UUID con `crypto.randomUUID`.

### D13 ⚠️ Offline del jurado: cola en IndexedDB
- Background Sync no existe en Safari/iOS → cola en la app (IndexedDB), reintento al volver `online` y por intervalo. Servidor idempotente por `(participante_id, jurado_id)`. `vite-plugin-pwa` solo para el shell.

### D14 ✅ Linters
- El repo no tiene → no se agregan.

### D15 ⚠️ Despliegue
- Backend: sin proceso PM2 nuevo. Antes del primer despliegue con TRK: `npm run trk:setup` en `srv-backend` (el `deploy-mantix.sh` no migra). Nginx de la API: `location /socket.io/` con `Upgrade`/`Connection`.
- Frontend: `dist/` bajo `/trikipeludos/`, HTTPS público (§14.4 resuelta: expuesto a internet).
- `src/trk/scripts/respaldo.sh` (RNF-7).

### D16 ✅ Git
- **Backend:** clon nuevo de `https://github.com/ebor94/mantix` en `apps/mantix/mantix-git/`, rama `feature/trikipeludos` desde `main`. No se toca la copia local `mantix-backend/`. Sin push hasta que lo pidas.
- **Frontend:** `https://github.com/ebor94/TRIKIPELUDOS` (vacío). `git init` en `peludos/`, remoto `origin` a esa URL, commit inicial en `main` con `docs/`, trabajo en `feature/trikipeludos`. Sin push hasta que lo pidas.

---

## 3. Huecos del spec — resueltos en el brainstorming (2026-10-19)

1. §9.0 (convención de códigos) y §9.1 (registro de endpoints) creadas en el spec.
2. Todas las rutas pasan a `/api/trk/v1/`.
3. Módulos válidos de `api_codigo`: `AUTH, USR, IMP, PAR, PAS, EVT, RUB, CAL, CAT, RNK, EXP` (§9.0).
4. `trk_participantes.categoria_propuesta_id` (HU-5 CA4).
5. Fusión con choque de jurado → se bloquea (HU-3 CA2).
