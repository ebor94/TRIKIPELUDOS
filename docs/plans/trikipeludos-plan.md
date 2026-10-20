# TRIKIPELUDOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir TRIKIPELUDOS (evaluación en vivo de un concurso de disfraces de mascotas) como módulo `src/trk/` de `mantix-backend` más una SPA Vue mobile-first, de punta a punta: importación, cabina con foto, pasarela en tiempo real, calificación offline-tolerante, ranking con desempates y publicación.

**Architecture:** El backend es un módulo autocontenido en `mantix-backend/src/trk/` (patrón del módulo `sv/`). Se monta en `/api/trk/v1`, registra sus modelos `Trk*` en la instancia Sequelize central (con `sync()` neutralizado), crea su esquema solo con migraciones SQL numeradas y comparte el servidor HTTP con Socket.IO (namespace `/trk`). Usuarios y roles son los de Mantix (`usuarios`, `roles.permisos.trk`); los roles operativos entran con PIN (`trk_accesos`). La lógica de negocio vive en servicios sin Express (el ranking es una función pura) y los controladores son delgados. El frontend es una SPA Vue 3 aparte (`peludos/`, repo `ebor94/TRIKIPELUDOS`).

**Tech Stack:** Node.js + Express 4 (CommonJS), Sequelize 6 + mysql2, MySQL 8, Socket.IO 4, Joi, Multer, Sharp, csv-parse, exceljs, jsonwebtoken, bcryptjs, express-rate-limit · Vue 3.5 + Vite 7 + Pinia 3 + Vue Router 4 + Tailwind 3.4, socket.io-client, vuedraggable, idb-keyval, vite-plugin-pwa · Jest 29 + Supertest (backend), Vitest + @vue/test-utils + fake-indexeddb (frontend), Playwright (E2E).

**Fuentes de verdad:** `peludos/docs/specs/trikipeludos-spec.md` (spec v2) y `peludos/docs/specs/decisiones.md`. Ante duda, gana el spec; si el repo contradice el spec, gana el repo y se anota en `decisiones.md`.

## Global Constraints

- Rúbricas, criterios y puntajes máximos son **datos** (seed SQL en `trk_rubricas`/`trk_criterios`), **nunca** constantes en el código. Ningún archivo `.js`/`.vue` puede contener los números 35/30/20/15/25/10 como máximos de criterio.
- Jurados, comentarista y pantalla pública **nunca** reciben `responsable_documento`, `responsable_telefono` ni `responsable_correo` (ni nombre completo del responsable): filtrado en el backend con `serializarParticipante(p, nivel)`, tanto en REST como en sockets.
- Mobile-first: cada pantalla funciona a **360 px** de ancho; áreas táctiles ≥ 44 px; textos de la ficha del comentarista ≥ 24 px; contraste AA.
- Toda tabla, vista, índice y llave MySQL lleva prefijo según spec §8.0: tablas `trk_`, vistas `trk_vw_`, índices `idx_trk_<tabla>_<cols>`, únicos `uq_trk_<tabla>_<cols>`, FKs `fk_trk_<tabla>_<referida>`. En Sequelize siempre `tableName` explícito y `freezeTableName: true`. Base: `serfuweb`.
- Todo endpoint vive bajo `/api/trk/v1/` y tiene código `TRK-<MÓD>-<NNN>` registrado en `src/trk/config/apiCodigos.js` (espejo de spec §9.1), presente en el encabezado `X-TRK-API`, en logs (`api_codigo`), en el cuerpo de error (`error`) y en `trk_auditoria.api_codigo`. Un endpoint sin código registrado hace fallar la prueba `apiCodigos.test.js`.
- Respuestas: `{ success: true, data }` / `{ success: false, error: '<TRK-...>', motivo: '<MOTIVO>', message, errors? }`.
- No se inventan datos de participantes reales: los fixtures son **anonimizados** (nombres ficticios) y reproducen los casos de §7.2.
- Backend: CommonJS, sin TypeScript; modelos con nombre `Trk*` (convención `R44*`/`Cym*` del repo) y `tableName` `trk_*`; secretos por entorno (`JWT_SECRET` de Mantix, `TRK_JWT_SECRET` propio).
- Zona horaria `-05:00` (config del repo). Mensajes al usuario en español.
- Commits: uno por tarea, en la rama `feature/trikipeludos` del repo correspondiente; mensaje en español estilo `feat(trk): …` / `test(trk): …` terminado con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Sin push** salvo que el usuario lo pida.

---

## Repositorios y rutas

| Alias | Ruta local | Remoto | Rama |
|---|---|---|---|
| **BACK** | `/Users/Shared/Files From c.localized/apps/mantix/mantix-git` | `https://github.com/ebor94/mantix` | `feature/trikipeludos` (desde `main`) |
| **FRONT** | `/Users/Shared/Files From c.localized/apps/mantix/peludos` | `https://github.com/ebor94/TRIKIPELUDOS` | `feature/trikipeludos` (desde `main`, que ya tiene `docs/`) |

Todas las rutas de archivo del plan van prefijadas con `BACK:` o `FRONT:` y son relativas a la raíz de ese repo. **No** se toca la copia vieja `apps/mantix/mantix-backend/`.

## Mapa de archivos

### BACK — cambios fuera de `src/trk/` (los únicos permitidos)

| Archivo | Cambio | Tarea |
|---|---|---|
| `src/config/database.js` | Agregar entorno `test` (copia de `development` con `pool.max: 5`) | 1.1 |
| `package.json` | Scripts `test:trk`, `test:trk:int`, `trk:setup`, `trk:db:test`; config `jest.testPathIgnorePatterns`; deps `socket.io` | 1.1, 4.2 |
| `jest.trk-int.config.js` | Config de integración | 1.1 |
| `.gitignore` | `!src/trk/migrations/*.sql`, `!src/trk/testing/sql/*.sql` | 1.1 |
| `src/models/index.js` | Una línea: `...require('../trk/models')(sequelize, Sequelize.DataTypes),` | 1.4 |
| `src/middleware/auth.js` | Exportar `resolverUsuarioDesdeToken` | 1.6 |
| `src/routes/index.js` | `router.use('/trk/v1', require('../trk/routes').router);` | 1.5 |
| `src/app.js` | `skip` del limitador global para `/api/trk/` | 1.5 |
| `server.js` | `http.createServer(app)` + `require('./src/trk/sockets').attach(server)` | 4.2 |

### BACK — `src/trk/`

```
src/trk/
  config/apiCodigos.js        registro TRK-<MÓD>-<NNN> → { metodo, ruta, descripcion }
  config/constantes.js        ESTADOS, ROLES_OPERATIVOS, PERMISOS_TRK, RAZAS_PEQUENAS, RAZAS_GRANDES
  migrations/001_esquema.sql … 005_evento_estado.sql
  models/index.js             (sequelize, DataTypes) => { TrkRubrica, TrkCriterio, TrkCategoria, TrkParticipante,
                              TrkAcceso, TrkCalificacion, TrkCalificacionDetalle, TrkAuditoria, TrkEventoEstado,
                              TrkRankingSnapshot, TrkImportacion }
  models/Trk*.js              un modelo por archivo
  middleware/apiCodigo.js     apiCodigo(codigo) → middleware (header, req.trkApiCodigo, req.trkLog, contrato de error)
  middleware/errorHandler.js  trkErrorHandler
  middleware/trkAuth.js       resolverSesion(token), trkAuth, trkAuthOpcional, trkPermiso(accion)
  middleware/validar.js       validar(schema, fuente)
  middleware/limitadores.js   limitadorPin
  utils/TrkError.js           class TrkError(statusCode, motivo, message, errors?)
  utils/aw.js                 async wrapper
  utils/ctx.js                ctxDe(req) → { usuario, usuarioId, apiCodigo, ip, log }
  utils/permisos.js           permisosTrk(usuario), tienePermiso(usuario, accion), nivelDatos(usuario)
  utils/normalizar.js         normalizarTexto, soloDigitos, normalizarEspecie, normalizarSexo, mapearCategoria,
                              telefonoValido, parsearFechaInscripcion, primerNombre, campoDeEncabezado
  utils/serializar.js         serializarParticipante(p, nivel), urlFoto(nombre)
  services/auditoria.service.js      registrarAuditoria(ctx, { entidad, entidadId, accion, antes, despues }, { transaction })
  services/authPin.service.js        generarPin, hashPin, emitirTokenPin, loginConPin, perfilDe, listarUsuariosPin
  services/usuarios.service.js       listarOperativos, crearOperativo, actualizarOperativo, regenerarPin
  services/importador.service.js     analizarCsv(buffer), confirmarImportacion({ token, decisiones, archivoNombre }, ctx)
  services/previewCache.js           guardar(analisis, meta) → token, obtener(token), borrar(token)
  services/participantes.service.js  listar, obtener, crearAltaRapida, editar, cambiarEstado, guardarFotoOficial,
                                     fusionar, confirmarCategoria
  services/fotos.service.js          procesarYGuardarFoto(buffer) → nombreArchivo
  services/pasarela.service.js       llamarAPasarela, reordenarCola
  services/evento.service.js         estadoPublico, cambiarPantalla, tablero
  services/calificaciones.service.js validarPuntajes, enviarCalificacion, desbloquear, misCalificaciones, rubricaDeCategoria
  services/ranking.service.js        calcularRanking({ participantes, criterios, calificaciones, juradosActivos, puestosPremiados })  (PURA)
  services/rankingDatos.service.js   rankingEnVivo(categoriaId), rankingPublicado(categoriaId), fijarDesempate
  services/categorias.service.js     abrir, cerrar, publicar, actualizar
  services/export.service.js         generarResultadosXlsx() → Buffer
  controllers/*.controller.js        delgados: leen req, llaman servicio, ok(res, data)
  routes/index.js                    { router, modulos }
  routes/<modulo>.routes.js          { prefijo, router }
  sockets/bus.js                     { bus, emitir(evento, payload, { rooms }) }
  sockets/index.js                   attach(httpServer) → io
  scripts/migrador.js                aplicarMigraciones(conn, dir?)
  scripts/setup.js                   CLI: aplica migraciones sobre DB_*
  scripts/e2e-servidor.js            servidor para Playwright (BD de prueba, usuarios con PIN conocido)
  scripts/respaldo.sh                RNF-7
  testing/env.js                     variables por defecto de pruebas
  testing/globalSetup.js             recrea serfuweb_test + base Mantix mínima + migraciones TRK
  testing/db.js                      limpiar(), cerrar()
  testing/fabricas.js                crearAdmin, crearOperativo, crearParticipante, categoria, calificar
  testing/app.js                     crearAppTrk()
  testing/sql/mantix_base.sql        tablas mínimas `roles` y `usuarios` + rol Administrador
  testing/fixtures/inscripciones-anonimizadas.csv
  testing/docker-compose.yml         MySQL 8 en 127.0.0.1:3307
  **/__tests__/*.test.js             unitarias (sin BD)
  **/__tests__/*.int.test.js         integración (MySQL de prueba)
```

> Los helpers de prueba viven en `src/trk/testing/` (no en `__tests__/`) porque Jest ejecutaría como prueba todo archivo dentro de `__tests__/`.

### FRONT — `peludos/`

```
package.json, vite.config.js (incluye config de Vitest), playwright.config.js, tailwind.config.js, postcss.config.js, index.html
src/main.js, src/App.vue, src/style.css
src/services/api.js            axios: api (base /api) y trk (base /api/trk/v1); normaliza errores
src/services/socket.js         conectarSocket(token) → socket del namespace /trk
src/stores/auth.js             token, usuario, loginPin, loginAdmin, cargarPerfil, logout, tiene(accion)
src/stores/evento.js           enPasarela, modoPantalla, ranking, aplicarEstado
src/stores/categorias.js       categorías (TRK-CAT-005)
src/stores/calificacion.js     cola offline + sincronización
src/router/index.js            rutas §10 + guard por permiso
src/composables/useTiempoReal.js   socket con respaldo de polling (3 s)
src/utils/imagen.js            calcularRecorte45, comprimirImagen
src/utils/colaOffline.js       encolar, listar, quitar (IndexedDB vía idb-keyval)
src/utils/errores.js           mensajeDeError(err)
src/components/FotoMascota.vue, AvatarEspecie.vue, EstadoChip.vue, ControlPuntaje.vue, BarraSuperior.vue, FichaMascota.vue
src/views/LoginView.vue, CabinaView.vue, ComentaristaView.vue, JuradoView.vue, CalificarView.vue, PantallaView.vue
src/views/admin/AdminLayout.vue, TableroView.vue, ImportarView.vue, ParticipantesView.vue, RankingView.vue, UsuariosView.vue
src/**/__tests__/*.spec.js     Vitest
e2e/*.spec.js                  Playwright (360×800)
```

## Convenciones para las tareas

- **Backend unit:** `cd BACK && npx jest <ruta> ` (sin BD).
- **Backend integración:** requiere MySQL de prueba arriba: `cd BACK && npm run trk:db:test` (una vez por sesión), luego `npx jest -c jest.trk-int.config.js --runInBand <ruta>`.
- **Frontend:** `cd FRONT && npx vitest run <ruta>`.
- **E2E:** `cd FRONT && npx playwright test <archivo>` (levanta backend de prueba y Vite solo).
- Cada endpoint nuevo: (1) entrada en `apiCodigos.js`, (2) `apiCodigo('<código>')` como **primer** middleware de la ruta, (3) prueba de integración que verifica `X-TRK-API`.
- Patrón de ruta: `router.<metodo>('<path>', apiCodigo('TRK-X-NNN'), [trkAuth | trkAuthOpcional], [trkPermiso('<accion>')], [validar(esquema)], aw(controller.fn))`.
- Al cerrar cada fase: correr **toda** la suite (unit + integración + vitest + e2e existentes) y reportar al usuario resumen de lo hecho y lo pendiente (paso "Cierre de fase").

---
## Fase 1 — Base: BD, migraciones, seed, auth, usuarios, esqueleto del frontend

**Hecho cuando:** pruebas de seed, login con PIN, invalidación de PIN, registro de códigos y gestión de usuarios pasan; el frontend arranca, inicia sesión y gestiona usuarios.

### Task 1.1: Repos, infraestructura de pruebas y migrador

Cubre: §12 Fase 1, D7, D8 (`decisiones.md`).

**Files:**
- Create: `BACK:src/trk/testing/docker-compose.yml`, `BACK:src/trk/testing/env.js`, `BACK:src/trk/testing/globalSetup.js`, `BACK:src/trk/testing/db.js`, `BACK:src/trk/testing/app.js`, `BACK:src/trk/testing/sql/mantix_base.sql`, `BACK:src/trk/scripts/migrador.js`, `BACK:src/trk/scripts/setup.js`, `BACK:src/trk/migrations/.gitkeep`, `BACK:jest.trk-int.config.js`
- Modify: `BACK:src/config/database.js` (agregar `test`), `BACK:package.json` (scripts + `jest`), `BACK:.gitignore`
- Test: `BACK:src/trk/scripts/__tests__/migrador.int.test.js`

**Interfaces:**
- Produces: `aplicarMigraciones(conn, dir = DIR_MIGRACIONES, log = () => {}) → Promise<string[]>` (nombres aplicados en esta corrida); `DIR_MIGRACIONES`; `limpiar()`, `cerrar()` (testing/db.js); `crearAppTrk() → express app` (testing/app.js, monta `require('../routes').router` en `/api/trk/v1` — el router existe desde Task 1.5; hasta entonces `app.js` no se usa).

- [ ] **Step 1: Preparar repos y ramas**

```bash
cd "/Users/Shared/Files From c.localized/apps/mantix"
git clone https://github.com/ebor94/mantix mantix-git
cd mantix-git && git checkout -b feature/trikipeludos && npm ci
npx jest 2>&1 | tail -5   # línea base: anotar cuántas pruebas pasan/fallan ANTES de tocar nada
cd ../peludos && git checkout -b feature/trikipeludos
```

Expected: clon en `main`, rama creada. Anota el resultado de la línea base de Jest en el reporte de la fase (si fallan pruebas preexistentes por falta del entorno `test` en `database.js`, el Step 3 lo corrige).

- [ ] **Step 2: MySQL de prueba**

`BACK:src/trk/testing/docker-compose.yml`:

```yaml
services:
  mysql-trk-test:
    image: mysql:8.0
    container_name: mysql-trk-test
    environment:
      MYSQL_ROOT_PASSWORD: trk_test
    command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci", "--default-time-zone=-05:00"]
    ports:
      - "127.0.0.1:3307:3306"
    tmpfs:
      - /var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-ptrk_test"]
      interval: 2s
      timeout: 2s
      retries: 30
```

- [ ] **Step 3: Entorno `test` en la config de BD**

En `BACK:src/config/database.js`, agregar como tercera clave del objeto exportado (después de `production`):

```js
  // Usado por Jest (NODE_ENV=test). Los valores DB_* los fija src/trk/testing/env.js.
  test: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'mysql',
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    timezone: '-05:00',
    dialectOptions: { typeCast: bitToNumberCast },
    define: { timestamps: true, underscored: false, freezeTableName: true }
  }
```

Ojo: `config/database.js` se evalúa al hacer `require`, así que `env.js` debe correr antes (lo garantiza `setupFiles`).

- [ ] **Step 4: Helpers de prueba**

`BACK:src/trk/testing/env.js`:

```js
// Valores por defecto para pruebas TRK. No pisa variables ya definidas.
const os = require('os');
const path = require('path');

const DEFAULTS = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3307',
  DB_NAME: 'serfuweb_test',
  DB_USER: 'root',
  DB_PASSWORD: 'trk_test',
  JWT_SECRET: 'test-jwt-mantix',
  TRK_JWT_SECRET: 'test-jwt-trk',
  TRK_FOTOS_PATH: path.join(os.tmpdir(), 'trk-fotos-test'),
  LOG_LEVEL: 'error'
};

for (const [clave, valor] of Object.entries(DEFAULTS)) {
  if (!process.env[clave]) process.env[clave] = valor;
}

module.exports = DEFAULTS;
```

`BACK:src/trk/testing/sql/mantix_base.sql` (tablas mínimas de Mantix compatibles con `src/models/Usuario.js` y `Rol.js`):

```sql
-- Base mínima de Mantix para pruebas TRK (solo lo que TRK lee/escribe).
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT NULL,
  permisos JSON NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rol_id INT NOT NULL,
  empresa_id INT UNSIGNED NULL,
  sede_id INT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  telefono VARCHAR(20) NULL,
  avatar VARCHAR(255) NULL,
  id_identidad INT NULL,
  es_super_admin TINYINT(1) NOT NULL DEFAULT 0,
  prefijo_recibo VARCHAR(10) NULL UNIQUE,
  codigo VARCHAR(45) NULL,
  cod_vendedor VARCHAR(45) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acceso DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (nombre, descripcion, permisos, activo)
VALUES ('Administrador', 'Administrador de Mantix', JSON_OBJECT(), 1);
```

`BACK:src/trk/scripts/migrador.js`:

```js
/**
 * src/trk/scripts/migrador.js
 * Aplica en orden las migraciones NNN_*.sql de src/trk/migrations que no estén
 * registradas en trk_migraciones. La conexión debe tener multipleStatements.
 */
const fs = require('fs');
const path = require('path');

const DIR_MIGRACIONES = path.join(__dirname, '..', 'migrations');
const PATRON = /^\d{3}_[a-z0-9_]+\.sql$/;

async function aplicarMigraciones(conn, dir = DIR_MIGRACIONES, log = () => {}) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS trk_migraciones (
       nombre VARCHAR(150) NOT NULL PRIMARY KEY,
       aplicada_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  const [filas] = await conn.query('SELECT nombre FROM trk_migraciones');
  const hechas = new Set(filas.map((f) => f.nombre));
  const archivos = fs.readdirSync(dir).filter((f) => PATRON.test(f)).sort();

  const aplicadas = [];
  for (const archivo of archivos) {
    if (hechas.has(archivo)) continue;
    const sql = fs.readFileSync(path.join(dir, archivo), 'utf8');
    await conn.query(sql);
    await conn.query('INSERT INTO trk_migraciones (nombre) VALUES (?)', [archivo]);
    aplicadas.push(archivo);
    log(archivo);
  }
  return aplicadas;
}

module.exports = { aplicarMigraciones, DIR_MIGRACIONES };
```

`BACK:src/trk/scripts/setup.js`:

```js
/**
 * src/trk/scripts/setup.js
 * Aplica las migraciones TRK sobre la base configurada en DB_* (serfuweb en producción).
 * Uso: npm run trk:setup
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { aplicarMigraciones } = require('./migrador');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4'
  });
  console.log(`✅ Conectado a ${process.env.DB_HOST}/${process.env.DB_NAME}`);
  try {
    const aplicadas = await aplicarMigraciones(conn, undefined, (f) => console.log(`   ✅ ${f}`));
    console.log(aplicadas.length ? `✔ ${aplicadas.length} migración(es) aplicada(s)` : '✔ Sin migraciones pendientes');
  } catch (e) {
    console.error('❌ Falló una migración:', e.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
```

`BACK:src/trk/testing/globalSetup.js`:

```js
// Recrea serfuweb_test: base mínima de Mantix + migraciones TRK. Corre una vez por `jest -c jest.trk-int.config.js`.
require('./env');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { aplicarMigraciones } = require('../scripts/migrador');

module.exports = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    charset: 'utf8mb4'
  });
  const bd = process.env.DB_NAME;
  if (!/_test$/.test(bd)) throw new Error(`Por seguridad, la BD de pruebas debe terminar en _test (recibido: ${bd})`);
  await conn.query(`DROP DATABASE IF EXISTS \`${bd}\``);
  await conn.query(`CREATE DATABASE \`${bd}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${bd}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, 'sql', 'mantix_base.sql'), 'utf8'));
  await aplicarMigraciones(conn);
  await conn.end();
};
```

`BACK:src/trk/testing/db.js`:

```js
// Limpieza entre pruebas de integración. Usa una transacción para fijar la conexión
// (FOREIGN_KEY_CHECKS es por sesión).
const db = require('../../models');

const TABLAS_DATOS = [
  'trk_calificacion_detalle',
  'trk_calificaciones',
  'trk_auditoria',
  'trk_importaciones',
  'trk_ranking_snapshots',
  'trk_accesos',
  'trk_participantes'
];

async function existe(tabla, transaction) {
  const [filas] = await db.sequelize.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    { replacements: [tabla], transaction }
  );
  return Number(filas[0].n) > 0;
}

async function limpiar() {
  await db.sequelize.transaction(async (transaction) => {
    const q = (sql) => db.sequelize.query(sql, { transaction });
    await q('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabla of TABLAS_DATOS) {
      if (await existe(tabla, transaction)) await q(`DELETE FROM ${tabla}`);
    }
    if (await existe('trk_evento_estado', transaction)) {
      await q("UPDATE trk_evento_estado SET participante_en_pasarela_id = NULL, modo_pantalla = 'PASARELA', categoria_pantalla_id = NULL");
    }
    if (await existe('trk_categorias', transaction)) {
      await q('UPDATE trk_categorias SET abierta = 1, ranking_publicado = 0, puestos_premiados = 3');
    }
    await q("DELETE FROM usuarios WHERE email LIKE '%@trikipeludos.local' OR email LIKE '%@prueba.test'");
    await q('SET FOREIGN_KEY_CHECKS = 1');
  });
}

async function cerrar() {
  await db.sequelize.close();
}

module.exports = { limpiar, cerrar };
```

`BACK:src/trk/testing/app.js`:

```js
// App Express mínima con solo el router TRK, para Supertest.
const express = require('express');

function crearAppTrk() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/trk/v1', require('../routes').router);
  return app;
}

module.exports = { crearAppTrk };
```

Crear `BACK:src/trk/migrations/.gitkeep` vacío.

- [ ] **Step 5: Config de Jest y scripts**

`BACK:jest.trk-int.config.js`:

```js
// Pruebas de integración TRK contra MySQL de prueba (npm run trk:db:test).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/trk/**/*.int.test.js'],
  setupFiles: ['<rootDir>/src/trk/testing/env.js'],
  globalSetup: '<rootDir>/src/trk/testing/globalSetup.js',
  testTimeout: 30000
};
```

En `BACK:package.json`, dentro de `"scripts"` agregar:

```json
    "test:trk": "jest src/trk",
    "test:trk:int": "jest -c jest.trk-int.config.js --runInBand",
    "trk:db:test": "docker compose -f src/trk/testing/docker-compose.yml up -d --wait",
    "trk:setup": "node src/trk/scripts/setup.js"
```

y al nivel raíz del JSON:

```json
  "jest": {
    "testEnvironment": "node",
    "testPathIgnorePatterns": ["/node_modules/", "\\.int\\.test\\.js$"]
  }
```

En `BACK:.gitignore`, debajo de `!src/scripts/*.sql`, agregar:

```
!src/trk/migrations/*.sql
!src/trk/testing/sql/*.sql
```

- [ ] **Step 6: Escribir la prueba que falla**

`BACK:src/trk/scripts/__tests__/migrador.int.test.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const mysql = require('mysql2/promise');
const { aplicarMigraciones } = require('../migrador');

let conn;
let dir;

beforeAll(async () => {
  conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trk-mig-'));
  fs.writeFileSync(path.join(dir, '002_segunda.sql'), "INSERT INTO trk_prueba_migrador (valor) VALUES ('b');");
  fs.writeFileSync(path.join(dir, '001_primera.sql'), 'CREATE TABLE trk_prueba_migrador (valor VARCHAR(5));\nINSERT INTO trk_prueba_migrador (valor) VALUES (\'a\');');
  fs.writeFileSync(path.join(dir, 'leeme.txt'), 'no es migración');
});

afterAll(async () => {
  await conn.query('DROP TABLE IF EXISTS trk_prueba_migrador');
  await conn.query("DELETE FROM trk_migraciones WHERE nombre IN ('001_primera.sql', '002_segunda.sql')");
  await conn.end();
});

test('aplica en orden numérico y registra en trk_migraciones', async () => {
  const aplicadas = await aplicarMigraciones(conn, dir);
  expect(aplicadas).toEqual(['001_primera.sql', '002_segunda.sql']);
  const [filas] = await conn.query('SELECT valor FROM trk_prueba_migrador ORDER BY valor');
  expect(filas.map((f) => f.valor)).toEqual(['a', 'b']);
});

test('es idempotente: la segunda corrida no aplica nada', async () => {
  const aplicadas = await aplicarMigraciones(conn, dir);
  expect(aplicadas).toEqual([]);
  const [filas] = await conn.query('SELECT COUNT(*) AS n FROM trk_prueba_migrador');
  expect(Number(filas[0].n)).toBe(2);
});
```

- [ ] **Step 7: Correr y verificar**

Run: `cd BACK && npm run trk:db:test && npx jest -c jest.trk-int.config.js --runInBand src/trk/scripts`
Expected: PASS (2 pruebas). Si el Step 4 se hizo después de escribir la prueba, primero debe fallar con `Cannot find module '../migrador'`.

Run: `npx jest 2>&1 | tail -5`
Expected: las pruebas preexistentes de Mantix siguen igual o mejor que la línea base del Step 1 (las `.int.test.js` quedan excluidas).

- [ ] **Step 8: Commit**

```bash
cd BACK
git add src/config/database.js package.json .gitignore jest.trk-int.config.js src/trk
git commit -m "test(trk): infraestructura de pruebas, MySQL de prueba y migrador SQL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Esquema `trk_*` y vista de totales

Cubre: §8.0, §8.1, D6.

**Files:**
- Create: `BACK:src/trk/migrations/001_esquema.sql`, `BACK:src/trk/migrations/002_vistas.sql`
- Delete: `BACK:src/trk/migrations/.gitkeep`
- Test: `BACK:src/trk/migrations/__tests__/esquema.int.test.js`

**Interfaces:**
- Produces: tablas `trk_rubricas, trk_criterios, trk_categorias, trk_participantes, trk_accesos, trk_calificaciones, trk_calificacion_detalle, trk_auditoria, trk_evento_estado, trk_ranking_snapshots, trk_importaciones` y vista `trk_vw_calificacion_totales` (columnas: `calificacion_id, participante_id, categoria_id, mascota_nombre, jurado_id, jurado_nombre, total, enviada_at, bloqueada, criterio_id, criterio_codigo, criterio_nombre, criterio_orden, puntaje`).

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/migrations/__tests__/esquema.int.test.js`:

```js
const db = require('../../../models');

const TABLAS = [
  'trk_rubricas', 'trk_criterios', 'trk_categorias', 'trk_participantes', 'trk_accesos',
  'trk_calificaciones', 'trk_calificacion_detalle', 'trk_auditoria', 'trk_evento_estado',
  'trk_ranking_snapshots', 'trk_importaciones', 'trk_migraciones'
];

const q = async (sql, replacements = []) => (await db.sequelize.query(sql, { replacements }))[0];

afterAll(() => db.sequelize.close());

test('existen todas las tablas trk_*', async () => {
  const filas = await q("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name LIKE 'trk\\_%'");
  expect(filas.map((f) => f.t).sort()).toEqual([...TABLAS].sort());
});

test('la vista trk_vw_calificacion_totales existe', async () => {
  const filas = await q("SELECT table_name AS t FROM information_schema.views WHERE table_schema = DATABASE()");
  expect(filas.map((f) => f.t)).toContain('trk_vw_calificacion_totales');
});

test('todo índice de tablas trk_ sigue §8.0 (idx_trk_ / uq_trk_ / fk_trk_)', async () => {
  const filas = await q("SELECT DISTINCT table_name AS t, index_name AS i FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name LIKE 'trk\\_%' AND index_name <> 'PRIMARY'");
  const malos = filas.filter((f) => !/^(idx_trk_|uq_trk_|fk_trk_)/.test(f.i));
  expect(malos).toEqual([]);
});

test('toda llave foránea sigue fk_trk_<tabla>_<referida>', async () => {
  const filas = await q("SELECT table_name AS t, constraint_name AS c FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY' AND table_name LIKE 'trk\\_%'");
  expect(filas.length).toBeGreaterThanOrEqual(14);
  for (const f of filas) expect(f.c.startsWith(`fk_${f.t}_`)).toBe(true);
});

test('único de calificaciones por participante y jurado', async () => {
  const filas = await q("SELECT index_name AS i, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'trk_calificaciones' AND non_unique = 0 GROUP BY index_name");
  expect(filas).toEqual(expect.arrayContaining([{ i: 'uq_trk_calificaciones_part_jur', cols: 'participante_id,jurado_id' }]));
});

test('clave natural de participantes', async () => {
  const filas = await q("SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'trk_participantes' AND index_name = 'uq_trk_participantes_doc_mascota'");
  expect(filas[0].cols).toBe('responsable_documento,mascota_nombre_norm');
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/migrations`
Expected: FAIL (`existen todas las tablas` recibe solo `trk_migraciones`).

- [ ] **Step 3: Escribir el esquema**

`BACK:src/trk/migrations/001_esquema.sql`:

```sql
-- ================================================================
-- TRIKIPELUDOS — 001 Esquema base (BD serfuweb, prefijo trk_)
-- Convención §8.0: idx_trk_ / uq_trk_ / fk_trk_<tabla>_<referida>
-- ================================================================

CREATE TABLE trk_rubricas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  CONSTRAINT uq_trk_rubricas_codigo UNIQUE (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_criterios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rubrica_id INT NOT NULL,
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  puntaje_max TINYINT UNSIGNED NOT NULL,
  orden TINYINT UNSIGNED NOT NULL,
  peso_desempate TINYINT UNSIGNED NULL COMMENT '1 = primer criterio de desempate; NULL = no desempata',
  CONSTRAINT uq_trk_criterios_rubrica_codigo UNIQUE (rubrica_id, codigo),
  CONSTRAINT fk_trk_criterios_rubricas FOREIGN KEY (rubrica_id) REFERENCES trk_rubricas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  rubrica_id INT NOT NULL,
  abierta TINYINT(1) NOT NULL DEFAULT 1,
  ranking_publicado TINYINT(1) NOT NULL DEFAULT 0,
  orden TINYINT UNSIGNED NOT NULL,
  puestos_premiados TINYINT UNSIGNED NOT NULL DEFAULT 3,
  CONSTRAINT uq_trk_categorias_codigo UNIQUE (codigo),
  CONSTRAINT fk_trk_categorias_rubricas FOREIGN KEY (rubrica_id) REFERENCES trk_rubricas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_participantes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  categoria_id INT NOT NULL,
  categoria_propuesta_id INT NULL,
  responsable_nombre VARCHAR(150) NOT NULL,
  responsable_documento VARCHAR(20) NULL,
  responsable_telefono VARCHAR(20) NULL,
  responsable_correo VARCHAR(150) NULL,
  mascota_nombre VARCHAR(100) NOT NULL,
  mascota_nombre_norm VARCHAR(100) NOT NULL,
  especie ENUM('PERRO','GATO') NULL,
  raza VARCHAR(100) NULL,
  edad_texto VARCHAR(50) NULL,
  sexo ENUM('MACHO','HEMBRA') NULL,
  disfraz_nombre VARCHAR(150) NULL,
  foto_inscripcion_url VARCHAR(500) NULL,
  foto_oficial_path VARCHAR(255) NULL,
  foto_oficial_at DATETIME NULL,
  estado ENUM('INSCRITO','PRESENTE','EN_PASARELA','PRESENTADO','AUSENTE') NOT NULL DEFAULT 'INSCRITO',
  orden_pasarela INT NULL,
  llegada_at DATETIME NULL,
  desempate_manual INT NULL,
  autoriza_datos TINYINT(1) NOT NULL DEFAULT 0,
  autoriza_reglamento TINYINT(1) NOT NULL DEFAULT 0,
  fecha_inscripcion DATE NULL,
  notas_importacion TEXT NULL,
  advertencias_importacion JSON NULL,
  fusionado_en_id CHAR(36) NULL,
  origen ENUM('IMPORTACION','CABINA') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_trk_participantes_doc_mascota UNIQUE (responsable_documento, mascota_nombre_norm),
  INDEX idx_trk_participantes_estado (estado),
  INDEX idx_trk_participantes_categoria_estado (categoria_id, estado),
  CONSTRAINT fk_trk_participantes_categorias FOREIGN KEY (categoria_id) REFERENCES trk_categorias (id),
  CONSTRAINT fk_trk_participantes_categorias_propuesta FOREIGN KEY (categoria_propuesta_id) REFERENCES trk_categorias (id),
  CONSTRAINT fk_trk_participantes_participantes FOREIGN KEY (fusionado_en_id) REFERENCES trk_participantes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PIN y versión de token de usuarios operativos (extensión 1:1 de usuarios de Mantix)
CREATE TABLE trk_accesos (
  usuario_id INT NOT NULL PRIMARY KEY,
  pin_hash VARCHAR(100) NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trk_accesos_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_calificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  participante_id CHAR(36) NOT NULL,
  jurado_id INT NOT NULL,
  total TINYINT UNSIGNED NOT NULL,
  enviada_at DATETIME NOT NULL,
  bloqueada TINYINT(1) NOT NULL DEFAULT 1,
  desbloqueada_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_trk_calificaciones_part_jur UNIQUE (participante_id, jurado_id),
  INDEX idx_trk_calificaciones_jurado (jurado_id),
  CONSTRAINT fk_trk_calificaciones_participantes FOREIGN KEY (participante_id) REFERENCES trk_participantes (id) ON DELETE CASCADE,
  CONSTRAINT fk_trk_calificaciones_usuarios FOREIGN KEY (jurado_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_calificacion_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  calificacion_id INT NOT NULL,
  criterio_id INT NOT NULL,
  puntaje TINYINT UNSIGNED NOT NULL,
  CONSTRAINT uq_trk_calificacion_detalle_cal_crit UNIQUE (calificacion_id, criterio_id),
  CONSTRAINT fk_trk_calificacion_detalle_calificaciones FOREIGN KEY (calificacion_id) REFERENCES trk_calificaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_trk_calificacion_detalle_criterios FOREIGN KEY (criterio_id) REFERENCES trk_criterios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_auditoria (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  api_codigo VARCHAR(20) NOT NULL,
  entidad VARCHAR(50) NOT NULL,
  entidad_id VARCHAR(36) NULL,
  accion VARCHAR(50) NOT NULL,
  antes JSON NULL,
  despues JSON NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trk_auditoria_entidad (entidad, entidad_id),
  INDEX idx_trk_auditoria_api_codigo (api_codigo),
  CONSTRAINT fk_trk_auditoria_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_evento_estado (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  participante_en_pasarela_id CHAR(36) NULL,
  modo_pantalla ENUM('PASARELA','RANKING') NOT NULL DEFAULT 'PASARELA',
  categoria_pantalla_id INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trk_evento_estado_participantes FOREIGN KEY (participante_en_pasarela_id) REFERENCES trk_participantes (id) ON DELETE SET NULL,
  CONSTRAINT fk_trk_evento_estado_categorias FOREIGN KEY (categoria_pantalla_id) REFERENCES trk_categorias (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_ranking_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  publicado_por INT NULL,
  publicado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  datos JSON NOT NULL,
  INDEX idx_trk_ranking_snapshots_categoria_fecha (categoria_id, publicado_at),
  CONSTRAINT fk_trk_ranking_snapshots_categorias FOREIGN KEY (categoria_id) REFERENCES trk_categorias (id),
  CONSTRAINT fk_trk_ranking_snapshots_usuarios FOREIGN KEY (publicado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trk_importaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  archivo_nombre VARCHAR(255) NOT NULL,
  archivo_sha256 CHAR(64) NOT NULL,
  filas_total INT NOT NULL,
  filas_ok INT NOT NULL,
  filas_advertencia INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trk_importaciones_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> ⚠️ Antes de aplicar en producción (Task 7.4) se verifica con `SHOW CREATE TABLE usuarios` que `usuarios.id` es `INT` con signo; si fuera `INT UNSIGNED`, se ajustan las columnas `usuario_id`, `jurado_id` y `publicado_por` en una migración nueva (nunca editando 001 ya aplicada).

`BACK:src/trk/migrations/002_vistas.sql`:

```sql
-- TRIKIPELUDOS — 002 Vistas. Formato largo: una fila por calificación × criterio.
CREATE OR REPLACE VIEW trk_vw_calificacion_totales AS
SELECT
  c.id               AS calificacion_id,
  c.participante_id  AS participante_id,
  p.categoria_id     AS categoria_id,
  p.mascota_nombre   AS mascota_nombre,
  c.jurado_id        AS jurado_id,
  TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS jurado_nombre,
  c.total            AS total,
  c.enviada_at       AS enviada_at,
  c.bloqueada        AS bloqueada,
  cr.id              AS criterio_id,
  cr.codigo          AS criterio_codigo,
  cr.nombre          AS criterio_nombre,
  cr.orden           AS criterio_orden,
  d.puntaje          AS puntaje
FROM trk_calificaciones c
JOIN trk_participantes p        ON p.id = c.participante_id
JOIN usuarios u                 ON u.id = c.jurado_id
JOIN trk_calificacion_detalle d ON d.calificacion_id = c.id
JOIN trk_criterios cr           ON cr.id = d.criterio_id;
```

Borrar `BACK:src/trk/migrations/.gitkeep`.

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/migrations src/trk/scripts`
Expected: PASS (6 + 2). `globalSetup` recrea la BD en cada corrida.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk/migrations
git commit -m "feat(trk): esquema trk_* y vista trk_vw_calificacion_totales

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Seed de rúbricas, categorías, roles TRK y estado del evento

Cubre: §3.1–§3.3 (rúbricas como datos), §2.1 (roles y permisos), regla "rúbricas son datos".

**Files:**
- Create: `BACK:src/trk/migrations/003_seed_rubricas.sql`, `BACK:src/trk/migrations/004_roles_trk.sql`, `BACK:src/trk/migrations/005_evento_estado.sql`
- Test: `BACK:src/trk/migrations/__tests__/seed.int.test.js`

**Interfaces:**
- Produces: rúbricas `INDIVIDUAL`, `FAMILIAR`; criterios con códigos `CREATIVIDAD, SEGURIDAD, ELABORACION, PASARELA, INTEGRACION` (`peso_desempate` 1 = CREATIVIDAD, 2 = SEGURIDAD); categorías `PEQ_MED, GRANDES, FELINOS, FAMILIAR` (orden 1–4); roles `TRK_CABINA, TRK_COMENTARISTA, TRK_JURADO`; fila `trk_evento_estado.id = 1`.

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/migrations/__tests__/seed.int.test.js`:

```js
const db = require('../../../models');

const q = async (sql, replacements = []) => (await db.sequelize.query(sql, { replacements }))[0];
const permisos = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

afterAll(() => db.sequelize.close());

test('cada rúbrica suma 100 (dato de BD, no código)', async () => {
  const filas = await q('SELECT r.codigo, SUM(c.puntaje_max) AS total, COUNT(*) AS n FROM trk_rubricas r JOIN trk_criterios c ON c.rubrica_id = r.id GROUP BY r.codigo ORDER BY r.codigo');
  expect(filas.map((f) => [f.codigo, Number(f.total), Number(f.n)])).toEqual([
    ['FAMILIAR', 100, 5],
    ['INDIVIDUAL', 100, 4]
  ]);
});

test('desempate: Creatividad primero, Seguridad segundo, en ambas rúbricas', async () => {
  const filas = await q('SELECT r.codigo AS rubrica, c.codigo, c.peso_desempate AS peso FROM trk_criterios c JOIN trk_rubricas r ON r.id = c.rubrica_id WHERE c.peso_desempate IS NOT NULL ORDER BY r.codigo, c.peso_desempate');
  expect(filas.map((f) => `${f.rubrica}:${f.codigo}:${f.peso}`)).toEqual([
    'FAMILIAR:CREATIVIDAD:1', 'FAMILIAR:SEGURIDAD:2', 'INDIVIDUAL:CREATIVIDAD:1', 'INDIVIDUAL:SEGURIDAD:2'
  ]);
});

test('categorías con su rúbrica, abiertas, sin publicar y 3 puestos premiados', async () => {
  const filas = await q('SELECT c.codigo, r.codigo AS rubrica, c.abierta, c.ranking_publicado, c.puestos_premiados FROM trk_categorias c JOIN trk_rubricas r ON r.id = c.rubrica_id ORDER BY c.orden');
  expect(filas.map((f) => [f.codigo, f.rubrica, Number(f.abierta), Number(f.ranking_publicado), Number(f.puestos_premiados)])).toEqual([
    ['PEQ_MED', 'INDIVIDUAL', 1, 0, 3],
    ['GRANDES', 'INDIVIDUAL', 1, 0, 3],
    ['FELINOS', 'INDIVIDUAL', 1, 0, 3],
    ['FAMILIAR', 'FAMILIAR', 1, 0, 3]
  ]);
});

test('roles operativos TRK con su permiso', async () => {
  const filas = await q("SELECT nombre, permisos FROM roles WHERE nombre LIKE 'TRK\\_%' ORDER BY nombre");
  expect(filas.map((f) => [f.nombre, permisos(f.permisos).trk])).toEqual([
    ['TRK_CABINA', { cabina: true }],
    ['TRK_COMENTARISTA', { pasarela: true }],
    ['TRK_JURADO', { calificar: true }]
  ]);
});

test('roles admin existentes reciben permisos trk sin perder los suyos', async () => {
  const [rol] = await q("SELECT permisos FROM roles WHERE nombre = 'Administrador'");
  expect(permisos(rol.permisos).trk).toEqual({
    administrar: true, importar: true, editar: true, calificaciones_desbloquear: true,
    publicar: true, exportar: true, pasarela: true, cabina: true
  });
});

test('existe la fila única de estado del evento', async () => {
  const filas = await q('SELECT id, modo_pantalla FROM trk_evento_estado');
  expect(filas).toEqual([{ id: 1, modo_pantalla: 'PASARELA' }]);
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/migrations/__tests__/seed.int.test.js`
Expected: FAIL (tablas vacías).

- [ ] **Step 3: Escribir los seeds**

`BACK:src/trk/migrations/003_seed_rubricas.sql`:

```sql
-- TRIKIPELUDOS — 003 Seed de rúbricas, criterios y categorías (spec §3). Idempotente.
-- Cambiar un puntaje máximo = UPDATE trk_criterios; no requiere desplegar código.
INSERT INTO trk_rubricas (codigo, nombre) VALUES
  ('INDIVIDUAL', 'Rúbrica individual'),
  ('FAMILIAR',   'Rúbrica familiar')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO trk_criterios (rubrica_id, codigo, nombre, descripcion, puntaje_max, orden, peso_desempate)
SELECT r.id, v.codigo, v.nombre, v.descripcion, v.puntaje_max, v.orden, v.peso
FROM trk_rubricas r
JOIN (
            SELECT 'INDIVIDUAL' AS rub, 'CREATIVIDAD' AS codigo, 'Creatividad' AS nombre, 'Idea novedosa y diferenciada' AS descripcion, 35 AS puntaje_max, 1 AS orden, 1 AS peso
  UNION ALL SELECT 'INDIVIDUAL', 'SEGURIDAD',   'Seguridad',            'Comodidad y libertad de movimiento de la mascota',          30, 2, 2
  UNION ALL SELECT 'INDIVIDUAL', 'ELABORACION', 'Elaboración',          'Calidad, detalle y presentación del disfraz',               20, 3, NULL
  UNION ALL SELECT 'INDIVIDUAL', 'PASARELA',    'Pasarela',             'Actitud, desenvolvimiento y conexión con el público',       15, 4, NULL
  UNION ALL SELECT 'FAMILIAR',   'CREATIVIDAD', 'Creatividad',          'Idea novedosa del conjunto',                                30, 1, 1
  UNION ALL SELECT 'FAMILIAR',   'SEGURIDAD',   'Seguridad',            'Bienestar, comodidad y movilidad de la mascota',            25, 2, 2
  UNION ALL SELECT 'FAMILIAR',   'ELABORACION', 'Elaboración',          'Calidad y presentación visual del conjunto',                20, 3, NULL
  UNION ALL SELECT 'FAMILIAR',   'PASARELA',    'Pasarela',             'Actitud y puesta en escena',                                10, 4, NULL
  UNION ALL SELECT 'FAMILIAR',   'INTEGRACION', 'Integración familiar', 'Coherencia entre los disfraces de la familia y la mascota', 15, 5, NULL
) v ON v.rub = r.codigo
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre), descripcion = VALUES(descripcion), puntaje_max = VALUES(puntaje_max),
  orden = VALUES(orden), peso_desempate = VALUES(peso_desempate);

INSERT INTO trk_categorias (codigo, nombre, rubrica_id, orden)
SELECT v.codigo, v.nombre, r.id, v.orden
FROM trk_rubricas r
JOIN (
            SELECT 'PEQ_MED' AS codigo, 'Caninos pequeños y medianos' AS nombre, 'INDIVIDUAL' AS rub, 1 AS orden
  UNION ALL SELECT 'GRANDES',  'Caninos grandes',                              'INDIVIDUAL', 2
  UNION ALL SELECT 'FELINOS',  'Felinos',                                      'INDIVIDUAL', 3
  UNION ALL SELECT 'FAMILIAR', 'Disfraz familiar (mascota + acompañante/s)',  'FAMILIAR',   4
) v ON v.rub = r.codigo
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), rubrica_id = VALUES(rubrica_id), orden = VALUES(orden);
```

`BACK:src/trk/migrations/004_roles_trk.sql`:

```sql
-- TRIKIPELUDOS — 004 Roles operativos y permisos trk sobre roles de Mantix (patrón rol_cajero_migration.sql).
INSERT IGNORE INTO roles (nombre, descripcion, permisos, activo) VALUES
  ('TRK_CABINA',       'TRIKIPELUDOS — Cabina de recepción (PIN compartido)',  '{"trk":{"cabina":true}}',    1),
  ('TRK_COMENTARISTA', 'TRIKIPELUDOS — Comentarista de tarima (PIN compartido)', '{"trk":{"pasarela":true}}',  1),
  ('TRK_JURADO',       'TRIKIPELUDOS — Jurado calificador (PIN individual)',   '{"trk":{"calificar":true}}', 1);

-- Roles administradores existentes: todos los permisos TRK excepto calificar.
UPDATE roles
SET permisos = JSON_MERGE_PATCH(
  COALESCE(permisos, '{}'),
  '{"trk":{"administrar":true,"importar":true,"editar":true,"calificaciones_desbloquear":true,"publicar":true,"exportar":true,"pasarela":true,"cabina":true}}'
)
WHERE LOWER(nombre) LIKE '%admin%';
```

`BACK:src/trk/migrations/005_evento_estado.sql`:

```sql
-- TRIKIPELUDOS — 005 Fila única de estado del evento.
INSERT IGNORE INTO trk_evento_estado (id, participante_en_pasarela_id, modo_pantalla, categoria_pantalla_id)
VALUES (1, NULL, 'PASARELA', NULL);
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS (seed 6 + esquema 6 + migrador 2).

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk/migrations
git commit -m "feat(trk): seed de rubricas, categorias, roles TRK y estado del evento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1.4: Modelos Sequelize `Trk*`

Cubre: §8.0 (tableName explícito), D3.

**Files:**
- Create: `BACK:src/trk/models/index.js`, `BACK:src/trk/models/TrkRubrica.js`, `TrkCriterio.js`, `TrkCategoria.js`, `TrkParticipante.js`, `TrkAcceso.js`, `TrkCalificacion.js`, `TrkCalificacionDetalle.js`, `TrkAuditoria.js`, `TrkEventoEstado.js`, `TrkRankingSnapshot.js`, `TrkImportacion.js` (todos en `BACK:src/trk/models/`)
- Modify: `BACK:src/models/index.js` (una línea antes del cierre `};` del objeto `db`)
- Test: `BACK:src/trk/models/__tests__/modelos.test.js`

**Interfaces:**
- Produces (en `require('src/models')`): `db.TrkRubrica`, `db.TrkCriterio`, `db.TrkCategoria`, `db.TrkParticipante`, `db.TrkAcceso`, `db.TrkCalificacion`, `db.TrkCalificacionDetalle`, `db.TrkAuditoria`, `db.TrkEventoEstado`, `db.TrkRankingSnapshot`, `db.TrkImportacion`.
- Asociaciones (alias exactos): `TrkRubrica.hasMany(TrkCriterio, 'criterios')`; `TrkCategoria.belongsTo(TrkRubrica, 'rubrica')`; `TrkParticipante.belongsTo(TrkCategoria, 'categoria')` y `(…, 'categoriaPropuesta')`; `TrkParticipante.hasMany(TrkCalificacion, 'calificaciones')`; `TrkCalificacion.belongsTo(TrkParticipante, 'participante')`, `belongsTo(Usuario, 'jurado')`, `hasMany(TrkCalificacionDetalle, 'detalles')`; `TrkCalificacionDetalle.belongsTo(TrkCriterio, 'criterio')`; `TrkAcceso.belongsTo(Usuario, 'usuario')`; `TrkEventoEstado.belongsTo(TrkParticipante, 'enPasarela')`, `belongsTo(TrkCategoria, 'categoriaPantalla')`; `TrkRankingSnapshot.belongsTo(TrkCategoria, 'categoria')`.
- Atributos en snake_case idénticos a las columnas (sin mapeo camelCase).
- `Model.sync()` de cada modelo TRK es un no-op: el `sequelize.sync()` de Mantix nunca crea tablas `trk_*` (D3).

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/models/__tests__/modelos.test.js`:

```js
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const definirModelosTrk = require('..');

const sequelize = new Sequelize({ dialect: 'mysql', logging: false });
const Usuario = sequelize.define('Usuario', {}, { tableName: 'usuarios' });
const modelos = definirModelosTrk(sequelize, DataTypes);
Object.values(modelos).forEach((m) => m.associate && m.associate({ ...modelos, Usuario }));

const sqlMigraciones = fs.readdirSync(path.join(__dirname, '..', '..', 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', f), 'utf8'))
  .join('\n');

test('todos los modelos se llaman Trk* y usan tabla trk_* con freezeTableName', () => {
  expect(Object.keys(modelos).sort()).toEqual([
    'TrkAcceso', 'TrkAuditoria', 'TrkCalificacion', 'TrkCalificacionDetalle', 'TrkCategoria', 'TrkCriterio',
    'TrkEventoEstado', 'TrkImportacion', 'TrkParticipante', 'TrkRankingSnapshot', 'TrkRubrica'
  ]);
  for (const m of Object.values(modelos)) {
    expect(m.options.tableName).toMatch(/^trk_/);
    expect(m.options.freezeTableName).toBe(true);
  }
});

test('toda tabla de modelo la crea una migración (el esquema no depende de sync)', () => {
  for (const m of Object.values(modelos)) {
    expect(sqlMigraciones).toContain(`CREATE TABLE ${m.options.tableName} (`);
  }
});

test('todo atributo existe como columna en la migración de su tabla', () => {
  for (const m of Object.values(modelos)) {
    const tabla = m.options.tableName;
    const inicio = sqlMigraciones.indexOf(`CREATE TABLE ${tabla} (`);
    const bloque = sqlMigraciones.slice(inicio, sqlMigraciones.indexOf(') ENGINE', inicio));
    for (const attr of Object.values(m.rawAttributes)) {
      expect({ tabla, columna: attr.field, presente: new RegExp(`\\n\\s+${attr.field} `).test(bloque) })
        .toEqual({ tabla, columna: attr.field, presente: true });
    }
  }
});

test('participante usa UUID y timestamps snake_case', () => {
  const p = modelos.TrkParticipante;
  expect(p.rawAttributes.id.type.key).toBe('UUID');
  expect(p.rawAttributes.created_at.field).toBe('created_at');
  expect(p.associations.categoria.foreignKey).toBe('categoria_id');
  expect(p.associations.categoriaPropuesta.foreignKey).toBe('categoria_propuesta_id');
});

test('sync() de los modelos TRK no toca la BD (lo usa el arranque de Mantix)', async () => {
  for (const m of Object.values(modelos)) await expect(m.sync({ alter: true })).resolves.toBe(m);
});

test('calificación pertenece a usuarios como jurado', () => {
  expect(modelos.TrkCalificacion.associations.jurado.target.options.tableName).toBe('usuarios');
  expect(modelos.TrkCalificacion.associations.detalles.foreignKey).toBe('calificacion_id');
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest src/trk/models`
Expected: FAIL `Cannot find module '..'`.

- [ ] **Step 3: Escribir los modelos**

`BACK:src/trk/models/index.js`:

```js
// ============================================
// src/trk/models/index.js — Modelos TRIKIPELUDOS (tablas trk_*)
// Se registran en la instancia central (src/models/index.js). El esquema lo crean
// las migraciones de src/trk/migrations; nunca sequelize.sync.
// ============================================
module.exports = (sequelize, DataTypes) => {
  const modelos = {
  TrkRubrica:             require('./TrkRubrica')(sequelize, DataTypes),
  TrkCriterio:            require('./TrkCriterio')(sequelize, DataTypes),
  TrkCategoria:           require('./TrkCategoria')(sequelize, DataTypes),
  TrkParticipante:        require('./TrkParticipante')(sequelize, DataTypes),
  TrkAcceso:              require('./TrkAcceso')(sequelize, DataTypes),
  TrkCalificacion:        require('./TrkCalificacion')(sequelize, DataTypes),
  TrkCalificacionDetalle: require('./TrkCalificacionDetalle')(sequelize, DataTypes),
  TrkAuditoria:           require('./TrkAuditoria')(sequelize, DataTypes),
  TrkEventoEstado:        require('./TrkEventoEstado')(sequelize, DataTypes),
  TrkRankingSnapshot:     require('./TrkRankingSnapshot')(sequelize, DataTypes),
  TrkImportacion:         require('./TrkImportacion')(sequelize, DataTypes)
  };
  // El sequelize.sync() que Mantix ejecuta al arrancar no debe crear ni tocar tablas trk_*:
  // su esquema (nombres de índices y FKs según §8.0) lo controlan solo las migraciones.
  for (const modelo of Object.values(modelos)) {
    modelo.sync = async function syncNeutralizado() { return this; };
  }
  return modelos;
};
```

`BACK:src/trk/models/TrkRubrica.js`:

```js
// trk_rubricas
module.exports = (sequelize, DataTypes) => {
  const TrkRubrica = sequelize.define('TrkRubrica', {
    id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo: { type: DataTypes.STRING(20), allowNull: false },
    nombre: { type: DataTypes.STRING(100), allowNull: false }
  }, { tableName: 'trk_rubricas', freezeTableName: true, timestamps: false });

  TrkRubrica.associate = (models) => {
    TrkRubrica.hasMany(models.TrkCriterio, { foreignKey: 'rubrica_id', as: 'criterios' });
  };
  return TrkRubrica;
};
```

`BACK:src/trk/models/TrkCriterio.js`:

```js
// trk_criterios — puntaje_max y peso_desempate son datos (seed), nunca constantes.
module.exports = (sequelize, DataTypes) => {
  const TrkCriterio = sequelize.define('TrkCriterio', {
    id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    rubrica_id:     { type: DataTypes.INTEGER, allowNull: false },
    codigo:         { type: DataTypes.STRING(30), allowNull: false },
    nombre:         { type: DataTypes.STRING(100), allowNull: false },
    descripcion:    { type: DataTypes.STRING(255), allowNull: false },
    puntaje_max:    { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    orden:          { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    peso_desempate: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true }
  }, { tableName: 'trk_criterios', freezeTableName: true, timestamps: false });

  TrkCriterio.associate = (models) => {
    TrkCriterio.belongsTo(models.TrkRubrica, { foreignKey: 'rubrica_id', as: 'rubrica' });
  };
  return TrkCriterio;
};
```

`BACK:src/trk/models/TrkCategoria.js`:

```js
// trk_categorias
module.exports = (sequelize, DataTypes) => {
  const TrkCategoria = sequelize.define('TrkCategoria', {
    id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo:            { type: DataTypes.STRING(20), allowNull: false },
    nombre:            { type: DataTypes.STRING(100), allowNull: false },
    rubrica_id:        { type: DataTypes.INTEGER, allowNull: false },
    abierta:           { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ranking_publicado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    orden:             { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    puestos_premiados: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 3 }
  }, { tableName: 'trk_categorias', freezeTableName: true, timestamps: false });

  TrkCategoria.associate = (models) => {
    TrkCategoria.belongsTo(models.TrkRubrica, { foreignKey: 'rubrica_id', as: 'rubrica' });
  };
  return TrkCategoria;
};
```

`BACK:src/trk/models/TrkParticipante.js`:

```js
// trk_participantes
module.exports = (sequelize, DataTypes) => {
  const TrkParticipante = sequelize.define('TrkParticipante', {
    id:                       { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    categoria_id:             { type: DataTypes.INTEGER, allowNull: false },
    categoria_propuesta_id:   { type: DataTypes.INTEGER, allowNull: true },
    responsable_nombre:       { type: DataTypes.STRING(150), allowNull: false },
    responsable_documento:    { type: DataTypes.STRING(20), allowNull: true },
    responsable_telefono:     { type: DataTypes.STRING(20), allowNull: true },
    responsable_correo:       { type: DataTypes.STRING(150), allowNull: true },
    mascota_nombre:           { type: DataTypes.STRING(100), allowNull: false },
    mascota_nombre_norm:      { type: DataTypes.STRING(100), allowNull: false },
    especie:                  { type: DataTypes.ENUM('PERRO', 'GATO'), allowNull: true },
    raza:                     { type: DataTypes.STRING(100), allowNull: true },
    edad_texto:               { type: DataTypes.STRING(50), allowNull: true },
    sexo:                     { type: DataTypes.ENUM('MACHO', 'HEMBRA'), allowNull: true },
    disfraz_nombre:           { type: DataTypes.STRING(150), allowNull: true },
    foto_inscripcion_url:     { type: DataTypes.STRING(500), allowNull: true },
    foto_oficial_path:        { type: DataTypes.STRING(255), allowNull: true },
    foto_oficial_at:          { type: DataTypes.DATE, allowNull: true },
    estado:                   { type: DataTypes.ENUM('INSCRITO', 'PRESENTE', 'EN_PASARELA', 'PRESENTADO', 'AUSENTE'), allowNull: false, defaultValue: 'INSCRITO' },
    orden_pasarela:           { type: DataTypes.INTEGER, allowNull: true },
    llegada_at:               { type: DataTypes.DATE, allowNull: true },
    desempate_manual:         { type: DataTypes.INTEGER, allowNull: true },
    autoriza_datos:           { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    autoriza_reglamento:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    fecha_inscripcion:        { type: DataTypes.DATEONLY, allowNull: true },
    notas_importacion:        { type: DataTypes.TEXT, allowNull: true },
    advertencias_importacion: { type: DataTypes.JSON, allowNull: true },
    fusionado_en_id:          { type: DataTypes.UUID, allowNull: true },
    origen:                   { type: DataTypes.ENUM('IMPORTACION', 'CABINA'), allowNull: false },
    created_at:               { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at:               { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'trk_participantes',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  TrkParticipante.associate = (models) => {
    TrkParticipante.belongsTo(models.TrkCategoria, { foreignKey: 'categoria_id', as: 'categoria' });
    TrkParticipante.belongsTo(models.TrkCategoria, { foreignKey: 'categoria_propuesta_id', as: 'categoriaPropuesta' });
    TrkParticipante.hasMany(models.TrkCalificacion, { foreignKey: 'participante_id', as: 'calificaciones' });
  };
  return TrkParticipante;
};
```

`BACK:src/trk/models/TrkAcceso.js`:

```js
// trk_accesos — PIN de usuarios operativos (extensión 1:1 de usuarios)
module.exports = (sequelize, DataTypes) => {
  const TrkAcceso = sequelize.define('TrkAcceso', {
    usuario_id:    { type: DataTypes.INTEGER, primaryKey: true },
    pin_hash:      { type: DataTypes.STRING(100), allowNull: false },
    token_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'trk_accesos',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  TrkAcceso.associate = (models) => {
    TrkAcceso.belongsTo(models.Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
  };
  return TrkAcceso;
};
```

`BACK:src/trk/models/TrkCalificacion.js`:

```js
// trk_calificaciones — una por (participante, jurado); total lo calcula siempre el servidor.
module.exports = (sequelize, DataTypes) => {
  const TrkCalificacion = sequelize.define('TrkCalificacion', {
    id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    participante_id: { type: DataTypes.UUID, allowNull: false },
    jurado_id:       { type: DataTypes.INTEGER, allowNull: false },
    total:           { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    enviada_at:      { type: DataTypes.DATE, allowNull: false },
    bloqueada:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    desbloqueada_at: { type: DataTypes.DATE, allowNull: true },
    created_at:      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at:      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'trk_calificaciones',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  TrkCalificacion.associate = (models) => {
    TrkCalificacion.belongsTo(models.TrkParticipante, { foreignKey: 'participante_id', as: 'participante' });
    TrkCalificacion.belongsTo(models.Usuario, { foreignKey: 'jurado_id', as: 'jurado' });
    TrkCalificacion.hasMany(models.TrkCalificacionDetalle, { foreignKey: 'calificacion_id', as: 'detalles' });
  };
  return TrkCalificacion;
};
```

`BACK:src/trk/models/TrkCalificacionDetalle.js`:

```js
// trk_calificacion_detalle — 0 <= puntaje <= trk_criterios.puntaje_max (validado en el servicio)
module.exports = (sequelize, DataTypes) => {
  const TrkCalificacionDetalle = sequelize.define('TrkCalificacionDetalle', {
    id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    calificacion_id: { type: DataTypes.INTEGER, allowNull: false },
    criterio_id:     { type: DataTypes.INTEGER, allowNull: false },
    puntaje:         { type: DataTypes.TINYINT.UNSIGNED, allowNull: false }
  }, { tableName: 'trk_calificacion_detalle', freezeTableName: true, timestamps: false });

  TrkCalificacionDetalle.associate = (models) => {
    TrkCalificacionDetalle.belongsTo(models.TrkCalificacion, { foreignKey: 'calificacion_id', as: 'calificacion' });
    TrkCalificacionDetalle.belongsTo(models.TrkCriterio, { foreignKey: 'criterio_id', as: 'criterio' });
  };
  return TrkCalificacionDetalle;
};
```

`BACK:src/trk/models/TrkAuditoria.js`:

```js
// trk_auditoria — quién, qué, antes, después, cuándo, con el código de API (RNF-6)
module.exports = (sequelize, DataTypes) => {
  const TrkAuditoria = sequelize.define('TrkAuditoria', {
    id:         { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true },
    api_codigo: { type: DataTypes.STRING(20), allowNull: false },
    entidad:    { type: DataTypes.STRING(50), allowNull: false },
    entidad_id: { type: DataTypes.STRING(36), allowNull: true },
    accion:     { type: DataTypes.STRING(50), allowNull: false },
    antes:      { type: DataTypes.JSON, allowNull: true },
    despues:    { type: DataTypes.JSON, allowNull: true },
    ip:         { type: DataTypes.STRING(45), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'trk_auditoria',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });
  return TrkAuditoria;
};
```

`BACK:src/trk/models/TrkEventoEstado.js`:

```js
// trk_evento_estado — fila única id = 1
module.exports = (sequelize, DataTypes) => {
  const TrkEventoEstado = sequelize.define('TrkEventoEstado', {
    id:                          { type: DataTypes.TINYINT.UNSIGNED, primaryKey: true },
    participante_en_pasarela_id: { type: DataTypes.UUID, allowNull: true },
    modo_pantalla:               { type: DataTypes.ENUM('PASARELA', 'RANKING'), allowNull: false, defaultValue: 'PASARELA' },
    categoria_pantalla_id:       { type: DataTypes.INTEGER, allowNull: true },
    updated_at:                  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'trk_evento_estado',
    freezeTableName: true,
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
  });

  TrkEventoEstado.associate = (models) => {
    TrkEventoEstado.belongsTo(models.TrkParticipante, { foreignKey: 'participante_en_pasarela_id', as: 'enPasarela' });
    TrkEventoEstado.belongsTo(models.TrkCategoria, { foreignKey: 'categoria_pantalla_id', as: 'categoriaPantalla' });
  };
  return TrkEventoEstado;
};
```

`BACK:src/trk/models/TrkRankingSnapshot.js`:

```js
// trk_ranking_snapshots — copia congelada al publicar
module.exports = (sequelize, DataTypes) => {
  const TrkRankingSnapshot = sequelize.define('TrkRankingSnapshot', {
    id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    categoria_id:  { type: DataTypes.INTEGER, allowNull: false },
    publicado_por: { type: DataTypes.INTEGER, allowNull: true },
    publicado_at:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    datos:         { type: DataTypes.JSON, allowNull: false }
  }, { tableName: 'trk_ranking_snapshots', freezeTableName: true, timestamps: false });

  TrkRankingSnapshot.associate = (models) => {
    TrkRankingSnapshot.belongsTo(models.TrkCategoria, { foreignKey: 'categoria_id', as: 'categoria' });
  };
  return TrkRankingSnapshot;
};
```

`BACK:src/trk/models/TrkImportacion.js`:

```js
// trk_importaciones — registro de cada importación confirmada
module.exports = (sequelize, DataTypes) => {
  const TrkImportacion = sequelize.define('TrkImportacion', {
    id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario_id:        { type: DataTypes.INTEGER, allowNull: true },
    archivo_nombre:    { type: DataTypes.STRING(255), allowNull: false },
    archivo_sha256:    { type: DataTypes.CHAR(64), allowNull: false },
    filas_total:       { type: DataTypes.INTEGER, allowNull: false },
    filas_ok:          { type: DataTypes.INTEGER, allowNull: false },
    filas_advertencia: { type: DataTypes.INTEGER, allowNull: false },
    created_at:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'trk_importaciones',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });
  return TrkImportacion;
};
```

En `BACK:src/models/index.js`, justo después de la línea `R44Revision: require('./R44Revision')(sequelize, Sequelize.DataTypes),` y antes del `};` que cierra `db`, agregar:

```js

  // ============================================
  // MÓDULO TRIKIPELUDOS — tablas trk_* (esquema por src/trk/migrations)
  // ============================================
  ...require('../trk/models')(sequelize, Sequelize.DataTypes),
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk/models && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS en ambas (6 pruebas de modelos; la integración confirma que el registro central carga sin errores).

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk/models src/models/index.js
git commit -m "feat(trk): modelos Sequelize Trk* registrados en la instancia central

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1.5: Núcleo del módulo: códigos de API, errores, validación y montaje

Cubre: §9.0 (códigos en encabezado, errores, logs), regla "endpoint sin código no se acepta", D9, D10 (limitador global).

**Files:**
- Create: `BACK:src/trk/config/apiCodigos.js`, `BACK:src/trk/config/constantes.js`, `BACK:src/trk/utils/TrkError.js`, `BACK:src/trk/utils/aw.js`, `BACK:src/trk/utils/ctx.js`, `BACK:src/trk/utils/respuesta.js`, `BACK:src/trk/middleware/apiCodigo.js`, `BACK:src/trk/middleware/errorHandler.js`, `BACK:src/trk/middleware/validar.js`, `BACK:src/trk/routes/index.js`
- Modify: `BACK:src/routes/index.js` (montaje), `BACK:src/app.js:74-79` (limitador)
- Test: `BACK:src/trk/middleware/__tests__/contrato.test.js`, `BACK:src/trk/config/__tests__/apiCodigos.test.js`, `BACK:src/trk/__tests__/montaje.test.js`

**Interfaces:**
- Produces:
  - `class TrkError extends AppError` — `new TrkError(statusCode, motivo, message, errors?)`; props `statusCode`, `motivo`, `errors`.
  - `apiCodigo(codigo) → middleware` con propiedad `.trkApiCodigo`; fija `req.trkApiCodigo`, `req.trkLog` (winston child `{ modulo: 'trk', api_codigo }`), encabezado `X-TRK-API`; parchea `res.json` para que toda respuesta `success: false` lleve `error: codigo` y `motivo`.
  - `trkErrorHandler(err, req, res, next)`.
  - `validar(schema, fuente = 'body') → middleware` (Joi; 400 `VALIDACION` con `errors: [{ campo, mensaje }]`).
  - `aw(fn)` async wrapper; `ok(res, data, status = 200)`; `ctxDe(req) → { usuario, usuarioId, apiCodigo, ip, log }`.
  - `routes/index.js` exporta `{ router, modulos }`; cada módulo de rutas es `{ prefijo, router }`.
  - `constantes.js`: `ESTADOS`, `ESTADOS_VISIBLES_PUBLICO`, `ROLES_OPERATIVOS`, `PERMISOS_TRK`, `MODULOS_API`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`BACK:src/trk/middleware/__tests__/contrato.test.js`:

```js
const express = require('express');
const request = require('supertest');
const Joi = require('joi');
const apiCodigo = require('../apiCodigo');
const { trkErrorHandler } = require('../errorHandler');
const validar = require('../validar');
const TrkError = require('../../utils/TrkError');
const aw = require('../../utils/aw');
const { ok } = require('../../utils/respuesta');

function app() {
  const a = express();
  a.use(express.json());
  a.get('/ok', apiCodigo('TRK-EVT-901'), (req, res) => ok(res, { hola: 1 }));
  a.get('/trk-error', apiCodigo('TRK-CAL-902'), aw(async () => { throw new TrkError(409, 'CALIFICACION_BLOQUEADA', 'Bloqueada'); }));
  a.get('/boom', apiCodigo('TRK-CAL-903'), aw(async () => { throw new Error('secreto interno'); }));
  a.get('/legacy-403', apiCodigo('TRK-USR-904'), (req, res) => res.status(403).json({ success: false, message: 'No tienes permiso' }));
  a.post('/validar', apiCodigo('TRK-PAR-905'), validar(Joi.object({ n: Joi.number().integer().min(1).required() })), (req, res) => ok(res, req.body));
  a.use(trkErrorHandler);
  return a;
}

test('respuesta exitosa lleva X-TRK-API y { success, data }', async () => {
  const r = await request(app()).get('/ok');
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-EVT-901');
  expect(r.body).toEqual({ success: true, data: { hola: 1 } });
});

test('TrkError → status, error = código, motivo y mensaje', async () => {
  const r = await request(app()).get('/trk-error');
  expect(r.status).toBe(409);
  expect(r.headers['x-trk-api']).toBe('TRK-CAL-902');
  expect(r.body).toEqual({ success: false, error: 'TRK-CAL-902', motivo: 'CALIFICACION_BLOQUEADA', message: 'Bloqueada' });
});

test('error no controlado → 500 sin filtrar detalles internos', async () => {
  const r = await request(app()).get('/boom');
  expect(r.status).toBe(500);
  expect(r.body).toEqual({ success: false, error: 'TRK-CAL-903', motivo: 'ERROR_INTERNO', message: 'Error interno del servidor' });
});

test('respuestas de error de middlewares de Mantix reciben código y motivo', async () => {
  const r = await request(app()).get('/legacy-403');
  expect(r.body).toEqual({ success: false, message: 'No tienes permiso', error: 'TRK-USR-904', motivo: 'SIN_PERMISO' });
});

test('validar → 400 VALIDACION con errores por campo y body convertido', async () => {
  const malo = await request(app()).post('/validar').send({ n: 0 });
  expect(malo.status).toBe(400);
  expect(malo.body.motivo).toBe('VALIDACION');
  expect(malo.body.errors).toEqual([{ campo: 'n', mensaje: expect.any(String) }]);
  const bueno = await request(app()).post('/validar').send({ n: '3', extra: 'x' });
  expect(bueno.body.data).toEqual({ n: 3 });
});
```

`BACK:src/trk/config/__tests__/apiCodigos.test.js`:

```js
const registro = require('../apiCodigos');
const { MODULOS_API } = require('../constantes');
const { modulos } = require('../../routes');

function rutasDeclaradas() {
  const salida = [];
  for (const { prefijo, router } of modulos) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const ruta = prefijo + (layer.route.path === '/' ? '' : layer.route.path);
      for (const metodo of Object.keys(layer.route.methods)) {
        salida.push({ metodo: metodo.toUpperCase(), ruta, codigo: layer.route.stack[0].handle.trkApiCodigo });
      }
    }
  }
  return salida;
}

test('formato TRK-<MÓDULO>-<NNN> con módulo conocido', () => {
  const patron = new RegExp(`^TRK-(${MODULOS_API.join('|')})-\\d{3}$`);
  for (const codigo of Object.keys(registro)) expect(codigo).toMatch(patron);
});

test('toda ruta TRK tiene apiCodigo como primer middleware', () => {
  for (const r of rutasDeclaradas()) expect({ ...r, codigo: r.codigo || null }).toEqual({ ...r, codigo: expect.any(String) });
});

test('cada ruta coincide con su entrada del registro (§9.1)', () => {
  for (const r of rutasDeclaradas()) {
    expect(registro[r.codigo]).toBeDefined();
    expect({ codigo: r.codigo, metodo: registro[r.codigo].metodo, ruta: registro[r.codigo].ruta })
      .toEqual({ codigo: r.codigo, metodo: r.metodo, ruta: r.ruta });
  }
});

test('no hay códigos registrados sin ruta ni códigos usados dos veces', () => {
  const usados = rutasDeclaradas().map((r) => r.codigo);
  expect(new Set(usados).size).toBe(usados.length);
  expect([...usados].sort()).toEqual(Object.keys(registro).sort());
});
```

`BACK:src/trk/__tests__/montaje.test.js`:

```js
// Carga la app real de Mantix: verifica montaje en /api/trk/v1 y exención del limitador global.
process.env.RATE_LIMIT_MAX_REQUESTS = '2';
const request = require('supertest');
const app = require('../../app');

test('rutas TRK desconocidas responden con el contrato TRK (montado en /api/trk/v1)', async () => {
  const r = await request(app).get('/api/trk/v1/no-existe');
  expect(r.status).toBe(404);
  expect(r.body).toMatchObject({ success: false, motivo: 'NO_ENCONTRADO' });
  expect(r.headers['x-trk-api']).toBe('TRK-SIN-CODIGO');
});

test('/api/trk/ está exento del limitador global; el resto de /api no', async () => {
  for (let i = 0; i < 4; i++) {
    const r = await request(app).get('/api/trk/v1/no-existe');
    expect(r.status).toBe(404);
  }
  const estados = [];
  for (let i = 0; i < 4; i++) estados.push((await request(app).get('/api/ruta-mantix-inexistente')).status);
  expect(estados).toContain(429);
});
```

> Si cargar `src/app.js` en Jest falla por efectos secundarios ajenos a TRK (variables de entorno de otros módulos), documentarlo en el reporte y mover `montaje.test.js` a `montaje.int.test.js` (que corre con `env.js`); no se modifica código de otros módulos.

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd BACK && npx jest src/trk/middleware src/trk/config src/trk/__tests__`
Expected: FAIL (`Cannot find module '../apiCodigo'`, etc.).

- [ ] **Step 3: Implementar**

`BACK:src/trk/config/constantes.js`:

```js
// Constantes de dominio TRIKIPELUDOS. NO incluye puntajes ni criterios: esos son datos (trk_criterios).
const ESTADOS = Object.freeze({
  INSCRITO: 'INSCRITO',
  PRESENTE: 'PRESENTE',
  EN_PASARELA: 'EN_PASARELA',
  PRESENTADO: 'PRESENTADO',
  AUSENTE: 'AUSENTE'
});

// Estados que ven comentarista, jurados y pantalla (spec §4)
const ESTADOS_VISIBLES_PUBLICO = [ESTADOS.PRESENTE, ESTADOS.EN_PASARELA, ESTADOS.PRESENTADO];

const ROLES_OPERATIVOS = ['TRK_CABINA', 'TRK_COMENTARISTA', 'TRK_JURADO'];
const ROL_JURADO = 'TRK_JURADO';

const PERMISOS_TRK = [
  'administrar', 'importar', 'editar', 'calificaciones_desbloquear',
  'publicar', 'exportar', 'pasarela', 'cabina', 'calificar'
];

const MODULOS_API = ['AUTH', 'USR', 'IMP', 'PAR', 'PAS', 'EVT', 'RUB', 'CAL', 'CAT', 'RNK', 'EXP'];

module.exports = { ESTADOS, ESTADOS_VISIBLES_PUBLICO, ROLES_OPERATIVOS, ROL_JURADO, PERMISOS_TRK, MODULOS_API };
```

`BACK:src/trk/config/apiCodigos.js`:

```js
// ============================================
// Registro de códigos de API TRIKIPELUDOS — espejo de spec §9.1.
// Formato: 'TRK-<MÓD>-<NNN>': { metodo, ruta (relativa a /api/trk/v1), descripcion }
// Un código nunca se reutiliza. La prueba config/__tests__/apiCodigos.test.js
// exige que toda ruta tenga código registrado y viceversa.
// ============================================
module.exports = {
};
```

`BACK:src/trk/utils/TrkError.js`:

```js
const AppError = require('../../utils/AppError');

// Error operativo TRK: status HTTP + motivo estable (contrato §9.0) + mensaje para el usuario.
class TrkError extends AppError {
  constructor(statusCode, motivo, message, errors) {
    super(message, statusCode);
    this.motivo = motivo;
    if (errors) this.errors = errors;
  }
}

module.exports = TrkError;
```

`BACK:src/trk/utils/aw.js`:

```js
// Envuelve handlers async para que los rechazos lleguen a trkErrorHandler.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

`BACK:src/trk/utils/respuesta.js`:

```js
// Respuestas exitosas TRK: { success: true, data } (patrón Mantix/SerVentas)
function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

module.exports = { ok };
```

`BACK:src/trk/utils/ctx.js`:

```js
// Contexto que los controladores pasan a los servicios (sin acoplarlos a Express).
function ctxDe(req) {
  return {
    usuario: req.usuario || null,
    usuarioId: req.usuario ? req.usuario.id : null,
    apiCodigo: req.trkApiCodigo,
    ip: req.ip,
    log: req.trkLog
  };
}

module.exports = { ctxDe };
```

`BACK:src/trk/middleware/apiCodigo.js`:

```js
const logger = require('../../utils/logger');

const MOTIVO_POR_STATUS = {
  400: 'VALIDACION',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  404: 'NO_ENCONTRADO',
  409: 'CONFLICTO',
  422: 'VALIDACION',
  429: 'DEMASIADOS_INTENTOS'
};

/**
 * Primer middleware de toda ruta TRK. Fija el código de API en el request, el
 * encabezado X-TRK-API y el logger hijo; además garantiza que cualquier respuesta
 * de error (incluidas las de middlewares de Mantix como requirePermiso) lleve
 * { error: <código>, motivo }.
 */
function apiCodigo(codigo) {
  const middleware = (req, res, next) => {
    const inicio = Date.now();
    req.trkApiCodigo = codigo;
    req.trkLog = logger.child({ modulo: 'trk', api_codigo: codigo });
    res.setHeader('X-TRK-API', codigo);

    const jsonOriginal = res.json.bind(res);
    res.json = (cuerpo) => {
      if (cuerpo && cuerpo.success === false) {
        cuerpo.error = codigo;
        if (!cuerpo.motivo) cuerpo.motivo = MOTIVO_POR_STATUS[res.statusCode] || 'ERROR';
      }
      return jsonOriginal(cuerpo);
    };

    res.on('finish', () => {
      req.trkLog.info('trk request', {
        metodo: req.method,
        ruta: req.originalUrl,
        status: res.statusCode,
        ms: Date.now() - inicio,
        usuario_id: req.usuario ? req.usuario.id : null
      });
    });
    next();
  };
  middleware.trkApiCodigo = codigo;
  return middleware;
}

module.exports = apiCodigo;
```

`BACK:src/trk/middleware/errorHandler.js`:

```js
const logger = require('../../utils/logger');
const TrkError = require('../utils/TrkError');

const SIN_CODIGO = 'TRK-SIN-CODIGO';

// Último middleware del router TRK. No toca los manejadores globales de Mantix.
// eslint-disable-next-line no-unused-vars
function trkErrorHandler(err, req, res, next) {
  const codigo = req.trkApiCodigo || SIN_CODIGO;
  const log = req.trkLog || logger.child({ modulo: 'trk', api_codigo: codigo });
  if (!res.getHeader('X-TRK-API')) res.setHeader('X-TRK-API', codigo);

  let status = 500;
  let motivo = 'ERROR_INTERNO';
  let message = 'Error interno del servidor';
  let errors;

  if (err instanceof TrkError) {
    ({ statusCode: status, motivo, message, errors } = err);
  } else if (err && err.name === 'MulterError') {
    status = 400;
    motivo = 'VALIDACION';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo es demasiado grande' : 'Archivo inválido';
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    motivo = 'VALIDACION';
    message = 'JSON inválido';
  }

  if (status >= 500) log.error('trk error no controlado', { message: err && err.message, stack: err && err.stack });
  else log.warn('trk error', { status, motivo, message });

  const cuerpo = { success: false, error: codigo, motivo, message };
  if (errors) cuerpo.errors = errors;
  res.status(status).json(cuerpo);
}

module.exports = { trkErrorHandler, SIN_CODIGO };
```

`BACK:src/trk/middleware/validar.js`:

```js
const TrkError = require('../utils/TrkError');

// Valida req[fuente] con un esquema Joi; reemplaza el valor por el convertido/limpio.
function validar(schema, fuente = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[fuente], { abortEarly: false, stripUnknown: true, convert: true });
    if (error) {
      const errors = error.details.map((d) => ({ campo: d.path.join('.'), mensaje: d.message }));
      return next(new TrkError(400, 'VALIDACION', 'Datos inválidos', errors));
    }
    req[fuente] = value;
    return next();
  };
}

module.exports = validar;
```

`BACK:src/trk/routes/index.js`:

```js
// ============================================
// src/trk/routes/index.js — Router del módulo TRIKIPELUDOS (/api/trk/v1)
// Cada módulo exporta { prefijo, router }. Toda ruta lleva apiCodigo() primero.
// ============================================
const express = require('express');
const TrkError = require('../utils/TrkError');
const { trkErrorHandler } = require('../middleware/errorHandler');

const modulos = [
];

const router = express.Router();
for (const { prefijo, router: sub } of modulos) router.use(prefijo, sub);
router.use((req, res, next) => next(new TrkError(404, 'NO_ENCONTRADO', 'Ruta no encontrada')));
router.use(trkErrorHandler);

module.exports = { router, modulos };
```

En `BACK:src/routes/index.js`: junto a los demás `require` de módulos, agregar
`const trkRoutes    = require('../trk/routes').router;   // ← Módulo TRIKIPELUDOS`
y junto a los demás `router.use(...)`, después de la línea de `/identidad`, agregar
`router.use('/trk/v1', trkRoutes);   // ← Módulo TRIKIPELUDOS (concurso de disfraces)`.

En `BACK:src/app.js`, reemplazar la definición del limitador global por:

```js
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000,
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
  // TRIKIPELUDOS: todo el evento comparte IP pública; el módulo aplica sus propios límites.
  skip: (req) => req.originalUrl.startsWith('/api/trk/')
});
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk`
Expected: PASS (contrato 5, apiCodigos 4 —con registro y rutas vacíos—, montaje 2, modelos 5).

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk src/routes/index.js src/app.js
git commit -m "feat(trk): nucleo del modulo (codigos de API, contrato de error, montaje en /api/trk/v1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1.6: Autenticación (token de Mantix + PIN) y permisos

Cubre: §2.1, HU-2 CA3, §9.1 `TRK-AUTH-001..003`, §13.12, D10.

**Files:**
- Create: `BACK:src/trk/utils/permisos.js`, `BACK:src/trk/services/authPin.service.js`, `BACK:src/trk/middleware/trkAuth.js`, `BACK:src/trk/middleware/limitadores.js`, `BACK:src/trk/controllers/auth.controller.js`, `BACK:src/trk/routes/auth.routes.js`, `BACK:src/trk/testing/fabricas.js`
- Modify: `BACK:src/middleware/auth.js` (exportar `resolverUsuarioDesdeToken`), `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/utils/__tests__/permisos.test.js`, `BACK:src/trk/routes/__tests__/auth.int.test.js`

**Interfaces:**
- Consumes: `db.Usuario`, `db.Rol`, `db.TrkAcceso` (1.4); `TrkError`, `apiCodigo`, `validar`, `aw`, `ok` (1.5).
- Produces:
  - `permisosTrk(usuario) → { [permiso]: true }`, `tienePermiso(usuario, accion) → boolean`, `nivelDatos(usuario | null) → 'COMPLETO' | 'PUBLICO'`.
  - `generarPin() → '######'`, `hashPin(pin) → Promise<string>`, `emitirTokenPin(usuarioId, tokenVersion) → string`, `loginConPin(usuarioId, pin) → { token, usuario: Perfil }`, `perfilDe(usuario) → Perfil = { id, nombre, rol, permisos }`, `listarUsuariosPin() → [{ id, nombre, rol }]`, `nombreVisible(usuario) → string`.
  - `resolverSesion(token) → Promise<{ usuario, tipo: 'PIN' | 'MANTIX' } | null>`, `trkAuth`, `trkAuthOpcional`, `trkPermiso(accion)` (= `requirePermiso('trk', accion)` de Mantix).
  - `limitadorPin` (5/min por IP + usuario_id; `TRK_PIN_MAX_INTENTOS` lo ajusta).
  - Fábricas: `crearAdmin({ superAdmin }) → { usuario, token }`, `crearOperativo(rolNombre, { nombre, pin, activo }) → { usuario, pin, token }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`BACK:src/trk/utils/__tests__/permisos.test.js`:

```js
const { permisosTrk, tienePermiso, nivelDatos } = require('../permisos');

const usuario = (permisos, extra = {}) => ({ es_super_admin: false, rol: { nombre: 'X', permisos }, ...extra });

test('lee permisos trk de objeto o de JSON en texto', () => {
  expect(permisosTrk(usuario({ trk: { calificar: true } }))).toEqual({ calificar: true });
  expect(permisosTrk(usuario('{"trk":{"cabina":true},"caja":{"x":true}}'))).toEqual({ cabina: true });
});

test('ignora permisos desconocidos o en falso', () => {
  expect(permisosTrk(usuario({ trk: { calificar: false, volar: true } }))).toEqual({});
});

test('super admin tiene todos los permisos TRK', () => {
  const p = permisosTrk(usuario(null, { es_super_admin: true }));
  expect(Object.keys(p).sort()).toEqual(['administrar', 'cabina', 'calificaciones_desbloquear', 'calificar', 'editar', 'exportar', 'importar', 'pasarela', 'publicar']);
});

test('tienePermiso y nivelDatos', () => {
  expect(tienePermiso(usuario({ trk: { pasarela: true } }), 'pasarela')).toBe(true);
  expect(tienePermiso(null, 'pasarela')).toBe(false);
  expect(nivelDatos(usuario({ trk: { cabina: true } }))).toBe('COMPLETO');
  expect(nivelDatos(usuario({ trk: { administrar: true } }))).toBe('COMPLETO');
  expect(nivelDatos(usuario({ trk: { calificar: true } }))).toBe('PUBLICO');
  expect(nivelDatos(usuario({ trk: { pasarela: true } }))).toBe('PUBLICO');
  expect(nivelDatos(null)).toBe('PUBLICO');
});
```

`BACK:src/trk/routes/__tests__/auth.int.test.js`:

```js
const express = require('express');
const request = require('supertest');
const db = require('../../../models');
const { auth: authMantix } = require('../../../middleware/auth');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo } = require('../../testing/fabricas');

const app = crearAppTrk();
beforeEach(limpiar);
afterAll(cerrar);

describe('TRK-AUTH-001 POST /auth/pin', () => {
  test('PIN correcto → token y perfil con permisos del rol', async () => {
    const { usuario } = await crearOperativo('TRK_JURADO', { nombre: 'Jurado Uno', pin: '246810' });
    const r = await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: usuario.id, pin: '246810' });
    expect(r.status).toBe(200);
    expect(r.headers['x-trk-api']).toBe('TRK-AUTH-001');
    expect(r.body.data.token).toEqual(expect.any(String));
    expect(r.body.data.usuario).toEqual({ id: usuario.id, nombre: 'Jurado Uno', rol: 'TRK_JURADO', permisos: { calificar: true } });
  });

  test('PIN incorrecto → 401 con contrato TRK', async () => {
    const { usuario } = await crearOperativo('TRK_JURADO', { pin: '111111' });
    const r = await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: usuario.id, pin: '222222' });
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ success: false, error: 'TRK-AUTH-001', motivo: 'NO_AUTENTICADO' });
  });

  test('usuario inactivo no entra', async () => {
    const { usuario } = await crearOperativo('TRK_CABINA', { pin: '333333', activo: false });
    const r = await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: usuario.id, pin: '333333' });
    expect(r.status).toBe(401);
  });

  test('un admin de Mantix no puede entrar por PIN', async () => {
    const { usuario } = await crearAdmin();
    const r = await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: usuario.id, pin: '123456' });
    expect(r.status).toBe(401);
  });

  test('PIN con formato inválido → 400 VALIDACION', async () => {
    const r = await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: 1, pin: '12ab' });
    expect(r.status).toBe(400);
    expect(r.body.motivo).toBe('VALIDACION');
  });

  test('más de 5 intentos por minuto para el mismo usuario → 429', async () => {
    const { usuario } = await crearOperativo('TRK_JURADO', { pin: '555555' });
    const estados = [];
    for (let i = 0; i < 6; i++) {
      estados.push((await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: usuario.id, pin: '000000' })).status);
    }
    expect(estados.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(estados[5]).toBe(429);
  });
});

describe('TRK-AUTH-002 GET /auth/usuarios-pin', () => {
  test('lista solo operativos activos, sin correo', async () => {
    await crearAdmin();
    const { usuario: jurado } = await crearOperativo('TRK_JURADO', { nombre: 'Jurado Dos' });
    await crearOperativo('TRK_CABINA', { nombre: 'Cabina', activo: false });
    const r = await request(app).get('/api/trk/v1/auth/usuarios-pin');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([{ id: jurado.id, nombre: 'Jurado Dos', rol: 'TRK_JURADO' }]);
  });
});

describe('TRK-AUTH-003 GET /auth/yo', () => {
  test('con token de PIN', async () => {
    const { usuario, token } = await crearOperativo('TRK_COMENTARISTA', { nombre: 'Locutor' });
    const r = await request(app).get('/api/trk/v1/auth/yo').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ id: usuario.id, nombre: 'Locutor', rol: 'TRK_COMENTARISTA', permisos: { pasarela: true } });
  });

  test('con token de Mantix de un administrador', async () => {
    const { token } = await crearAdmin();
    const r = await request(app).get('/api/trk/v1/auth/yo').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.permisos).toMatchObject({ administrar: true, publicar: true });
    expect(r.body.data.permisos.calificar).toBeUndefined();
  });

  test('sin token → 401 con código', async () => {
    const r = await request(app).get('/api/trk/v1/auth/yo');
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ error: 'TRK-AUTH-003', motivo: 'NO_AUTENTICADO' });
  });

  test('cambiar token_version invalida el token de PIN (HU-2 CA3)', async () => {
    const { usuario, token } = await crearOperativo('TRK_JURADO');
    await db.TrkAcceso.increment('token_version', { where: { usuario_id: usuario.id } });
    const r = await request(app).get('/api/trk/v1/auth/yo').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
  });
});

test('§13.12: un token de PIN no sirve en rutas de Mantix', async () => {
  const { token } = await crearOperativo('TRK_JURADO');
  const appMantix = express();
  appMantix.get('/mantix', authMantix, (req, res) => res.json({ ok: true }));
  const r = await request(appMantix).get('/mantix').set('Authorization', `Bearer ${token}`);
  expect(r.status).toBe(401);
});
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd BACK && npx jest src/trk/utils && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/auth.int.test.js`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

En `BACK:src/middleware/auth.js`, agregar `resolverUsuarioDesdeToken,` como primera entrada del objeto `module.exports` (no se cambia su lógica).

`BACK:src/trk/utils/permisos.js`:

```js
const { PERMISOS_TRK } = require('../config/constantes');

function leerPermisosRol(rol) {
  const p = rol && rol.permisos;
  if (!p) return {};
  return typeof p === 'string' ? JSON.parse(p) : p;
}

// Permisos TRK efectivos: super admin = todos; si no, roles.permisos.trk filtrado a PERMISOS_TRK.
function permisosTrk(usuario) {
  if (!usuario) return {};
  if (usuario.es_super_admin) return Object.fromEntries(PERMISOS_TRK.map((p) => [p, true]));
  const trk = leerPermisosRol(usuario.rol).trk || {};
  return Object.fromEntries(PERMISOS_TRK.filter((p) => trk[p] === true).map((p) => [p, true]));
}

const tienePermiso = (usuario, accion) => permisosTrk(usuario)[accion] === true;

// COMPLETO: ve documento/teléfono/correo (admin y cabina, spec RNF-5). PUBLICO: el resto.
function nivelDatos(usuario) {
  const p = permisosTrk(usuario);
  return p.cabina || p.administrar || p.editar ? 'COMPLETO' : 'PUBLICO';
}

module.exports = { permisosTrk, tienePermiso, nivelDatos };
```

`BACK:src/trk/services/authPin.service.js`:

```js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../models');
const TrkError = require('../utils/TrkError');
const { permisosTrk } = require('../utils/permisos');
const { ROLES_OPERATIVOS } = require('../config/constantes');

const generarPin = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const hashPin = (pin) => bcrypt.hash(pin, 10);

function secreto() {
  if (!process.env.TRK_JWT_SECRET) throw new Error('Falta TRK_JWT_SECRET');
  return process.env.TRK_JWT_SECRET;
}

function emitirTokenPin(usuarioId, tokenVersion) {
  return jwt.sign({ id: usuarioId, scope: 'trk', tv: tokenVersion }, secreto(), { expiresIn: '12h' });
}

const nombreVisible = (u) => `${u.nombre || ''} ${u.apellido || ''}`.trim();

function perfilDe(usuario) {
  return {
    id: usuario.id,
    nombre: nombreVisible(usuario),
    rol: usuario.rol ? usuario.rol.nombre : null,
    permisos: permisosTrk(usuario)
  };
}

async function loginConPin(usuarioId, pin) {
  const usuario = await db.Usuario.findByPk(usuarioId, { include: [{ model: db.Rol, as: 'rol' }] });
  const acceso = usuario ? await db.TrkAcceso.findByPk(usuario.id) : null;
  const esOperativo = usuario && usuario.rol && ROLES_OPERATIVOS.includes(usuario.rol.nombre);
  const valido = Boolean(usuario && usuario.activo && esOperativo && acceso && (await bcrypt.compare(pin, acceso.pin_hash)));
  if (!valido) throw new TrkError(401, 'NO_AUTENTICADO', 'Usuario o PIN incorrecto');
  return { token: emitirTokenPin(usuario.id, acceso.token_version), usuario: perfilDe(usuario) };
}

async function listarUsuariosPin() {
  const usuarios = await db.Usuario.findAll({
    where: { activo: true },
    include: [{ model: db.Rol, as: 'rol', where: { nombre: ROLES_OPERATIVOS } }],
    order: [['nombre', 'ASC']]
  });
  return usuarios.map((u) => ({ id: u.id, nombre: nombreVisible(u), rol: u.rol.nombre }));
}

module.exports = { generarPin, hashPin, emitirTokenPin, loginConPin, perfilDe, listarUsuariosPin, nombreVisible };
```

`BACK:src/trk/middleware/trkAuth.js`:

```js
const jwt = require('jsonwebtoken');
const db = require('../../models');
const { resolverUsuarioDesdeToken, requirePermiso } = require('../../middleware/auth');
const TrkError = require('../utils/TrkError');
const aw = require('../utils/aw');

const conRol = { include: [{ model: db.Rol, as: 'rol' }] };

/**
 * Acepta dos tokens:
 *  - PIN (TRK_JWT_SECRET, scope 'trk', tv = trk_accesos.token_version)
 *  - Mantix (JWT_SECRET o SSO), vía resolverUsuarioDesdeToken del repo.
 */
async function resolverSesion(token) {
  if (!token) return null;
  try {
    const d = jwt.verify(token, process.env.TRK_JWT_SECRET);
    if (d && d.scope === 'trk') {
      const [usuario, acceso] = await Promise.all([db.Usuario.findByPk(d.id, conRol), db.TrkAcceso.findByPk(d.id)]);
      if (!usuario || !usuario.activo || !acceso || acceso.token_version !== d.tv) return null;
      return { usuario, tipo: 'PIN' };
    }
  } catch (_) { /* no es un token de PIN válido: probar token de Mantix */ }

  const usuario = await resolverUsuarioDesdeToken(token);
  if (!usuario || !usuario.activo) return null;
  return { usuario, tipo: 'MANTIX' };
}

const leerToken = (req) => {
  const h = req.header('Authorization');
  return h ? h.replace('Bearer ', '') : null;
};

const trkAuth = aw(async (req, res, next) => {
  const sesion = await resolverSesion(leerToken(req));
  if (!sesion) throw new TrkError(401, 'NO_AUTENTICADO', 'Sesión inválida o vencida');
  req.usuario = sesion.usuario;
  req.trkSesion = sesion;
  next();
});

const trkAuthOpcional = aw(async (req, res, next) => {
  const sesion = await resolverSesion(leerToken(req));
  if (sesion) {
    req.usuario = sesion.usuario;
    req.trkSesion = sesion;
  }
  next();
});

// Reutiliza el RBAC de Mantix: roles.permisos.trk.<accion> (super admin pasa siempre).
const trkPermiso = (accion) => requirePermiso('trk', accion);

module.exports = { resolverSesion, trkAuth, trkAuthOpcional, trkPermiso, leerToken };
```

`BACK:src/trk/middleware/limitadores.js`:

```js
const rateLimit = require('express-rate-limit');
const TrkError = require('../utils/TrkError');

// Login con PIN: clave IP + usuario (todo el evento comparte IP pública).
const limitadorPin = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.TRK_PIN_MAX_INTENTOS || 5),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${(req.body && req.body.usuario_id) || '-'}`,
  handler: (req, res, next) => next(new TrkError(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera un minuto e intenta de nuevo.'))
});

module.exports = { limitadorPin };
```

`BACK:src/trk/controllers/auth.controller.js`:

```js
const authPin = require('../services/authPin.service');
const { ok } = require('../utils/respuesta');

exports.loginPin = async (req, res) => ok(res, await authPin.loginConPin(req.body.usuario_id, req.body.pin));
exports.usuariosPin = async (req, res) => ok(res, await authPin.listarUsuariosPin());
exports.yo = async (req, res) => ok(res, authPin.perfilDe(req.usuario));
```

`BACK:src/trk/routes/auth.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth } = require('../middleware/trkAuth');
const { limitadorPin } = require('../middleware/limitadores');
const aw = require('../utils/aw');
const ctrl = require('../controllers/auth.controller');

const esquemaPin = Joi.object({
  usuario_id: Joi.number().integer().positive().required(),
  pin: Joi.string().pattern(/^\d{6}$/).required()
});

const router = express.Router();
router.post('/pin', apiCodigo('TRK-AUTH-001'), limitadorPin, validar(esquemaPin), aw(ctrl.loginPin));
router.get('/usuarios-pin', apiCodigo('TRK-AUTH-002'), aw(ctrl.usuariosPin));
router.get('/yo', apiCodigo('TRK-AUTH-003'), trkAuth, aw(ctrl.yo));

module.exports = { prefijo: '/auth', router };
```

En `BACK:src/trk/routes/index.js`, dentro del arreglo `modulos`, agregar: `require('./auth.routes'),`.

En `BACK:src/trk/config/apiCodigos.js`, dentro del objeto:

```js
  'TRK-AUTH-001': { metodo: 'POST', ruta: '/auth/pin', descripcion: 'Login con PIN de usuario operativo' },
  'TRK-AUTH-002': { metodo: 'GET', ruta: '/auth/usuarios-pin', descripcion: 'Usuarios operativos activos para el selector de login' },
  'TRK-AUTH-003': { metodo: 'GET', ruta: '/auth/yo', descripcion: 'Perfil y permisos TRK de la sesión' },
```

`BACK:src/trk/testing/fabricas.js`:

```js
// Fábricas de datos para pruebas de integración TRK. Datos ficticios.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../../models');
const { hashPin, emitirTokenPin } = require('../services/authPin.service');

let secuencia = 0;
const sufijo = () => `${Date.now()}${++secuencia}`;

const rolPorNombre = (nombre) => db.Rol.findOne({ where: { nombre } });

async function crearAdmin({ superAdmin = false } = {}) {
  const rol = await rolPorNombre('Administrador');
  const usuario = await db.Usuario.create({
    rol_id: rol.id, nombre: 'Admin', apellido: 'Prueba', email: `admin${sufijo()}@prueba.test`,
    password: 'secreta123', es_super_admin: superAdmin, activo: true
  });
  const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { usuario, token };
}

async function crearOperativo(rolNombre, { nombre = 'Operativo', pin = '123456', activo = true } = {}) {
  const rol = await rolPorNombre(rolNombre);
  const usuario = await db.Usuario.create({
    rol_id: rol.id, nombre, apellido: '', email: `op${sufijo()}@trikipeludos.local`,
    password: crypto.randomBytes(24).toString('hex'), activo
  });
  const acceso = await db.TrkAcceso.create({ usuario_id: usuario.id, pin_hash: await hashPin(pin), token_version: 0 });
  return { usuario, pin, token: emitirTokenPin(usuario.id, acceso.token_version) };
}

module.exports = { sufijo, crearAdmin, crearOperativo };
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS (incluida `apiCodigos.test.js`, que ahora valida las 3 rutas AUTH).

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk src/middleware/auth.js
git commit -m "feat(trk): autenticacion por PIN y token de Mantix con permisos roles.permisos.trk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1.7: Gestión de jurados y accesos (HU-2) + auditoría

Cubre: HU-2 CA1–CA4, RNF-6, §9.1 `TRK-USR-001..004`.

**Files:**
- Create: `BACK:src/trk/utils/normalizar.js` (solo `normalizarTexto` y `slug` en esta tarea), `BACK:src/trk/services/auditoria.service.js`, `BACK:src/trk/services/usuarios.service.js`, `BACK:src/trk/controllers/usuarios.controller.js`, `BACK:src/trk/routes/usuarios.routes.js`
- Modify: `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/utils/__tests__/normalizar.test.js`, `BACK:src/trk/routes/__tests__/usuarios.int.test.js`

**Interfaces:**
- Consumes: `generarPin`, `hashPin`, `nombreVisible` (1.6); `trkAuth`, `trkPermiso` (1.6); `ctxDe` (1.5).
- Produces:
  - `normalizarTexto(s) → string` (sin tildes, minúsculas, espacios simples, trim); `slug(s) → string`.
  - `registrarAuditoria(ctx, { entidad, entidadId, accion, antes = null, despues = null }, { transaction } = {}) → Promise<TrkAuditoria>`.
  - `listarOperativos() → [{ id, nombre, rol, activo }]`; `crearOperativo({ nombre, rol }, ctx) → { usuario: { id, nombre, rol, activo }, pin }`; `actualizarOperativo(id, { nombre?, activo? }, ctx) → { id, nombre, rol, activo }`; `regenerarPin(id, ctx) → { pin }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`BACK:src/trk/utils/__tests__/normalizar.test.js`:

```js
const { normalizarTexto, slug } = require('../normalizar');

test('normalizarTexto quita tildes, mayúsculas y espacios dobles', () => {
  expect(normalizarTexto('  Cateogoría   de PARTICIPACIÓN ')).toBe('cateogoria de participacion');
  expect(normalizarTexto('Ñoño')).toBe('nono');
  expect(normalizarTexto(null)).toBe('');
});

test('slug', () => {
  expect(slug('Jurado Número 1')).toBe('jurado-numero-1');
  expect(slug('***')).toBe('usuario');
});
```

`BACK:src/trk/routes/__tests__/usuarios.int.test.js`:

```js
const request = require('supertest');
const db = require('../../../models');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo } = require('../../testing/fabricas');

const app = crearAppTrk();
const base = '/api/trk/v1/usuarios';
let admin;

beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
});
afterAll(cerrar);

const comoAdmin = (req) => req.set('Authorization', `Bearer ${admin.token}`);

test('TRK-USR-002 crea jurado con PIN de 6 dígitos que sirve para entrar, y audita', async () => {
  const r = await comoAdmin(request(app).post(base)).send({ nombre: 'Jurado Uno', rol: 'TRK_JURADO' });
  expect(r.status).toBe(201);
  expect(r.headers['x-trk-api']).toBe('TRK-USR-002');
  expect(r.body.data.pin).toMatch(/^\d{6}$/);
  expect(r.body.data.usuario).toMatchObject({ nombre: 'Jurado Uno', rol: 'TRK_JURADO', activo: true });

  const login = await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: r.body.data.usuario.id, pin: r.body.data.pin });
  expect(login.status).toBe(200);

  const auditoria = await db.TrkAuditoria.findOne({ where: { entidad: 'usuario', entidad_id: String(r.body.data.usuario.id) } });
  expect(auditoria).toMatchObject({ api_codigo: 'TRK-USR-002', accion: 'CREAR', usuario_id: admin.usuario.id });
  expect(JSON.stringify(auditoria.despues)).not.toMatch(r.body.data.pin);
});

test('rol inválido → 400', async () => {
  const r = await comoAdmin(request(app).post(base)).send({ nombre: 'X', rol: 'Administrador' });
  expect(r.status).toBe(400);
});

test('TRK-USR-001 lista solo usuarios operativos', async () => {
  await crearOperativo('TRK_CABINA', { nombre: 'Cabina' });
  await crearOperativo('TRK_JURADO', { nombre: 'Ana' });
  const r = await comoAdmin(request(app).get(base));
  expect(r.status).toBe(200);
  expect(r.body.data.map((u) => [u.nombre, u.rol])).toEqual([['Cabina', 'TRK_CABINA'], ['Ana', 'TRK_JURADO']]);
});

test('sin permiso administrar → 403 con código y motivo', async () => {
  const jurado = await crearOperativo('TRK_JURADO');
  const r = await request(app).get(base).set('Authorization', `Bearer ${jurado.token}`);
  expect(r.status).toBe(403);
  expect(r.body).toMatchObject({ success: false, error: 'TRK-USR-001', motivo: 'SIN_PERMISO' });
});

test('TRK-USR-004 regenerar PIN invalida sesiones y el PIN viejo', async () => {
  const jurado = await crearOperativo('TRK_JURADO', { pin: '101010' });
  const r = await comoAdmin(request(app).post(`${base}/${jurado.usuario.id}/pin`));
  expect(r.status).toBe(200);
  expect(r.body.data.pin).toMatch(/^\d{6}$/);

  const yoViejo = await request(app).get('/api/trk/v1/auth/yo').set('Authorization', `Bearer ${jurado.token}`);
  expect(yoViejo.status).toBe(401);
  const pinViejo = await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: jurado.usuario.id, pin: '101010' });
  expect(pinViejo.status).toBe(401);
  const pinNuevo = await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: jurado.usuario.id, pin: r.body.data.pin });
  expect(pinNuevo.status).toBe(200);
  expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-USR-004', accion: 'REGENERAR_PIN' } })).toBe(1);
});

test('TRK-USR-003 desactivar impide entrar e invalida la sesión', async () => {
  const cabina = await crearOperativo('TRK_CABINA', { pin: '202020' });
  const r = await comoAdmin(request(app).patch(`${base}/${cabina.usuario.id}`)).send({ activo: false });
  expect(r.status).toBe(200);
  expect(r.body.data.activo).toBe(false);
  expect((await request(app).get('/api/trk/v1/auth/yo').set('Authorization', `Bearer ${cabina.token}`)).status).toBe(401);
  expect((await request(app).post('/api/trk/v1/auth/pin').send({ usuario_id: cabina.usuario.id, pin: '202020' })).status).toBe(401);
});

test('no se puede gestionar un usuario que no es operativo TRK', async () => {
  const r = await comoAdmin(request(app).patch(`${base}/${admin.usuario.id}`)).send({ nombre: 'Hack' });
  expect(r.status).toBe(404);
});
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd BACK && npx jest src/trk/utils && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/usuarios.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BACK:src/trk/utils/normalizar.js`:

```js
// Normalización de texto para búsquedas y claves naturales (sin tildes, minúsculas, espacios simples).
function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(valor) {
  return normalizarTexto(valor).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'usuario';
}

module.exports = { normalizarTexto, slug };
```

`BACK:src/trk/services/auditoria.service.js`:

```js
const db = require('../../models');

// RNF-6: quién, qué, antes, después, cuándo + código de API del request.
function registrarAuditoria(ctx, { entidad, entidadId, accion, antes = null, despues = null }, { transaction } = {}) {
  return db.TrkAuditoria.create({
    usuario_id: ctx.usuarioId,
    api_codigo: ctx.apiCodigo,
    entidad,
    entidad_id: entidadId == null ? null : String(entidadId),
    accion,
    antes,
    despues,
    ip: ctx.ip || null
  }, { transaction });
}

module.exports = { registrarAuditoria };
```

`BACK:src/trk/services/usuarios.service.js`:

```js
const crypto = require('crypto');
const db = require('../../models');
const TrkError = require('../utils/TrkError');
const { slug } = require('../utils/normalizar');
const { ROLES_OPERATIVOS } = require('../config/constantes');
const { generarPin, hashPin, nombreVisible } = require('./authPin.service');
const { registrarAuditoria } = require('./auditoria.service');

const vista = (u) => ({ id: u.id, nombre: nombreVisible(u), rol: u.rol.nombre, activo: Boolean(u.activo) });

const emailSintetico = (nombre) => `${slug(nombre)}-${crypto.randomBytes(3).toString('hex')}@trikipeludos.local`;

async function obtenerOperativo(id, transaction) {
  const usuario = await db.Usuario.findByPk(id, { include: [{ model: db.Rol, as: 'rol' }], transaction });
  if (!usuario || !usuario.rol || !ROLES_OPERATIVOS.includes(usuario.rol.nombre)) {
    throw new TrkError(404, 'NO_ENCONTRADO', 'Usuario operativo no encontrado');
  }
  return usuario;
}

async function listarOperativos() {
  const usuarios = await db.Usuario.findAll({
    include: [{ model: db.Rol, as: 'rol', where: { nombre: ROLES_OPERATIVOS } }],
    order: [[{ model: db.Rol, as: 'rol' }, 'nombre', 'ASC'], ['nombre', 'ASC']]
  });
  return usuarios.map(vista);
}

async function crearOperativo({ nombre, rol }, ctx) {
  const rolDb = await db.Rol.findOne({ where: { nombre: rol } });
  if (!rolDb || !ROLES_OPERATIVOS.includes(rol)) throw new TrkError(400, 'VALIDACION', 'Rol inválido');
  const pin = generarPin();
  const pinHash = await hashPin(pin);
  const usuario = await db.sequelize.transaction(async (transaction) => {
    const u = await db.Usuario.create({
      rol_id: rolDb.id, nombre, apellido: '', email: emailSintetico(nombre),
      password: crypto.randomBytes(32).toString('hex'), activo: true
    }, { transaction });
    await db.TrkAcceso.create({ usuario_id: u.id, pin_hash: pinHash, token_version: 0 }, { transaction });
    await registrarAuditoria(ctx, { entidad: 'usuario', entidadId: u.id, accion: 'CREAR', despues: { nombre, rol } }, { transaction });
    return u;
  });
  return { usuario: { id: usuario.id, nombre, rol, activo: true }, pin };
}

async function actualizarOperativo(id, cambios, ctx) {
  return db.sequelize.transaction(async (transaction) => {
    const usuario = await obtenerOperativo(id, transaction);
    const antes = vista(usuario);
    if (cambios.nombre !== undefined) usuario.nombre = cambios.nombre;
    if (cambios.activo !== undefined) usuario.activo = cambios.activo;
    await usuario.save({ transaction });
    if (cambios.activo === false) {
      await db.TrkAcceso.increment('token_version', { where: { usuario_id: usuario.id }, transaction });
    }
    const despues = vista(usuario);
    await registrarAuditoria(ctx, { entidad: 'usuario', entidadId: usuario.id, accion: 'EDITAR', antes, despues }, { transaction });
    return despues;
  });
}

async function regenerarPin(id, ctx) {
  const pin = generarPin();
  const pinHash = await hashPin(pin);
  await db.sequelize.transaction(async (transaction) => {
    const usuario = await obtenerOperativo(id, transaction);
    const acceso = await db.TrkAcceso.findByPk(usuario.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (acceso) {
      await acceso.update({ pin_hash: pinHash, token_version: acceso.token_version + 1 }, { transaction });
    } else {
      await db.TrkAcceso.create({ usuario_id: usuario.id, pin_hash: pinHash, token_version: 0 }, { transaction });
    }
    await registrarAuditoria(ctx, { entidad: 'usuario', entidadId: usuario.id, accion: 'REGENERAR_PIN' }, { transaction });
  });
  return { pin };
}

module.exports = { listarOperativos, crearOperativo, actualizarOperativo, regenerarPin };
```

`BACK:src/trk/controllers/usuarios.controller.js`:

```js
const svc = require('../services/usuarios.service');
const { ok } = require('../utils/respuesta');
const { ctxDe } = require('../utils/ctx');

exports.listar = async (req, res) => ok(res, await svc.listarOperativos());
exports.crear = async (req, res) => ok(res, await svc.crearOperativo(req.body, ctxDe(req)), 201);
exports.actualizar = async (req, res) => ok(res, await svc.actualizarOperativo(req.params.id, req.body, ctxDe(req)));
exports.regenerarPin = async (req, res) => ok(res, await svc.regenerarPin(req.params.id, ctxDe(req)));
```

`BACK:src/trk/routes/usuarios.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth, trkPermiso } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const { ROLES_OPERATIVOS } = require('../config/constantes');
const ctrl = require('../controllers/usuarios.controller');

const esquemaCrear = Joi.object({
  nombre: Joi.string().trim().min(2).max(60).required(),
  rol: Joi.string().valid(...ROLES_OPERATIVOS).required()
});
const esquemaActualizar = Joi.object({
  nombre: Joi.string().trim().min(2).max(60),
  activo: Joi.boolean()
}).min(1);
const esquemaId = Joi.object({ id: Joi.number().integer().positive().required() });

const admin = [trkAuth, trkPermiso('administrar')];
const router = express.Router();
router.get('/', apiCodigo('TRK-USR-001'), ...admin, aw(ctrl.listar));
router.post('/', apiCodigo('TRK-USR-002'), ...admin, validar(esquemaCrear), aw(ctrl.crear));
router.patch('/:id', apiCodigo('TRK-USR-003'), ...admin, validar(esquemaId, 'params'), validar(esquemaActualizar), aw(ctrl.actualizar));
router.post('/:id/pin', apiCodigo('TRK-USR-004'), ...admin, validar(esquemaId, 'params'), aw(ctrl.regenerarPin));

module.exports = { prefijo: '/usuarios', router };
```

En `BACK:src/trk/routes/index.js` agregar `require('./usuarios.routes'),` al arreglo `modulos`.

En `BACK:src/trk/config/apiCodigos.js` agregar:

```js
  'TRK-USR-001': { metodo: 'GET', ruta: '/usuarios', descripcion: 'Lista usuarios operativos (cabina, comentarista, jurados)' },
  'TRK-USR-002': { metodo: 'POST', ruta: '/usuarios', descripcion: 'Crea usuario operativo y devuelve su PIN una vez' },
  'TRK-USR-003': { metodo: 'PATCH', ruta: '/usuarios/:id', descripcion: 'Edita nombre/activo de un usuario operativo' },
  'TRK-USR-004': { metodo: 'POST', ruta: '/usuarios/:id/pin', descripcion: 'Regenera PIN e invalida sesiones' },
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): gestion de usuarios operativos y PIN (HU-2) con auditoria

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1.8: Esqueleto del frontend, sesión y login

Cubre: §10 `/login`, §2.1 (dos formas de entrar), RNF-1, RNF-8, D5.

**Files:**
- Create: `FRONT:package.json`, `FRONT:vite.config.js`, `FRONT:tailwind.config.js`, `FRONT:postcss.config.js`, `FRONT:index.html`, `FRONT:src/main.js`, `FRONT:src/App.vue`, `FRONT:src/style.css`, `FRONT:src/testing/setup.js`, `FRONT:src/services/api.js`, `FRONT:src/utils/errores.js`, `FRONT:src/stores/auth.js`, `FRONT:src/router/index.js`, `FRONT:src/views/LoginView.vue`, `FRONT:public/favicon.svg`
- Test: `FRONT:src/stores/__tests__/auth.spec.js`, `FRONT:src/router/__tests__/guardia.spec.js`, `FRONT:src/views/__tests__/LoginView.spec.js`

**Interfaces:**
- Produces:
  - `api`, `trk` (axios; responden `{ success, data }`; errores rechazados como `ErrorApi = { status, codigo, motivo, message, errors }`), `tokenStorage.leer() / guardar(t)`, `normalizarError(axiosError) → ErrorApi`.
  - `useAuthStore()` — state `{ token, usuario }`; getters `autenticado`, `tiene(accion)`, `rutaInicio`; actions `loginPin(usuarioId, pin)`, `loginAdmin(email, password)`, `cargarPerfil()`, `fijarSesion(token, usuario)`, `logout()`.
  - `decidirNavegacion(to, auth) → true | { path, query? }`; `router` (rutas con `meta.publica` / `meta.permiso`).
  - `mensajeDeError(err) → string`.

- [ ] **Step 1: Crear el proyecto**

`FRONT:package.json`:

```json
{
  "name": "trikipeludos-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@heroicons/vue": "^2.2.0",
    "axios": "^1.12.2",
    "idb-keyval": "^6.2.1",
    "pinia": "^3.0.3",
    "socket.io-client": "^4.8.1",
    "vue": "^3.5.22",
    "vue-router": "^4.5.1",
    "vue-toastification": "^2.0.0-rc.5",
    "vuedraggable": "^4.1.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@vitejs/plugin-vue": "^6.0.1",
    "@vue/test-utils": "^2.4.6",
    "autoprefixer": "^10.4.21",
    "fake-indexeddb": "^6.0.1",
    "jsdom": "^26.1.0",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.18",
    "vite": "^7.1.7",
    "vite-plugin-pwa": "^1.0.3",
    "vitest": "^3.2.4"
  }
}
```

`FRONT:vite.config.js`:

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const destino = process.env.VITE_PROXY_TARGET || 'http://localhost:3020'

export default defineConfig({
  base: '/trikipeludos/',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    proxy: {
      '/api': { target: destino, changeOrigin: true },
      '/uploads': { target: destino, changeOrigin: true },
      '/socket.io': { target: destino, changeOrigin: true, ws: true }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/*.spec.js'],
    setupFiles: ['./src/testing/setup.js']
  }
})
```

`FRONT:tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // RNF-8: paleta Halloween/otoñal. Texto blanco solo sobre 700+ (contraste AA).
        calabaza: {
          50: '#FFF4EB', 100: '#FFE3CC', 200: '#FFC499', 300: '#FFA366', 400: '#F98A3C',
          500: '#E8711A', 600: '#C75A0E', 700: '#9E460C', 800: '#76340B', 900: '#4F2308'
        },
        morado: {
          50: '#F4EEFA', 100: '#E2D3F1', 200: '#C5A6E3', 300: '#A57AD2', 400: '#8552BE',
          500: '#6B3AA4', 600: '#5B2A86', 700: '#47206A', 800: '#33174D', 900: '#200E31'
        },
        crema: { DEFAULT: '#FFF6E6', 100: '#FFFBF3' }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      minHeight: { tactil: '44px' },
      minWidth: { tactil: '44px' }
    }
  },
  plugins: []
}
```

`FRONT:postcss.config.js`:

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

`FRONT:index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/trikipeludos/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#47206A" />
    <title>TRIKIPELUDOS</title>
  </head>
  <body class="bg-crema text-morado-900">
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

`FRONT:public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="36" r="24" fill="#E8711A"/><rect x="29" y="6" width="6" height="12" rx="3" fill="#47206A"/><path d="M22 34l5-6 5 6zm10 0l5-6 5 6zM22 44q10 8 20 0" fill="#200E31"/></svg>
```

`FRONT:src/style.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn { @apply inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-tactil font-semibold disabled:opacity-50; }
  .btn-primario { @apply btn bg-calabaza-700 text-white active:bg-calabaza-800; }
  .btn-secundario { @apply btn bg-morado-700 text-white active:bg-morado-800; }
  .btn-claro { @apply btn bg-white text-morado-800 border border-morado-200; }
  .campo { @apply w-full rounded-xl border border-morado-200 bg-white px-3 min-h-tactil text-base; }
  .tarjeta { @apply rounded-2xl bg-white shadow-sm p-4; }
}
```

`FRONT:src/testing/setup.js`:

```js
import 'fake-indexeddb/auto'
```

`FRONT:src/main.js`:

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(Toast, { position: 'top-center', timeout: 3500 })
  .mount('#app')
```

`FRONT:src/App.vue`:

```vue
<template>
  <RouterView />
</template>
```

- [ ] **Step 2: Escribir las pruebas que fallan**

`FRONT:src/stores/__tests__/auth.spec.js`:

```js
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => {
  const almacen = { token: null }
  return {
    api: { post: vi.fn() },
    trk: { post: vi.fn(), get: vi.fn() },
    tokenStorage: { leer: () => almacen.token, guardar: (t) => { almacen.token = t } }
  }
})

import { api, trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('loginPin guarda token y usuario', async () => {
  trk.post.mockResolvedValue({ data: { token: 't1', usuario: { id: 7, nombre: 'Jurado', rol: 'TRK_JURADO', permisos: { calificar: true } } } })
  const auth = useAuthStore()
  await auth.loginPin(7, '123456')
  expect(trk.post).toHaveBeenCalledWith('/auth/pin', { usuario_id: 7, pin: '123456' })
  expect(auth.autenticado).toBe(true)
  expect(auth.tiene('calificar')).toBe(true)
  expect(auth.rutaInicio).toBe('/jurado')
})

test('loginAdmin usa el login de Mantix y exige permiso administrar', async () => {
  api.post.mockResolvedValue({ data: { token: 'tm' } })
  trk.get.mockResolvedValue({ data: { id: 1, nombre: 'Admin', rol: 'Administrador', permisos: { administrar: true } } })
  const auth = useAuthStore()
  await auth.loginAdmin('a@b.co', 'x')
  expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.co', password: 'x' })
  expect(auth.rutaInicio).toBe('/admin')
})

test('loginAdmin rechaza usuarios de Mantix sin acceso TRK y cierra sesión', async () => {
  api.post.mockResolvedValue({ data: { token: 'tm' } })
  trk.get.mockResolvedValue({ data: { id: 2, nombre: 'Otro', rol: 'ASESOR', permisos: {} } })
  const auth = useAuthStore()
  await expect(auth.loginAdmin('a@b.co', 'x')).rejects.toMatchObject({ motivo: 'SIN_PERMISO' })
  expect(auth.token).toBeNull()
})

test('rutaInicio por permiso', () => {
  const auth = useAuthStore()
  auth.usuario = { permisos: { cabina: true } }
  expect(auth.rutaInicio).toBe('/cabina')
  auth.usuario = { permisos: { pasarela: true } }
  expect(auth.rutaInicio).toBe('/comentarista')
  auth.usuario = null
  expect(auth.rutaInicio).toBe('/login')
})
```

`FRONT:src/router/__tests__/guardia.spec.js`:

```js
import { test, expect, vi } from 'vitest'

vi.mock('@/services/api', () => ({ api: {}, trk: {}, tokenStorage: { leer: () => null, guardar: () => {} } }))

import { decidirNavegacion } from '@/router'

const ruta = (meta = {}, padres = []) => ({ fullPath: '/x', meta, matched: [...padres.map((m) => ({ meta: m })), { meta }] })
const auth = (permisos, token = 't') => ({
  token,
  tiene: (a) => permisos[a] === true,
  rutaInicio: permisos.calificar ? '/jurado' : permisos.administrar ? '/admin' : '/login'
})

test('rutas públicas pasan sin sesión', () => {
  expect(decidirNavegacion(ruta({ publica: true }), auth({}, null))).toBe(true)
})

test('sin token → login con redirect', () => {
  expect(decidirNavegacion(ruta({ permiso: 'calificar' }), auth({}, null))).toEqual({ path: '/login', query: { redirect: '/x' } })
})

test('sin permiso → su pantalla de inicio', () => {
  expect(decidirNavegacion(ruta({ permiso: 'administrar' }), auth({ calificar: true }))).toEqual({ path: '/jurado' })
})

test('permiso heredado del padre', () => {
  expect(decidirNavegacion(ruta({}, [{ permiso: 'administrar' }]), auth({ calificar: true }))).toEqual({ path: '/jurado' })
  expect(decidirNavegacion(ruta({}, [{ permiso: 'administrar' }]), auth({ administrar: true }))).toBe(true)
})
```

`FRONT:src/views/__tests__/LoginView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))
vi.mock('@/services/api', () => ({
  api: { post: vi.fn() },
  trk: { get: vi.fn(), post: vi.fn() },
  tokenStorage: { leer: () => null, guardar: () => {} }
}))

import { trk } from '@/services/api'
import LoginView from '@/views/LoginView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: [{ id: 3, nombre: 'Jurado Ana', rol: 'TRK_JURADO' }, { id: 4, nombre: 'Cabina', rol: 'TRK_CABINA' }] })
})

test('lista usuarios operativos y entra con PIN', async () => {
  trk.post.mockResolvedValue({ data: { token: 't', usuario: { id: 3, nombre: 'Jurado Ana', rol: 'TRK_JURADO', permisos: { calificar: true } } } })
  const w = mount(LoginView)
  await flushPromises()
  expect(w.text()).toContain('Jurado Ana')
  await w.get('[data-test="usuario-3"]').trigger('click')
  await w.get('[data-test="pin"]').setValue('123456')
  await w.get('[data-test="entrar-pin"]').trigger('submit')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/auth/pin', { usuario_id: 3, pin: '123456' })
  expect(push).toHaveBeenCalledWith('/jurado')
})

test('muestra el error del servidor', async () => {
  trk.post.mockRejectedValue({ status: 401, motivo: 'NO_AUTENTICADO', message: 'Usuario o PIN incorrecto' })
  const w = mount(LoginView)
  await flushPromises()
  await w.get('[data-test="usuario-4"]').trigger('click')
  await w.get('[data-test="pin"]').setValue('000000')
  await w.get('[data-test="entrar-pin"]').trigger('submit')
  await flushPromises()
  expect(w.text()).toContain('Usuario o PIN incorrecto')
})
```

- [ ] **Step 3: Correr para verificar que fallan**

Run: `cd FRONT && npm install && npx vitest run`
Expected: FAIL (módulos `@/stores/auth`, `@/router`, `@/views/LoginView.vue` inexistentes).

- [ ] **Step 4: Implementar**

`FRONT:src/services/api.js`:

```js
import axios from 'axios'

const CLAVE_TOKEN = 'trk_token'

export const tokenStorage = {
  leer() {
    try { return localStorage.getItem(CLAVE_TOKEN) } catch { return null }
  },
  guardar(token) {
    try {
      if (token) localStorage.setItem(CLAVE_TOKEN, token)
      else localStorage.removeItem(CLAVE_TOKEN)
    } catch { /* almacenamiento no disponible */ }
  }
}

// Contrato de error TRK (§9.0) → objeto plano para la UI.
export function normalizarError(error) {
  const r = error && error.response
  return {
    status: r ? r.status : 0,
    codigo: r && r.data ? r.data.error || null : null,
    motivo: r ? (r.data && r.data.motivo) || 'ERROR' : 'SIN_CONEXION',
    message: r ? (r.data && r.data.message) || 'Ocurrió un error' : 'Sin conexión con el servidor',
    errors: (r && r.data && r.data.errors) || []
  }
}

function crearCliente(baseURL) {
  const cliente = axios.create({ baseURL, timeout: 20000 })
  cliente.interceptors.request.use((config) => {
    const token = tokenStorage.leer()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  cliente.interceptors.response.use((r) => r.data, (e) => Promise.reject(normalizarError(e)))
  return cliente
}

const BASE = import.meta.env.VITE_API_URL || '/api'
export const api = crearCliente(BASE)
export const trk = crearCliente(`${BASE}/trk/v1`)
```

`FRONT:src/utils/errores.js`:

```js
export function mensajeDeError(err) {
  if (!err) return 'Ocurrió un error'
  if (err.errors && err.errors.length) return err.errors.map((e) => e.mensaje).join('. ')
  return err.message || 'Ocurrió un error'
}
```

`FRONT:src/stores/auth.js`:

```js
import { defineStore } from 'pinia'
import { api, trk, tokenStorage } from '@/services/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({ token: tokenStorage.leer(), usuario: null }),
  getters: {
    autenticado: (s) => Boolean(s.token && s.usuario),
    tiene: (s) => (accion) => Boolean(s.usuario && s.usuario.permisos && s.usuario.permisos[accion] === true),
    rutaInicio(s) {
      const p = (s.usuario && s.usuario.permisos) || {}
      if (p.administrar) return '/admin'
      if (p.cabina) return '/cabina'
      if (p.pasarela) return '/comentarista'
      if (p.calificar) return '/jurado'
      return '/login'
    }
  },
  actions: {
    fijarSesion(token, usuario) {
      this.token = token
      this.usuario = usuario
      tokenStorage.guardar(token)
    },
    async loginPin(usuarioId, pin) {
      const { data } = await trk.post('/auth/pin', { usuario_id: usuarioId, pin })
      this.fijarSesion(data.token, data.usuario)
    },
    async loginAdmin(email, password) {
      const { data } = await api.post('/auth/login', { email, password })
      this.fijarSesion(data.token, null)
      await this.cargarPerfil()
      if (!this.tiene('administrar')) {
        this.logout()
        throw { status: 403, motivo: 'SIN_PERMISO', message: 'Tu usuario de Mantix no tiene acceso a TRIKIPELUDOS' }
      }
    },
    async cargarPerfil() {
      if (!this.token) return null
      try {
        const { data } = await trk.get('/auth/yo')
        this.usuario = data
        return data
      } catch (e) {
        if (e.status === 401) this.logout()
        throw e
      }
    },
    logout() {
      this.token = null
      this.usuario = null
      tokenStorage.guardar(null)
    }
  }
})
```

`FRONT:src/router/index.js`:

```js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { publica: true } }
]

export function decidirNavegacion(to, auth) {
  if (to.meta && to.meta.publica) return true
  if (!auth.token) return { path: '/login', query: { redirect: to.fullPath } }
  const permiso = to.matched.map((r) => r.meta && r.meta.permiso).filter(Boolean).pop()
  if (permiso && !auth.tiene(permiso)) return { path: auth.rutaInicio }
  return true
}

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.token && !auth.usuario) {
    try { await auth.cargarPerfil() } catch { /* token inválido: cargarPerfil ya cerró sesión */ }
  }
  return decidirNavegacion(to, auth)
})

export default router
```

`FRONT:src/views/LoginView.vue`:

```vue
<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { trk } from '@/services/api'
import { mensajeDeError } from '@/utils/errores'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const modo = ref('equipo')
const usuarios = ref([])
const seleccionado = ref(null)
const pin = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const enviando = ref(false)

const ETIQUETA_ROL = { TRK_JURADO: 'Jurado', TRK_CABINA: 'Cabina', TRK_COMENTARISTA: 'Comentarista' }
const pinCompleto = computed(() => /^\d{6}$/.test(pin.value))

onMounted(async () => {
  try {
    const { data } = await trk.get('/auth/usuarios-pin')
    usuarios.value = data
  } catch (e) {
    error.value = mensajeDeError(e)
  }
})

async function entrar(accion) {
  error.value = ''
  enviando.value = true
  try {
    await accion()
    router.push(route.query.redirect || auth.rutaInicio)
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    enviando.value = false
  }
}

const entrarConPin = () => entrar(() => auth.loginPin(seleccionado.value.id, pin.value))
const entrarComoAdmin = () => entrar(() => auth.loginAdmin(email.value, password.value))
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8">
    <header class="text-center">
      <h1 class="text-3xl font-extrabold text-morado-700">TRIKIPELUDOS</h1>
      <p class="text-morado-600">Concurso de disfraces de mascotas</p>
    </header>

    <div class="grid grid-cols-2 gap-2" role="tablist">
      <button class="btn" :class="modo === 'equipo' ? 'bg-morado-700 text-white' : 'bg-white text-morado-800'" role="tab" @click="modo = 'equipo'">Equipo del evento</button>
      <button class="btn" :class="modo === 'admin' ? 'bg-morado-700 text-white' : 'bg-white text-morado-800'" role="tab" @click="modo = 'admin'">Administrador</button>
    </div>

    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>

    <form v-if="modo === 'equipo'" class="flex flex-col gap-4" data-test="entrar-pin" @submit.prevent="entrarConPin">
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 font-semibold">¿Quién eres?</legend>
        <button
          v-for="u in usuarios" :key="u.id" type="button" :data-test="`usuario-${u.id}`"
          class="btn justify-between"
          :class="seleccionado && seleccionado.id === u.id ? 'bg-calabaza-700 text-white' : 'bg-white text-morado-900 border border-morado-200'"
          @click="seleccionado = u"
        >
          <span>{{ u.nombre }}</span><span class="text-sm opacity-80">{{ ETIQUETA_ROL[u.rol] }}</span>
        </button>
      </fieldset>
      <label class="flex flex-col gap-1">
        <span class="font-semibold">PIN</span>
        <input v-model="pin" data-test="pin" class="campo text-center text-2xl tracking-[0.5em]" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\d{6}" />
      </label>
      <button class="btn-primario" type="submit" :disabled="!seleccionado || !pinCompleto || enviando">Entrar</button>
    </form>

    <form v-else class="flex flex-col gap-4" data-test="entrar-admin" @submit.prevent="entrarComoAdmin">
      <label class="flex flex-col gap-1"><span class="font-semibold">Correo de Mantix</span>
        <input v-model="email" class="campo" type="email" autocomplete="username" required />
      </label>
      <label class="flex flex-col gap-1"><span class="font-semibold">Contraseña</span>
        <input v-model="password" class="campo" type="password" autocomplete="current-password" required />
      </label>
      <button class="btn-primario" type="submit" :disabled="enviando">Entrar</button>
    </form>
  </main>
</template>
```

- [ ] **Step 5: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS (auth 4, guardia 4, login 2) y build sin errores.

- [ ] **Step 6: Commit**

```bash
cd FRONT
git add .
git commit -m "feat(front): esqueleto Vue, sesion (PIN y Mantix), guardia por permisos y login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1.9: Administración de usuarios en el frontend

Cubre: HU-2 (UI), §10 `/admin/usuarios`.

**Files:**
- Create: `FRONT:src/views/admin/AdminLayout.vue`, `FRONT:src/views/admin/UsuariosView.vue`, `FRONT:src/components/BarraSuperior.vue`
- Modify: `FRONT:src/router/index.js` (rutas `/admin`)
- Test: `FRONT:src/views/admin/__tests__/UsuariosView.spec.js`

**Interfaces:**
- Consumes: `trk` (1.8), `useAuthStore` (1.8), endpoints `TRK-USR-001..004`.
- Produces: `AdminLayout` (navegación admin con `<RouterView/>`); `BarraSuperior` (props `titulo: string`; muestra nombre del usuario y botón Salir).

- [ ] **Step 1: Escribir la prueba que falla**

`FRONT:src/views/admin/__tests__/UsuariosView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  api: {},
  trk: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  tokenStorage: { leer: () => null, guardar: () => {} }
}))

import { trk } from '@/services/api'
import UsuariosView from '@/views/admin/UsuariosView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: [{ id: 1, nombre: 'Jurado Ana', rol: 'TRK_JURADO', activo: true }] })
  window.confirm = vi.fn(() => true)
})

test('lista usuarios', async () => {
  const w = mount(UsuariosView)
  await flushPromises()
  expect(w.text()).toContain('Jurado Ana')
})

test('crear muestra el PIN una sola vez', async () => {
  trk.post.mockResolvedValue({ data: { usuario: { id: 2, nombre: 'Jurado Beto', rol: 'TRK_JURADO', activo: true }, pin: '482913' } })
  const w = mount(UsuariosView)
  await flushPromises()
  await w.get('[data-test="nombre"]').setValue('Jurado Beto')
  await w.get('[data-test="rol"]').setValue('TRK_JURADO')
  await w.get('[data-test="crear"]').trigger('submit')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/usuarios', { nombre: 'Jurado Beto', rol: 'TRK_JURADO' })
  expect(w.get('[data-test="pin-nuevo"]').text()).toContain('482913')
  await w.get('[data-test="cerrar-pin"]').trigger('click')
  expect(w.find('[data-test="pin-nuevo"]').exists()).toBe(false)
})

test('regenerar PIN pide confirmación', async () => {
  trk.post.mockResolvedValue({ data: { pin: '111222' } })
  const w = mount(UsuariosView)
  await flushPromises()
  await w.get('[data-test="regenerar-1"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalled()
  expect(trk.post).toHaveBeenCalledWith('/usuarios/1/pin')
  expect(w.text()).toContain('111222')
})

test('activar/desactivar', async () => {
  trk.patch.mockResolvedValue({ data: { id: 1, nombre: 'Jurado Ana', rol: 'TRK_JURADO', activo: false } })
  const w = mount(UsuariosView)
  await flushPromises()
  await w.get('[data-test="activo-1"]').trigger('click')
  await flushPromises()
  expect(trk.patch).toHaveBeenCalledWith('/usuarios/1', { activo: false })
  expect(w.text()).toContain('Inactivo')
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd FRONT && npx vitest run src/views/admin`
Expected: FAIL (vista inexistente).

- [ ] **Step 3: Implementar**

`FRONT:src/components/BarraSuperior.vue`:

```vue
<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

defineProps({ titulo: { type: String, required: true } })
const auth = useAuthStore()
const router = useRouter()

function salir() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-10 flex items-center justify-between gap-2 bg-morado-700 px-4 py-2 text-white">
    <h1 class="truncate text-lg font-bold">{{ titulo }}</h1>
    <div class="flex items-center gap-2">
      <span class="hidden truncate text-sm sm:inline">{{ auth.usuario && auth.usuario.nombre }}</span>
      <button class="btn min-w-tactil bg-morado-800 text-white" @click="salir">Salir</button>
    </div>
  </header>
</template>
```

`FRONT:src/views/admin/AdminLayout.vue`:

```vue
<script setup>
import BarraSuperior from '@/components/BarraSuperior.vue'

const enlaces = [
  { to: '/admin', texto: 'Tablero', exacto: true },
  { to: '/admin/importar', texto: 'Importar' },
  { to: '/admin/participantes', texto: 'Participantes' },
  { to: '/admin/ranking', texto: 'Ranking' },
  { to: '/admin/usuarios', texto: 'Usuarios' }
]
</script>

<template>
  <div class="min-h-screen">
    <BarraSuperior titulo="TRIKIPELUDOS · Admin" />
    <nav class="flex gap-1 overflow-x-auto bg-white px-2 py-1 shadow-sm">
      <RouterLink
        v-for="e in enlaces" :key="e.to" :to="e.to"
        class="btn whitespace-nowrap text-morado-800"
        :exact-active-class="e.exacto ? 'bg-calabaza-100 text-calabaza-800' : ''"
        :active-class="e.exacto ? '' : 'bg-calabaza-100 text-calabaza-800'"
      >{{ e.texto }}</RouterLink>
    </nav>
    <main class="mx-auto max-w-5xl p-4"><RouterView /></main>
  </div>
</template>
```

`FRONT:src/views/admin/UsuariosView.vue`:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { trk } from '@/services/api'
import { mensajeDeError } from '@/utils/errores'

const ROLES = [
  { valor: 'TRK_JURADO', texto: 'Jurado' },
  { valor: 'TRK_CABINA', texto: 'Cabina' },
  { valor: 'TRK_COMENTARISTA', texto: 'Comentarista' }
]
const textoRol = (v) => (ROLES.find((r) => r.valor === v) || {}).texto || v

const usuarios = ref([])
const nombre = ref('')
const rol = ref('TRK_JURADO')
const pinMostrado = ref(null)
const error = ref('')

async function cargar() {
  try { usuarios.value = (await trk.get('/usuarios')).data } catch (e) { error.value = mensajeDeError(e) }
}

async function crear() {
  error.value = ''
  try {
    const { data } = await trk.post('/usuarios', { nombre: nombre.value, rol: rol.value })
    usuarios.value.push(data.usuario)
    pinMostrado.value = { nombre: data.usuario.nombre, pin: data.pin }
    nombre.value = ''
  } catch (e) { error.value = mensajeDeError(e) }
}

async function regenerar(u) {
  if (!window.confirm(`¿Regenerar el PIN de ${u.nombre}? Sus sesiones abiertas se cerrarán.`)) return
  try {
    const { data } = await trk.post(`/usuarios/${u.id}/pin`)
    pinMostrado.value = { nombre: u.nombre, pin: data.pin }
  } catch (e) { error.value = mensajeDeError(e) }
}

async function alternarActivo(u) {
  try {
    const { data } = await trk.patch(`/usuarios/${u.id}`, { activo: !u.activo })
    Object.assign(u, data)
  } catch (e) { error.value = mensajeDeError(e) }
}

onMounted(cargar)
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-2xl font-bold">Jurados y accesos</h2>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>

    <div v-if="pinMostrado" data-test="pin-nuevo" class="tarjeta border-2 border-calabaza-500">
      <p>PIN de <strong>{{ pinMostrado.nombre }}</strong> (se muestra una sola vez):</p>
      <p class="my-2 text-center font-mono text-4xl tracking-[0.3em]">{{ pinMostrado.pin }}</p>
      <button class="btn-claro w-full" data-test="cerrar-pin" @click="pinMostrado = null">Ya lo anoté</button>
    </div>

    <form class="tarjeta flex flex-col gap-3 sm:flex-row sm:items-end" data-test="crear" @submit.prevent="crear">
      <label class="flex flex-1 flex-col gap-1"><span class="font-semibold">Nombre</span>
        <input v-model="nombre" data-test="nombre" class="campo" required minlength="2" maxlength="60" />
      </label>
      <label class="flex flex-col gap-1"><span class="font-semibold">Rol</span>
        <select v-model="rol" data-test="rol" class="campo">
          <option v-for="r in ROLES" :key="r.valor" :value="r.valor">{{ r.texto }}</option>
        </select>
      </label>
      <button class="btn-primario" type="submit">Crear</button>
    </form>

    <ul class="flex flex-col gap-2">
      <li v-for="u in usuarios" :key="u.id" class="tarjeta flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="font-semibold">{{ u.nombre }}</p>
          <p class="text-sm text-morado-600">{{ textoRol(u.rol) }} · <span>{{ u.activo ? 'Activo' : 'Inactivo' }}</span></p>
        </div>
        <div class="flex gap-2">
          <button class="btn-claro" :data-test="`regenerar-${u.id}`" @click="regenerar(u)">Nuevo PIN</button>
          <button class="btn-claro" :data-test="`activo-${u.id}`" @click="alternarActivo(u)">{{ u.activo ? 'Desactivar' : 'Activar' }}</button>
        </div>
      </li>
    </ul>
  </section>
</template>
```

En `FRONT:src/router/index.js`, agregar al arreglo `routes`:

```js
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { permiso: 'administrar' },
    children: [
      { path: '', redirect: '/admin/usuarios' },
      { path: 'usuarios', component: () => import('@/views/admin/UsuariosView.vue') }
    ]
  },
```

(La Task 4.5 reemplaza el `redirect` del hijo `''` por el tablero.)

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS y build OK.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): administracion de jurados y accesos (HU-2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Cierre de Fase 1

- [ ] Run: `cd BACK && npx jest && npm run test:trk:int` · `cd FRONT && npx vitest run && npx vite build`
- [ ] Reportar al usuario: tareas 1.1–1.9 hechas, conteo de pruebas, línea base de Mantix (antes/después) y pendientes (Fases 2–7). Esperar aprobación antes de la Fase 2.

---
## Fase 2 — Importador CSV con vista previa y validaciones §7.2

**Hecho cuando:** las pruebas con el fixture anonimizado cubren todos los casos de §7.2, la reimportación no duplica (§13.9) y el admin puede importar desde la UI.

### Task 2.1: Normalización de campos de la hoja

Cubre: HU-1 CA1 (mapeo por nombre normalizado), §7.1, §7.2 (documento, teléfono, especie con texto extra).

**Files:**
- Modify: `BACK:src/trk/utils/normalizar.js`, `BACK:src/trk/config/constantes.js`
- Test: `BACK:src/trk/utils/__tests__/normalizar.test.js` (ampliar)

**Interfaces:**
- Produces (en `normalizar.js`, además de `normalizarTexto`, `slug`):
  - `soloDigitos(v) → string`
  - `normalizarEspecie(v) → { especie: 'PERRO' | 'GATO' | null, extra: string | null }`
  - `normalizarSexo(v) → 'MACHO' | 'HEMBRA' | null`
  - `mapearCategoria(v) → 'PEQ_MED' | 'GRANDES' | 'FELINOS' | 'FAMILIAR' | null`
  - `telefonoValido(digitos) → boolean` (exactamente 10 dígitos)
  - `parsearFechaInscripcion(v) → 'YYYY-MM-DD' | null` (acepta `octubre 5, 2026` y `5/10/2026`)
  - `parsearAutorizacion(v) → boolean`
  - `primerNombre(nombre) → string`
  - `campoDeEncabezado(encabezado) → string | null` (`'notas'` para encabezado vacío; `null` si es desconocido)
  - `esRazaPequena(raza) → boolean`, `esRazaGrande(raza) → boolean`
- En `constantes.js`: `RAZAS_PEQUENAS`, `RAZAS_GRANDES` (listas en minúsculas sin tildes; heurística de advertencias, no reglas de puntaje).

- [ ] **Step 1: Escribir las pruebas que fallan** — agregar al final de `BACK:src/trk/utils/__tests__/normalizar.test.js`:

```js
const {
  soloDigitos, normalizarEspecie, normalizarSexo, mapearCategoria, telefonoValido,
  parsearFechaInscripcion, parsearAutorizacion, primerNombre, campoDeEncabezado, esRazaPequena, esRazaGrande
} = require('../normalizar');

test('documento: solo dígitos (§7.2 "88.251.117")', () => {
  expect(soloDigitos('88.251.117')).toBe('88251117');
  expect(soloDigitos(' 1 234 ')).toBe('1234');
  expect(soloDigitos(undefined)).toBe('');
});

test('especie normalizada y texto extra separado (§7.2 "Perro(cupo lleno)")', () => {
  expect(normalizarEspecie('Perro(cupo lleno)')).toEqual({ especie: 'PERRO', extra: '(cupo lleno)' });
  expect(normalizarEspecie(' gato ')).toEqual({ especie: 'GATO', extra: null });
  expect(normalizarEspecie('Canino')).toEqual({ especie: 'PERRO', extra: null });
  expect(normalizarEspecie('Felino')).toEqual({ especie: 'GATO', extra: null });
  expect(normalizarEspecie('Conejo')).toEqual({ especie: null, extra: null });
});

test('sexo', () => {
  expect(normalizarSexo('Macho')).toBe('MACHO');
  expect(normalizarSexo('HEMBRA')).toBe('HEMBRA');
  expect(normalizarSexo('')).toBeNull();
});

test('categorías de la hoja (§7.1)', () => {
  expect(mapearCategoria('Perros pequeños y medianos.')).toBe('PEQ_MED');
  expect(mapearCategoria('Perros grandes.')).toBe('GRANDES');
  expect(mapearCategoria('PERROS GRANDES')).toBe('GRANDES');
  expect(mapearCategoria('Gaticos.')).toBe('FELINOS');
  expect(mapearCategoria('Disfraz familiar: mascota y acompañante/s.')).toBe('FAMILIAR');
  expect(mapearCategoria('Otra cosa')).toBeNull();
});

test('teléfono válido = 10 dígitos (§7.2 "302268158")', () => {
  expect(telefonoValido('3001234567')).toBe(true);
  expect(telefonoValido('302268158')).toBe(false);
  expect(telefonoValido('30012345678')).toBe(false);
});

test('fecha de inscripción', () => {
  expect(parsearFechaInscripcion('octubre 5, 2026')).toBe('2026-10-05');
  expect(parsearFechaInscripcion('Septiembre 30, 2026')).toBe('2026-09-30');
  expect(parsearFechaInscripcion('5/10/2026 14:33:00')).toBe('2026-10-05');
  expect(parsearFechaInscripcion('ayer')).toBeNull();
});

test('autorizaciones', () => {
  expect(parsearAutorizacion('on')).toBe(true);
  expect(parsearAutorizacion('Sí')).toBe(true);
  expect(parsearAutorizacion('')).toBe(false);
});

test('primer nombre', () => {
  expect(primerNombre('ANA MARÍA Pérez')).toBe('Ana');
  expect(primerNombre('')).toBe('');
});

test('encabezados por nombre normalizado, incluido "Cateogoría" (sic)', () => {
  expect(campoDeEncabezado('Cateogoría de participación')).toBe('categoria');
  expect(campoDeEncabezado('  Nombre   del responsable ')).toBe('responsable_nombre');
  expect(campoDeEncabezado('FOTOGRAFÍA PARTICIPANTE')).toBe('foto_inscripcion_url');
  expect(campoDeEncabezado('Telefono')).toBe('responsable_telefono');
  expect(campoDeEncabezado('')).toBe('notas');
  expect(campoDeEncabezado('Columna rara')).toBeNull();
});

test('razas pequeñas y grandes', () => {
  expect(esRazaPequena('Mini Pinscher')).toBe(true);
  expect(esRazaPequena('Yorkie')).toBe(true);
  expect(esRazaGrande('Doberman')).toBe(true);
  expect(esRazaGrande('Pit bull')).toBe(true);
  expect(esRazaPequena('Criollo')).toBe(false);
});
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd BACK && npx jest src/trk/utils/__tests__/normalizar.test.js`
Expected: FAIL (`soloDigitos is not a function`).

- [ ] **Step 3: Implementar**

Agregar a `BACK:src/trk/config/constantes.js` (antes de `module.exports`) y exportarlas:

```js
// Heurísticas para advertencias del importador (§7.2). No afectan puntajes.
const RAZAS_PEQUENAS = [
  'pinscher', 'yorkie', 'yorkshire', 'chihuahua', 'pomerania', 'pomeranian', 'shih tzu', 'shitzu',
  'maltes', 'poodle toy', 'french poodle', 'pug', 'teckel', 'dachshund', 'salchicha', 'schnauzer mini',
  'bichon', 'pekines', 'jack russell', 'beagle'
];
const RAZAS_GRANDES = [
  'doberman', 'pit bull', 'pitbull', 'labrador', 'golden', 'pastor aleman', 'rottweiler', 'husky',
  'boxer', 'gran danes', 'san bernardo', 'dogo', 'akita', 'malinois', 'weimaraner', 'dalmata', 'bull terrier'
];
```

`module.exports = { ESTADOS, ESTADOS_VISIBLES_PUBLICO, ROLES_OPERATIVOS, ROL_JURADO, PERMISOS_TRK, MODULOS_API, RAZAS_PEQUENAS, RAZAS_GRANDES };`

Reemplazar `BACK:src/trk/utils/normalizar.js` completo por:

```js
// Normalización de datos de la hoja TRIKIPELUDOS (§7) y utilidades de texto.
const { RAZAS_PEQUENAS, RAZAS_GRANDES } = require('../config/constantes');

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(valor) {
  return normalizarTexto(valor).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'usuario';
}

const soloDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

function normalizarEspecie(valor) {
  const original = String(valor ?? '').trim();
  const n = normalizarTexto(original);
  let especie = null;
  if (/^(perr|can)/.test(n)) especie = 'PERRO';
  else if (/^(gat|fel)/.test(n)) especie = 'GATO';
  const resto = original.replace(/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+/, '').trim();
  return { especie, extra: especie && resto ? resto : null };
}

function normalizarSexo(valor) {
  const n = normalizarTexto(valor);
  if (n.startsWith('mach')) return 'MACHO';
  if (n.startsWith('hemb')) return 'HEMBRA';
  return null;
}

function mapearCategoria(valor) {
  const n = normalizarTexto(valor).replace(/\.+$/, '').trim();
  if (n.startsWith('perros pequenos') || n.includes('pequenos y medianos')) return 'PEQ_MED';
  if (n.startsWith('perros grandes') || n === 'grandes') return 'GRANDES';
  if (n.startsWith('gatico') || n.startsWith('gato') || n.startsWith('felino')) return 'FELINOS';
  if (n.startsWith('disfraz familiar') || n.startsWith('familiar')) return 'FAMILIAR';
  return null;
}

const telefonoValido = (digitos) => /^\d{10}$/.test(String(digitos ?? ''));

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};
const dosDigitos = (n) => String(n).padStart(2, '0');

function parsearFechaInscripcion(valor) {
  const n = normalizarTexto(valor);
  let m = n.match(/^([a-z]+) (\d{1,2}), (\d{4})/);
  if (m && MESES[m[1]]) return `${m[3]}-${dosDigitos(MESES[m[1]])}-${dosDigitos(m[2])}`;
  m = n.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${dosDigitos(m[2])}-${dosDigitos(m[1])}`;
  return null;
}

const parsearAutorizacion = (valor) => ['on', 'si', 'true', 'acepto', 'x', '1'].includes(normalizarTexto(valor));

function primerNombre(nombre) {
  const primero = String(nombre ?? '').trim().split(/\s+/)[0] || '';
  return primero ? primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase() : '';
}

const ENCABEZADOS = {
  'nombre del responsable': 'responsable_nombre',
  'documento de identidad': 'responsable_documento',
  telefono: 'responsable_telefono',
  'correo electronico': 'responsable_correo',
  'nombre de la mascota': 'mascota_nombre',
  especie: 'especie',
  raza: 'raza',
  'edad de la mascota': 'edad_texto',
  sexo: 'sexo',
  'cateogoria de participacion': 'categoria',
  'categoria de participacion': 'categoria',
  'autorizacion de datos': 'autoriza_datos',
  'autorizacion de reglamento': 'autoriza_reglamento',
  'fecha inscripcion': 'fecha_inscripcion',
  'fecha de inscripcion': 'fecha_inscripcion',
  'nombre del disfraz': 'disfraz_nombre',
  'fotografia participante': 'foto_inscripcion_url'
};

function campoDeEncabezado(encabezado) {
  const n = normalizarTexto(encabezado);
  if (!n) return 'notas';
  return ENCABEZADOS[n] || null;
}

const contieneAlguna = (raza, lista) => {
  const n = normalizarTexto(raza);
  return Boolean(n) && lista.some((r) => n.includes(r));
};
const esRazaGrande = (raza) => contieneAlguna(raza, RAZAS_GRANDES);
const esRazaPequena = (raza) => !esRazaGrande(raza) && contieneAlguna(raza, RAZAS_PEQUENAS);

module.exports = {
  normalizarTexto, slug, soloDigitos, normalizarEspecie, normalizarSexo, mapearCategoria, telefonoValido,
  parsearFechaInscripcion, parsearAutorizacion, primerNombre, campoDeEncabezado, esRazaPequena, esRazaGrande
};
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk/utils`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): normalizacion de campos de la hoja de inscripcion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2.2: Análisis del CSV con fixture anonimizado (vista previa en memoria)

Cubre: HU-1 CA1, CA2 (vista previa sin guardar), CA3b, CA4, §7.2 completo, §13.10.

**Files:**
- Create: `BACK:src/trk/testing/fixtures/inscripciones-anonimizadas.csv`, `BACK:src/trk/services/importador.service.js` (solo `analizarCsv` en esta tarea)
- Test: `BACK:src/trk/services/__tests__/importador.analisis.test.js`

**Interfaces:**
- Consumes: funciones de `normalizar.js` (2.1), `TrkError` (1.5).
- Produces: `analizarCsv(buffer) → { filas: FilaAnalizada[], resumen: { total, ok, con_advertencias, con_errores, grupos_duplicados } }` donde
  `FilaAnalizada = { indice (0-based), linea (número de línea del CSV), datos: { responsable_nombre, responsable_documento, responsable_telefono, responsable_correo, mascota_nombre, mascota_nombre_norm, especie, raza, edad_texto, sexo, categoria_codigo, autoriza_datos, autoriza_reglamento, fecha_inscripcion, disfraz_nombre, foto_inscripcion_url, notas_importacion }, advertencias: [{ codigo, mensaje, sugerencia? }], errores: [{ codigo, mensaje }], grupo_duplicado: string | null, conservar_por_defecto: boolean }`.
- Códigos de advertencia: `DOCUMENTO_NORMALIZADO`, `TELEFONO_INVALIDO`, `ESPECIE_TEXTO_EXTRA`, `ESPECIE_CATEGORIA_INCOHERENTE` (con `sugerencia`), `RAZA_PEQUENA_EN_GRANDES` (sugerencia `PEQ_MED`), `VARIAS_MASCOTAS`, `POSIBLE_DUPLICADO`, `NOTA_IMPORTACION`. Códigos de error: `CATEGORIA_DESCONOCIDA`, `MASCOTA_SIN_NOMBRE`, `RESPONSABLE_SIN_NOMBRE`.

- [ ] **Step 1: Crear el fixture anonimizado** (nombres y datos ficticios; cada fila reproduce un caso de §7.2; columnas desordenadas y dos columnas de notas sin encabezado)

`BACK:src/trk/testing/fixtures/inscripciones-anonimizadas.csv`:

```csv
Fecha inscripción,Nombre del responsable,Documento de identidad,Telefono,Correo electrónico,Nombre de la mascota,especie,raza,edad de la mascota,sexo,Cateogoría de participación,autorizacion de datos,Autorizacion de reglamento,NOMBRE DEL DISFRAZ,FOTOGRAFÍA PARTICIPANTE,,
"octubre 5, 2026",Laura Gómez Ruiz,1.234.567.890,3001112233,laura@ejemplo.test,Canela,Perro,Criollo,3,Hembra,Perros pequeños y medianos.,on,on,Bruja de Oz,https://drive.google.com/open?id=FICTICIO1,,
"octubre 6, 2026",Pedro Alba,10203040,3002223344,pedro@ejemplo.test,Rocky,Perro(cupo lleno),Pinscher,2 años,Macho,Gaticos.,on,on,Drácula,,,
"octubre 6, 2026",Sofía Mar,20304050,3003334455,sofia@ejemplo.test,Misifú,Gato,Angora,1 año y 4 meses,Hembra,Perros pequeños y medianos.,on,on,Calabacita,,,
"octubre 7, 2026",Carlos Ríos,30405060,3004445566,carlos@ejemplo.test,Thor,Perro,Labrador,5,Macho,Perros grandes.,on,on,Vikingo,,,
"octubre 8, 2026",Carlos Ríos,30405060,3004445566,carlos@ejemplo.test,THOR,perro,Labrador,5,Macho,Disfraz familiar: mascota y acompañante/s.,on,on,Familia vikinga,,,
"octubre 8, 2026",Marta Luna,40506070,3005556677,marta@ejemplo.test,Trompis y Princesa. Dos perritas,Perro,Criollas,10 MESES,Hembra,Perros pequeños y medianos.,on,on,Abejitas,,,
"octubre 9, 2026",Julián Sol,50607080,3006667788,julian@ejemplo.test,Toby,Perro,Yorkie,4,Macho,Perros grandes.,on,on,Superhéroe,,,
"octubre 9, 2026",Elena Paz,60708090,302268158,elena@ejemplo.test,Luna,Gato,Criollo,2,Hembra,Gaticos.,on,on,Fantasma,,,
"octubre 10, 2026",Andrés Vela,70809010,3007778899,andres@ejemplo.test,Max,Perro,Doberman,3,Macho,Gaticos.,on,,Hombre lobo,,confirmar si es uno o dos y categoría,validar en cual categoría ira
```

Índices: 0 Canela · 1 Rocky · 2 Misifú · 3 Thor · 4 THOR · 5 Trompis… · 6 Toby · 7 Luna · 8 Max.

- [ ] **Step 2: Escribir la prueba que falla**

`BACK:src/trk/services/__tests__/importador.analisis.test.js`:

```js
const fs = require('fs');
const path = require('path');
const { analizarCsv } = require('../importador.service');

const csv = fs.readFileSync(path.join(__dirname, '..', '..', 'testing', 'fixtures', 'inscripciones-anonimizadas.csv'));
const { filas, resumen } = analizarCsv(csv);
const fila = (i) => filas[i];
const codigos = (i) => fila(i).advertencias.map((a) => a.codigo).sort();

test('lee todas las filas, mapeando columnas por nombre y no por posición', () => {
  expect(resumen.total).toBe(9);
  expect(fila(0).linea).toBe(2);
  expect(fila(0).datos).toMatchObject({
    responsable_nombre: 'Laura Gómez Ruiz', mascota_nombre: 'Canela', mascota_nombre_norm: 'canela',
    especie: 'PERRO', sexo: 'HEMBRA', categoria_codigo: 'PEQ_MED', autoriza_datos: true, autoriza_reglamento: true,
    fecha_inscripcion: '2026-10-05', disfraz_nombre: 'Bruja de Oz',
    foto_inscripcion_url: 'https://drive.google.com/open?id=FICTICIO1'
  });
});

test('documento con formato se normaliza a dígitos con advertencia', () => {
  expect(fila(0).datos.responsable_documento).toBe('1234567890');
  expect(codigos(0)).toEqual(['DOCUMENTO_NORMALIZADO']);
});

test('§13.10 "Perro(cupo lleno)" en "Gaticos." → texto extra + incoherencia con sugerencia por raza', () => {
  expect(fila(1).datos.especie).toBe('PERRO');
  expect(codigos(1)).toEqual(['ESPECIE_CATEGORIA_INCOHERENTE', 'ESPECIE_TEXTO_EXTRA']);
  expect(fila(1).advertencias.find((a) => a.codigo === 'ESPECIE_CATEGORIA_INCOHERENTE').sugerencia).toBe('PEQ_MED');
  expect(fila(1).datos.notas_importacion).toContain('Perro(cupo lleno)');
});

test('gato inscrito en perros pequeños → sugiere FELINOS', () => {
  const a = fila(2).advertencias.find((x) => x.codigo === 'ESPECIE_CATEGORIA_INCOHERENTE');
  expect(a.sugerencia).toBe('FELINOS');
});

test('perro grande en Gaticos → sugiere GRANDES', () => {
  const a = fila(8).advertencias.find((x) => x.codigo === 'ESPECIE_CATEGORIA_INCOHERENTE');
  expect(a.sugerencia).toBe('GRANDES');
});

test('misma mascota en dos categorías → grupo de posible duplicado, conserva la primera por defecto', () => {
  expect(fila(3).grupo_duplicado).toEqual(expect.any(String));
  expect(fila(4).grupo_duplicado).toBe(fila(3).grupo_duplicado);
  expect(fila(3).conservar_por_defecto).toBe(true);
  expect(fila(4).conservar_por_defecto).toBe(false);
  expect(codigos(4)).toContain('POSIBLE_DUPLICADO');
  expect(resumen.grupos_duplicados).toBe(1);
});

test('una fila con varias mascotas se marca para dividir', () => {
  expect(codigos(5)).toContain('VARIAS_MASCOTAS');
});

test('raza pequeña en Perros grandes', () => {
  expect(codigos(6)).toEqual(['RAZA_PEQUENA_EN_GRANDES']);
});

test('teléfono inválido', () => {
  expect(codigos(7)).toEqual(['TELEFONO_INVALIDO']);
  expect(fila(7).datos.responsable_telefono).toBe('302268158');
});

test('notas de columnas sin encabezado quedan visibles', () => {
  expect(codigos(8)).toContain('NOTA_IMPORTACION');
  expect(fila(8).datos.notas_importacion).toBe('confirmar si es uno o dos y categoría | validar en cual categoría ira');
  expect(fila(8).datos.autoriza_reglamento).toBe(false);
});

test('las advertencias no bloquean: ninguna fila del fixture tiene errores', () => {
  expect(filas.every((f) => f.errores.length === 0)).toBe(true);
  expect(resumen.con_errores).toBe(0);
});

test('categoría desconocida o sin mascota → error de fila', () => {
  const malo = Buffer.from('Nombre del responsable,Nombre de la mascota,Cateogoría de participación\nAna,,Gaticos.\nBeto,Rex,Conejos\n');
  const r = analizarCsv(malo);
  expect(r.filas[0].errores.map((e) => e.codigo)).toEqual(['MASCOTA_SIN_NOMBRE']);
  expect(r.filas[1].errores.map((e) => e.codigo)).toEqual(['CATEGORIA_DESCONOCIDA']);
});

test('archivo sin columnas obligatorias → 400', () => {
  expect(() => analizarCsv(Buffer.from('a,b\n1,2\n'))).toThrow(expect.objectContaining({ statusCode: 400, motivo: 'VALIDACION' }));
});

test('tolera BOM de Excel', () => {
  const r = analizarCsv(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), csv]));
  expect(r.resumen.total).toBe(9);
});
```

- [ ] **Step 3: Correr para verificar que falla**

Run: `cd BACK && npx jest src/trk/services/__tests__/importador.analisis.test.js`
Expected: FAIL (`Cannot find module '../importador.service'`).

- [ ] **Step 4: Implementar**

`BACK:src/trk/services/importador.service.js`:

```js
// ============================================
// Importador TRIKIPELUDOS (HU-1). analizarCsv no toca la BD: solo produce la vista previa.
// ============================================
const { parse } = require('csv-parse/sync');
const TrkError = require('../utils/TrkError');
const {
  normalizarTexto, soloDigitos, normalizarEspecie, normalizarSexo, mapearCategoria, telefonoValido,
  parsearFechaInscripcion, parsearAutorizacion, campoDeEncabezado, esRazaPequena, esRazaGrande
} = require('../utils/normalizar');

const OBLIGATORIAS = ['responsable_nombre', 'mascota_nombre', 'categoria'];
const PATRON_VARIAS_MASCOTAS = /(\sy\s|,|&|\+|\bdos\b|\btres\b)/;

const coherente = (especie, categoria) => (especie === 'GATO'
  ? ['FELINOS', 'FAMILIAR'].includes(categoria)
  : ['PEQ_MED', 'GRANDES', 'FAMILIAR'].includes(categoria));

function sugerirCategoria(especie, raza) {
  if (especie === 'GATO') return 'FELINOS';
  if (esRazaGrande(raza)) return 'GRANDES';
  if (esRazaPequena(raza)) return 'PEQ_MED';
  return null;
}

function analizarFila(celdas, campos, indice) {
  const crudo = {};
  const notas = [];
  campos.forEach((campo, j) => {
    const valor = String(celdas[j] ?? '').trim();
    if (!campo) return;
    if (campo === 'notas') {
      if (valor) notas.push(valor);
      return;
    }
    crudo[campo] = valor;
  });

  const advertencias = [];
  const errores = [];

  const documento = soloDigitos(crudo.responsable_documento);
  if (crudo.responsable_documento && documento !== crudo.responsable_documento) {
    advertencias.push({ codigo: 'DOCUMENTO_NORMALIZADO', mensaje: `Documento "${crudo.responsable_documento}" normalizado a ${documento}` });
  }

  const telefono = soloDigitos(crudo.responsable_telefono);
  if (crudo.responsable_telefono && !telefonoValido(telefono)) {
    advertencias.push({ codigo: 'TELEFONO_INVALIDO', mensaje: `El teléfono ${crudo.responsable_telefono} no tiene 10 dígitos` });
  }

  const { especie, extra } = normalizarEspecie(crudo.especie);
  if (extra) advertencias.push({ codigo: 'ESPECIE_TEXTO_EXTRA', mensaje: `La especie traía texto adicional: "${extra}"` });

  const categoriaCodigo = mapearCategoria(crudo.categoria);
  if (!crudo.mascota_nombre) errores.push({ codigo: 'MASCOTA_SIN_NOMBRE', mensaje: 'La fila no tiene nombre de mascota' });
  if (!crudo.responsable_nombre) errores.push({ codigo: 'RESPONSABLE_SIN_NOMBRE', mensaje: 'La fila no tiene nombre del responsable' });
  if (!categoriaCodigo) errores.push({ codigo: 'CATEGORIA_DESCONOCIDA', mensaje: `Categoría no reconocida: "${crudo.categoria || ''}"` });

  if (categoriaCodigo && especie && !coherente(especie, categoriaCodigo)) {
    advertencias.push({
      codigo: 'ESPECIE_CATEGORIA_INCOHERENTE',
      mensaje: `${especie === 'PERRO' ? 'Perro' : 'Gato'} inscrito en ${categoriaCodigo}`,
      sugerencia: sugerirCategoria(especie, crudo.raza)
    });
  }
  if (categoriaCodigo === 'GRANDES' && esRazaPequena(crudo.raza)) {
    advertencias.push({ codigo: 'RAZA_PEQUENA_EN_GRANDES', mensaje: `Raza "${crudo.raza}" inscrita en Caninos grandes`, sugerencia: 'PEQ_MED' });
  }
  if (PATRON_VARIAS_MASCOTAS.test(normalizarTexto(crudo.mascota_nombre))) {
    advertencias.push({ codigo: 'VARIAS_MASCOTAS', mensaje: 'La fila parece tener varias mascotas; divídela manualmente' });
  }
  if (notas.length) advertencias.push({ codigo: 'NOTA_IMPORTACION', mensaje: notas.join(' | ') });

  const notasImportacion = [extra ? `Especie original: ${crudo.especie}` : null, ...notas].filter(Boolean).join(' | ') || null;

  return {
    indice,
    linea: indice + 2,
    datos: {
      responsable_nombre: crudo.responsable_nombre || '',
      responsable_documento: documento || null,
      responsable_telefono: telefono || null,
      responsable_correo: crudo.responsable_correo || null,
      mascota_nombre: crudo.mascota_nombre || '',
      mascota_nombre_norm: normalizarTexto(crudo.mascota_nombre),
      especie,
      raza: crudo.raza || null,
      edad_texto: crudo.edad_texto || null,
      sexo: normalizarSexo(crudo.sexo),
      categoria_codigo: categoriaCodigo,
      autoriza_datos: parsearAutorizacion(crudo.autoriza_datos),
      autoriza_reglamento: parsearAutorizacion(crudo.autoriza_reglamento),
      fecha_inscripcion: parsearFechaInscripcion(crudo.fecha_inscripcion),
      disfraz_nombre: crudo.disfraz_nombre || null,
      foto_inscripcion_url: crudo.foto_inscripcion_url || null,
      notas_importacion: notasImportacion
    },
    advertencias,
    errores,
    grupo_duplicado: null,
    conservar_por_defecto: true
  };
}

function marcarDuplicados(filas) {
  const grupos = new Map();
  for (const f of filas) {
    if (!f.datos.responsable_documento || !f.datos.mascota_nombre_norm) continue;
    const clave = `${f.datos.responsable_documento}|${f.datos.mascota_nombre_norm}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(f);
  }
  let n = 0;
  for (const miembros of grupos.values()) {
    if (miembros.length < 2) continue;
    const id = `dup-${++n}`;
    const lineas = miembros.map((m) => `${m.linea} (${m.datos.categoria_codigo || '?'})`).join(', ');
    miembros.forEach((m, i) => {
      m.grupo_duplicado = id;
      m.conservar_por_defecto = i === 0;
      m.advertencias.push({ codigo: 'POSIBLE_DUPLICADO', mensaje: `Misma mascota en las líneas ${lineas}. Una mascota compite en una sola categoría.` });
    });
  }
  return n;
}

function analizarCsv(buffer) {
  const texto = buffer.toString('utf8').replace(/^﻿/, '');
  const registros = parse(texto, { columns: false, skip_empty_lines: true, relax_column_count: true, trim: true });
  if (!registros.length) throw new TrkError(400, 'VALIDACION', 'El archivo está vacío');

  const campos = registros[0].map(campoDeEncabezado);
  const faltan = OBLIGATORIAS.filter((c) => !campos.includes(c));
  if (faltan.length) throw new TrkError(400, 'VALIDACION', `Faltan columnas obligatorias: ${faltan.join(', ')}`);

  const filas = registros.slice(1).map((celdas, i) => analizarFila(celdas, campos, i));
  const gruposDuplicados = marcarDuplicados(filas);

  return {
    filas,
    resumen: {
      total: filas.length,
      ok: filas.filter((f) => !f.advertencias.length && !f.errores.length).length,
      con_advertencias: filas.filter((f) => f.advertencias.length).length,
      con_errores: filas.filter((f) => f.errores.length).length,
      grupos_duplicados: gruposDuplicados
    }
  };
}

module.exports = { analizarCsv };
```

- [ ] **Step 5: Correr y verificar**

Run: `cd BACK && npx jest src/trk/services`
Expected: PASS (14 pruebas).

- [ ] **Step 6: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): analisis del CSV de inscripcion con advertencias de §7.2 y fixture anonimizado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2.3: Endpoints de importación, confirmación transaccional y listado de categorías

Cubre: HU-1 CA2, CA3, CA3b, §9.1 `TRK-IMP-001/002` y **nuevo `TRK-CAT-005`** (listar categorías), §13.9, RNF-6.

**Files:**
- Create: `BACK:src/trk/services/previewCache.js`, `BACK:src/trk/controllers/import.controller.js`, `BACK:src/trk/routes/import.routes.js`, `BACK:src/trk/services/categorias.service.js` (solo `listar` en esta tarea), `BACK:src/trk/controllers/categorias.controller.js`, `BACK:src/trk/routes/categorias.routes.js`
- Modify: `BACK:src/trk/services/importador.service.js` (agregar `confirmarImportacion`), `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`, `FRONT:docs/specs/trikipeludos-spec.md` (§9.1: fila `TRK-CAT-005`; §9.0: motivos `DUPLICADO`, `ESTADO_INVALIDO`, `CATEGORIAS_DISTINTAS`, `EMPATE_SIN_RESOLVER`, `RANKING_NO_PUBLICADO`, `NO_BLOQUEADA` que usan fases siguientes)
- Test: `BACK:src/trk/routes/__tests__/import.int.test.js`, `BACK:src/trk/routes/__tests__/categorias.int.test.js`

**Interfaces:**
- Consumes: `analizarCsv` (2.2), `registrarAuditoria` (1.7), `crearAdmin`, `crearOperativo` (fábricas).
- Produces:
  - `previewCache.guardar(analisis, meta) → token` (token = SHA-256 hex del archivo; `meta = { sha256, archivoNombre }`), `obtener(token) → { analisis, meta } | null` (TTL 30 min), `borrar(token)`.
  - `confirmarImportacion({ token, decisiones = { omitir: number[], conservar: { [grupo]: indice }, categoria: { [indice]: codigo } } }, ctx) → { creados, actualizados, omitidos }`.
  - `categoriasService.listar() → [{ id, codigo, nombre, orden, abierta, ranking_publicado, puestos_premiados, rubrica_codigo }]`.
  - Respuesta de `TRK-IMP-001`: `{ preview_token, archivo_nombre, filas, resumen }`.
  - Fábricas nuevas en `testing/fabricas.js`: `categoria(codigo) → TrkCategoria`, `crearParticipante(overrides) → TrkParticipante` (por defecto `PEQ_MED`, estado `PRESENTE`, responsable "Ana María Pérez").

- [ ] **Step 1: Escribir las pruebas que fallan**

`BACK:src/trk/routes/__tests__/import.int.test.js`:

```js
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const db = require('../../../models');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante } = require('../../testing/fabricas');

const app = crearAppTrk();
const CSV = path.join(__dirname, '..', '..', 'testing', 'fixtures', 'inscripciones-anonimizadas.csv');
let admin;

beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
});
afterAll(cerrar);

const preview = () => request(app).post('/api/trk/v1/import/preview')
  .set('Authorization', `Bearer ${admin.token}`)
  .attach('archivo', fs.readFileSync(CSV), 'inscripciones.csv');
const confirmar = (token, decisiones = {}) => request(app).post('/api/trk/v1/import/confirm')
  .set('Authorization', `Bearer ${admin.token}`)
  .send({ preview_token: token, decisiones });

test('TRK-IMP-001 vista previa: devuelve filas y no guarda nada (CA2)', async () => {
  const r = await preview();
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-IMP-001');
  expect(r.body.data.preview_token).toMatch(/^[a-f0-9]{64}$/);
  expect(r.body.data.resumen.total).toBe(9);
  expect(await db.TrkParticipante.count()).toBe(0);
});

test('TRK-IMP-002 confirma con decisiones por defecto: 8 creados (duplicado conserva la primera)', async () => {
  const token = (await preview()).body.data.preview_token;
  const r = await confirmar(token);
  expect(r.status).toBe(200);
  expect(r.body.data).toEqual({ creados: 8, actualizados: 0, omitidos: 1 });
  const thor = await db.TrkParticipante.findAll({ where: { mascota_nombre_norm: 'thor' }, include: ['categoria'] });
  expect(thor.map((t) => t.categoria.codigo)).toEqual(['GRANDES']);
  const max = await db.TrkParticipante.findOne({ where: { mascota_nombre: 'Max' } });
  expect(max).toMatchObject({ estado: 'INSCRITO', origen: 'IMPORTACION', notas_importacion: 'confirmar si es uno o dos y categoría | validar en cual categoría ira' });
  expect(max.advertencias_importacion.map((a) => a.codigo)).toContain('NOTA_IMPORTACION');
  expect(await db.TrkImportacion.count()).toBe(1);
  expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-IMP-002', accion: 'IMPORTAR' } })).toBe(1);
});

test('decisiones: conservar otra fila del grupo, aceptar sugerencia y omitir filas', async () => {
  const token = (await preview()).body.data.preview_token;
  const r = await confirmar(token, { conservar: { 'dup-1': 4 }, categoria: { 1: 'PEQ_MED' }, omitir: [5] });
  expect(r.body.data).toEqual({ creados: 7, actualizados: 0, omitidos: 2 });
  const thor = await db.TrkParticipante.findOne({ where: { mascota_nombre_norm: 'thor' }, include: ['categoria'] });
  expect(thor.categoria.codigo).toBe('FAMILIAR');
  const rocky = await db.TrkParticipante.findOne({ where: { mascota_nombre: 'Rocky' }, include: ['categoria'] });
  expect(rocky.categoria.codigo).toBe('PEQ_MED');
  expect(await db.TrkParticipante.count({ where: { mascota_nombre_norm: { [db.Sequelize.Op.like]: 'trompis%' } } })).toBe(0);
});

test('§13.9 importar dos veces el mismo CSV → cero duplicados', async () => {
  await confirmar((await preview()).body.data.preview_token);
  const r = await confirmar((await preview()).body.data.preview_token);
  expect(r.body.data).toEqual({ creados: 0, actualizados: 8, omitidos: 1 });
  expect(await db.TrkParticipante.count()).toBe(8);
});

test('CA3: al reimportar solo se llenan campos vacíos; foto oficial y estado intactos', async () => {
  const existente = await crearParticipante({
    mascota_nombre: 'Canela', responsable_documento: '1234567890', responsable_nombre: 'Laura Gómez Ruiz',
    raza: 'Raza previa', disfraz_nombre: null, foto_oficial_path: 'previa.jpg', estado: 'PRESENTE'
  });
  await confirmar((await preview()).body.data.preview_token);
  await existente.reload();
  expect(existente.raza).toBe('Raza previa');
  expect(existente.disfraz_nombre).toBe('Bruja de Oz');
  expect(existente.foto_oficial_path).toBe('previa.jpg');
  expect(existente.estado).toBe('PRESENTE');
});

test('token desconocido o vencido → 409 PREVIEW_VENCIDO', async () => {
  const r = await confirmar('a'.repeat(64));
  expect(r.status).toBe(409);
  expect(r.body).toMatchObject({ error: 'TRK-IMP-002', motivo: 'PREVIEW_VENCIDO' });
});

test('categoría decidida inexistente → 400', async () => {
  const token = (await preview()).body.data.preview_token;
  const r = await confirmar(token, { categoria: { 0: 'NO_EXISTE' } });
  expect(r.status).toBe(400);
  expect(await db.TrkParticipante.count()).toBe(0);
});

test('sin archivo → 400; sin permiso importar → 403', async () => {
  const sinArchivo = await request(app).post('/api/trk/v1/import/preview').set('Authorization', `Bearer ${admin.token}`);
  expect(sinArchivo.status).toBe(400);
  const cabina = await crearOperativo('TRK_CABINA');
  const r = await request(app).post('/api/trk/v1/import/preview').set('Authorization', `Bearer ${cabina.token}`).attach('archivo', fs.readFileSync(CSV), 'x.csv');
  expect(r.status).toBe(403);
});
```

`BACK:src/trk/routes/__tests__/categorias.int.test.js`:

```js
const request = require('supertest');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearOperativo } = require('../../testing/fabricas');

const app = crearAppTrk();
beforeEach(limpiar);
afterAll(cerrar);

test('TRK-CAT-005 lista categorías en orden para cualquier sesión TRK', async () => {
  const jurado = await crearOperativo('TRK_JURADO');
  const r = await request(app).get('/api/trk/v1/categorias').set('Authorization', `Bearer ${jurado.token}`);
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-CAT-005');
  expect(r.body.data.map((c) => [c.codigo, c.rubrica_codigo])).toEqual([
    ['PEQ_MED', 'INDIVIDUAL'], ['GRANDES', 'INDIVIDUAL'], ['FELINOS', 'INDIVIDUAL'], ['FAMILIAR', 'FAMILIAR']
  ]);
  expect(r.body.data[0]).toMatchObject({ abierta: true, ranking_publicado: false, puestos_premiados: 3 });
});

test('sin sesión → 401', async () => {
  expect((await request(app).get('/api/trk/v1/categorias')).status).toBe(401);
});
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/import.int.test.js src/trk/routes/__tests__/categorias.int.test.js`
Expected: FAIL (`crearParticipante is not a function` / 404).

- [ ] **Step 3: Implementar**

Agregar a `BACK:src/trk/testing/fabricas.js` (y exportarlas):

```js
const { normalizarTexto } = require('../utils/normalizar');

const categoria = (codigo) => db.TrkCategoria.findOne({ where: { codigo } });

async function crearParticipante(overrides = {}) {
  const { categoriaCodigo = 'PEQ_MED', ...resto } = overrides;
  const cat = await categoria(categoriaCodigo);
  const mascota = resto.mascota_nombre || `Firulais ${sufijo()}`;
  return db.TrkParticipante.create({
    categoria_id: cat.id,
    responsable_nombre: 'Ana María Pérez',
    responsable_documento: String(1000000000 + Math.floor(Math.random() * 8999999999)).slice(0, 10),
    responsable_telefono: '3001234567',
    responsable_correo: 'ana@ejemplo.test',
    especie: 'PERRO',
    raza: 'Criollo',
    edad_texto: '3',
    sexo: 'MACHO',
    disfraz_nombre: 'Vampiro',
    estado: 'PRESENTE',
    origen: 'IMPORTACION',
    ...resto,
    mascota_nombre: mascota,
    mascota_nombre_norm: normalizarTexto(mascota)
  });
}
```

`module.exports = { sufijo, crearAdmin, crearOperativo, categoria, crearParticipante };`

`BACK:src/trk/services/previewCache.js`:

```js
// Vista previa de importación en memoria del proceso (PM2 fork = una instancia). TTL 30 min.
const TTL_MS = 30 * 60 * 1000;
const cache = new Map();

function purgar(ahora = Date.now()) {
  for (const [token, entrada] of cache) if (entrada.expira <= ahora) cache.delete(token);
}

function guardar(analisis, meta) {
  purgar();
  cache.set(meta.sha256, { analisis, meta, expira: Date.now() + TTL_MS });
  return meta.sha256;
}

function obtener(token) {
  const entrada = cache.get(token);
  if (!entrada) return null;
  if (entrada.expira <= Date.now()) {
    cache.delete(token);
    return null;
  }
  return entrada;
}

const borrar = (token) => cache.delete(token);

module.exports = { guardar, obtener, borrar, TTL_MS };
```

Agregar a `BACK:src/trk/services/importador.service.js` (y exportar `confirmarImportacion` junto a `analizarCsv`):

```js
const db = require('../../models');
const previewCache = require('./previewCache');
const { registrarAuditoria } = require('./auditoria.service');

// Campos que una reimportación puede llenar si están vacíos (CA3). Nunca foto oficial, estado ni categoría.
const CAMPOS_RELLENABLES = [
  'responsable_nombre', 'responsable_documento', 'responsable_telefono', 'responsable_correo', 'especie', 'raza',
  'edad_texto', 'sexo', 'disfraz_nombre', 'foto_inscripcion_url', 'fecha_inscripcion', 'notas_importacion'
];
const vacio = (v) => v === null || v === undefined || v === '';

function buscarExistente(datos, transaction) {
  const where = datos.responsable_documento
    ? { responsable_documento: datos.responsable_documento, mascota_nombre_norm: datos.mascota_nombre_norm }
    : { responsable_documento: null, mascota_nombre_norm: datos.mascota_nombre_norm, responsable_nombre: datos.responsable_nombre };
  return db.TrkParticipante.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
}

function cambiosParaVacios(existente, datos, advertencias) {
  const cambios = {};
  for (const campo of CAMPOS_RELLENABLES) {
    if (vacio(existente[campo]) && !vacio(datos[campo])) cambios[campo] = datos[campo];
  }
  if (vacio(existente.advertencias_importacion) && advertencias.length) cambios.advertencias_importacion = advertencias;
  return cambios;
}

async function confirmarImportacion({ token, decisiones = {} }, ctx) {
  const entrada = previewCache.obtener(token);
  if (!entrada) throw new TrkError(409, 'PREVIEW_VENCIDO', 'La vista previa venció; vuelve a cargar el archivo');

  const omitir = new Set(decisiones.omitir || []);
  const conservar = decisiones.conservar || {};
  const categoriaDecidida = decisiones.categoria || {};

  const categorias = await db.TrkCategoria.findAll();
  const idPorCodigo = Object.fromEntries(categorias.map((c) => [c.codigo, c.id]));
  for (const codigo of Object.values(categoriaDecidida)) {
    if (!idPorCodigo[codigo]) throw new TrkError(400, 'VALIDACION', `Categoría desconocida: ${codigo}`);
  }

  const { filas, resumen } = entrada.analisis;
  const primeraDelGrupo = {};
  for (const f of filas) if (f.grupo_duplicado && f.conservar_por_defecto) primeraDelGrupo[f.grupo_duplicado] = f.indice;

  const resultado = { creados: 0, actualizados: 0, omitidos: 0 };
  await db.sequelize.transaction(async (transaction) => {
    for (const fila of filas) {
      const codigo = categoriaDecidida[String(fila.indice)] || fila.datos.categoria_codigo;
      const elegidaDelGrupo = fila.grupo_duplicado
        ? Number(conservar[fila.grupo_duplicado] ?? primeraDelGrupo[fila.grupo_duplicado])
        : fila.indice;
      const importable = !omitir.has(fila.indice) && idPorCodigo[codigo] && fila.datos.mascota_nombre
        && fila.datos.responsable_nombre && elegidaDelGrupo === fila.indice;
      if (!importable) {
        resultado.omitidos += 1;
        continue;
      }

      const { categoria_codigo: _ignorada, ...datos } = fila.datos;
      const existente = await buscarExistente(datos, transaction);
      if (existente) {
        const cambios = cambiosParaVacios(existente, datos, fila.advertencias);
        if (Object.keys(cambios).length) await existente.update(cambios, { transaction });
        resultado.actualizados += 1;
      } else {
        await db.TrkParticipante.create({
          ...datos,
          categoria_id: idPorCodigo[codigo],
          advertencias_importacion: fila.advertencias.length ? fila.advertencias : null,
          estado: 'INSCRITO',
          origen: 'IMPORTACION'
        }, { transaction });
        resultado.creados += 1;
      }
    }

    await db.TrkImportacion.create({
      usuario_id: ctx.usuarioId,
      archivo_nombre: entrada.meta.archivoNombre,
      archivo_sha256: token,
      filas_total: resumen.total,
      filas_ok: resultado.creados + resultado.actualizados,
      filas_advertencia: resumen.con_advertencias
    }, { transaction });
    await registrarAuditoria(ctx, {
      entidad: 'importacion', entidadId: token.slice(0, 36), accion: 'IMPORTAR',
      despues: { archivo: entrada.meta.archivoNombre, ...resultado }
    }, { transaction });
  });

  previewCache.borrar(token);
  return resultado;
}
```

`BACK:src/trk/controllers/import.controller.js`:

```js
const crypto = require('crypto');
const importador = require('../services/importador.service');
const previewCache = require('../services/previewCache');
const TrkError = require('../utils/TrkError');
const { ok } = require('../utils/respuesta');
const { ctxDe } = require('../utils/ctx');

exports.preview = async (req, res) => {
  if (!req.file) throw new TrkError(400, 'VALIDACION', 'Adjunta el archivo CSV en el campo "archivo"');
  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const analisis = importador.analizarCsv(req.file.buffer);
  const token = previewCache.guardar(analisis, { sha256, archivoNombre: req.file.originalname });
  ok(res, { preview_token: token, archivo_nombre: req.file.originalname, ...analisis });
};

exports.confirmar = async (req, res) => ok(res, await importador.confirmarImportacion(
  { token: req.body.preview_token, decisiones: req.body.decisiones }, ctxDe(req)
));
```

`BACK:src/trk/routes/import.routes.js`:

```js
const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth, trkPermiso } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const TrkError = require('../utils/TrkError');
const ctrl = require('../controllers/import.controller');

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const valido = /\.csv$/i.test(file.originalname) || /csv|text\/plain/.test(file.mimetype);
    cb(valido ? null : new TrkError(400, 'VALIDACION', 'El archivo debe ser CSV'), valido);
  }
});

const esquemaConfirmar = Joi.object({
  preview_token: Joi.string().hex().length(64).required(),
  decisiones: Joi.object({
    omitir: Joi.array().items(Joi.number().integer().min(0)).default([]),
    conservar: Joi.object().pattern(Joi.string(), Joi.number().integer().min(0)).default({}),
    categoria: Joi.object().pattern(Joi.string().pattern(/^\d+$/), Joi.string().max(20)).default({})
  }).default({})
});

const puedeImportar = [trkAuth, trkPermiso('importar')];
const router = express.Router();
router.post('/preview', apiCodigo('TRK-IMP-001'), ...puedeImportar, subida.single('archivo'), aw(ctrl.preview));
router.post('/confirm', apiCodigo('TRK-IMP-002'), ...puedeImportar, validar(esquemaConfirmar), aw(ctrl.confirmar));

module.exports = { prefijo: '/import', router };
```

`BACK:src/trk/services/categorias.service.js`:

```js
const db = require('../../models');

const vistaCategoria = (c) => ({
  id: c.id,
  codigo: c.codigo,
  nombre: c.nombre,
  orden: c.orden,
  abierta: Boolean(c.abierta),
  ranking_publicado: Boolean(c.ranking_publicado),
  puestos_premiados: c.puestos_premiados,
  rubrica_codigo: c.rubrica ? c.rubrica.codigo : null
});

async function listar() {
  const categorias = await db.TrkCategoria.findAll({ include: [{ model: db.TrkRubrica, as: 'rubrica' }], order: [['orden', 'ASC']] });
  return categorias.map(vistaCategoria);
}

module.exports = { listar, vistaCategoria };
```

`BACK:src/trk/controllers/categorias.controller.js`:

```js
const svc = require('../services/categorias.service');
const { ok } = require('../utils/respuesta');

exports.listar = async (req, res) => ok(res, await svc.listar());
```

`BACK:src/trk/routes/categorias.routes.js`:

```js
const express = require('express');
const apiCodigo = require('../middleware/apiCodigo');
const { trkAuth } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const ctrl = require('../controllers/categorias.controller');

const router = express.Router();
router.get('/', apiCodigo('TRK-CAT-005'), trkAuth, aw(ctrl.listar));

module.exports = { prefijo: '/categorias', router };
```

En `BACK:src/trk/routes/index.js` agregar a `modulos`: `require('./import.routes'),` y `require('./categorias.routes'),`.

En `BACK:src/trk/config/apiCodigos.js` agregar:

```js
  'TRK-IMP-001': { metodo: 'POST', ruta: '/import/preview', descripcion: 'Vista previa del CSV con advertencias (no guarda)' },
  'TRK-IMP-002': { metodo: 'POST', ruta: '/import/confirm', descripcion: 'Confirma la importación con decisiones del admin' },
  'TRK-CAT-005': { metodo: 'GET', ruta: '/categorias', descripcion: 'Lista categorías con estado y rúbrica' },
```

En `FRONT:docs/specs/trikipeludos-spec.md`:
- §9.1, después de la fila `TRK-CAT-004`, agregar: `| TRK-CAT-005 | GET | \`/categorias\` | cualquier sesión TRK | Lista categorías (estado, rúbrica, puestos premiados) para selectores |`
- §9.0, tabla de motivos: en la fila 409 agregar `DUPLICADO`, `ESTADO_INVALIDO`, `CATEGORIAS_DISTINTAS`, `EMPATE_SIN_RESOLVER`, `RANKING_NO_PUBLICADO`, `NO_BLOQUEADA` a la lista de motivos.

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit** (dos repos)

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): importacion con vista previa, confirmacion transaccional y listado de categorias

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd ../peludos
git add docs/specs/trikipeludos-spec.md
git commit -m "docs(spec): registra TRK-CAT-005 y motivos de error adicionales

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2.4: Pantalla de importación (admin)

Cubre: HU-1 CA2 (vista previa con advertencias, nada se guarda hasta confirmar), CA3b (elegir fila del duplicado), §10 `/admin/importar`.

**Files:**
- Create: `FRONT:src/views/admin/ImportarView.vue`, `FRONT:src/stores/categorias.js`
- Modify: `FRONT:src/router/index.js` (hijo `importar` de `/admin`)
- Test: `FRONT:src/views/admin/__tests__/ImportarView.spec.js`

**Interfaces:**
- Consumes: `TRK-IMP-001/002`, `TRK-CAT-005`.
- Produces: `useCategoriasStore()` — state `lista`; actions `cargar(forzar = false)`; getters `porId(id)`, `porCodigo(codigo)`.

- [ ] **Step 1: Escribir la prueba que falla**

`FRONT:src/views/admin/__tests__/ImportarView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  api: {},
  trk: { get: vi.fn(), post: vi.fn() },
  tokenStorage: { leer: () => null, guardar: () => {} }
}))

import { trk } from '@/services/api'
import ImportarView from '@/views/admin/ImportarView.vue'

const vistaPrevia = {
  preview_token: 'f'.repeat(64),
  archivo_nombre: 'inscripciones.csv',
  resumen: { total: 3, ok: 1, con_advertencias: 2, con_errores: 0, grupos_duplicados: 1 },
  filas: [
    { indice: 0, linea: 2, datos: { mascota_nombre: 'Rocky', responsable_nombre: 'Pedro', categoria_codigo: 'FELINOS' }, advertencias: [{ codigo: 'ESPECIE_CATEGORIA_INCOHERENTE', mensaje: 'Perro inscrito en FELINOS', sugerencia: 'PEQ_MED' }], errores: [], grupo_duplicado: null, conservar_por_defecto: true },
    { indice: 1, linea: 3, datos: { mascota_nombre: 'Thor', responsable_nombre: 'Carlos', categoria_codigo: 'GRANDES' }, advertencias: [{ codigo: 'POSIBLE_DUPLICADO', mensaje: 'Misma mascota' }], errores: [], grupo_duplicado: 'dup-1', conservar_por_defecto: true },
    { indice: 2, linea: 4, datos: { mascota_nombre: 'THOR', responsable_nombre: 'Carlos', categoria_codigo: 'FAMILIAR' }, advertencias: [{ codigo: 'POSIBLE_DUPLICADO', mensaje: 'Misma mascota' }], errores: [], grupo_duplicado: 'dup-1', conservar_por_defecto: false }
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: [
    { id: 1, codigo: 'PEQ_MED', nombre: 'Caninos pequeños y medianos' }, { id: 2, codigo: 'GRANDES', nombre: 'Caninos grandes' },
    { id: 3, codigo: 'FELINOS', nombre: 'Felinos' }, { id: 4, codigo: 'FAMILIAR', nombre: 'Familiar' }
  ] })
})

async function cargarArchivo(w) {
  trk.post.mockResolvedValueOnce({ data: vistaPrevia })
  const input = w.get('[data-test="archivo"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'inscripciones.csv', { type: 'text/csv' })] })
  await input.trigger('change')
  await flushPromises()
}

test('sube el CSV y muestra vista previa con advertencias', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w)
  expect(trk.post).toHaveBeenCalledWith('/import/preview', expect.any(FormData))
  expect(w.text()).toContain('Perro inscrito en FELINOS')
  expect(w.text()).toContain('3 filas')
})

test('confirma enviando decisiones: sugerencia aceptada, fila del duplicado y omitidas', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w)
  await w.get('[data-test="sugerencia-0"]').trigger('click')
  await w.get('[data-test="conservar-2"]').setValue(true)
  trk.post.mockResolvedValueOnce({ data: { creados: 2, actualizados: 0, omitidos: 1 } })
  await w.get('[data-test="confirmar"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenLastCalledWith('/import/confirm', {
    preview_token: 'f'.repeat(64),
    decisiones: { omitir: [], conservar: { 'dup-1': 2 }, categoria: { 0: 'PEQ_MED' } }
  })
  expect(w.text()).toContain('2 creados')
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd FRONT && npx vitest run src/views/admin/__tests__/ImportarView.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/stores/categorias.js`:

```js
import { defineStore } from 'pinia'
import { trk } from '@/services/api'

export const useCategoriasStore = defineStore('categorias', {
  state: () => ({ lista: [], cargada: false }),
  getters: {
    porId: (s) => (id) => s.lista.find((c) => c.id === Number(id)) || null,
    porCodigo: (s) => (codigo) => s.lista.find((c) => c.codigo === codigo) || null
  },
  actions: {
    async cargar(forzar = false) {
      if (this.cargada && !forzar) return this.lista
      this.lista = (await trk.get('/categorias')).data
      this.cargada = true
      return this.lista
    }
  }
})
```

`FRONT:src/views/admin/ImportarView.vue`:

```vue
<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { trk } from '@/services/api'
import { useCategoriasStore } from '@/stores/categorias'
import { mensajeDeError } from '@/utils/errores'

const categorias = useCategoriasStore()
const vista = ref(null)
const resultado = ref(null)
const error = ref('')
const cargando = ref(false)
const decisiones = reactive({ omitir: new Set(), conservar: {}, categoria: {} })

const nombreCategoria = (codigo) => (categorias.porCodigo(codigo) || {}).nombre || codigo || '—'
const categoriaFinal = (f) => decisiones.categoria[f.indice] || f.datos.categoria_codigo
const conservada = (f) => !f.grupo_duplicado || Number(decisiones.conservar[f.grupo_duplicado]) === f.indice
const seImporta = (f) => !decisiones.omitir.has(f.indice) && conservada(f) && Boolean(categoriaFinal(f))
const totalAImportar = computed(() => (vista.value ? vista.value.filas.filter(seImporta).length : 0))

onMounted(() => categorias.cargar().catch((e) => { error.value = mensajeDeError(e) }))

async function subir(evento) {
  const archivo = evento.target.files && evento.target.files[0]
  if (!archivo) return
  error.value = ''
  resultado.value = null
  cargando.value = true
  try {
    const form = new FormData()
    form.append('archivo', archivo)
    vista.value = (await trk.post('/import/preview', form)).data
    decisiones.omitir = new Set()
    decisiones.categoria = {}
    decisiones.conservar = {}
    for (const f of vista.value.filas) if (f.grupo_duplicado && f.conservar_por_defecto) decisiones.conservar[f.grupo_duplicado] = f.indice
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

function alternarOmitir(f) {
  if (decisiones.omitir.has(f.indice)) decisiones.omitir.delete(f.indice)
  else decisiones.omitir.add(f.indice)
  decisiones.omitir = new Set(decisiones.omitir)
}

async function confirmar() {
  error.value = ''
  cargando.value = true
  try {
    resultado.value = (await trk.post('/import/confirm', {
      preview_token: vista.value.preview_token,
      decisiones: { omitir: [...decisiones.omitir], conservar: { ...decisiones.conservar }, categoria: { ...decisiones.categoria } }
    })).data
    vista.value = null
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-2xl font-bold">Importar inscripciones</h2>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
    <p v-if="resultado" class="rounded-xl bg-green-100 p-3 text-green-900" role="status">
      Importación lista: {{ resultado.creados }} creados, {{ resultado.actualizados }} actualizados, {{ resultado.omitidos }} omitidos.
    </p>

    <label class="tarjeta flex flex-col gap-2">
      <span class="font-semibold">Archivo CSV exportado de la hoja TRIKIPELUDOS</span>
      <input data-test="archivo" type="file" accept=".csv,text/csv" class="campo py-2" :disabled="cargando" @change="subir" />
    </label>

    <template v-if="vista">
      <div class="tarjeta">
        <p><strong>{{ vista.archivo_nombre }}</strong> · {{ vista.resumen.total }} filas · {{ vista.resumen.con_advertencias }} con advertencias · {{ vista.resumen.con_errores }} con errores</p>
        <p class="text-sm text-morado-600">Nada se guarda hasta confirmar. Se importarán {{ totalAImportar }} filas.</p>
      </div>

      <ul class="flex flex-col gap-2">
        <li v-for="f in vista.filas" :key="f.indice" class="tarjeta flex flex-col gap-2" :class="seImporta(f) ? '' : 'opacity-60'">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-semibold">Línea {{ f.linea }} · {{ f.datos.mascota_nombre || '(sin nombre)' }} <span class="font-normal text-morado-600">· {{ f.datos.responsable_nombre }}</span></p>
            <span class="rounded-full bg-morado-100 px-3 py-1 text-sm">{{ nombreCategoria(categoriaFinal(f)) }}</span>
          </div>
          <ul class="flex flex-col gap-1 text-sm">
            <li v-for="(a, i) in f.advertencias" :key="`a${i}`" class="rounded-lg bg-calabaza-50 p-2 text-calabaza-900">
              ⚠️ {{ a.mensaje }}
              <button v-if="a.sugerencia && categoriaFinal(f) !== a.sugerencia" class="btn-claro ml-2 min-h-0 py-1" :data-test="`sugerencia-${f.indice}`" @click="decisiones.categoria[f.indice] = a.sugerencia">
                Usar {{ nombreCategoria(a.sugerencia) }}
              </button>
            </li>
            <li v-for="(e, i) in f.errores" :key="`e${i}`" class="rounded-lg bg-red-50 p-2 text-red-800">⛔ {{ e.mensaje }}</li>
          </ul>
          <div class="flex flex-wrap items-center gap-3">
            <label v-if="f.grupo_duplicado" class="flex min-h-tactil items-center gap-2">
              <input type="radio" :name="f.grupo_duplicado" :value="f.indice" :data-test="`conservar-${f.indice}`" :checked="conservada(f)" @change="decisiones.conservar[f.grupo_duplicado] = f.indice" />
              Conservar esta
            </label>
            <label v-if="f.errores.length" class="flex items-center gap-2">
              Categoría:
              <select class="campo w-auto" @change="decisiones.categoria[f.indice] = $event.target.value">
                <option value="">—</option>
                <option v-for="c in categorias.lista" :key="c.codigo" :value="c.codigo">{{ c.nombre }}</option>
              </select>
            </label>
            <label class="flex min-h-tactil items-center gap-2">
              <input type="checkbox" :checked="decisiones.omitir.has(f.indice)" :data-test="`omitir-${f.indice}`" @change="alternarOmitir(f)" />
              Omitir
            </label>
          </div>
        </li>
      </ul>

      <button class="btn-primario sticky bottom-4" data-test="confirmar" :disabled="cargando || !totalAImportar" @click="confirmar">
        Confirmar importación ({{ totalAImportar }})
      </button>
    </template>
  </section>
</template>
```

En `FRONT:src/router/index.js`, en los `children` de `/admin`, agregar:
`{ path: 'importar', component: () => import('@/views/admin/ImportarView.vue') },`

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): importacion de inscripciones con vista previa y decisiones (HU-1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Cierre de Fase 2

- [ ] Run: suite completa (ver Cierre de Fase 1). Reportar al usuario y esperar aprobación.

---

## Fase 3 — Cabina: búsqueda, alta rápida, foto oficial

**Hecho cuando:** el flujo e2e de cabina (buscar → foto → `PRESENTE`) pasa en móvil emulado a 360 px y §13.8 (REST) está cubierto.

### Task 3.1: Serialización por rol y consulta de participantes

Cubre: RNF-5, §13.8 (REST), HU-5 CA1 (búsqueda tolerante), HU-6 CA1 (campos), §4 (solo `PRESENTE`+ para comentarista/jurado), §9.1 `TRK-PAR-001/002`.

**Files:**
- Create: `BACK:src/trk/utils/serializar.js`, `BACK:src/trk/services/participantes.service.js` (`listar`, `obtener` en esta tarea), `BACK:src/trk/controllers/participantes.controller.js`, `BACK:src/trk/routes/participantes.routes.js`
- Modify: `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/utils/__tests__/serializar.test.js`, `BACK:src/trk/routes/__tests__/participantes.consulta.int.test.js`

**Interfaces:**
- Produces:
  - `serializarParticipante(p, nivel: 'COMPLETO' | 'PUBLICO') → object`. PUBLICO = `id, categoria_id, categoria{ id, codigo, nombre }, mascota_nombre, especie, raza, edad_texto, sexo, disfraz_nombre, foto_url, foto_inscripcion_url, estado, orden_pasarela, llegada_at, responsable_primer_nombre`. COMPLETO = PUBLICO + `categoria_propuesta_id, responsable_nombre, responsable_documento, responsable_telefono, responsable_correo, autoriza_datos, autoriza_reglamento, fecha_inscripcion, notas_importacion, advertencias_importacion, origen, desempate_manual, foto_oficial_at, created_at, updated_at`.
  - `urlFoto(nombreArchivo) → string | null` (`${TRK_FOTOS_URL_BASE || '/uploads/trk/fotos'}/${nombre}`).
  - `participantes.listar({ categoria, estado, q }, usuario) → Participante[]` (serializados por `nivelDatos(usuario)`), `participantes.obtener(id, usuario) → Participante`.
  - `participantes.buscarModelo(id, { transaction, lock }) → TrkParticipante` (404 si no existe o está fusionado) — lo usan las tareas siguientes.

- [ ] **Step 1: Escribir las pruebas que fallan**

`BACK:src/trk/utils/__tests__/serializar.test.js`:

```js
const { serializarParticipante, urlFoto } = require('../serializar');

const p = {
  id: 'u1', categoria_id: 1, categoria: { id: 1, codigo: 'PEQ_MED', nombre: 'Caninos pequeños', rubrica_id: 1 },
  responsable_nombre: 'ANA MARÍA Pérez', responsable_documento: '123', responsable_telefono: '300', responsable_correo: 'a@b.co',
  mascota_nombre: 'Canela', especie: 'PERRO', raza: 'Criollo', edad_texto: '3', sexo: 'HEMBRA', disfraz_nombre: 'Bruja',
  foto_oficial_path: 'abc.jpg', foto_inscripcion_url: null, estado: 'PRESENTE', orden_pasarela: 1, llegada_at: null,
  notas_importacion: 'x', origen: 'IMPORTACION'
};

test('PUBLICO nunca incluye documento, teléfono, correo ni nombre completo (RNF-5)', () => {
  const s = serializarParticipante(p, 'PUBLICO');
  for (const campo of ['responsable_documento', 'responsable_telefono', 'responsable_correo', 'responsable_nombre', 'notas_importacion']) {
    expect(s).not.toHaveProperty(campo);
  }
  expect(JSON.stringify(s)).not.toMatch(/123|300|a@b\.co|MARÍA/);
  expect(s).toMatchObject({ responsable_primer_nombre: 'Ana', mascota_nombre: 'Canela', foto_url: '/uploads/trk/fotos/abc.jpg', categoria: { id: 1, codigo: 'PEQ_MED', nombre: 'Caninos pequeños' } });
  expect(s.categoria).not.toHaveProperty('rubrica_id');
});

test('COMPLETO incluye datos de contacto', () => {
  expect(serializarParticipante(p, 'COMPLETO')).toMatchObject({ responsable_documento: '123', responsable_telefono: '300', responsable_correo: 'a@b.co' });
});

test('acepta instancias Sequelize (get({ plain }))', () => {
  const instancia = { get: () => p };
  expect(serializarParticipante(instancia, 'PUBLICO').id).toBe('u1');
});

test('urlFoto', () => {
  expect(urlFoto(null)).toBeNull();
  expect(urlFoto('x.jpg')).toBe('/uploads/trk/fotos/x.jpg');
});
```

`BACK:src/trk/routes/__tests__/participantes.consulta.int.test.js`:

```js
const request = require('supertest');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria } = require('../../testing/fabricas');

const app = crearAppTrk();
const base = '/api/trk/v1/participantes';
const SENSIBLES = ['responsable_documento', 'responsable_telefono', 'responsable_correo', 'responsable_nombre'];

let admin; let jurado; let comentarista; let cabina;
beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
  jurado = await crearOperativo('TRK_JURADO');
  comentarista = await crearOperativo('TRK_COMENTARISTA');
  cabina = await crearOperativo('TRK_CABINA');
});
afterAll(cerrar);

const get = (url, quien) => request(app).get(url).set('Authorization', `Bearer ${quien.token}`);

test('§13.8 jurado y comentarista: detalle sin documento, teléfono ni correo', async () => {
  const p = await crearParticipante({ mascota_nombre: 'Canela', estado: 'EN_PASARELA' });
  for (const quien of [jurado, comentarista]) {
    const r = await get(`${base}/${p.id}`, quien);
    expect(r.status).toBe(200);
    expect(r.headers['x-trk-api']).toBe('TRK-PAR-002');
    for (const campo of SENSIBLES) expect(r.body.data).not.toHaveProperty(campo);
    expect(r.body.data.responsable_primer_nombre).toBe('Ana');
  }
});

test('admin y cabina sí ven datos de contacto', async () => {
  const p = await crearParticipante();
  for (const quien of [admin, cabina]) {
    const r = await get(`${base}/${p.id}`, quien);
    expect(r.body.data.responsable_telefono).toBe('3001234567');
  }
});

test('TRK-PAR-001 jurado solo ve PRESENTE o posteriores; cabina ve todos', async () => {
  await crearParticipante({ mascota_nombre: 'Inscrita', estado: 'INSCRITO' });
  await crearParticipante({ mascota_nombre: 'Ausente', estado: 'AUSENTE' });
  await crearParticipante({ mascota_nombre: 'Presente', estado: 'PRESENTE' });
  await crearParticipante({ mascota_nombre: 'Presentada', estado: 'PRESENTADO' });
  const rJ = await get(base, jurado);
  expect(rJ.headers['x-trk-api']).toBe('TRK-PAR-001');
  expect(rJ.body.data.map((x) => x.mascota_nombre).sort()).toEqual(['Presentada', 'Presente']);
  for (const x of rJ.body.data) for (const campo of SENSIBLES) expect(x).not.toHaveProperty(campo);
  const rC = await get(base, cabina);
  expect(rC.body.data).toHaveLength(4);
});

test('participante no visible para el rol → 404', async () => {
  const p = await crearParticipante({ estado: 'INSCRITO' });
  expect((await get(`${base}/${p.id}`, jurado)).status).toBe(404);
});

test('HU-5 CA1 búsqueda tolerante a tildes y mayúsculas por mascota, responsable o últimos dígitos del documento', async () => {
  await crearParticipante({ mascota_nombre: 'Misifú', responsable_nombre: 'Sofía Márquez', responsable_documento: '20304050' });
  await crearParticipante({ mascota_nombre: 'Rocky', responsable_nombre: 'Pedro Alba', responsable_documento: '10203040' });
  const nombres = async (q) => (await get(`${base}?q=${encodeURIComponent(q)}`, cabina)).body.data.map((x) => x.mascota_nombre);
  expect(await nombres('MISIFU')).toEqual(['Misifú']);
  expect(await nombres('marquez')).toEqual(['Misifú']);
  expect(await nombres('3040')).toEqual(['Rocky']);
});

test('filtros por categoría y estado; orden por orden de pasarela', async () => {
  const grandes = await categoria('GRANDES');
  await crearParticipante({ mascota_nombre: 'B', categoriaCodigo: 'GRANDES', orden_pasarela: 2 });
  await crearParticipante({ mascota_nombre: 'A', categoriaCodigo: 'GRANDES', orden_pasarela: 1 });
  await crearParticipante({ mascota_nombre: 'C', categoriaCodigo: 'PEQ_MED' });
  const r = await get(`${base}?categoria=${grandes.id}&estado=PRESENTE`, cabina);
  expect(r.body.data.map((x) => x.mascota_nombre)).toEqual(['A', 'B']);
});

test('fusionados no aparecen', async () => {
  const destino = await crearParticipante({ mascota_nombre: 'Destino' });
  await crearParticipante({ mascota_nombre: 'Origen', fusionado_en_id: destino.id });
  const r = await get(base, cabina);
  expect(r.body.data.map((x) => x.mascota_nombre)).toEqual(['Destino']);
});

test('sin sesión → 401 (la pantalla pública no usa este endpoint)', async () => {
  expect((await request(app).get(base)).status).toBe(401);
});
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd BACK && npx jest src/trk/utils/__tests__/serializar.test.js && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/participantes.consulta.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BACK:src/trk/utils/serializar.js`:

```js
// ÚNICA salida de datos de participantes (REST y sockets). Lista blanca por nivel (RNF-5).
const { primerNombre } = require('./normalizar');

const CAMPOS_PUBLICOS = [
  'id', 'categoria_id', 'mascota_nombre', 'especie', 'raza', 'edad_texto', 'sexo', 'disfraz_nombre',
  'foto_inscripcion_url', 'estado', 'orden_pasarela', 'llegada_at'
];
const CAMPOS_SOLO_COMPLETO = [
  'categoria_propuesta_id', 'responsable_nombre', 'responsable_documento', 'responsable_telefono', 'responsable_correo',
  'autoriza_datos', 'autoriza_reglamento', 'fecha_inscripcion', 'notas_importacion', 'advertencias_importacion',
  'origen', 'desempate_manual', 'foto_oficial_at', 'created_at', 'updated_at'
];

function urlFoto(nombreArchivo) {
  if (!nombreArchivo) return null;
  return `${process.env.TRK_FOTOS_URL_BASE || '/uploads/trk/fotos'}/${nombreArchivo}`;
}

function serializarParticipante(participante, nivel) {
  if (!participante) return null;
  const plano = typeof participante.get === 'function' ? participante.get({ plain: true }) : participante;
  const campos = nivel === 'COMPLETO' ? [...CAMPOS_PUBLICOS, ...CAMPOS_SOLO_COMPLETO] : CAMPOS_PUBLICOS;
  const salida = {};
  for (const campo of campos) if (campo in plano) salida[campo] = plano[campo];
  salida.responsable_primer_nombre = primerNombre(plano.responsable_nombre);
  salida.foto_url = urlFoto(plano.foto_oficial_path);
  if (plano.categoria) salida.categoria = { id: plano.categoria.id, codigo: plano.categoria.codigo, nombre: plano.categoria.nombre };
  return salida;
}

module.exports = { serializarParticipante, urlFoto, CAMPOS_PUBLICOS };
```

`BACK:src/trk/services/participantes.service.js`:

```js
const { Op } = require('sequelize');
const db = require('../../models');
const TrkError = require('../utils/TrkError');
const { normalizarTexto, soloDigitos } = require('../utils/normalizar');
const { serializarParticipante } = require('../utils/serializar');
const { nivelDatos } = require('../utils/permisos');
const { ESTADOS_VISIBLES_PUBLICO } = require('../config/constantes');

const INCLUIR_CATEGORIA = [{ model: db.TrkCategoria, as: 'categoria' }];
const ORDEN_COLA = [
  [{ model: db.TrkCategoria, as: 'categoria' }, 'orden', 'ASC'],
  [db.sequelize.literal('`TrkParticipante`.`orden_pasarela` IS NULL'), 'ASC'],
  ['orden_pasarela', 'ASC'],
  ['llegada_at', 'ASC'],
  ['mascota_nombre', 'ASC']
];

function filtroBusqueda(q) {
  const texto = String(q || '').trim();
  if (!texto) return null;
  const condiciones = [
    { mascota_nombre_norm: { [Op.like]: `%${normalizarTexto(texto)}%` } },
    { responsable_nombre: { [Op.like]: `%${texto}%` } } // collation utf8mb4_unicode_ci: ignora tildes y mayúsculas
  ];
  const digitos = soloDigitos(texto);
  if (digitos.length >= 3 && digitos === texto.replace(/\s/g, '')) {
    condiciones.push({ responsable_documento: { [Op.like]: `%${digitos}` } });
  }
  return { [Op.or]: condiciones };
}

async function listar({ categoria, estado, q } = {}, usuario) {
  const nivel = nivelDatos(usuario);
  const where = { fusionado_en_id: null };
  if (categoria) where.categoria_id = Number(categoria);
  if (estado) where.estado = estado;
  if (nivel === 'PUBLICO') where.estado = estado && ESTADOS_VISIBLES_PUBLICO.includes(estado) ? estado : ESTADOS_VISIBLES_PUBLICO;
  const busqueda = filtroBusqueda(q);
  if (busqueda) Object.assign(where, busqueda);
  const filas = await db.TrkParticipante.findAll({ where, include: INCLUIR_CATEGORIA, order: ORDEN_COLA });
  return filas.map((p) => serializarParticipante(p, nivel));
}

async function buscarModelo(id, { transaction, lock } = {}) {
  const p = await db.TrkParticipante.findByPk(id, {
    include: INCLUIR_CATEGORIA,
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined
  });
  if (!p || p.fusionado_en_id) throw new TrkError(404, 'NO_ENCONTRADO', 'Participante no encontrado');
  return p;
}

async function obtener(id, usuario) {
  const nivel = nivelDatos(usuario);
  const p = await buscarModelo(id);
  if (nivel === 'PUBLICO' && !ESTADOS_VISIBLES_PUBLICO.includes(p.estado)) {
    throw new TrkError(404, 'NO_ENCONTRADO', 'Participante no encontrado');
  }
  return serializarParticipante(p, nivel);
}

module.exports = { listar, obtener, buscarModelo, INCLUIR_CATEGORIA };
```

> Con `include` + `findByPk` + `lock`, MySQL aplica `FOR UPDATE` también a la tabla incluida; es aceptable (categorías no se escriben en esas transacciones). Si Sequelize rechaza `lock` con `include` en tu versión, separar: bloquear con `findByPk(id, { transaction, lock })` sin include y luego `reload({ include })`.

`BACK:src/trk/controllers/participantes.controller.js`:

```js
const svc = require('../services/participantes.service');
const { ok } = require('../utils/respuesta');

exports.listar = async (req, res) => ok(res, await svc.listar(req.query, req.usuario));
exports.obtener = async (req, res) => ok(res, await svc.obtener(req.params.id, req.usuario));
```

`BACK:src/trk/routes/participantes.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const { ESTADOS } = require('../config/constantes');
const ctrl = require('../controllers/participantes.controller');

const esquemaListado = Joi.object({
  categoria: Joi.number().integer().positive(),
  estado: Joi.string().valid(...Object.values(ESTADOS)),
  q: Joi.string().trim().max(100).allow('')
});
const esquemaId = Joi.object({ id: Joi.string().guid({ version: 'uuidv4' }).required() });

const router = express.Router();
router.get('/', apiCodigo('TRK-PAR-001'), trkAuth, validar(esquemaListado, 'query'), aw(ctrl.listar));
router.get('/:id', apiCodigo('TRK-PAR-002'), trkAuth, validar(esquemaId, 'params'), aw(ctrl.obtener));

module.exports = { prefijo: '/participantes', router, esquemaId };
```

En `BACK:src/trk/routes/index.js` agregar `require('./participantes.routes'),` a `modulos`.

En `BACK:src/trk/config/apiCodigos.js` agregar:

```js
  'TRK-PAR-001': { metodo: 'GET', ruta: '/participantes', descripcion: 'Listado filtrado; campos según rol' },
  'TRK-PAR-002': { metodo: 'GET', ruta: '/participantes/:id', descripcion: 'Detalle; campos según rol' },
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): consulta de participantes con filtrado de datos personales por rol

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3.2: Alta de último minuto, edición y ausencia

Cubre: HU-5 CA4 (categoría directa o propuesta), CA6, HU-3 (edición admin), §9.1 `TRK-PAR-003/004/008`, RNF-6.

**Files:**
- Create: `BACK:src/trk/sockets/bus.js`
- Modify: `BACK:src/trk/services/participantes.service.js` (`crearAltaRapida`, `editar`, `cambiarEstado`), `BACK:src/trk/controllers/participantes.controller.js`, `BACK:src/trk/routes/participantes.routes.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/routes/__tests__/participantes.edicion.int.test.js`

**Interfaces:**
- Produces:
  - `bus` (EventEmitter, evento interno `'trk'`) y `emitir(evento, payload, { rooms } = {})`; `ROOMS_TODAS = ['admin', 'cabina', 'comentarista', 'jurado', 'pantalla']`. `payload.participante`, si viene, es el **modelo o plano crudo**; los sockets (Task 4.2) lo serializan por room.
  - `crearAltaRapida(datos, ctx) → Participante (COMPLETO)`; `editar(id, cambios, ctx) → { participante (COMPLETO), requiere_confirmacion: boolean }`; `cambiarEstado(id, estado, ctx) → Participante (COMPLETO)`.
  - Campos editables: `CAMPOS_CABINA = ['mascota_nombre','disfraz_nombre','raza','edad_texto','sexo','especie','categoria_id','responsable_telefono','responsable_correo']`; `CAMPOS_ADMIN = CAMPOS_CABINA + ['responsable_nombre','responsable_documento','autoriza_datos','autoriza_reglamento','foto_inscripcion_url']`.

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/routes/__tests__/participantes.edicion.int.test.js`:

```js
const request = require('supertest');
const db = require('../../../models');
const { bus } = require('../../sockets/bus');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria } = require('../../testing/fabricas');

const app = crearAppTrk();
const base = '/api/trk/v1/participantes';
let admin; let cabina; let jurado; let eventos;
const escuchar = (e) => eventos.push(e);

beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
  cabina = await crearOperativo('TRK_CABINA');
  jurado = await crearOperativo('TRK_JURADO');
  eventos = [];
  bus.on('trk', escuchar);
});
afterEach(() => bus.off('trk', escuchar));
afterAll(cerrar);

const como = (quien, req) => req.set('Authorization', `Bearer ${quien.token}`);

async function calificacionDePrueba(p) {
  return db.TrkCalificacion.create({ participante_id: p.id, jurado_id: jurado.usuario.id, total: 50, enviada_at: new Date(), bloqueada: true });
}

test('TRK-PAR-003 alta rápida de cabina con datos mínimos (CA6)', async () => {
  const cat = await categoria('FELINOS');
  const r = await como(cabina, request(app).post(base)).send({
    responsable_nombre: 'Nora Díaz', responsable_telefono: '3009998877', mascota_nombre: 'Pelusa', especie: 'GATO', categoria_id: cat.id
  });
  expect(r.status).toBe(201);
  expect(r.headers['x-trk-api']).toBe('TRK-PAR-003');
  expect(r.body.data).toMatchObject({ mascota_nombre: 'Pelusa', estado: 'INSCRITO', origen: 'CABINA', responsable_telefono: '3009998877' });
  expect(eventos.map((e) => e.evento)).toContain('participante:actualizado');
});

test('alta duplicada (mismo documento y mascota) → 409 DUPLICADO', async () => {
  const cat = await categoria('PEQ_MED');
  await crearParticipante({ mascota_nombre: 'Kira', responsable_documento: '55555' });
  const r = await como(cabina, request(app).post(base)).send({
    responsable_nombre: 'X', responsable_telefono: '3000000000', responsable_documento: '55555', mascota_nombre: 'KIRA', especie: 'PERRO', categoria_id: cat.id
  });
  expect(r.status).toBe(409);
  expect(r.body.motivo).toBe('DUPLICADO');
});

test('jurado no puede crear → 403', async () => {
  const r = await como(jurado, request(app).post(base)).send({});
  expect(r.status).toBe(403);
});

test('TRK-PAR-004 cabina edita disfraz y categoría sin calificaciones → cambio directo', async () => {
  const p = await crearParticipante({ disfraz_nombre: 'Viejo' });
  const grandes = await categoria('GRANDES');
  const r = await como(cabina, request(app).patch(`${base}/${p.id}`)).send({ disfraz_nombre: 'Nuevo', categoria_id: grandes.id });
  expect(r.status).toBe(200);
  expect(r.body.data).toMatchObject({ requiere_confirmacion: false, participante: { disfraz_nombre: 'Nuevo', categoria_id: grandes.id } });
  expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-PAR-004', accion: 'CAMBIAR_CATEGORIA' } })).toBe(1);
});

test('con calificaciones, el cambio de categoría queda como propuesta (HU-5 CA4)', async () => {
  const p = await crearParticipante();
  await calificacionDePrueba(p);
  const grandes = await categoria('GRANDES');
  const r = await como(cabina, request(app).patch(`${base}/${p.id}`)).send({ categoria_id: grandes.id });
  expect(r.body.data.requiere_confirmacion).toBe(true);
  await p.reload();
  expect(p.categoria_propuesta_id).toBe(grandes.id);
  expect(p.categoria_id).not.toBe(grandes.id);
  expect(await db.TrkCalificacion.count({ where: { participante_id: p.id } })).toBe(1);
});

test('cabina no puede editar documento; admin sí', async () => {
  const p = await crearParticipante();
  const r = await como(cabina, request(app).patch(`${base}/${p.id}`)).send({ responsable_documento: '999' });
  expect(r.status).toBe(403);
  const rA = await como(admin, request(app).patch(`${base}/${p.id}`)).send({ responsable_documento: '999' });
  expect(rA.status).toBe(200);
  expect(rA.body.data.participante.responsable_documento).toBe('999');
});

test('renombrar la mascota actualiza el nombre normalizado', async () => {
  const p = await crearParticipante({ mascota_nombre: 'Lassie' });
  await como(cabina, request(app).patch(`${base}/${p.id}`)).send({ mascota_nombre: 'Lassié Dos' });
  await p.reload();
  expect(p.mascota_nombre_norm).toBe('lassie dos');
});

test('TRK-PAR-008 marcar y desmarcar ausente', async () => {
  const p = await crearParticipante({ estado: 'INSCRITO' });
  const r = await como(cabina, request(app).patch(`${base}/${p.id}/estado`)).send({ estado: 'AUSENTE' });
  expect(r.status).toBe(200);
  expect(r.body.data.estado).toBe('AUSENTE');
  const r2 = await como(cabina, request(app).patch(`${base}/${p.id}/estado`)).send({ estado: 'INSCRITO' });
  expect(r2.body.data.estado).toBe('INSCRITO');
});

test('no se puede marcar ausente a quien ya está presente → 409 ESTADO_INVALIDO', async () => {
  const p = await crearParticipante({ estado: 'PRESENTE' });
  const r = await como(cabina, request(app).patch(`${base}/${p.id}/estado`)).send({ estado: 'AUSENTE' });
  expect(r.status).toBe(409);
  expect(r.body.motivo).toBe('ESTADO_INVALIDO');
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/participantes.edicion.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BACK:src/trk/sockets/bus.js`:

```js
// Bus interno de eventos TRK. Los servicios emiten aquí; sockets/index.js reenvía a Socket.IO
// serializando por room. Así los servicios no dependen de Socket.IO y se prueban sin red.
const { EventEmitter } = require('events');

const ROOMS_TODAS = ['admin', 'cabina', 'comentarista', 'jurado', 'pantalla'];
const bus = new EventEmitter();
bus.setMaxListeners(50);

function emitir(evento, payload, { rooms = ROOMS_TODAS } = {}) {
  bus.emit('trk', { evento, payload, rooms });
}

module.exports = { bus, emitir, ROOMS_TODAS };
```

Agregar a `BACK:src/trk/services/participantes.service.js` (y exportar `crearAltaRapida, editar, cambiarEstado, CAMPOS_CABINA, CAMPOS_ADMIN`):

```js
const { tienePermiso } = require('../utils/permisos');
const { registrarAuditoria } = require('./auditoria.service');
const { emitir } = require('../sockets/bus');

const CAMPOS_CABINA = ['mascota_nombre', 'disfraz_nombre', 'raza', 'edad_texto', 'sexo', 'especie', 'categoria_id', 'responsable_telefono', 'responsable_correo'];
const CAMPOS_ADMIN = [...CAMPOS_CABINA, 'responsable_nombre', 'responsable_documento', 'autoriza_datos', 'autoriza_reglamento', 'foto_inscripcion_url'];

function aDuplicado(e) {
  if (e && e.name === 'SequelizeUniqueConstraintError') {
    return new TrkError(409, 'DUPLICADO', 'Ya existe un participante con ese documento y nombre de mascota');
  }
  return e;
}

async function recargarCompleto(p, transaction) {
  await p.reload({ include: INCLUIR_CATEGORIA, transaction });
  return serializarParticipante(p, 'COMPLETO');
}

async function crearAltaRapida(datos, ctx) {
  try {
    const creado = await db.sequelize.transaction(async (transaction) => {
      const p = await db.TrkParticipante.create({
        ...datos,
        responsable_documento: datos.responsable_documento || null,
        mascota_nombre_norm: normalizarTexto(datos.mascota_nombre),
        estado: 'INSCRITO',
        origen: 'CABINA'
      }, { transaction });
      await registrarAuditoria(ctx, { entidad: 'participante', entidadId: p.id, accion: 'CREAR', despues: datos }, { transaction });
      return p;
    });
    await creado.reload({ include: INCLUIR_CATEGORIA });
    emitir('participante:actualizado', { participante: creado.get({ plain: true }) }, { rooms: ['admin', 'cabina'] });
    return serializarParticipante(creado, 'COMPLETO');
  } catch (e) {
    throw aDuplicado(e);
  }
}

async function editar(id, cambios, ctx) {
  const permitidos = tienePermiso(ctx.usuario, 'editar') ? CAMPOS_ADMIN : CAMPOS_CABINA;
  const prohibidos = Object.keys(cambios).filter((c) => !permitidos.includes(c));
  if (prohibidos.length) throw new TrkError(403, 'SIN_PERMISO', `No puedes editar: ${prohibidos.join(', ')}`);

  try {
    const resultado = await db.sequelize.transaction(async (transaction) => {
      const p = await buscarModelo(id, { transaction, lock: true });
      const antes = p.get({ plain: true });
      const { categoria_id: nuevaCategoria, ...resto } = cambios;
      let requiereConfirmacion = false;

      if (resto.mascota_nombre !== undefined) resto.mascota_nombre_norm = normalizarTexto(resto.mascota_nombre);
      Object.assign(p, resto);

      if (nuevaCategoria !== undefined && nuevaCategoria !== p.categoria_id) {
        const categoria = await db.TrkCategoria.findByPk(nuevaCategoria, { transaction });
        if (!categoria) throw new TrkError(400, 'VALIDACION', 'Categoría inexistente');
        const calificaciones = await db.TrkCalificacion.count({ where: { participante_id: p.id }, transaction });
        if (calificaciones > 0) {
          p.categoria_propuesta_id = nuevaCategoria;
          requiereConfirmacion = true;
          await registrarAuditoria(ctx, { entidad: 'participante', entidadId: p.id, accion: 'PROPONER_CATEGORIA', antes: { categoria_id: antes.categoria_id }, despues: { categoria_propuesta_id: nuevaCategoria } }, { transaction });
        } else {
          p.categoria_id = nuevaCategoria;
          p.categoria_propuesta_id = null;
          await registrarAuditoria(ctx, { entidad: 'participante', entidadId: p.id, accion: 'CAMBIAR_CATEGORIA', antes: { categoria_id: antes.categoria_id }, despues: { categoria_id: nuevaCategoria } }, { transaction });
        }
      } else if (nuevaCategoria !== undefined) {
        p.categoria_propuesta_id = null;
      }

      await p.save({ transaction });
      const cambiados = Object.keys(resto);
      if (cambiados.length) {
        await registrarAuditoria(ctx, {
          entidad: 'participante', entidadId: p.id, accion: 'EDITAR',
          antes: Object.fromEntries(cambiados.map((c) => [c, antes[c]])),
          despues: Object.fromEntries(cambiados.map((c) => [c, p[c]]))
        }, { transaction });
      }
      return { p, requiereConfirmacion };
    });
    const participante = await recargarCompleto(resultado.p);
    emitir('participante:actualizado', { participante: resultado.p.get({ plain: true }) });
    return { participante, requiere_confirmacion: resultado.requiereConfirmacion };
  } catch (e) {
    throw aDuplicado(e);
  }
}

const TRANSICIONES_AUSENCIA = { INSCRITO: 'AUSENTE', AUSENTE: 'INSCRITO' };

async function cambiarEstado(id, estado, ctx) {
  const p = await db.sequelize.transaction(async (transaction) => {
    const participante = await buscarModelo(id, { transaction, lock: true });
    if (TRANSICIONES_AUSENCIA[participante.estado] !== estado) {
      throw new TrkError(409, 'ESTADO_INVALIDO', `No se puede pasar de ${participante.estado} a ${estado}`);
    }
    const antes = participante.estado;
    await participante.update({ estado }, { transaction });
    await registrarAuditoria(ctx, { entidad: 'participante', entidadId: participante.id, accion: 'CAMBIAR_ESTADO', antes: { estado: antes }, despues: { estado } }, { transaction });
    return participante;
  });
  emitir('participante:actualizado', { participante: p.get({ plain: true }) });
  return recargarCompleto(p);
}
```

Agregar a `BACK:src/trk/controllers/participantes.controller.js`:

```js
const { ctxDe } = require('../utils/ctx');

exports.crear = async (req, res) => ok(res, await svc.crearAltaRapida(req.body, ctxDe(req)), 201);
exports.editar = async (req, res) => ok(res, await svc.editar(req.params.id, req.body, ctxDe(req)));
exports.cambiarEstado = async (req, res) => ok(res, await svc.cambiarEstado(req.params.id, req.body.estado, ctxDe(req)));
```

Agregar a `BACK:src/trk/routes/participantes.routes.js` (antes de `module.exports`; importar `trkPermiso` desde `../middleware/trkAuth`):

```js
const telefono = Joi.string().pattern(/^\d{7,10}$/);
const esquemaAlta = Joi.object({
  responsable_nombre: Joi.string().trim().min(2).max(150).required(),
  responsable_telefono: telefono.required(),
  responsable_documento: Joi.string().pattern(/^\d{4,20}$/).allow(null, ''),
  responsable_correo: Joi.string().email().allow(null, ''),
  mascota_nombre: Joi.string().trim().min(1).max(100).required(),
  especie: Joi.string().valid('PERRO', 'GATO').required(),
  categoria_id: Joi.number().integer().positive().required(),
  raza: Joi.string().trim().max(100).allow(null, ''),
  edad_texto: Joi.string().trim().max(50).allow(null, ''),
  sexo: Joi.string().valid('MACHO', 'HEMBRA').allow(null),
  disfraz_nombre: Joi.string().trim().max(150).allow(null, '')
});
const esquemaEdicion = Joi.object({
  mascota_nombre: Joi.string().trim().min(1).max(100),
  disfraz_nombre: Joi.string().trim().max(150).allow(null, ''),
  raza: Joi.string().trim().max(100).allow(null, ''),
  edad_texto: Joi.string().trim().max(50).allow(null, ''),
  sexo: Joi.string().valid('MACHO', 'HEMBRA').allow(null),
  especie: Joi.string().valid('PERRO', 'GATO').allow(null),
  categoria_id: Joi.number().integer().positive(),
  responsable_telefono: telefono.allow(null, ''),
  responsable_correo: Joi.string().email().allow(null, ''),
  responsable_nombre: Joi.string().trim().min(2).max(150),
  responsable_documento: Joi.string().pattern(/^\d{4,20}$/).allow(null),
  autoriza_datos: Joi.boolean(),
  autoriza_reglamento: Joi.boolean(),
  foto_inscripcion_url: Joi.string().uri().max(500).allow(null, '')
}).min(1);
const esquemaEstado = Joi.object({ estado: Joi.string().valid('AUSENTE', 'INSCRITO').required() });

router.post('/', apiCodigo('TRK-PAR-003'), trkAuth, trkPermiso('cabina'), validar(esquemaAlta), aw(ctrl.crear));
router.patch('/:id', apiCodigo('TRK-PAR-004'), trkAuth, trkPermiso('cabina'), validar(esquemaId, 'params'), validar(esquemaEdicion), aw(ctrl.editar));
router.patch('/:id/estado', apiCodigo('TRK-PAR-008'), trkAuth, trkPermiso('cabina'), validar(esquemaId, 'params'), validar(esquemaEstado), aw(ctrl.cambiarEstado));
```

> El rol admin tiene `cabina: true` (seed 004), así que `trkPermiso('cabina')` cubre a admin y cabina; el servicio restringe campos con `editar`.

En `BACK:src/trk/config/apiCodigos.js` agregar:

```js
  'TRK-PAR-003': { metodo: 'POST', ruta: '/participantes', descripcion: 'Alta de último minuto (cabina/admin)' },
  'TRK-PAR-004': { metodo: 'PATCH', ruta: '/participantes/:id', descripcion: 'Edición; categoría directa o propuesta' },
  'TRK-PAR-008': { metodo: 'PATCH', ruta: '/participantes/:id/estado', descripcion: 'Marca o desmarca AUSENTE' },
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): alta rapida, edicion con categoria propuesta y ausencia (HU-5, HU-3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3.3: Foto oficial (subida, normalización y estado `PRESENTE`)

Cubre: HU-5 CA3 (servidor), CA4, RNF-5 (UUID, sin EXIF), §9.1 `TRK-PAR-005`.

**Files:**
- Create: `BACK:src/trk/services/fotos.service.js`
- Modify: `BACK:src/trk/services/participantes.service.js` (`guardarFotoOficial`), `BACK:src/trk/controllers/participantes.controller.js`, `BACK:src/trk/routes/participantes.routes.js`, `BACK:src/trk/config/apiCodigos.js`, `BACK:src/trk/testing/app.js` (opción `estaticos`)
- Test: `BACK:src/trk/routes/__tests__/participantes.foto.int.test.js`

**Interfaces:**
- Produces:
  - `dirFotos() → string` (`TRK_FOTOS_PATH` o `<cwd>/uploads/trk/fotos`), `procesarYGuardarFoto(buffer) → Promise<string>` (nombre `<uuid>.jpg`; rota según EXIF, lado mayor ≤ 1600, JPEG calidad 80, sin metadatos).
  - `guardarFotoOficial(id, buffer, ctx) → Participante (COMPLETO)`: fija `foto_oficial_path`, `foto_oficial_at`; si estado es `INSCRITO`/`AUSENTE` → `PRESENTE`, `llegada_at` (si vacío) y `orden_pasarela` (si vacío: máximo de la categoría + 1). Emite `foto:nueva` y `participante:actualizado`.
  - `crearAppTrk({ estaticos = false })` sirve `/uploads/trk/fotos` desde `dirFotos()` cuando `estaticos` es `true`.

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/routes/__tests__/participantes.foto.int.test.js`:

```js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const request = require('supertest');
const { bus } = require('../../sockets/bus');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearOperativo, crearParticipante } = require('../../testing/fabricas');
const { dirFotos } = require('../../services/fotos.service');

const app = crearAppTrk({ estaticos: true });
let cabina; let eventos;
const escuchar = (e) => eventos.push(e.evento);

beforeEach(async () => {
  await limpiar();
  cabina = await crearOperativo('TRK_CABINA');
  eventos = [];
  bus.on('trk', escuchar);
});
afterEach(() => bus.off('trk', escuchar));
afterAll(cerrar);

const imagen = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#E8711A' } })
  .withMetadata({ exif: { IFD0: { Make: 'CamaraFicticia' } } })
  .jpeg()
  .toBuffer();

const subir = (id, buffer, nombre = 'foto.jpg') => request(app)
  .post(`/api/trk/v1/participantes/${id}/foto`)
  .set('Authorization', `Bearer ${cabina.token}`)
  .attach('foto', buffer, nombre);

test('TRK-PAR-005 guarda foto con UUID, ≤1600 px, sin EXIF, y marca PRESENTE con orden de llegada', async () => {
  await crearParticipante({ estado: 'PRESENTE', orden_pasarela: 4 });
  const p = await crearParticipante({ estado: 'INSCRITO' });
  const r = await subir(p.id, await imagen(2400, 3000));
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-PAR-005');
  expect(r.body.data).toMatchObject({ estado: 'PRESENTE', orden_pasarela: 5 });
  expect(r.body.data.llegada_at).toEqual(expect.any(String));
  expect(r.body.data.foto_url).toMatch(/^\/uploads\/trk\/fotos\/[0-9a-f-]{36}\.jpg$/);

  const archivo = path.join(dirFotos(), path.basename(r.body.data.foto_url));
  const meta = await sharp(fs.readFileSync(archivo)).metadata();
  expect(Math.max(meta.width, meta.height)).toBe(1600);
  expect(meta.exif).toBeUndefined();
  expect(eventos).toEqual(expect.arrayContaining(['foto:nueva', 'participante:actualizado']));

  const estatico = await request(app).get(r.body.data.foto_url);
  expect(estatico.status).toBe(200);
});

test('repetir la foto no cambia el estado de quien ya está en pasarela', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA', foto_oficial_path: 'vieja.jpg' });
  const r = await subir(p.id, await imagen(800, 1000));
  expect(r.body.data.estado).toBe('EN_PASARELA');
  expect(r.body.data.foto_url).not.toContain('vieja.jpg');
});

test('archivo que no es imagen → 400', async () => {
  const p = await crearParticipante();
  const r = await subir(p.id, Buffer.from('no soy imagen'), 'x.txt');
  expect(r.status).toBe(400);
  expect(r.body.motivo).toBe('VALIDACION');
});

test('sin archivo → 400', async () => {
  const p = await crearParticipante();
  const r = await request(app).post(`/api/trk/v1/participantes/${p.id}/foto`).set('Authorization', `Bearer ${cabina.token}`);
  expect(r.status).toBe(400);
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/participantes.foto.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BACK:src/trk/services/fotos.service.js`:

```js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const TrkError = require('../utils/TrkError');

const LADO_MAXIMO = 1600;

const dirFotos = () => process.env.TRK_FOTOS_PATH || path.join(process.cwd(), 'uploads', 'trk', 'fotos');

// Normaliza en servidor aunque el cliente ya comprima: orientación, tamaño, sin EXIF/GPS (RNF-5).
async function procesarYGuardarFoto(buffer) {
  const dir = dirFotos();
  fs.mkdirSync(dir, { recursive: true });
  const nombre = `${crypto.randomUUID()}.jpg`;
  try {
    await sharp(buffer)
      .rotate()
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(dir, nombre));
  } catch (e) {
    throw new TrkError(400, 'VALIDACION', 'La imagen no se pudo procesar');
  }
  return nombre;
}

module.exports = { dirFotos, procesarYGuardarFoto };
```

Agregar a `BACK:src/trk/services/participantes.service.js` (y exportar `guardarFotoOficial`):

```js
const { procesarYGuardarFoto } = require('./fotos.service');

async function guardarFotoOficial(id, buffer, ctx) {
  const nombre = await procesarYGuardarFoto(buffer);
  const p = await db.sequelize.transaction(async (transaction) => {
    const participante = await buscarModelo(id, { transaction, lock: true });
    const cambios = { foto_oficial_path: nombre, foto_oficial_at: new Date() };
    if (['INSCRITO', 'AUSENTE'].includes(participante.estado)) {
      cambios.estado = 'PRESENTE';
      if (!participante.llegada_at) cambios.llegada_at = new Date();
      if (participante.orden_pasarela == null) {
        const maximo = await db.TrkParticipante.max('orden_pasarela', { where: { categoria_id: participante.categoria_id }, transaction });
        cambios.orden_pasarela = (maximo || 0) + 1;
      }
    }
    await participante.update(cambios, { transaction });
    await registrarAuditoria(ctx, { entidad: 'participante', entidadId: participante.id, accion: 'FOTO_OFICIAL', despues: { foto_oficial_path: nombre, estado: participante.estado } }, { transaction });
    return participante;
  });
  const plano = p.get({ plain: true });
  emitir('foto:nueva', { participante: plano });
  emitir('participante:actualizado', { participante: plano });
  return recargarCompleto(p);
}
```

Agregar a `BACK:src/trk/controllers/participantes.controller.js`:

```js
const TrkError = require('../utils/TrkError');

exports.subirFoto = async (req, res) => {
  if (!req.file) throw new TrkError(400, 'VALIDACION', 'Adjunta la foto en el campo "foto"');
  ok(res, await svc.guardarFotoOficial(req.params.id, req.file.buffer, ctxDe(req)));
};
```

Agregar a `BACK:src/trk/routes/participantes.routes.js` (importar `multer` y `TrkError`):

```js
const subidaFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const valido = /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype);
    cb(valido ? null : new TrkError(400, 'VALIDACION', 'Solo se permiten imágenes JPG, PNG, WEBP o HEIC'), valido);
  }
});

router.post('/:id/foto', apiCodigo('TRK-PAR-005'), trkAuth, trkPermiso('cabina'), validar(esquemaId, 'params'), subidaFoto.single('foto'), aw(ctrl.subirFoto));
```

En `BACK:src/trk/config/apiCodigos.js` agregar:
`'TRK-PAR-005': { metodo: 'POST', ruta: '/participantes/:id/foto', descripcion: 'Sube foto oficial y marca PRESENTE' },`

Reemplazar `BACK:src/trk/testing/app.js`:

```js
// App Express mínima con solo el router TRK, para Supertest y E2E.
const express = require('express');
const { dirFotos } = require('../services/fotos.service');

function crearAppTrk({ estaticos = false } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  if (estaticos) app.use('/uploads/trk/fotos', express.static(dirFotos()));
  app.use('/api/trk/v1', require('../routes').router);
  return app;
}

module.exports = { crearAppTrk };
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): foto oficial con UUID, normalizacion en servidor y estado PRESENTE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3.4: Utilidades de imagen y componente de foto con respaldo

Cubre: HU-5 CA3 (recorte 4:5, compresión en cliente ≤1600 px, JPEG ~0.8, objetivo < 500 KB), CA5 (foto oficial → inscripción → avatar por especie/familia).

**Files:**
- Create: `FRONT:src/utils/imagen.js`, `FRONT:src/components/AvatarEspecie.vue`, `FRONT:src/components/FotoMascota.vue`
- Test: `FRONT:src/utils/__tests__/imagen.spec.js`, `FRONT:src/components/__tests__/FotoMascota.spec.js`

**Interfaces:**
- Produces:
  - `calcularRecorte45(ancho, alto) → { sx, sy, sw, sh }` (recorte centrado 4:5).
  - `dimensionesDestino(sw, sh, ladoMax = 1600) → { ancho, alto }`.
  - `comprimirImagen(archivo, { ladoMax = 1600, calidad = 0.8, objetivoBytes = 500 * 1024, calidadMinima = 0.5 }) → Promise<Blob>` (usa `createImageBitmap` + `<canvas>`; baja calidad de 0.1 en 0.1 hasta cumplir el objetivo o la mínima).
  - `<FotoMascota :participante="p" :clase="'...'" />`; `<AvatarEspecie :tipo="'perro' | 'gato' | 'familia'" />`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/utils/__tests__/imagen.spec.js`:

```js
import { test, expect } from 'vitest'
import { calcularRecorte45, dimensionesDestino } from '@/utils/imagen'

test('recorte 4:5 centrado de una foto horizontal', () => {
  expect(calcularRecorte45(4000, 3000)).toEqual({ sx: 800, sy: 0, sw: 2400, sh: 3000 })
})

test('recorte 4:5 centrado de una foto muy vertical', () => {
  expect(calcularRecorte45(1000, 2000)).toEqual({ sx: 0, sy: 375, sw: 1000, sh: 1250 })
})

test('una foto ya 4:5 no se recorta', () => {
  expect(calcularRecorte45(800, 1000)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 1000 })
})

test('lado mayor ≤ 1600 sin agrandar', () => {
  expect(dimensionesDestino(2400, 3000)).toEqual({ ancho: 1280, alto: 1600 })
  expect(dimensionesDestino(400, 500)).toEqual({ ancho: 400, alto: 500 })
})
```

`FRONT:src/components/__tests__/FotoMascota.spec.js`:

```js
import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FotoMascota from '@/components/FotoMascota.vue'

const base = { mascota_nombre: 'Canela', especie: 'PERRO', categoria: { codigo: 'PEQ_MED' } }

test('usa la foto oficial si existe', () => {
  const w = mount(FotoMascota, { props: { participante: { ...base, foto_url: '/uploads/trk/fotos/a.jpg', foto_inscripcion_url: 'https://x/y.jpg' } } })
  expect(w.get('img').attributes('src')).toBe('/uploads/trk/fotos/a.jpg')
  expect(w.get('img').attributes('alt')).toBe('Canela')
})

test('si no hay oficial usa la de inscripción; si falla, avatar', async () => {
  const w = mount(FotoMascota, { props: { participante: { ...base, foto_url: null, foto_inscripcion_url: 'https://x/y.jpg' } } })
  expect(w.get('img').attributes('src')).toBe('https://x/y.jpg')
  await w.get('img').trigger('error')
  expect(w.find('img').exists()).toBe(false)
  expect(w.get('[data-test="avatar"]').attributes('data-tipo')).toBe('perro')
})

test('avatar de gato y de familia', () => {
  const gato = mount(FotoMascota, { props: { participante: { ...base, especie: 'GATO', foto_url: null } } })
  expect(gato.get('[data-test="avatar"]').attributes('data-tipo')).toBe('gato')
  const familia = mount(FotoMascota, { props: { participante: { ...base, categoria: { codigo: 'FAMILIAR' }, foto_url: null } } })
  expect(familia.get('[data-test="avatar"]').attributes('data-tipo')).toBe('familia')
})
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd FRONT && npx vitest run src/utils src/components`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/utils/imagen.js`:

```js
// HU-5 CA3: recorte 4:5, lado mayor ≤ 1600 px, JPEG ~0.8, objetivo < 500 KB.
const RELACION = 4 / 5

export function calcularRecorte45(ancho, alto) {
  if (ancho / alto > RELACION) {
    const sw = Math.round(alto * RELACION)
    return { sx: Math.round((ancho - sw) / 2), sy: 0, sw, sh: alto }
  }
  const sh = Math.round(ancho / RELACION)
  return { sx: 0, sy: Math.round((alto - sh) / 2), sw: ancho, sh }
}

export function dimensionesDestino(sw, sh, ladoMax = 1600) {
  const escala = Math.min(1, ladoMax / Math.max(sw, sh))
  return { ancho: Math.round(sw * escala), alto: Math.round(sh * escala) }
}

const aBlob = (canvas, calidad) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/jpeg', calidad)
})

export async function comprimirImagen(archivo, { ladoMax = 1600, calidad = 0.8, objetivoBytes = 500 * 1024, calidadMinima = 0.5 } = {}) {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  const { sx, sy, sw, sh } = calcularRecorte45(bitmap.width, bitmap.height)
  const { ancho, alto } = dimensionesDestino(sw, sh, ladoMax)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, ancho, alto)
  if (bitmap.close) bitmap.close()

  let q = calidad
  let blob = await aBlob(canvas, q)
  while (blob.size > objetivoBytes && q - 0.1 >= calidadMinima - 1e-9) {
    q = Math.round((q - 0.1) * 10) / 10
    blob = await aBlob(canvas, q)
  }
  return blob
}
```

`FRONT:src/components/AvatarEspecie.vue`:

```vue
<script setup>
defineProps({ tipo: { type: String, default: 'perro' } })
</script>

<template>
  <div data-test="avatar" :data-tipo="tipo" class="flex h-full w-full items-center justify-center bg-morado-100 text-morado-700" role="img" :aria-label="`Avatar de ${tipo}`">
    <svg v-if="tipo === 'gato'" viewBox="0 0 64 64" class="h-1/2 w-1/2" fill="currentColor"><path d="M12 8l10 12h20L52 8v30c0 11-9 18-20 18S12 49 12 38z"/><circle cx="24" cy="34" r="3" fill="#fff"/><circle cx="40" cy="34" r="3" fill="#fff"/></svg>
    <svg v-else-if="tipo === 'familia'" viewBox="0 0 64 64" class="h-1/2 w-1/2" fill="currentColor"><circle cx="20" cy="16" r="7"/><circle cx="44" cy="16" r="7"/><path d="M8 44c0-9 5-16 12-16s12 7 12 16zM32 44c0-9 5-16 12-16s12 7 12 16z"/><circle cx="32" cy="50" r="7"/></svg>
    <svg v-else viewBox="0 0 64 64" class="h-1/2 w-1/2" fill="currentColor"><path d="M14 14l8 6h20l8-6 4 18c0 14-10 24-22 24S10 46 10 32z"/><circle cx="24" cy="32" r="3" fill="#fff"/><circle cx="40" cy="32" r="3" fill="#fff"/><ellipse cx="32" cy="42" rx="5" ry="3" fill="#fff"/></svg>
  </div>
</template>
```

`FRONT:src/components/FotoMascota.vue`:

```vue
<script setup>
import { ref, computed, watch } from 'vue'
import AvatarEspecie from './AvatarEspecie.vue'

const props = defineProps({
  participante: { type: Object, required: true },
  clase: { type: String, default: 'aspect-[4/5] w-full rounded-2xl' }
})

const fallidas = ref(new Set())
watch(() => props.participante && props.participante.id, () => { fallidas.value = new Set() })

const fuente = computed(() => {
  const p = props.participante || {}
  return [p.foto_url, p.foto_inscripcion_url].find((u) => u && !fallidas.value.has(u)) || null
})

const tipoAvatar = computed(() => {
  const p = props.participante || {}
  if (p.categoria && p.categoria.codigo === 'FAMILIAR') return 'familia'
  return p.especie === 'GATO' ? 'gato' : 'perro'
})

function alFallar() {
  fallidas.value = new Set([...fallidas.value, fuente.value])
}
</script>

<template>
  <div :class="['overflow-hidden bg-morado-50', clase]">
    <img v-if="fuente" :src="fuente" :alt="participante.mascota_nombre" class="h-full w-full object-cover" loading="lazy" @error="alFallar" />
    <AvatarEspecie v-else :tipo="tipoAvatar" />
  </div>
</template>
```

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): recorte 4:5 y compresion de fotos; foto de mascota con respaldo por especie

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3.5: Pantalla de cabina

Cubre: HU-5 CA1–CA6, §10 `/cabina`, RNF-1.

**Files:**
- Create: `FRONT:src/views/CabinaView.vue`, `FRONT:src/components/EstadoChip.vue`
- Modify: `FRONT:src/router/index.js` (ruta `/cabina`, `meta.permiso: 'cabina'`)
- Test: `FRONT:src/views/__tests__/CabinaView.spec.js`

**Interfaces:**
- Consumes: `TRK-PAR-001/003/004/005/008`, `TRK-CAT-005`, `comprimirImagen` (3.4), `FotoMascota` (3.4), `useCategoriasStore` (2.4), `BarraSuperior` (1.9).
- Produces: `<EstadoChip :estado="'PRESENTE'" />` (texto en español y color por estado).

- [ ] **Step 1: Escribir la prueba que falla**

`FRONT:src/views/__tests__/CabinaView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({
  api: {},
  trk: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  tokenStorage: { leer: () => null, guardar: () => {} }
}))
vi.mock('@/utils/imagen', () => ({ comprimirImagen: vi.fn(async () => new Blob(['jpg'], { type: 'image/jpeg' })) }))

import { trk } from '@/services/api'
import { comprimirImagen } from '@/utils/imagen'
import CabinaView from '@/views/CabinaView.vue'

const CATEGORIAS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Caninos pequeños y medianos' }, { id: 3, codigo: 'FELINOS', nombre: 'Felinos' }]
const canela = { id: 'p1', mascota_nombre: 'Canela', responsable_nombre: 'Laura Gómez', responsable_telefono: '3001112233', estado: 'INSCRITO', categoria_id: 1, categoria: CATEGORIAS[0], especie: 'PERRO', disfraz_nombre: 'Bruja', foto_url: null }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) // flushPromises usa setImmediate
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATEGORIAS }
    return { data: [canela] }
  })
})

async function buscarYAbrir(w) {
  await w.get('[data-test="buscar"]').setValue('canela')
  vi.advanceTimersByTime(350)
  await flushPromises()
  await w.get('[data-test="participante-p1"]').trigger('click')
  await flushPromises()
}

test('busca con espera y muestra resultados', async () => {
  const w = mount(CabinaView)
  await flushPromises()
  await w.get('[data-test="buscar"]').setValue('canela')
  vi.advanceTimersByTime(350)
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/participantes', { params: { q: 'canela' } })
  expect(w.text()).toContain('Canela')
})

test('botón Tomar foto usa la cámara trasera y hay opción de galería (CA2)', async () => {
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  const camara = w.get('[data-test="input-camara"]')
  expect(camara.attributes('accept')).toBe('image/*')
  expect(camara.attributes('capture')).toBe('environment')
  expect(w.get('[data-test="input-galeria"]').attributes('capture')).toBeUndefined()
})

test('toma foto: comprime, sube con progreso y queda PRESENTE (CA3, CA4)', async () => {
  trk.post.mockImplementation(async (url, form, config) => {
    config.onUploadProgress({ loaded: 50, total: 100 })
    return { data: { ...canela, estado: 'PRESENTE', foto_url: '/uploads/trk/fotos/n.jpg' } }
  })
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  const input = w.get('[data-test="input-camara"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['raw'], 'f.jpg', { type: 'image/jpeg' })] })
  await input.trigger('change')
  await flushPromises()
  expect(comprimirImagen).toHaveBeenCalled()
  expect(trk.post).toHaveBeenCalledWith('/participantes/p1/foto', expect.any(FormData), expect.objectContaining({ onUploadProgress: expect.any(Function) }))
  expect(w.text()).toContain('Presente')
  expect(w.get('[data-test="repetir"]').exists()).toBe(true)
})

test('editar disfraz y categoría; avisa si queda como propuesta', async () => {
  trk.patch.mockResolvedValue({ data: { participante: { ...canela, disfraz_nombre: 'Hada', categoria_propuesta_id: 3 }, requiere_confirmacion: true } })
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  await w.get('[data-test="disfraz"]').setValue('Hada')
  await w.get('[data-test="categoria"]').setValue('3')
  await w.get('[data-test="guardar-datos"]').trigger('submit')
  await flushPromises()
  expect(trk.patch).toHaveBeenCalledWith('/participantes/p1', { disfraz_nombre: 'Hada', categoria_id: 3 })
  expect(w.text()).toContain('El administrador debe confirmar el cambio de categoría')
})

test('alta de último minuto (CA6)', async () => {
  trk.post.mockResolvedValue({ data: { ...canela, id: 'p9', mascota_nombre: 'Pelusa' } })
  const w = mount(CabinaView)
  await flushPromises()
  await w.get('[data-test="abrir-alta"]').trigger('click')
  await w.get('[data-test="alta-responsable"]').setValue('Nora Díaz')
  await w.get('[data-test="alta-telefono"]').setValue('3009998877')
  await w.get('[data-test="alta-mascota"]').setValue('Pelusa')
  await w.get('[data-test="alta-especie"]').setValue('GATO')
  await w.get('[data-test="alta-categoria"]').setValue('3')
  await w.get('[data-test="form-alta"]').trigger('submit')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/participantes', { responsable_nombre: 'Nora Díaz', responsable_telefono: '3009998877', mascota_nombre: 'Pelusa', especie: 'GATO', categoria_id: 3 })
  expect(w.text()).toContain('Pelusa')
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd FRONT && npx vitest run src/views/__tests__/CabinaView.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/components/EstadoChip.vue`:

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({ estado: { type: String, required: true } })
const ESTILOS = {
  INSCRITO: ['Inscrito', 'bg-gray-200 text-gray-800'],
  PRESENTE: ['Presente', 'bg-green-100 text-green-900'],
  EN_PASARELA: ['En pasarela', 'bg-calabaza-700 text-white'],
  PRESENTADO: ['Presentado', 'bg-morado-100 text-morado-900'],
  AUSENTE: ['Ausente', 'bg-red-100 text-red-900']
}
const estilo = computed(() => ESTILOS[props.estado] || [props.estado, 'bg-gray-200'])
</script>

<template>
  <span :class="['inline-block rounded-full px-3 py-1 text-sm font-semibold', estilo[1]]">{{ estilo[0] }}</span>
</template>
```

`FRONT:src/views/CabinaView.vue`:

```vue
<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { trk } from '@/services/api'
import { comprimirImagen } from '@/utils/imagen'
import { mensajeDeError } from '@/utils/errores'
import { useCategoriasStore } from '@/stores/categorias'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FotoMascota from '@/components/FotoMascota.vue'
import EstadoChip from '@/components/EstadoChip.vue'

const categorias = useCategoriasStore()
const texto = ref('')
const resultados = ref([])
const actual = ref(null)
const datos = reactive({ disfraz_nombre: '', categoria_id: null })
const progreso = ref(null)
const aviso = ref('')
const error = ref('')
const mostrandoAlta = ref(false)
const alta = reactive({ responsable_nombre: '', responsable_telefono: '', mascota_nombre: '', especie: 'PERRO', categoria_id: null })
let espera = null

async function buscar() {
  error.value = ''
  try {
    const params = texto.value.trim() ? { q: texto.value.trim() } : {}
    resultados.value = (await trk.get('/participantes', { params })).data
  } catch (e) { error.value = mensajeDeError(e) }
}

function alEscribir() {
  clearTimeout(espera)
  espera = setTimeout(buscar, 300)
}

function abrir(p) {
  actual.value = p
  datos.disfraz_nombre = p.disfraz_nombre || ''
  datos.categoria_id = p.categoria_id
  aviso.value = ''
  progreso.value = null
}

function reemplazar(p) {
  actual.value = p
  const i = resultados.value.findIndex((r) => r.id === p.id)
  if (i >= 0) resultados.value[i] = p
  else resultados.value.unshift(p)
}

async function subirFoto(evento) {
  const archivo = evento.target.files && evento.target.files[0]
  evento.target.value = ''
  if (!archivo || !actual.value) return
  error.value = ''
  progreso.value = 0
  try {
    const blob = await comprimirImagen(archivo)
    const form = new FormData()
    form.append('foto', blob, 'foto.jpg')
    const { data } = await trk.post(`/participantes/${actual.value.id}/foto`, form, {
      onUploadProgress: (e) => { progreso.value = e.total ? Math.round((e.loaded / e.total) * 100) : null }
    })
    reemplazar(data)
    progreso.value = 100
  } catch (e) {
    error.value = mensajeDeError(e)
    progreso.value = null
  }
}

async function guardarDatos() {
  error.value = ''
  const cambios = {}
  if (datos.disfraz_nombre !== (actual.value.disfraz_nombre || '')) cambios.disfraz_nombre = datos.disfraz_nombre
  if (Number(datos.categoria_id) !== actual.value.categoria_id) cambios.categoria_id = Number(datos.categoria_id)
  if (!Object.keys(cambios).length) return
  try {
    const { data } = await trk.patch(`/participantes/${actual.value.id}`, cambios)
    reemplazar(data.participante)
    aviso.value = data.requiere_confirmacion ? 'El administrador debe confirmar el cambio de categoría porque ya hay calificaciones.' : 'Datos guardados.'
  } catch (e) { error.value = mensajeDeError(e) }
}

async function alternarAusente() {
  const estado = actual.value.estado === 'AUSENTE' ? 'INSCRITO' : 'AUSENTE'
  try { reemplazar((await trk.patch(`/participantes/${actual.value.id}/estado`, { estado })).data) } catch (e) { error.value = mensajeDeError(e) }
}

async function crearAlta() {
  error.value = ''
  try {
    const { data } = await trk.post('/participantes', { ...alta, categoria_id: Number(alta.categoria_id) })
    mostrandoAlta.value = false
    Object.assign(alta, { responsable_nombre: '', responsable_telefono: '', mascota_nombre: '', especie: 'PERRO', categoria_id: null })
    reemplazar(data)
    abrir(data)
  } catch (e) { error.value = mensajeDeError(e) }
}

onMounted(async () => {
  try { await categorias.cargar() } catch (e) { error.value = mensajeDeError(e) }
})
onBeforeUnmount(() => clearTimeout(espera))
</script>

<template>
  <div class="min-h-screen pb-8">
    <BarraSuperior titulo="Cabina de recepción" />
    <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>

      <div class="flex gap-2">
        <input v-model="texto" data-test="buscar" class="campo flex-1" type="search" placeholder="Mascota, responsable o últimos dígitos del documento" @input="alEscribir" />
        <button class="btn-secundario" data-test="abrir-alta" @click="mostrandoAlta = !mostrandoAlta">+ Agregar</button>
      </div>

      <form v-if="mostrandoAlta" data-test="form-alta" class="tarjeta flex flex-col gap-3" @submit.prevent="crearAlta">
        <h2 class="text-lg font-bold">Inscripción de último minuto</h2>
        <input v-model="alta.responsable_nombre" data-test="alta-responsable" class="campo" placeholder="Nombre del responsable" required />
        <input v-model="alta.responsable_telefono" data-test="alta-telefono" class="campo" inputmode="tel" placeholder="Teléfono (10 dígitos)" required pattern="\d{7,10}" />
        <input v-model="alta.mascota_nombre" data-test="alta-mascota" class="campo" placeholder="Nombre de la mascota" required />
        <select v-model="alta.especie" data-test="alta-especie" class="campo"><option value="PERRO">Perro</option><option value="GATO">Gato</option></select>
        <select v-model="alta.categoria_id" data-test="alta-categoria" class="campo" required>
          <option :value="null" disabled>Categoría</option>
          <option v-for="c in categorias.lista" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
        <button class="btn-primario" type="submit">Inscribir</button>
      </form>

      <section v-if="actual" class="tarjeta flex flex-col gap-3" aria-label="Ficha del participante">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h2 class="text-2xl font-bold">{{ actual.mascota_nombre }}</h2>
            <p class="text-morado-700">{{ actual.responsable_nombre }} · {{ actual.responsable_telefono }}</p>
          </div>
          <EstadoChip :estado="actual.estado" />
        </div>
        <FotoMascota :participante="actual" />

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label class="btn-primario min-h-[56px] text-lg">
            📷 {{ actual.foto_url ? 'Repetir foto' : 'Tomar foto' }}
            <input data-test="input-camara" class="sr-only" type="file" accept="image/*" capture="environment" @change="subirFoto" />
          </label>
          <label class="btn-claro min-h-[56px]">
            🖼️ Elegir de galería
            <input data-test="input-galeria" class="sr-only" type="file" accept="image/*" @change="subirFoto" />
          </label>
        </div>
        <div v-if="progreso !== null" class="h-3 w-full overflow-hidden rounded-full bg-morado-100" role="progressbar" :aria-valuenow="progreso">
          <div class="h-full bg-calabaza-600 transition-all" :style="{ width: `${progreso}%` }" />
        </div>
        <span v-if="progreso === 100" data-test="repetir" class="text-sm text-green-800">Foto guardada. Puedes repetirla si no quedó bien.</span>

        <form data-test="guardar-datos" class="flex flex-col gap-2" @submit.prevent="guardarDatos">
          <label class="flex flex-col gap-1"><span class="font-semibold">Nombre del disfraz</span>
            <input v-model="datos.disfraz_nombre" data-test="disfraz" class="campo" />
          </label>
          <label class="flex flex-col gap-1"><span class="font-semibold">Categoría</span>
            <select v-model="datos.categoria_id" data-test="categoria" class="campo">
              <option v-for="c in categorias.lista" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </label>
          <button class="btn-secundario" type="submit">Guardar datos</button>
        </form>
        <p v-if="aviso" class="rounded-xl bg-calabaza-50 p-3 text-calabaza-900" role="status">{{ aviso }}</p>

        <button v-if="['INSCRITO', 'AUSENTE'].includes(actual.estado)" class="btn-claro" @click="alternarAusente">
          {{ actual.estado === 'AUSENTE' ? 'Quitar marca de ausente' : 'Marcar como ausente' }}
        </button>
      </section>

      <ul class="flex flex-col gap-2">
        <li v-for="p in resultados" :key="p.id">
          <button :data-test="`participante-${p.id}`" class="tarjeta flex w-full items-center gap-3 text-left" @click="abrir(p)">
            <FotoMascota :participante="p" clase="h-16 w-14 shrink-0 rounded-xl" />
            <span class="flex-1">
              <span class="block font-semibold">{{ p.mascota_nombre }}</span>
              <span class="block text-sm text-morado-600">{{ p.responsable_nombre }} · {{ p.categoria && p.categoria.nombre }}</span>
            </span>
            <EstadoChip :estado="p.estado" />
          </button>
        </li>
      </ul>
    </main>
  </div>
</template>
```

En `FRONT:src/router/index.js` agregar a `routes`:
`{ path: '/cabina', component: () => import('@/views/CabinaView.vue'), meta: { permiso: 'cabina' } },`

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): cabina con busqueda, foto con camara trasera, edicion y alta rapida (HU-5)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3.6: E2E: infraestructura Playwright y flujo de cabina a 360 px

Cubre: §12 Fase 3 ("flujo e2e en móvil emulado"), RNF-1.

**Files:**
- Create: `BACK:src/trk/testing/semillaE2E.js`, `BACK:src/trk/scripts/e2e-servidor.js`, `FRONT:playwright.config.js`, `FRONT:e2e/utilidades.js`, `FRONT:e2e/cabina.spec.js`
- Modify: `FRONT:.gitignore` (ya ignora `playwright-report/`, `test-results/`)

**Interfaces:**
- Produces:
  - Servidor E2E en `http://localhost:3021` (BD `serfuweb_e2e_test`, recreada al iniciar) con usuarios: `Cabina E2E` (PIN `111111`), `Comentarista E2E` (`222222`), `Jurado E2E 1/2/3` (`333331`, `333332`, `333333`) y participantes `Canela` (PEQ_MED, INSCRITO), `Rocky` (PEQ_MED, INSCRITO), `Misifú` (FELINOS, INSCRITO).
  - `e2e/utilidades.js`: `nuevoContexto(browser)`, `entrarConPin(page, nombreUsuario, pin)`, `imagenDePrueba(page) → Buffer`, `sinScrollHorizontal(page) → Promise<boolean>`.

- [ ] **Step 1: Servidor E2E (backend)**

`BACK:src/trk/testing/semillaE2E.js`:

```js
// Datos ficticios para Playwright.
const db = require('../../models');
const { crearOperativo, crearParticipante } = require('./fabricas');

async function semillaE2E() {
  await crearOperativo('TRK_CABINA', { nombre: 'Cabina E2E', pin: '111111' });
  await crearOperativo('TRK_COMENTARISTA', { nombre: 'Comentarista E2E', pin: '222222' });
  for (const n of [1, 2, 3]) await crearOperativo('TRK_JURADO', { nombre: `Jurado E2E ${n}`, pin: `33333${n}` });
  await crearParticipante({ mascota_nombre: 'Canela', estado: 'INSCRITO', responsable_nombre: 'Laura Gómez', responsable_documento: '1001' });
  await crearParticipante({ mascota_nombre: 'Rocky', estado: 'INSCRITO', responsable_nombre: 'Pedro Alba', responsable_documento: '1002' });
  await crearParticipante({ mascota_nombre: 'Misifú', estado: 'INSCRITO', categoriaCodigo: 'FELINOS', especie: 'GATO', responsable_nombre: 'Sofía Mar', responsable_documento: '1003' });
  return { participantes: await db.TrkParticipante.count() };
}

module.exports = { semillaE2E };
```

`BACK:src/trk/scripts/e2e-servidor.js`:

```js
/**
 * Servidor para pruebas E2E (Playwright). Recrea la BD serfuweb_e2e_test, siembra datos
 * ficticios y sirve /api/trk/v1 + fotos en TRK_E2E_PORT (3021).
 * Requiere MySQL de prueba: npm run trk:db:test
 */
process.env.DB_NAME = process.env.DB_NAME || 'serfuweb_e2e_test';
require('../testing/env');
const http = require('http');

(async () => {
  await require('../testing/globalSetup')();
  const { semillaE2E } = require('../testing/semillaE2E');
  const { crearAppTrk } = require('../testing/app');
  await semillaE2E();
  const server = http.createServer(crearAppTrk({ estaticos: true }));
  const puerto = Number(process.env.TRK_E2E_PORT || 3021);
  server.listen(puerto, () => console.log(`TRK E2E escuchando en ${puerto}`));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Config de Playwright (frontend)**

`FRONT:playwright.config.js`:

```js
import { defineConfig, devices } from '@playwright/test'

const BACK = process.env.TRK_BACKEND_DIR || '../mantix-git'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 800 },
    baseURL: 'http://localhost:5174/trikipeludos/',
    testIdAttribute: 'data-test',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'node src/trk/scripts/e2e-servidor.js',
      cwd: BACK,
      url: 'http://localhost:3021/api/trk/v1/auth/usuarios-pin',
      timeout: 120_000,
      reuseExistingServer: false
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174/trikipeludos/',
      env: { VITE_PROXY_TARGET: 'http://localhost:3021' },
      timeout: 60_000,
      reuseExistingServer: false
    }
  ]
})
```

`FRONT:e2e/utilidades.js`:

```js
import { test, expect } from '@playwright/test'

// browser.newContext() no hereda `use` del proyecto: se pasan baseURL y emulación móvil explícitas.
export function nuevoContexto(browser) {
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use
  return browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch })
}

export async function entrarConPin(page, nombreUsuario, pin) {
  await page.goto('login')
  await page.getByRole('button', { name: new RegExp(nombreUsuario) }).click()
  await page.getByTestId('pin').fill(pin)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/login/)
}

// JPEG generado en el navegador (no se versionan binarios)
export async function imagenDePrueba(page, ancho = 1200, alto = 900) {
  const bytes = await page.evaluate(async ({ ancho, alto }) => {
    const c = document.createElement('canvas')
    c.width = ancho
    c.height = alto
    const g = c.getContext('2d')
    g.fillStyle = '#E8711A'
    g.fillRect(0, 0, ancho, alto)
    g.fillStyle = '#47206A'
    g.fillRect(ancho / 4, alto / 4, ancho / 2, alto / 2)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  }, { ancho, alto })
  return Buffer.from(bytes)
}

export const sinScrollHorizontal = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
```


- [ ] **Step 3: Escribir la prueba E2E**

`FRONT:e2e/cabina.spec.js`:

```js
import { test, expect } from '@playwright/test'
import { entrarConPin, imagenDePrueba, sinScrollHorizontal } from './utilidades'

test('cabina: buscar sin tildes, tomar foto y dejar PRESENTE a 360 px', async ({ page }) => {
  await entrarConPin(page, 'Cabina E2E', '111111')
  await expect(page).toHaveURL(/cabina/)
  expect(await sinScrollHorizontal(page)).toBe(true)

  await page.getByTestId('buscar').fill('misifu')
  await page.getByRole('button', { name: /Misifú/ }).click()
  await expect(page.getByText('Inscrito').first()).toBeVisible()

  await page.getByTestId('input-camara').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: await imagenDePrueba(page) })
  await expect(page.getByTestId('repetir')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Ficha del participante').getByText('Presente')).toBeVisible()
  await expect(page.getByLabel('Ficha del participante').locator('img')).toHaveAttribute('src', /\/uploads\/trk\/fotos\/.+\.jpg/)
  expect(await sinScrollHorizontal(page)).toBe(true)
})
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npm run trk:db:test && cd ../peludos && npx playwright install chromium && npx playwright test e2e/cabina.spec.js`
Expected: PASS (1 prueba). Si falla por tiempos de arranque, revisar `npx playwright test --debug`, no subir timeouts a ciegas.

- [ ] **Step 5: Commit** (dos repos)

```bash
cd BACK
git add src/trk
git commit -m "test(trk): servidor y semilla para pruebas E2E

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd ../peludos
git add playwright.config.js e2e
git commit -m "test(front): E2E de cabina a 360 px con Playwright

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Cierre de Fase 3

- [ ] Run: suite completa + `cd FRONT && npx playwright test`. Reportar al usuario y esperar aprobación.

---
## Fase 4 — Comentarista, pasarela, Socket.IO y pantalla pública (modo pasarela)

**Hecho cuando:** el cambio de pasarela es visible en < 2 s en 3 clientes (E2E) y §13.8 (sockets) y §13.14 pasan.

### Task 4.1: Servicio de pasarela, orden de cola y estado público del evento

Cubre: HU-7 CA1, CA3; §4 (una sola `EN_PASARELA`); §9.1 `TRK-PAS-001/002`, `TRK-EVT-001`; §13.14.

**Files:**
- Create: `BACK:src/trk/services/pasarela.service.js`, `BACK:src/trk/services/evento.service.js` (`estadoPublico` en esta tarea), `BACK:src/trk/controllers/pasarela.controller.js`, `BACK:src/trk/controllers/evento.controller.js`, `BACK:src/trk/routes/pasarela.routes.js`, `BACK:src/trk/routes/evento.routes.js`
- Modify: `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/routes/__tests__/pasarela.int.test.js`

**Interfaces:**
- Consumes: `buscarModelo`, `listar`, `INCLUIR_CATEGORIA` (3.1); `emitir` (3.2); `registrarAuditoria`; `nivelDatos`; `serializarParticipante`.
- Produces:
  - `llamarAPasarela(id, ctx) → Participante` (serializado por `nivelDatos(ctx.usuario)`); emite `pasarela:cambio` con `{ participante, anteriores: string[] }`.
  - `reordenarCola({ categoria_id, orden: string[] }, ctx) → Participante[]` (cola de la categoría); emite `participante:actualizado` con `{ categoria_id, orden }` a `admin`, `cabina`, `comentarista`.
  - `estadoPublico() → { modo_pantalla, categoria_pantalla: { id, codigo, nombre } | null, en_pasarela: Participante(PUBLICO) | null, ranking: null }` (la Task 6.2 llena `ranking`).

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/routes/__tests__/pasarela.int.test.js`:

```js
const request = require('supertest');
const db = require('../../../models');
const { bus } = require('../../sockets/bus');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearOperativo, crearParticipante, categoria } = require('../../testing/fabricas');

const app = crearAppTrk();
let comentarista; let jurado; let eventos;
const escuchar = (e) => eventos.push(e);

beforeEach(async () => {
  await limpiar();
  comentarista = await crearOperativo('TRK_COMENTARISTA');
  jurado = await crearOperativo('TRK_JURADO');
  eventos = [];
  bus.on('trk', escuchar);
});
afterEach(() => bus.off('trk', escuchar));
afterAll(cerrar);

const llamar = (id, quien = comentarista) => request(app).post(`/api/trk/v1/pasarela/${id}`).set('Authorization', `Bearer ${quien.token}`);

test('TRK-PAS-001 pone en pasarela, la anterior pasa a PRESENTADO y se emite el cambio (HU-7 CA1)', async () => {
  const a = await crearParticipante({ mascota_nombre: 'A' });
  const b = await crearParticipante({ mascota_nombre: 'B' });
  expect((await llamar(a.id)).status).toBe(200);
  const r = await llamar(b.id);
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-PAS-001');
  expect(r.body.data.estado).toBe('EN_PASARELA');
  expect(r.body.data).not.toHaveProperty('responsable_telefono');
  await a.reload();
  expect(a.estado).toBe('PRESENTADO');
  const estado = await db.TrkEventoEstado.findByPk(1);
  expect(estado.participante_en_pasarela_id).toBe(b.id);
  const cambio = eventos.filter((e) => e.evento === 'pasarela:cambio').pop();
  expect(cambio.payload).toMatchObject({ participante: { id: b.id }, anteriores: [a.id] });
});

test('§13.14 llamadas concurrentes → exactamente una mascota EN_PASARELA', async () => {
  const ps = await Promise.all([1, 2, 3, 4].map((n) => crearParticipante({ mascota_nombre: `P${n}` })));
  await Promise.all(ps.map((p) => llamar(p.id)));
  expect(await db.TrkParticipante.count({ where: { estado: 'EN_PASARELA' } })).toBe(1);
  expect(await db.TrkParticipante.count({ where: { estado: 'PRESENTADO' } })).toBe(3);
});

test('una mascota INSCRITA (sin pasar por cabina) no puede salir → 409 ESTADO_INVALIDO', async () => {
  const p = await crearParticipante({ estado: 'INSCRITO' });
  const r = await llamar(p.id);
  expect(r.status).toBe(409);
  expect(r.body).toMatchObject({ error: 'TRK-PAS-001', motivo: 'ESTADO_INVALIDO' });
});

test('un jurado no controla la pasarela → 403', async () => {
  const p = await crearParticipante();
  expect((await llamar(p.id, jurado)).status).toBe(403);
});

test('TRK-PAS-002 reordena la cola de una categoría (HU-7 CA3)', async () => {
  const cat = await categoria('PEQ_MED');
  const a = await crearParticipante({ mascota_nombre: 'A', orden_pasarela: 1 });
  const b = await crearParticipante({ mascota_nombre: 'B', orden_pasarela: 2 });
  const c = await crearParticipante({ mascota_nombre: 'C', orden_pasarela: 3 });
  const r = await request(app).put('/api/trk/v1/pasarela/orden').set('Authorization', `Bearer ${comentarista.token}`)
    .send({ categoria_id: cat.id, orden: [c.id, a.id, b.id] });
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-PAS-002');
  expect(r.body.data.map((p) => p.mascota_nombre)).toEqual(['C', 'A', 'B']);
  expect(eventos.some((e) => e.evento === 'participante:actualizado' && e.payload.categoria_id === cat.id)).toBe(true);
});

test('reordenar con un participante de otra categoría → 400', async () => {
  const cat = await categoria('PEQ_MED');
  const a = await crearParticipante();
  const otro = await crearParticipante({ categoriaCodigo: 'GRANDES' });
  const r = await request(app).put('/api/trk/v1/pasarela/orden').set('Authorization', `Bearer ${comentarista.token}`)
    .send({ categoria_id: cat.id, orden: [a.id, otro.id] });
  expect(r.status).toBe(400);
});

test('TRK-EVT-001 estado público sin sesión, sin datos personales', async () => {
  const p = await crearParticipante({ mascota_nombre: 'Canela' });
  await llamar(p.id);
  const r = await request(app).get('/api/trk/v1/evento/estado');
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-EVT-001');
  expect(r.body.data).toMatchObject({ modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: { id: p.id, mascota_nombre: 'Canela' } });
  expect(r.body.data.en_pasarela).not.toHaveProperty('responsable_documento');
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/pasarela.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BACK:src/trk/services/pasarela.service.js`:

```js
const { Op } = require('sequelize');
const db = require('../../models');
const TrkError = require('../utils/TrkError');
const { serializarParticipante } = require('../utils/serializar');
const { nivelDatos } = require('../utils/permisos');
const { registrarAuditoria } = require('./auditoria.service');
const { buscarModelo, listar } = require('./participantes.service');
const { emitir } = require('../sockets/bus');

const PUEDEN_SALIR = ['PRESENTE', 'PRESENTADO', 'EN_PASARELA'];

async function llamarAPasarela(id, ctx) {
  const { actual, anteriores } = await db.sequelize.transaction(async (transaction) => {
    // Serializa llamadas concurrentes: todas bloquean la fila única de estado del evento.
    await db.TrkEventoEstado.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    const p = await buscarModelo(id, { transaction, lock: true });
    if (!PUEDEN_SALIR.includes(p.estado)) {
      throw new TrkError(409, 'ESTADO_INVALIDO', 'Solo mascotas que pasaron por cabina pueden salir a pasarela');
    }
    const previas = await db.TrkParticipante.findAll({
      where: { estado: 'EN_PASARELA', id: { [Op.ne]: p.id } }, transaction, lock: transaction.LOCK.UPDATE
    });
    for (const previa of previas) await previa.update({ estado: 'PRESENTADO' }, { transaction });
    await p.update({ estado: 'EN_PASARELA' }, { transaction });
    await db.TrkEventoEstado.update({ participante_en_pasarela_id: p.id }, { where: { id: 1 }, transaction });
    await registrarAuditoria(ctx, {
      entidad: 'participante', entidadId: p.id, accion: 'LLAMAR_PASARELA',
      antes: { en_pasarela: previas.map((x) => x.id) }, despues: { en_pasarela: p.id }
    }, { transaction });
    return { actual: p, anteriores: previas.map((x) => x.id) };
  });
  emitir('pasarela:cambio', { participante: actual.get({ plain: true }), anteriores });
  return serializarParticipante(actual, nivelDatos(ctx.usuario));
}

async function reordenarCola({ categoria_id: categoriaId, orden }, ctx) {
  await db.sequelize.transaction(async (transaction) => {
    const filas = await db.TrkParticipante.findAll({ where: { id: orden, fusionado_en_id: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (filas.length !== orden.length || filas.some((f) => f.categoria_id !== Number(categoriaId))) {
      throw new TrkError(400, 'VALIDACION', 'Todos los participantes deben existir y pertenecer a la categoría');
    }
    for (const [i, id] of orden.entries()) {
      await db.TrkParticipante.update({ orden_pasarela: i + 1 }, { where: { id }, transaction });
    }
    await registrarAuditoria(ctx, { entidad: 'categoria', entidadId: categoriaId, accion: 'REORDENAR_COLA', despues: { orden } }, { transaction });
  });
  emitir('participante:actualizado', { categoria_id: Number(categoriaId), orden }, { rooms: ['admin', 'cabina', 'comentarista'] });
  return listar({ categoria: categoriaId }, ctx.usuario);
}

module.exports = { llamarAPasarela, reordenarCola };
```

`BACK:src/trk/services/evento.service.js`:

```js
const db = require('../../models');
const { serializarParticipante } = require('../utils/serializar');
const { INCLUIR_CATEGORIA } = require('./participantes.service');

const vistaCategoriaCorta = (c) => (c ? { id: c.id, codigo: c.codigo, nombre: c.nombre } : null);

// Lo que ve la pantalla pública (sin login) y lo que usan todos como respaldo de polling.
async function estadoPublico() {
  const estado = await db.TrkEventoEstado.findByPk(1, {
    include: [
      { model: db.TrkParticipante, as: 'enPasarela', include: INCLUIR_CATEGORIA },
      { model: db.TrkCategoria, as: 'categoriaPantalla' }
    ]
  });
  return {
    modo_pantalla: estado.modo_pantalla,
    categoria_pantalla: vistaCategoriaCorta(estado.categoriaPantalla),
    en_pasarela: estado.enPasarela ? serializarParticipante(estado.enPasarela, 'PUBLICO') : null,
    ranking: null
  };
}

module.exports = { estadoPublico, vistaCategoriaCorta };
```

`BACK:src/trk/controllers/pasarela.controller.js`:

```js
const svc = require('../services/pasarela.service');
const { ok } = require('../utils/respuesta');
const { ctxDe } = require('../utils/ctx');

exports.llamar = async (req, res) => ok(res, await svc.llamarAPasarela(req.params.id, ctxDe(req)));
exports.reordenar = async (req, res) => ok(res, await svc.reordenarCola(req.body, ctxDe(req)));
```

`BACK:src/trk/controllers/evento.controller.js`:

```js
const svc = require('../services/evento.service');
const { ok } = require('../utils/respuesta');

exports.estado = async (req, res) => ok(res, await svc.estadoPublico());
```

`BACK:src/trk/routes/pasarela.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth, trkPermiso } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const { esquemaId } = require('./participantes.routes');
const ctrl = require('../controllers/pasarela.controller');

const esquemaOrden = Joi.object({
  categoria_id: Joi.number().integer().positive().required(),
  orden: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).min(1).unique().required()
});

const router = express.Router();
// '/orden' antes de '/:id' para que Express no lo tome como id
router.put('/orden', apiCodigo('TRK-PAS-002'), trkAuth, trkPermiso('pasarela'), validar(esquemaOrden), aw(ctrl.reordenar));
router.post('/:id', apiCodigo('TRK-PAS-001'), trkAuth, trkPermiso('pasarela'), validar(esquemaId, 'params'), aw(ctrl.llamar));

module.exports = { prefijo: '/pasarela', router };
```

`BACK:src/trk/routes/evento.routes.js`:

```js
const express = require('express');
const apiCodigo = require('../middleware/apiCodigo');
const aw = require('../utils/aw');
const ctrl = require('../controllers/evento.controller');

const router = express.Router();
router.get('/estado', apiCodigo('TRK-EVT-001'), aw(ctrl.estado));

module.exports = { prefijo: '/evento', router };
```

En `BACK:src/trk/routes/index.js` agregar `require('./pasarela.routes'),` y `require('./evento.routes'),` a `modulos`.

En `BACK:src/trk/config/apiCodigos.js` agregar:

```js
  'TRK-PAS-001': { metodo: 'POST', ruta: '/pasarela/:id', descripcion: 'Pone una mascota en pasarela' },
  'TRK-PAS-002': { metodo: 'PUT', ruta: '/pasarela/orden', descripcion: 'Reordena la cola de una categoría' },
  'TRK-EVT-001': { metodo: 'GET', ruta: '/evento/estado', descripcion: 'Estado público: en pasarela, modo de pantalla, ranking publicado' },
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): pasarela unica con bloqueo, orden de cola y estado publico del evento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4.2: Socket.IO en el servidor de Mantix (namespace `/trk`)

Cubre: RNF-2, HU-7 CA2, §9 eventos, §13.8 (sockets), D4.

**Files:**
- Create: `BACK:src/trk/sockets/index.js`
- Modify: `BACK:server.js`, `BACK:package.json` (dep `socket.io`, devDep `socket.io-client`), `BACK:src/trk/scripts/e2e-servidor.js`
- Test: `BACK:src/trk/sockets/__tests__/sockets.int.test.js`

**Interfaces:**
- Consumes: `bus` (3.2), `resolverSesion` (1.6), `permisosTrk`, `serializarParticipante`.
- Produces: `attach(httpServer, opciones = {}) → io` (con `io.trkCerrar()` para pruebas); `roomsDe(usuario) → string[]` (`admin` exclusivo si `administrar`; si no `cabina`/`comentarista`/`jurado` según permisos); `NIVEL_POR_ROOM`. Sin token → room `pantalla`. Token inválido → `connect_error` con mensaje `NO_AUTENTICADO`.

- [ ] **Step 1: Instalar dependencias**

```bash
cd BACK && npm install socket.io@^4.8.1 && npm install -D socket.io-client@^4.8.1
```

- [ ] **Step 2: Escribir la prueba que falla**

`BACK:src/trk/sockets/__tests__/sockets.int.test.js`:

```js
const http = require('http');
const request = require('supertest');
const { io: cliente } = require('socket.io-client');
const { attach } = require('..');
const { emitir } = require('../bus');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante } = require('../../testing/fabricas');

const SENSIBLES = ['responsable_documento', 'responsable_telefono', 'responsable_correo', 'responsable_nombre'];
let server; let io; let url; let sockets;
let admin; let jurado; let comentarista;

beforeAll((done) => {
  server = http.createServer(crearAppTrk());
  io = attach(server);
  server.listen(0, () => { url = `http://localhost:${server.address().port}/trk`; done(); });
});
afterAll(async () => {
  io.trkCerrar();
  await new Promise((r) => server.close(r));
  await cerrar();
});
beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
  jurado = await crearOperativo('TRK_JURADO');
  comentarista = await crearOperativo('TRK_COMENTARISTA');
  sockets = [];
});
afterEach(() => sockets.forEach((s) => s.close()));

function conectar(token) {
  return new Promise((resolve, reject) => {
    const s = cliente(url, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}
const esperar = (s, evento, ms = 2000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timeout ${evento}`)), ms);
  s.once(evento, (m) => { clearTimeout(t); resolve(m); });
});
const noRecibe = (s, evento, ms = 400) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  s.once(evento, () => { clearTimeout(t); reject(new Error(`no debía recibir ${evento}`)); });
});

test('§13.8 + HU-7 CA2: jurado, comentarista y pantalla reciben pasarela:cambio sin datos personales; admin con datos', async () => {
  const p = await crearParticipante({ mascota_nombre: 'Canela' });
  const [sJ, sC, sP, sA] = await Promise.all([conectar(jurado.token), conectar(comentarista.token), conectar(null), conectar(admin.token)]);
  const mensajes = Promise.all([sJ, sC, sP, sA].map((s) => esperar(s, 'pasarela:cambio')));
  const inicio = Date.now();
  await request(server).post(`/api/trk/v1/pasarela/${p.id}`).set('Authorization', `Bearer ${comentarista.token}`).expect(200);
  const [mJ, mC, mP, mA] = await mensajes;
  expect(Date.now() - inicio).toBeLessThan(2000);
  for (const m of [mJ, mC, mP]) {
    expect(m.participante).toMatchObject({ id: p.id, mascota_nombre: 'Canela', responsable_primer_nombre: 'Ana' });
    for (const campo of SENSIBLES) expect(m.participante).not.toHaveProperty(campo);
  }
  expect(mA.participante.responsable_telefono).toBe('3001234567');
});

test('token inválido → connect_error NO_AUTENTICADO', async () => {
  await expect(conectar('token-falso')).rejects.toThrow('NO_AUTENTICADO');
});

test('calificacion:recibida solo llega a la room admin', async () => {
  const [sA, sJ, sP] = await Promise.all([conectar(admin.token), conectar(jurado.token), conectar(null)]);
  const llegaAdmin = esperar(sA, 'calificacion:recibida');
  const noJurado = noRecibe(sJ, 'calificacion:recibida');
  const noPantalla = noRecibe(sP, 'calificacion:recibida');
  emitir('calificacion:recibida', { participante_id: 'x', jurado_id: 1, total: 80 }, { rooms: ['admin'] });
  await expect(llegaAdmin).resolves.toEqual({ participante_id: 'x', jurado_id: 1, total: 80 });
  await noJurado;
  await noPantalla;
});
```

- [ ] **Step 3: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/sockets`
Expected: FAIL (`Cannot find module '..'`).

- [ ] **Step 4: Implementar**

`BACK:src/trk/sockets/index.js`:

```js
// ============================================
// Socket.IO de TRIKIPELUDOS: namespace /trk sobre el servidor HTTP de Mantix.
// Rooms: admin | cabina | comentarista | jurado (con token) · pantalla (sin token).
// Toda carga con participante se serializa por room (RNF-5).
// ============================================
const { Server } = require('socket.io');
const { bus } = require('./bus');
const { resolverSesion } = require('../middleware/trkAuth');
const { permisosTrk } = require('../utils/permisos');
const { serializarParticipante } = require('../utils/serializar');

const NIVEL_POR_ROOM = { admin: 'COMPLETO', cabina: 'COMPLETO', comentarista: 'PUBLICO', jurado: 'PUBLICO', pantalla: 'PUBLICO' };

function roomsDe(usuario) {
  const p = permisosTrk(usuario);
  if (p.administrar) return ['admin'];
  const rooms = [];
  if (p.cabina) rooms.push('cabina');
  if (p.pasarela) rooms.push('comentarista');
  if (p.calificar) rooms.push('jurado');
  return rooms.length ? rooms : ['pantalla'];
}

function serializarPayload(payload, room) {
  if (!payload || !payload.participante) return payload;
  return { ...payload, participante: serializarParticipante(payload.participante, NIVEL_POR_ROOM[room]) };
}

function attach(httpServer, opciones = {}) {
  const io = new Server(httpServer, { path: '/socket.io', cors: { origin: true }, ...opciones });
  const nsp = io.of('/trk');

  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) {
        socket.data.rooms = ['pantalla'];
        return next();
      }
      const sesion = await resolverSesion(token);
      if (!sesion) return next(new Error('NO_AUTENTICADO'));
      socket.data.rooms = roomsDe(sesion.usuario);
      socket.data.usuarioId = sesion.usuario.id;
      return next();
    } catch (e) {
      return next(new Error('NO_AUTENTICADO'));
    }
  });

  nsp.on('connection', (socket) => socket.join(socket.data.rooms));

  const reenviar = ({ evento, payload, rooms }) => {
    for (const room of rooms) nsp.to(room).emit(evento, serializarPayload(payload, room));
  };
  bus.on('trk', reenviar);

  io.trkCerrar = () => {
    bus.off('trk', reenviar);
    io.close();
  };
  return io;
}

module.exports = { attach, roomsDe, NIVEL_POR_ROOM };
```

En `BACK:server.js`:
- Agregar al inicio, después de `require('dotenv').config();`: `const http = require('http');`
- Reemplazar el bloque `app.listen(PORT, () => { ... });` por:

```js
    // Servidor HTTP explícito: Mantix + Socket.IO de TRIKIPELUDOS (namespace /trk)
    const server = http.createServer(app);
    require('./src/trk/sockets').attach(server);
    server.listen(PORT, () => {
      logger.info(`🚀 Servidor Mantix corriendo en puerto ${PORT}`);
      logger.info(`📚 Documentación API: http://${process.env.DB_HOST}:${PORT}/api-docs`);
      logger.info(`🌍 Ambiente: ${process.env.NODE_ENV}`);
    });
```

En `BACK:src/trk/scripts/e2e-servidor.js`, reemplazar `const server = http.createServer(crearAppTrk({ estaticos: true }));` por:

```js
  const server = http.createServer(crearAppTrk({ estaticos: true }));
  require('../sockets').attach(server);
```

- [ ] **Step 5: Correr y verificar**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk && node -e "require('dotenv').config(); require('./src/trk/sockets')" && echo OK`
Expected: PASS y `OK`.

- [ ] **Step 6: Commit**

```bash
cd BACK
git add server.js package.json package-lock.json src/trk
git commit -m "feat(trk): Socket.IO namespace /trk con rooms por rol y serializacion por room

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4.3: Control de pantalla y tablero del admin

Cubre: HU-4 CA6, §10 `/admin` (tablero), §9.1 `TRK-EVT-002/003`.

**Files:**
- Modify: `BACK:src/trk/services/evento.service.js` (`cambiarPantalla`, `tablero`), `BACK:src/trk/controllers/evento.controller.js`, `BACK:src/trk/routes/evento.routes.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/routes/__tests__/evento.int.test.js`

**Interfaces:**
- Produces:
  - `cambiarPantalla({ modo, categoria_id }, ctx) → EstadoPublico` (RANKING exige categoría con `ranking_publicado` → si no, 409 `RANKING_NO_PUBLICADO`); emite `pantalla:modo` con el estado público completo.
  - `tablero() → { categorias: [{ id, codigo, nombre, abierta, ranking_publicado, total, por_estado: { INSCRITO, PRESENTE, EN_PASARELA, PRESENTADO, AUSENTE } }], jurados: [{ id, nombre, activo, calificadas, pendientes }], calificables: number }` (`calificables` = participantes `EN_PASARELA`/`PRESENTADO` no fusionados; `pendientes` = calificables − calificadas por ese jurado sobre ese conjunto).

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/routes/__tests__/evento.int.test.js`:

```js
const request = require('supertest');
const db = require('../../../models');
const { bus } = require('../../sockets/bus');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria } = require('../../testing/fabricas');

const app = crearAppTrk();
let admin; let eventos;
const escuchar = (e) => eventos.push(e);
beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
  eventos = [];
  bus.on('trk', escuchar);
});
afterEach(() => bus.off('trk', escuchar));
afterAll(cerrar);

const pantalla = (body) => request(app).put('/api/trk/v1/evento/pantalla').set('Authorization', `Bearer ${admin.token}`).send(body);

test('TRK-EVT-002 modo RANKING exige ranking publicado', async () => {
  const cat = await categoria('FELINOS');
  const r = await pantalla({ modo: 'RANKING', categoria_id: cat.id });
  expect(r.status).toBe(409);
  expect(r.body).toMatchObject({ error: 'TRK-EVT-002', motivo: 'RANKING_NO_PUBLICADO' });
  await cat.update({ ranking_publicado: true });
  const ok = await pantalla({ modo: 'RANKING', categoria_id: cat.id });
  expect(ok.status).toBe(200);
  expect(ok.body.data).toMatchObject({ modo_pantalla: 'RANKING', categoria_pantalla: { codigo: 'FELINOS' } });
  expect(eventos.some((e) => e.evento === 'pantalla:modo' && e.payload.modo_pantalla === 'RANKING')).toBe(true);
});

test('volver a modo PASARELA limpia la categoría', async () => {
  const r = await pantalla({ modo: 'PASARELA' });
  expect(r.body.data).toMatchObject({ modo_pantalla: 'PASARELA', categoria_pantalla: null });
});

test('TRK-EVT-003 tablero: contadores por estado y progreso por jurado', async () => {
  const j1 = await crearOperativo('TRK_JURADO', { nombre: 'J1' });
  await crearOperativo('TRK_JURADO', { nombre: 'J2' });
  const a = await crearParticipante({ estado: 'PRESENTADO' });
  await crearParticipante({ estado: 'EN_PASARELA' });
  await crearParticipante({ estado: 'INSCRITO', categoriaCodigo: 'GRANDES' });
  await db.TrkCalificacion.create({ participante_id: a.id, jurado_id: j1.usuario.id, total: 70, enviada_at: new Date(), bloqueada: true });
  const r = await request(app).get('/api/trk/v1/evento/tablero').set('Authorization', `Bearer ${admin.token}`);
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-EVT-003');
  const peq = r.body.data.categorias.find((c) => c.codigo === 'PEQ_MED');
  expect(peq).toMatchObject({ total: 2, por_estado: { PRESENTADO: 1, EN_PASARELA: 1, INSCRITO: 0 } });
  expect(r.body.data.calificables).toBe(2);
  expect(r.body.data.jurados.map((j) => [j.nombre, j.calificadas, j.pendientes])).toEqual([['J1', 1, 1], ['J2', 0, 2]]);
});

test('sin permiso administrar → 403', async () => {
  const jurado = await crearOperativo('TRK_JURADO');
  const r = await request(app).get('/api/trk/v1/evento/tablero').set('Authorization', `Bearer ${jurado.token}`);
  expect(r.status).toBe(403);
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/evento.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Agregar a `BACK:src/trk/services/evento.service.js` (y exportar `cambiarPantalla`, `tablero`):

```js
const { QueryTypes } = require('sequelize');
const TrkError = require('../utils/TrkError');
const { registrarAuditoria } = require('./auditoria.service');
const { emitir } = require('../sockets/bus');
const { ROL_JURADO, ESTADOS } = require('../config/constantes');

async function cambiarPantalla({ modo, categoria_id: categoriaId }, ctx) {
  let categoria = null;
  if (modo === 'RANKING') {
    categoria = await db.TrkCategoria.findByPk(categoriaId);
    if (!categoria) throw new TrkError(400, 'VALIDACION', 'Indica la categoría a mostrar');
    if (!categoria.ranking_publicado) throw new TrkError(409, 'RANKING_NO_PUBLICADO', 'Publica el ranking de la categoría antes de mostrarlo');
  }
  await db.sequelize.transaction(async (transaction) => {
    await db.TrkEventoEstado.update({ modo_pantalla: modo, categoria_pantalla_id: categoria ? categoria.id : null }, { where: { id: 1 }, transaction });
    await registrarAuditoria(ctx, { entidad: 'evento', entidadId: 1, accion: 'CAMBIAR_PANTALLA', despues: { modo, categoria_id: categoria ? categoria.id : null } }, { transaction });
  });
  const estado = await estadoPublico();
  emitir('pantalla:modo', estado);
  return estado;
}

async function tablero() {
  const categorias = await db.TrkCategoria.findAll({ order: [['orden', 'ASC']] });
  const conteos = await db.sequelize.query(
    'SELECT categoria_id, estado, COUNT(*) AS n FROM trk_participantes WHERE fusionado_en_id IS NULL GROUP BY categoria_id, estado',
    { type: QueryTypes.SELECT }
  );
  const vacios = () => Object.fromEntries(Object.values(ESTADOS).map((e) => [e, 0]));
  const porCategoria = categorias.map((c) => {
    const por_estado = vacios();
    for (const f of conteos.filter((x) => x.categoria_id === c.id)) por_estado[f.estado] = Number(f.n);
    return {
      id: c.id, codigo: c.codigo, nombre: c.nombre, abierta: Boolean(c.abierta), ranking_publicado: Boolean(c.ranking_publicado),
      total: Object.values(por_estado).reduce((s, n) => s + n, 0), por_estado
    };
  });

  const [{ calificables }] = await db.sequelize.query(
    "SELECT COUNT(*) AS calificables FROM trk_participantes WHERE fusionado_en_id IS NULL AND estado IN ('EN_PASARELA','PRESENTADO')",
    { type: QueryTypes.SELECT }
  );
  const jurados = await db.sequelize.query(
    `SELECT u.id, TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS nombre, u.activo,
            (SELECT COUNT(*) FROM trk_calificaciones c JOIN trk_participantes p ON p.id = c.participante_id
              WHERE c.jurado_id = u.id AND p.fusionado_en_id IS NULL AND p.estado IN ('EN_PASARELA','PRESENTADO')) AS calificadas
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
      WHERE r.nombre = :rol
      ORDER BY u.nombre`,
    { type: QueryTypes.SELECT, replacements: { rol: ROL_JURADO } }
  );
  const total = Number(calificables);
  return {
    categorias: porCategoria,
    calificables: total,
    jurados: jurados.map((j) => ({ id: j.id, nombre: j.nombre, activo: Boolean(j.activo), calificadas: Number(j.calificadas), pendientes: total - Number(j.calificadas) }))
  };
}
```

Agregar a `BACK:src/trk/controllers/evento.controller.js`:

```js
const { ctxDe } = require('../utils/ctx');

exports.pantalla = async (req, res) => ok(res, await svc.cambiarPantalla(req.body, ctxDe(req)));
exports.tablero = async (req, res) => ok(res, await svc.tablero());
```

Agregar a `BACK:src/trk/routes/evento.routes.js` (importar `Joi`, `validar`, `trkAuth`, `trkPermiso`):

```js
const esquemaPantalla = Joi.object({
  modo: Joi.string().valid('PASARELA', 'RANKING').required(),
  categoria_id: Joi.number().integer().positive().when('modo', { is: 'RANKING', then: Joi.required(), otherwise: Joi.optional().allow(null) })
});

router.put('/pantalla', apiCodigo('TRK-EVT-002'), trkAuth, trkPermiso('administrar'), validar(esquemaPantalla), aw(ctrl.pantalla));
router.get('/tablero', apiCodigo('TRK-EVT-003'), trkAuth, trkPermiso('administrar'), aw(ctrl.tablero));
```

En `BACK:src/trk/config/apiCodigos.js` agregar:

```js
  'TRK-EVT-002': { metodo: 'PUT', ruta: '/evento/pantalla', descripcion: 'Modo y categoría de la pantalla pública' },
  'TRK-EVT-003': { metodo: 'GET', ruta: '/evento/tablero', descripcion: 'Contadores y progreso por jurado' },
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): control de pantalla publica y tablero del admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4.4: Tiempo real en el frontend (socket + respaldo de polling)

Cubre: RNF-2 (polling de respaldo), HU-7 CA2, HU-9 CA3.

**Files:**
- Create: `FRONT:src/services/socket.js`, `FRONT:src/composables/useTiempoReal.js`, `FRONT:src/stores/evento.js`
- Test: `FRONT:src/composables/__tests__/useTiempoReal.spec.js`, `FRONT:src/stores/__tests__/evento.spec.js`

**Interfaces:**
- Produces:
  - `conectarSocket(token | null) → Socket` (URL `VITE_SOCKET_URL` o el origen; namespace `/trk`; `auth.token`).
  - `useTiempoReal({ token, eventos: { [nombre]: handler }, sincronizar: () => Promise, intervaloMs = 3000, conectar = conectarSocket, automatico = true }) → { conectado: Ref<boolean>, iniciar(), detener() }`. Hace polling con `sincronizar` hasta conectar y cada vez que el socket cae; con `automatico` se engancha a `onMounted`/`onBeforeUnmount`.
  - `useEventoStore()` — state `{ enPasarela, modoPantalla, categoriaPantalla, ranking, actualizadoEn }`; actions `aplicarEstado(estadoPublico)`, `sincronizar()`, `alCambioPasarela({ participante })`, `alFotoNueva({ participante })`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/composables/__tests__/useTiempoReal.spec.js`:

```js
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTiempoReal } from '@/composables/useTiempoReal'

function socketFalso() {
  const handlers = {}
  return {
    handlers,
    on: vi.fn((e, h) => { (handlers[e] ||= []).push(h) }),
    emitir: (e, ...a) => (handlers[e] || []).forEach((h) => h(...a)),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn()
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('sincroniza al iniciar y hace polling hasta que el socket conecta', async () => {
  const socket = socketFalso()
  const sincronizar = vi.fn(async () => {})
  const rt = useTiempoReal({ token: 't', sincronizar, conectar: () => socket, automatico: false })
  rt.iniciar()
  expect(sincronizar).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(3000)
  expect(sincronizar).toHaveBeenCalledTimes(2)
  socket.emitir('connect')
  expect(rt.conectado.value).toBe(true)
  const tras = sincronizar.mock.calls.length
  vi.advanceTimersByTime(9000)
  expect(sincronizar.mock.calls.length).toBe(tras)
})

test('si el socket cae vuelve al polling cada 3 s (RNF-2)', () => {
  const socket = socketFalso()
  const sincronizar = vi.fn(async () => {})
  const rt = useTiempoReal({ sincronizar, conectar: () => socket, automatico: false })
  rt.iniciar()
  socket.emitir('connect')
  sincronizar.mockClear()
  socket.emitir('disconnect')
  expect(rt.conectado.value).toBe(false)
  vi.advanceTimersByTime(6000)
  expect(sincronizar).toHaveBeenCalledTimes(2)
})

test('registra handlers de eventos y limpia al detener', () => {
  const socket = socketFalso()
  const alCambio = vi.fn()
  const rt = useTiempoReal({ eventos: { 'pasarela:cambio': alCambio }, sincronizar: async () => {}, conectar: () => socket, automatico: false })
  rt.iniciar()
  socket.emitir('pasarela:cambio', { participante: { id: 'x' } })
  expect(alCambio).toHaveBeenCalledWith({ participante: { id: 'x' } })
  rt.detener()
  expect(socket.disconnect).toHaveBeenCalled()
})
```

`FRONT:src/stores/__tests__/evento.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn() }, tokenStorage: { leer: () => null, guardar: () => {} } }))

import { trk } from '@/services/api'
import { useEventoStore } from '@/stores/evento'

beforeEach(() => setActivePinia(createPinia()))

test('sincronizar aplica el estado público', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, en_pasarela: { id: 'a' }, ranking: null } })
  const e = useEventoStore()
  await e.sincronizar()
  expect(trk.get).toHaveBeenCalledWith('/evento/estado')
  expect(e.enPasarela).toEqual({ id: 'a' })
})

test('cambio de pasarela y foto nueva del que está en pasarela', () => {
  const e = useEventoStore()
  e.alCambioPasarela({ participante: { id: 'b', foto_url: null } })
  e.alFotoNueva({ participante: { id: 'c', foto_url: '/x.jpg' } })
  expect(e.enPasarela.foto_url).toBeNull()
  e.alFotoNueva({ participante: { id: 'b', foto_url: '/y.jpg' } })
  expect(e.enPasarela.foto_url).toBe('/y.jpg')
})
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd FRONT && npx vitest run src/composables src/stores/__tests__/evento.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/services/socket.js`:

```js
import { io } from 'socket.io-client'

export function conectarSocket(token) {
  const base = import.meta.env.VITE_SOCKET_URL || window.location.origin
  return io(`${base}/trk`, {
    path: '/socket.io',
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  })
}
```

`FRONT:src/composables/useTiempoReal.js`:

```js
import { ref, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { conectarSocket } from '@/services/socket'

// Socket.IO con respaldo de polling REST (RNF-2): mientras no haya socket, llama a `sincronizar` cada intervaloMs.
export function useTiempoReal({ token = null, eventos = {}, sincronizar = null, intervaloMs = 3000, conectar = conectarSocket, automatico = true } = {}) {
  const conectado = ref(false)
  let socket = null
  let temporizador = null

  const correr = () => { if (sincronizar) Promise.resolve(sincronizar()).catch(() => {}) }
  const iniciarPolling = () => { if (!temporizador) temporizador = setInterval(correr, intervaloMs) }
  const detenerPolling = () => { clearInterval(temporizador); temporizador = null }

  function iniciar() {
    socket = conectar(token)
    socket.on('connect', () => { conectado.value = true; detenerPolling(); correr() })
    socket.on('disconnect', () => { conectado.value = false; iniciarPolling() })
    socket.on('connect_error', () => { conectado.value = false; iniciarPolling() })
    for (const [evento, handler] of Object.entries(eventos)) socket.on(evento, handler)
    correr()
    iniciarPolling()
  }

  function detener() {
    detenerPolling()
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }
  }

  if (automatico && getCurrentInstance()) {
    onMounted(iniciar)
    onBeforeUnmount(detener)
  }
  return { conectado, iniciar, detener }
}
```

`FRONT:src/stores/evento.js`:

```js
import { defineStore } from 'pinia'
import { trk } from '@/services/api'

export const useEventoStore = defineStore('evento', {
  state: () => ({ enPasarela: null, modoPantalla: 'PASARELA', categoriaPantalla: null, ranking: null, actualizadoEn: null }),
  actions: {
    aplicarEstado(estado) {
      this.enPasarela = estado.en_pasarela
      this.modoPantalla = estado.modo_pantalla
      this.categoriaPantalla = estado.categoria_pantalla
      this.ranking = estado.ranking || null
      this.actualizadoEn = Date.now()
    },
    async sincronizar() {
      const { data } = await trk.get('/evento/estado')
      this.aplicarEstado(data)
    },
    alCambioPasarela({ participante }) {
      this.enPasarela = participante
      this.actualizadoEn = Date.now()
    },
    alFotoNueva({ participante }) {
      if (this.enPasarela && participante && participante.id === this.enPasarela.id) {
        this.enPasarela = { ...this.enPasarela, foto_url: participante.foto_url }
      }
    }
  }
})
```

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): tiempo real con Socket.IO y respaldo de polling; store del evento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4.5: Pantalla del comentarista y ficha de presentación

Cubre: HU-6 CA1, CA2; HU-7 CA1–CA3; RNF-9 (≥ 24 px); §10 `/comentarista`.

**Files:**
- Create: `FRONT:src/components/FichaMascota.vue`, `FRONT:src/views/ComentaristaView.vue`
- Modify: `FRONT:src/router/index.js` (ruta `/comentarista`, permiso `pasarela`)
- Test: `FRONT:src/components/__tests__/FichaMascota.spec.js`, `FRONT:src/views/__tests__/ComentaristaView.spec.js`

**Interfaces:**
- Consumes: `TRK-CAT-005`, `TRK-PAR-001`, `TRK-PAS-001/002`, `useTiempoReal`, `useEventoStore`, `useCategoriasStore`, `FotoMascota`, `EstadoChip`.
- Produces: `<FichaMascota :participante="p" :grande="true" />` — muestra foto, nombre, disfraz, raza, edad, sexo, categoría y `responsable_primer_nombre` (nunca otros datos del responsable); con `grande` todos los textos ≥ `text-2xl` (24 px).

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/components/__tests__/FichaMascota.spec.js`:

```js
import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FichaMascota from '@/components/FichaMascota.vue'

const p = {
  id: 'a', mascota_nombre: 'Canela', disfraz_nombre: 'Bruja de Oz', raza: 'Criollo', edad_texto: '3', sexo: 'HEMBRA',
  especie: 'PERRO', categoria: { codigo: 'PEQ_MED', nombre: 'Caninos pequeños y medianos' }, responsable_primer_nombre: 'Laura',
  responsable_telefono: '3001112233'
}

test('muestra los campos de HU-6 CA1 y nada más del responsable', () => {
  const w = mount(FichaMascota, { props: { participante: p, grande: true } })
  for (const texto of ['Canela', 'Bruja de Oz', 'Criollo', '3', 'Hembra', 'Caninos pequeños y medianos', 'Laura']) expect(w.text()).toContain(texto)
  expect(w.text()).not.toContain('3001112233')
})

test('en modo grande todo el texto es ≥ 24 px (text-2xl o mayor)', () => {
  const w = mount(FichaMascota, { props: { participante: p, grande: true } })
  for (const el of w.findAll('[data-texto]')) expect(el.classes().some((c) => /^text-(2xl|3xl|4xl|5xl|6xl)$/.test(c))).toBe(true)
})
```

`FRONT:src/views/__tests__/ComentaristaView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn(() => ({ conectado: { value: true } })) }))

import { trk } from '@/services/api'
import { useTiempoReal } from '@/composables/useTiempoReal'
import ComentaristaView from '@/views/ComentaristaView.vue'

const CATS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños' }, { id: 2, codigo: 'GRANDES', nombre: 'Grandes' }]
const cola = [
  { id: 'a', mascota_nombre: 'Canela', estado: 'PRESENTE', categoria_id: 1, responsable_primer_nombre: 'Laura' },
  { id: 'b', mascota_nombre: 'Rocky', estado: 'PRESENTE', categoria_id: 1, responsable_primer_nombre: 'Pedro' },
  { id: 'c', mascota_nombre: 'Toby', estado: 'PRESENTADO', categoria_id: 1, responsable_primer_nombre: 'Julián' }
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATS }
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: null, categoria_pantalla: null, ranking: null } }
    return { data: cola }
  })
})

test('carga la cola de la primera categoría y muestra la ficha de la primera mascota', async () => {
  const w = mount(ComentaristaView)
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/participantes', { params: { categoria: 1 } })
  expect(w.get('[data-test="ficha"]').text()).toContain('Canela')
})

test('anterior / siguiente dentro de la cola (HU-6 CA2)', async () => {
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="siguiente"]').trigger('click')
  expect(w.get('[data-test="ficha"]').text()).toContain('Rocky')
  await w.get('[data-test="anterior"]').trigger('click')
  expect(w.get('[data-test="ficha"]').text()).toContain('Canela')
})

test('llamar a pasarela (HU-7 CA1)', async () => {
  trk.post.mockResolvedValue({ data: { ...cola[0], estado: 'EN_PASARELA' } })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="llamar"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/pasarela/a')
  expect(w.text()).toContain('En pasarela')
})

test('reordenar con botones accesibles envía el nuevo orden (HU-7 CA3)', async () => {
  trk.put.mockResolvedValue({ data: [cola[1], cola[0], cola[2]] })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="bajar-a"]').trigger('click')
  await flushPromises()
  expect(trk.put).toHaveBeenCalledWith('/pasarela/orden', { categoria_id: 1, orden: ['b', 'a', 'c'] })
})

test('se suscribe a pasarela:cambio y participante:actualizado', async () => {
  mount(ComentaristaView)
  await flushPromises()
  const opciones = useTiempoReal.mock.calls[0][0]
  expect(Object.keys(opciones.eventos)).toEqual(expect.arrayContaining(['pasarela:cambio', 'participante:actualizado', 'foto:nueva']))
})
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd FRONT && npx vitest run src/components/__tests__/FichaMascota.spec.js src/views/__tests__/ComentaristaView.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/components/FichaMascota.vue`:

```vue
<script setup>
import { computed } from 'vue'
import FotoMascota from './FotoMascota.vue'

const props = defineProps({ participante: { type: Object, required: true }, grande: { type: Boolean, default: false } })
const SEXO = { MACHO: 'Macho', HEMBRA: 'Hembra' }
const t = computed(() => (props.grande
  ? { nombre: 'text-5xl', dato: 'text-2xl', disfraz: 'text-3xl' }
  : { nombre: 'text-2xl', dato: 'text-base', disfraz: 'text-lg' }))
const detalles = computed(() => [
  props.participante.raza,
  props.participante.edad_texto ? `${props.participante.edad_texto}` : null,
  SEXO[props.participante.sexo]
].filter(Boolean))
</script>

<template>
  <article class="flex flex-col gap-3">
    <FotoMascota :participante="participante" />
    <h2 data-texto :class="['font-extrabold leading-tight text-morado-800', t.nombre]">{{ participante.mascota_nombre }}</h2>
    <p v-if="participante.disfraz_nombre" data-texto :class="['font-semibold text-calabaza-800', t.disfraz]">«{{ participante.disfraz_nombre }}»</p>
    <p v-if="detalles.length" data-texto :class="t.dato">{{ detalles.join(' · ') }}</p>
    <p v-if="participante.categoria" data-texto :class="['text-morado-700', t.dato]">{{ participante.categoria.nombre }}</p>
    <p v-if="participante.responsable_primer_nombre" data-texto :class="t.dato">Con {{ participante.responsable_primer_nombre }}</p>
  </article>
</template>
```

`FRONT:src/views/ComentaristaView.vue`:

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import draggable from 'vuedraggable'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useEventoStore } from '@/stores/evento'
import { useCategoriasStore } from '@/stores/categorias'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FichaMascota from '@/components/FichaMascota.vue'
import FotoMascota from '@/components/FotoMascota.vue'
import EstadoChip from '@/components/EstadoChip.vue'

const auth = useAuthStore()
const evento = useEventoStore()
const categorias = useCategoriasStore()
const categoriaId = ref(null)
const cola = ref([])
const indice = ref(0)
const error = ref('')
const llamando = ref(false)
let recarga = null

const actual = computed(() => cola.value[indice.value] || null)

async function cargarCola() {
  if (!categoriaId.value) return
  try {
    const idActual = actual.value && actual.value.id
    cola.value = (await trk.get('/participantes', { params: { categoria: categoriaId.value } })).data
    const i = cola.value.findIndex((p) => p.id === idActual)
    indice.value = i >= 0 ? i : 0
  } catch (e) { error.value = mensajeDeError(e) }
}
const recargarPronto = () => { clearTimeout(recarga); recarga = setTimeout(cargarCola, 300) }

function elegirCategoria(id) {
  categoriaId.value = id
  indice.value = 0
  cargarCola()
}

const mover = (paso) => { indice.value = Math.min(Math.max(indice.value + paso, 0), cola.value.length - 1) }

async function llamar() {
  if (!actual.value) return
  llamando.value = true
  error.value = ''
  try {
    const { data } = await trk.post(`/pasarela/${actual.value.id}`)
    cola.value = cola.value.map((p) => (p.id === data.id ? { ...p, ...data } : (p.estado === 'EN_PASARELA' ? { ...p, estado: 'PRESENTADO' } : p)))
    evento.alCambioPasarela({ participante: data })
  } catch (e) { error.value = mensajeDeError(e) } finally { llamando.value = false }
}

async function guardarOrden(nuevo) {
  try {
    cola.value = (await trk.put('/pasarela/orden', { categoria_id: categoriaId.value, orden: nuevo.map((p) => p.id) })).data
  } catch (e) {
    error.value = mensajeDeError(e)
    cargarCola()
  }
}

function desplazar(id, paso) {
  const lista = [...cola.value]
  const i = lista.findIndex((p) => p.id === id)
  const j = i + paso
  if (i < 0 || j < 0 || j >= lista.length) return
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  cola.value = lista
  guardarOrden(lista)
}

useTiempoReal({
  token: auth.token,
  sincronizar: () => evento.sincronizar(),
  eventos: {
    'pasarela:cambio': (m) => { evento.alCambioPasarela(m); recargarPronto() },
    'participante:actualizado': recargarPronto,
    'foto:nueva': recargarPronto
  }
})

onMounted(async () => {
  try {
    await categorias.cargar()
    if (categorias.lista.length) elegirCategoria(categorias.lista[0].id)
  } catch (e) { error.value = mensajeDeError(e) }
})
</script>

<template>
  <div class="min-h-screen pb-28">
    <BarraSuperior titulo="Comentarista" />
    <nav class="flex gap-1 overflow-x-auto bg-white px-2 py-1 shadow-sm">
      <button v-for="c in categorias.lista" :key="c.id" class="btn whitespace-nowrap" :class="c.id === categoriaId ? 'bg-calabaza-700 text-white' : 'text-morado-800'" @click="elegirCategoria(c.id)">{{ c.nombre }}</button>
    </nav>
    <main class="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-[2fr_1fr]">
      <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800 md:col-span-2" role="alert">{{ error }}</p>

      <section v-if="actual" data-test="ficha" class="tarjeta flex flex-col gap-3">
        <div class="flex items-center justify-between"><EstadoChip :estado="actual.estado" /><span class="text-2xl">{{ indice + 1 }} / {{ cola.length }}</span></div>
        <FichaMascota :participante="actual" grande />
        <div class="grid grid-cols-2 gap-2">
          <button class="btn-claro min-h-[56px] text-2xl" data-test="anterior" :disabled="indice === 0" @click="mover(-1)">◀ Anterior</button>
          <button class="btn-claro min-h-[56px] text-2xl" data-test="siguiente" :disabled="indice >= cola.length - 1" @click="mover(1)">Siguiente ▶</button>
        </div>
      </section>
      <p v-else class="tarjeta text-2xl">No hay mascotas presentes en esta categoría.</p>

      <aside class="tarjeta">
        <h2 class="mb-2 text-xl font-bold">Cola de salida</h2>
        <draggable :model-value="cola" item-key="id" handle=".asa" @update:model-value="(l) => { cola = l; guardarOrden(l) }">
          <template #item="{ element, index }">
            <div class="flex items-center gap-2 border-b border-morado-100 py-2" :class="index === indice ? 'bg-calabaza-50' : ''">
              <span class="asa cursor-grab select-none px-1 text-xl" aria-hidden="true">⠿</span>
              <button class="flex flex-1 items-center gap-2 text-left" @click="indice = index">
                <FotoMascota :participante="element" clase="h-12 w-10 shrink-0 rounded-lg" />
                <span class="flex-1 font-semibold">{{ element.mascota_nombre }}</span>
                <EstadoChip :estado="element.estado" />
              </button>
              <button class="btn min-w-tactil px-2" :aria-label="`Subir ${element.mascota_nombre}`" :data-test="`subir-${element.id}`" @click="desplazar(element.id, -1)">▲</button>
              <button class="btn min-w-tactil px-2" :aria-label="`Bajar ${element.mascota_nombre}`" :data-test="`bajar-${element.id}`" @click="desplazar(element.id, 1)">▼</button>
            </div>
          </template>
        </draggable>
      </aside>
    </main>

    <div v-if="actual" class="fixed inset-x-0 bottom-0 bg-white/95 p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      <button class="btn-primario mx-auto flex min-h-[64px] w-full max-w-xl text-2xl" data-test="llamar" :disabled="llamando || actual.estado === 'EN_PASARELA'" @click="llamar">
        {{ actual.estado === 'EN_PASARELA' ? 'En pasarela' : '📣 Llamar a pasarela' }}
      </button>
    </div>
  </div>
</template>
```

En `FRONT:src/router/index.js` agregar:
`{ path: '/comentarista', component: () => import('@/views/ComentaristaView.vue'), meta: { permiso: 'pasarela' } },`

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS. (`vuedraggable` funciona en jsdom; si diera problemas, en el test agregar `global: { stubs: { draggable: { props: ['modelValue'], template: '<div><slot name="item" v-for="(element, index) in modelValue" :element="element" :index="index" /></div>' } } }` al `mount`.)

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): pantalla del comentarista con ficha grande, cola reordenable y llamado a pasarela

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4.6: Pantalla pública (modo pasarela) y tablero del admin

Cubre: HU-9 CA1, CA3; RNF-8 (logo configurable); §10 `/pantalla`, `/admin` (tablero); HU-4 CA6 (botones de modo de pantalla en el tablero).

**Files:**
- Create: `FRONT:src/views/PantallaView.vue`, `FRONT:src/views/admin/TableroView.vue`, `FRONT:public/logo-evento.svg`
- Modify: `FRONT:src/router/index.js` (ruta `/pantalla` pública; hijo `''` de `/admin` → `TableroView`)
- Test: `FRONT:src/views/__tests__/PantallaView.spec.js`, `FRONT:src/views/admin/__tests__/TableroView.spec.js`

**Interfaces:**
- Consumes: `useEventoStore`, `useTiempoReal`, `TRK-EVT-001/002/003`.
- Produces: `PantallaView` con dos ramas: `modoPantalla === 'PASARELA'` (esta tarea) y `'RANKING'` (Task 6.6). Logo desde `import.meta.env.VITE_LOGO_URL` o `${BASE_URL}logo-evento.svg`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/views/__tests__/PantallaView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn() }, tokenStorage: { leer: () => null, guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn((o) => { o.sincronizar(); return { conectado: { value: true } } }) }))

import { trk } from '@/services/api'
import { useTiempoReal } from '@/composables/useTiempoReal'
import PantallaView from '@/views/PantallaView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('modo pasarela: foto grande, nombre, disfraz y categoría (HU-9 CA1), sin login', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: { id: 'a', mascota_nombre: 'Canela', disfraz_nombre: 'Bruja', categoria: { nombre: 'Pequeños' }, foto_url: '/f.jpg' } } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(useTiempoReal.mock.calls[0][0].token).toBeNull()
  expect(w.text()).toContain('Canela')
  expect(w.text()).toContain('Bruja')
  expect(w.text()).toContain('Pequeños')
  expect(w.get('img[alt="Canela"]').attributes('src')).toBe('/f.jpg')
})

test('sin nadie en pasarela muestra el logo del evento', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: null } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.find('[data-test="logo"]').exists()).toBe(true)
})
```

`FRONT:src/views/admin/__tests__/TableroView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn(() => ({ conectado: { value: true } })) }))

import { trk } from '@/services/api'
import TableroView from '@/views/admin/TableroView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: {
    calificables: 2,
    categorias: [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños', abierta: true, ranking_publicado: false, total: 2, por_estado: { INSCRITO: 0, PRESENTE: 0, EN_PASARELA: 1, PRESENTADO: 1, AUSENTE: 0 } }],
    jurados: [{ id: 5, nombre: 'J1', activo: true, calificadas: 1, pendientes: 1 }]
  } })
})

test('muestra contadores y progreso por jurado', async () => {
  const w = mount(TableroView)
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/evento/tablero')
  expect(w.text()).toContain('Pequeños')
  expect(w.text()).toContain('J1')
  expect(w.text()).toContain('1 / 2')
})

test('cambia la pantalla a modo pasarela', async () => {
  trk.put.mockResolvedValue({ data: { modo_pantalla: 'PASARELA' } })
  const w = mount(TableroView)
  await flushPromises()
  await w.get('[data-test="pantalla-pasarela"]').trigger('click')
  expect(trk.put).toHaveBeenCalledWith('/evento/pantalla', { modo: 'PASARELA' })
})
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd FRONT && npx vitest run src/views`
Expected: FAIL en las dos nuevas.

- [ ] **Step 3: Implementar**

`FRONT:public/logo-evento.svg` (reemplazable por el logo oficial de Los Olivos sin tocar código, o vía `VITE_LOGO_URL`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><rect width="320" height="120" rx="24" fill="#47206A"/><circle cx="60" cy="64" r="36" fill="#E8711A"/><rect x="56" y="22" width="8" height="14" rx="4" fill="#200E31"/><text x="110" y="58" font-family="Inter,sans-serif" font-size="30" font-weight="800" fill="#FFF6E6">TRIKIPELUDOS</text><text x="110" y="88" font-family="Inter,sans-serif" font-size="16" fill="#FFC499">Serfunorte · Los Olivos</text></svg>
```

`FRONT:src/views/PantallaView.vue`:

```vue
<script setup>
import { computed } from 'vue'
import { useEventoStore } from '@/stores/evento'
import { useTiempoReal } from '@/composables/useTiempoReal'
import FotoMascota from '@/components/FotoMascota.vue'

const evento = useEventoStore()
const logo = import.meta.env.VITE_LOGO_URL || `${import.meta.env.BASE_URL}logo-evento.svg`
const p = computed(() => evento.enPasarela)

useTiempoReal({
  token: null,
  sincronizar: () => evento.sincronizar(),
  eventos: {
    'pasarela:cambio': (m) => evento.alCambioPasarela(m),
    'foto:nueva': (m) => evento.alFotoNueva(m),
    'pantalla:modo': (estado) => evento.aplicarEstado(estado),
    'ranking:publicado': () => evento.sincronizar()
  }
})
</script>

<template>
  <main class="flex min-h-screen flex-col bg-morado-900 p-6 text-crema">
    <header class="mb-4 flex items-center justify-between">
      <img :src="logo" alt="TRIKIPELUDOS" class="h-16" />
      <span v-if="p && evento.modoPantalla === 'PASARELA'" class="text-3xl font-bold text-calabaza-300">🎃 En pasarela</span>
    </header>

    <section v-if="evento.modoPantalla === 'PASARELA'" class="flex flex-1 items-center justify-center">
      <div v-if="p" class="grid w-full max-w-6xl items-center gap-8 md:grid-cols-2">
        <FotoMascota :participante="p" clase="aspect-[4/5] w-full max-h-[80vh] rounded-3xl shadow-2xl" />
        <div class="flex flex-col gap-4 text-center md:text-left">
          <h1 class="text-6xl font-extrabold md:text-7xl">{{ p.mascota_nombre }}</h1>
          <p v-if="p.disfraz_nombre" class="text-4xl text-calabaza-300">«{{ p.disfraz_nombre }}»</p>
          <p v-if="p.categoria" class="text-3xl text-morado-100">{{ p.categoria.nombre }}</p>
        </div>
      </div>
      <img v-else data-test="logo" :src="logo" alt="TRIKIPELUDOS" class="w-full max-w-xl" />
    </section>
  </main>
</template>
```

`FRONT:src/views/admin/TableroView.vue`:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'

const auth = useAuthStore()
const datos = ref(null)
const error = ref('')
const ESTADOS = [['INSCRITO', 'Inscritos'], ['PRESENTE', 'Presentes'], ['EN_PASARELA', 'En pasarela'], ['PRESENTADO', 'Presentados'], ['AUSENTE', 'Ausentes']]

async function cargar() {
  try { datos.value = (await trk.get('/evento/tablero')).data } catch (e) { error.value = mensajeDeError(e) }
}
async function pantalla(cuerpo) {
  error.value = ''
  try { await trk.put('/evento/pantalla', cuerpo) } catch (e) { error.value = mensajeDeError(e) }
}

useTiempoReal({
  token: auth.token,
  sincronizar: cargar,
  intervaloMs: 10000,
  eventos: { 'calificacion:recibida': cargar, 'participante:actualizado': cargar, 'pasarela:cambio': cargar, 'foto:nueva': cargar }
})
onMounted(cargar)
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold">Tablero</h2>
      <div class="flex gap-2">
        <a class="btn-claro" href="../pantalla" target="_blank" rel="noopener">Abrir pantalla</a>
        <button class="btn-secundario" data-test="pantalla-pasarela" @click="pantalla({ modo: 'PASARELA' })">Pantalla: pasarela</button>
      </div>
    </div>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
    <template v-if="datos">
      <div class="grid gap-3 sm:grid-cols-2">
        <article v-for="c in datos.categorias" :key="c.id" class="tarjeta">
          <h3 class="font-bold">{{ c.nombre }} <span class="text-sm font-normal">({{ c.total }})</span></h3>
          <p class="text-sm text-morado-600">{{ c.abierta ? 'Abierta' : 'Cerrada' }} · {{ c.ranking_publicado ? 'Publicada' : 'Sin publicar' }}</p>
          <dl class="mt-2 grid grid-cols-3 gap-1 text-sm">
            <template v-for="[clave, texto] in ESTADOS" :key="clave"><dt>{{ texto }}</dt><dd class="col-span-2 font-semibold">{{ c.por_estado[clave] }}</dd></template>
          </dl>
        </article>
      </div>
      <article class="tarjeta">
        <h3 class="mb-2 font-bold">Progreso de jurados ({{ datos.calificables }} mascotas calificables)</h3>
        <ul class="flex flex-col gap-2">
          <li v-for="j in datos.jurados" :key="j.id">
            <div class="flex justify-between"><span>{{ j.nombre }}<span v-if="!j.activo"> (inactivo)</span></span><span>{{ j.calificadas }} / {{ datos.calificables }}</span></div>
            <div class="h-2 overflow-hidden rounded-full bg-morado-100"><div class="h-full bg-calabaza-600" :style="{ width: datos.calificables ? `${(j.calificadas / datos.calificables) * 100}%` : '0%' }" /></div>
          </li>
        </ul>
      </article>
    </template>
  </section>
</template>
```

En `FRONT:src/router/index.js`:
- agregar `{ path: '/pantalla', component: () => import('@/views/PantallaView.vue'), meta: { publica: true } },`
- en los `children` de `/admin`, reemplazar `{ path: '', redirect: '/admin/usuarios' },` por `{ path: '', component: () => import('@/views/admin/TableroView.vue') },`

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src public
git commit -m "feat(front): pantalla publica en modo pasarela y tablero del admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4.7: E2E: cambio de pasarela visible en < 2 s en 3 clientes

Cubre: §12 Fase 4 ("Cambio de pasarela visible en < 2 s en 3 clientes"), HU-7 CA2.

**Files:**
- Modify: `BACK:src/trk/testing/semillaE2E.js` (participantes `PRESENTE` para pasarela)
- Create: `FRONT:e2e/pasarela.spec.js`

**Interfaces:**
- Produces: participantes E2E adicionales `Toby` (PEQ_MED, PRESENTE, orden 1, foto ninguna) y `Kira` (PEQ_MED, PRESENTE, orden 2).

- [ ] **Step 1: Ampliar la semilla** — en `semillaE2E()` de `BACK:src/trk/testing/semillaE2E.js`, antes del `return`:

```js
  await crearParticipante({ mascota_nombre: 'Toby', estado: 'PRESENTE', orden_pasarela: 1, responsable_nombre: 'Julián Sol', responsable_documento: '1004', disfraz_nombre: 'Superhéroe' });
  await crearParticipante({ mascota_nombre: 'Kira', estado: 'PRESENTE', orden_pasarela: 2, responsable_nombre: 'Marta Luna', responsable_documento: '1005', disfraz_nombre: 'Abejita' });
```

- [ ] **Step 2: Escribir la prueba E2E**

`FRONT:e2e/pasarela.spec.js`:

```js
import { test, expect } from '@playwright/test'
import { nuevoContexto, entrarConPin, sinScrollHorizontal } from './utilidades'

test('comentarista llama a pasarela y 2 pantallas + el propio comentarista lo ven en < 2 s', async ({ browser }) => {
  const ctxComentarista = await nuevoContexto(browser)
  const ctxPantalla1 = await nuevoContexto(browser)
  const ctxPantalla2 = await nuevoContexto(browser)
  const comentarista = await ctxComentarista.newPage()
  const pantalla1 = await ctxPantalla1.newPage()
  const pantalla2 = await ctxPantalla2.newPage()

  await entrarConPin(comentarista, 'Comentarista E2E', '222222')
  await expect(comentarista).toHaveURL(/comentarista/)
  expect(await sinScrollHorizontal(comentarista)).toBe(true)
  await pantalla1.goto('pantalla')
  await pantalla2.goto('pantalla')
  // No se asume pantalla vacía: otros archivos E2E pueden haber dejado una mascota en pasarela.
  await expect(pantalla1.locator('main')).toBeVisible()
  await expect(pantalla2.locator('main')).toBeVisible()

  await expect(comentarista.getByTestId('ficha')).toContainText('Toby')
  const inicio = Date.now()
  await comentarista.getByTestId('llamar').click()
  await Promise.all([
    expect(pantalla1.getByRole('heading', { name: 'Toby' })).toBeVisible({ timeout: 2000 }),
    expect(pantalla2.getByRole('heading', { name: 'Toby' })).toBeVisible({ timeout: 2000 }),
    expect(comentarista.getByTestId('llamar')).toHaveText(/En pasarela/, { timeout: 2000 })
  ])
  expect(Date.now() - inicio).toBeLessThan(2000)

  await comentarista.getByTestId('siguiente').click()
  await comentarista.getByTestId('llamar').click()
  await expect(pantalla1.getByRole('heading', { name: 'Kira' })).toBeVisible({ timeout: 2000 })

  await Promise.all([ctxComentarista.close(), ctxPantalla1.close(), ctxPantalla2.close()])
})
```

> La Task 5.5 agrega el jurado como cliente adicional de esta misma prueba.

- [ ] **Step 3: Correr y verificar**

Run: `cd FRONT && npx playwright test`
Expected: PASS (cabina + pasarela).

- [ ] **Step 4: Commit** (dos repos)

```bash
cd BACK && git add src/trk && git commit -m "test(trk): semilla E2E con mascotas presentes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd ../peludos && git add e2e && git commit -m "test(front): E2E de pasarela en tiempo real con 3 clientes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Cierre de Fase 4

- [ ] Run: suite completa + Playwright. Reportar al usuario y esperar aprobación.

---

## Fase 5 — Jurado: calificación, bloqueo y cola offline

**Hecho cuando:** pasan las pruebas de R1, R2, R7, idempotencia (§13.1–13.3) y el E2E del jurado (incluido sin conexión).

### Task 5.1: Servicio de calificación (R1, R2, R7, idempotencia)

Cubre: R1, R2, R7, HU-8 CA4, CA5 (servidor idempotente), CA6, HU-4 CA1 (categoría cerrada), §13.1, §13.2, §13.3 (bloqueo), RNF-6; §9.1 `TRK-CAL-002`.

**Files:**
- Create: `BACK:src/trk/services/calificaciones.service.js`, `BACK:src/trk/controllers/calificaciones.controller.js`, `BACK:src/trk/routes/calificaciones.routes.js`
- Modify: `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`, `BACK:src/trk/testing/fabricas.js` (`calificar`, `puntajesMaximos`)
- Test: `BACK:src/trk/services/__tests__/validarPuntajes.test.js`, `BACK:src/trk/routes/__tests__/calificaciones.int.test.js`

**Interfaces:**
- Produces:
  - `validarPuntajes(criterios: [{ id, nombre, puntaje_max }], puntajes: [{ criterio_id, puntaje }]) → total` (lanza 400 `VALIDACION` por criterio repetido/ajeno, 422 `CRITERIO_FALTANTE`, 422 `PUNTAJE_FUERA_DE_RANGO`).
  - `enviarCalificacion(participanteId, puntajes, ctx) → Calificacion` donde `Calificacion = { id, participante_id, jurado_id, total, bloqueada, enviada_at, puntajes: [{ criterio_id, puntaje }] }`. Reenvío idéntico de una bloqueada → misma calificación sin escribir; distinto → 409 `CALIFICACION_BLOQUEADA`. Solo `EN_PASARELA`/`PRESENTADO` (si no, 409 `ESTADO_INVALIDO`); categoría cerrada → 409 `CATEGORIA_CERRADA`. Emite `calificacion:recibida` solo a `admin`.
  - `vistaCalificacion(modeloConDetalles) → Calificacion`.
  - Fábricas: `criteriosDe(participante) → TrkCriterio[]`, `calificar(participante, juradoUsuario, puntajesPorCodigo) → TrkCalificacion` (inserta directo, bloqueada).

- [ ] **Step 1: Escribir las pruebas que fallan**

`BACK:src/trk/services/__tests__/validarPuntajes.test.js`:

```js
const { validarPuntajes } = require('../calificaciones.service');

// Fixture de prueba: los máximos reales viven en BD (seed); aquí solo importan para la regla.
const criterios = [
  { id: 1, nombre: 'Creatividad', puntaje_max: 35 },
  { id: 2, nombre: 'Seguridad', puntaje_max: 30 },
  { id: 3, nombre: 'Elaboración', puntaje_max: 20 },
  { id: 4, nombre: 'Pasarela', puntaje_max: 15 }
];
const p = (...v) => v.map((puntaje, i) => ({ criterio_id: i + 1, puntaje }));

test('R2: total = suma de criterios', () => {
  expect(validarPuntajes(criterios, p(30, 25, 10, 5))).toBe(70);
  expect(validarPuntajes(criterios, p(0, 0, 0, 0))).toBe(0);
  expect(validarPuntajes(criterios, p(35, 30, 20, 15))).toBe(100);
});

test('§13.1 / R1: criterio > máximo → 422 PUNTAJE_FUERA_DE_RANGO', () => {
  expect(() => validarPuntajes(criterios, p(36, 0, 0, 0))).toThrow(expect.objectContaining({ statusCode: 422, motivo: 'PUNTAJE_FUERA_DE_RANGO' }));
  expect(() => validarPuntajes(criterios, p(-1, 0, 0, 0))).toThrow(expect.objectContaining({ statusCode: 422 }));
  expect(() => validarPuntajes(criterios, p(1.5, 0, 0, 0))).toThrow(expect.objectContaining({ statusCode: 422 }));
});

test('HU-8 CA4: criterio sin valor explícito → 422 CRITERIO_FALTANTE', () => {
  expect(() => validarPuntajes(criterios, p(10, 10, 10))).toThrow(expect.objectContaining({ statusCode: 422, motivo: 'CRITERIO_FALTANTE' }));
});

test('criterio repetido o de otra rúbrica → 400', () => {
  expect(() => validarPuntajes(criterios, [...p(1, 1, 1, 1), { criterio_id: 1, puntaje: 2 }])).toThrow(expect.objectContaining({ statusCode: 400 }));
  expect(() => validarPuntajes(criterios, [...p(1, 1, 1, 1), { criterio_id: 99, puntaje: 2 }])).toThrow(expect.objectContaining({ statusCode: 400 }));
});
```

`BACK:src/trk/routes/__tests__/calificaciones.int.test.js`:

```js
const request = require('supertest');
const db = require('../../../models');
const { bus } = require('../../sockets/bus');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearOperativo, crearParticipante, criteriosDe, categoria } = require('../../testing/fabricas');

const app = crearAppTrk();
let jurado; let eventos;
const escuchar = (e) => eventos.push(e);
beforeEach(async () => {
  await limpiar();
  jurado = await crearOperativo('TRK_JURADO');
  eventos = [];
  bus.on('trk', escuchar);
});
afterEach(() => bus.off('trk', escuchar));
afterAll(cerrar);

// Puntajes válidos tomados de la BD (maximo - k), sin constantes de rúbrica en la prueba.
async function puntajes(participante, k = 1) {
  return (await criteriosDe(participante)).map((c) => ({ criterio_id: c.id, puntaje: Math.max(c.puntaje_max - k, 0) }));
}
const enviar = (p, cuerpo, quien = jurado) => request(app).put(`/api/trk/v1/calificaciones/${p.id}`).set('Authorization', `Bearer ${quien.token}`).send(cuerpo);

test('TRK-CAL-002 crea y bloquea la calificación; el total lo calcula el servidor (CA6)', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const ps = await puntajes(p, 2);
  const r = await enviar(p, { puntajes: ps, total: 999 });
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-CAL-002');
  expect(r.body.data).toMatchObject({ participante_id: p.id, jurado_id: jurado.usuario.id, bloqueada: true, total: ps.reduce((s, x) => s + x.puntaje, 0) });
  expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-CAL-002', accion: 'CREAR', entidad: 'calificacion' } })).toBe(1);
  expect(eventos.filter((e) => e.evento === 'calificacion:recibida').map((e) => e.rooms)).toEqual([['admin']]);
});

test('§13.1 criterio por encima del máximo → 422 sin guardar', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const ps = await puntajes(p, 0);
  ps[0].puntaje += 1;
  const r = await enviar(p, { puntajes: ps });
  expect(r.status).toBe(422);
  expect(r.body).toMatchObject({ error: 'TRK-CAL-002', motivo: 'PUNTAJE_FUERA_DE_RANGO' });
  expect(await db.TrkCalificacion.count()).toBe(0);
});

test('§13.2 reintento offline idéntico → una sola fila y 200 sin error', async () => {
  const p = await crearParticipante({ estado: 'PRESENTADO' });
  const ps = await puntajes(p);
  const [r1, r2] = await Promise.all([enviar(p, { puntajes: ps }), enviar(p, { puntajes: ps })]);
  const r3 = await enviar(p, { puntajes: ps });
  expect([r1.status, r2.status, r3.status]).toEqual([200, 200, 200]);
  expect(await db.TrkCalificacion.count({ where: { participante_id: p.id } })).toBe(1);
  expect(await db.TrkCalificacionDetalle.count()).toBe(ps.length);
  expect(await db.TrkAuditoria.count({ where: { entidad: 'calificacion' } })).toBe(1);
});

test('§13.3 modificar una calificación bloqueada → 409 CALIFICACION_BLOQUEADA', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const ps = await puntajes(p);
  await enviar(p, { puntajes: ps });
  const distinto = ps.map((x, i) => (i === 0 ? { ...x, puntaje: x.puntaje - 1 } : x));
  const r = await enviar(p, { puntajes: distinto });
  expect(r.status).toBe(409);
  expect(r.body.motivo).toBe('CALIFICACION_BLOQUEADA');
});

test('mascota que aún no sale a pasarela → 409 ESTADO_INVALIDO', async () => {
  const p = await crearParticipante({ estado: 'PRESENTE' });
  const r = await enviar(p, { puntajes: await puntajes(p) });
  expect(r.status).toBe(409);
  expect(r.body.motivo).toBe('ESTADO_INVALIDO');
});

test('HU-4 CA1 categoría cerrada → 409 CATEGORIA_CERRADA', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  await (await categoria('PEQ_MED')).update({ abierta: false });
  const r = await enviar(p, { puntajes: await puntajes(p) });
  expect(r.status).toBe(409);
  expect(r.body.motivo).toBe('CATEGORIA_CERRADA');
});

test('rúbrica FAMILIAR exige su criterio adicional (los criterios vienen de la categoría)', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA', categoriaCodigo: 'FAMILIAR' });
  const ps = await puntajes(p);
  const r = await enviar(p, { puntajes: ps.slice(0, -1) });
  expect(r.status).toBe(422);
  expect(r.body.motivo).toBe('CRITERIO_FALTANTE');
  expect((await enviar(p, { puntajes: ps })).status).toBe(200);
});

test('solo jurados califican → cabina 403', async () => {
  const cabina = await crearOperativo('TRK_CABINA');
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const r = await enviar(p, { puntajes: await puntajes(p) }, cabina);
  expect(r.status).toBe(403);
});
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd BACK && npx jest src/trk/services/__tests__/validarPuntajes.test.js && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/calificaciones.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Agregar a `BACK:src/trk/testing/fabricas.js` (y exportar `criteriosDe`, `calificar`):

```js
async function criteriosDe(participante) {
  const cat = await db.TrkCategoria.findByPk(participante.categoria_id);
  return db.TrkCriterio.findAll({ where: { rubrica_id: cat.rubrica_id }, order: [['orden', 'ASC']] });
}

// Inserta una calificación bloqueada directo en BD (para pruebas de ranking, fusión, etc.).
async function calificar(participante, juradoUsuario, puntajesPorCodigo) {
  const criterios = await criteriosDe(participante);
  const total = criterios.reduce((s, c) => s + puntajesPorCodigo[c.codigo], 0);
  const cal = await db.TrkCalificacion.create({ participante_id: participante.id, jurado_id: juradoUsuario.id, total, enviada_at: new Date(), bloqueada: true });
  await db.TrkCalificacionDetalle.bulkCreate(criterios.map((c) => ({ calificacion_id: cal.id, criterio_id: c.id, puntaje: puntajesPorCodigo[c.codigo] })));
  return cal;
}
```

`BACK:src/trk/services/calificaciones.service.js`:

```js
// ============================================
// Calificaciones (HU-8): R1 rango por criterio, R2 total = suma, R7 bloqueo, idempotencia.
// Los máximos se leen de trk_criterios; nunca de constantes.
// ============================================
const db = require('../../models');
const TrkError = require('../utils/TrkError');
const { registrarAuditoria } = require('./auditoria.service');
const { buscarModelo } = require('./participantes.service');
const { emitir } = require('../sockets/bus');

const CALIFICABLES = ['EN_PASARELA', 'PRESENTADO'];

function validarPuntajes(criterios, puntajes) {
  const porCriterio = new Map(puntajes.map((p) => [Number(p.criterio_id), p.puntaje]));
  if (porCriterio.size !== puntajes.length) throw new TrkError(400, 'VALIDACION', 'Hay criterios repetidos');
  const ajenos = [...porCriterio.keys()].filter((id) => !criterios.some((c) => c.id === id));
  if (ajenos.length) throw new TrkError(400, 'VALIDACION', 'Hay criterios que no pertenecen a la rúbrica de la categoría');
  const faltantes = criterios.filter((c) => !porCriterio.has(c.id));
  if (faltantes.length) throw new TrkError(422, 'CRITERIO_FALTANTE', `Falta calificar: ${faltantes.map((c) => c.nombre).join(', ')}`);
  let total = 0;
  for (const c of criterios) {
    const v = porCriterio.get(c.id);
    if (!Number.isInteger(v) || v < 0 || v > c.puntaje_max) {
      throw new TrkError(422, 'PUNTAJE_FUERA_DE_RANGO', `${c.nombre} debe ser un entero entre 0 y ${c.puntaje_max}`);
    }
    total += v;
  }
  return total;
}

function vistaCalificacion(cal) {
  return {
    id: cal.id,
    participante_id: cal.participante_id,
    jurado_id: cal.jurado_id,
    total: cal.total,
    bloqueada: Boolean(cal.bloqueada),
    enviada_at: cal.enviada_at,
    puntajes: (cal.detalles || []).map((d) => ({ criterio_id: d.criterio_id, puntaje: d.puntaje })).sort((a, b) => a.criterio_id - b.criterio_id)
  };
}

const conDetalles = { include: [{ model: db.TrkCalificacionDetalle, as: 'detalles' }] };
const mismos = (a, b) => Object.keys(b).length === Object.keys(a).length && Object.keys(b).every((k) => a[k] === b[k]);

async function enviarCalificacion(participanteId, puntajes, ctx, intento = 0) {
  try {
    const { calificacion, repetida } = await db.sequelize.transaction(async (transaction) => {
      // El bloqueo de la fila del participante serializa envíos simultáneos (reintentos offline).
      const p = await buscarModelo(participanteId, { transaction, lock: true });
      if (!CALIFICABLES.includes(p.estado)) throw new TrkError(409, 'ESTADO_INVALIDO', 'La mascota aún no ha salido a pasarela');
      const categoria = await db.TrkCategoria.findByPk(p.categoria_id, { transaction });
      if (!categoria.abierta) throw new TrkError(409, 'CATEGORIA_CERRADA', 'La categoría está cerrada; ya no se puede calificar');
      const criterios = await db.TrkCriterio.findAll({ where: { rubrica_id: categoria.rubrica_id }, order: [['orden', 'ASC']], transaction });
      const total = validarPuntajes(criterios, puntajes);
      const nuevos = Object.fromEntries(puntajes.map((x) => [Number(x.criterio_id), x.puntaje]));

      const existente = await db.TrkCalificacion.findOne({
        where: { participante_id: p.id, jurado_id: ctx.usuarioId }, ...conDetalles, transaction, lock: transaction.LOCK.UPDATE
      });
      if (existente) {
        const actuales = Object.fromEntries(existente.detalles.map((d) => [d.criterio_id, d.puntaje]));
        if (existente.bloqueada) {
          if (mismos(actuales, nuevos)) return { calificacion: existente, repetida: true };
          throw new TrkError(409, 'CALIFICACION_BLOQUEADA', 'La calificación ya fue enviada y está bloqueada');
        }
        const antes = { total: existente.total, puntajes: actuales };
        await db.TrkCalificacionDetalle.destroy({ where: { calificacion_id: existente.id }, transaction });
        await db.TrkCalificacionDetalle.bulkCreate(criterios.map((c) => ({ calificacion_id: existente.id, criterio_id: c.id, puntaje: nuevos[c.id] })), { transaction });
        await existente.update({ total, bloqueada: true, enviada_at: new Date() }, { transaction });
        await registrarAuditoria(ctx, { entidad: 'calificacion', entidadId: existente.id, accion: 'REENVIAR', antes, despues: { total, puntajes: nuevos } }, { transaction });
        return { calificacion: await existente.reload({ ...conDetalles, transaction }), repetida: false };
      }

      const cal = await db.TrkCalificacion.create({ participante_id: p.id, jurado_id: ctx.usuarioId, total, enviada_at: new Date(), bloqueada: true }, { transaction });
      await db.TrkCalificacionDetalle.bulkCreate(criterios.map((c) => ({ calificacion_id: cal.id, criterio_id: c.id, puntaje: nuevos[c.id] })), { transaction });
      await registrarAuditoria(ctx, { entidad: 'calificacion', entidadId: cal.id, accion: 'CREAR', despues: { participante_id: p.id, total, puntajes: nuevos } }, { transaction });
      return { calificacion: await cal.reload({ ...conDetalles, transaction }), repetida: false };
    });

    if (!repetida) {
      emitir('calificacion:recibida', { participante_id: calificacion.participante_id, jurado_id: calificacion.jurado_id, total: calificacion.total }, { rooms: ['admin'] });
    }
    return vistaCalificacion(calificacion);
  } catch (e) {
    if (e && e.name === 'SequelizeUniqueConstraintError' && intento === 0) return enviarCalificacion(participanteId, puntajes, ctx, 1);
    throw e;
  }
}

module.exports = { validarPuntajes, enviarCalificacion, vistaCalificacion, conDetalles };
```

`BACK:src/trk/controllers/calificaciones.controller.js`:

```js
const svc = require('../services/calificaciones.service');
const { ok } = require('../utils/respuesta');
const { ctxDe } = require('../utils/ctx');

exports.enviar = async (req, res) => ok(res, await svc.enviarCalificacion(req.params.participanteId, req.body.puntajes, ctxDe(req)));
```

`BACK:src/trk/routes/calificaciones.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth, trkPermiso } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const ctrl = require('../controllers/calificaciones.controller');

const esquemaParticipante = Joi.object({ participanteId: Joi.string().guid({ version: 'uuidv4' }).required() });
// Joi solo exige forma; el rango por criterio (R1) lo valida el servicio con los máximos de BD → 422.
const esquemaEnvio = Joi.object({
  puntajes: Joi.array().items(Joi.object({
    criterio_id: Joi.number().integer().positive().required(),
    puntaje: Joi.number().required()
  })).min(1).required()
});

const router = express.Router();
router.put('/:participanteId', apiCodigo('TRK-CAL-002'), trkAuth, trkPermiso('calificar'), validar(esquemaParticipante, 'params'), validar(esquemaEnvio), aw(ctrl.enviar));

module.exports = { prefijo: '/calificaciones', router };
```

En `BACK:src/trk/routes/index.js` agregar `require('./calificaciones.routes'),`. En `BACK:src/trk/config/apiCodigos.js`:
`'TRK-CAL-002': { metodo: 'PUT', ruta: '/calificaciones/:participanteId', descripcion: 'Crea/envía calificación (idempotente, bloquea)' },`

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): calificacion idempotente con validacion por rubrica de BD y bloqueo (R1, R2, R7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5.2: Rúbrica de la categoría, mis calificaciones y desbloqueo

Cubre: HU-8 CA1 (insignias), CA2 (criterios con máximo y descripción), R7 (desbloqueo solo admin, auditado), R8, §13.3 (completo); §9.1 `TRK-RUB-001`, `TRK-CAL-001`, `TRK-CAL-003`.

**Files:**
- Create: `BACK:src/trk/controllers/rubricas.controller.js`, `BACK:src/trk/routes/rubricas.routes.js`
- Modify: `BACK:src/trk/services/calificaciones.service.js` (`rubricaDeCategoria`, `misCalificaciones`, `desbloquear`), `BACK:src/trk/controllers/calificaciones.controller.js`, `BACK:src/trk/routes/calificaciones.routes.js`, `BACK:src/trk/middleware/trkAuth.js` (`trkPermisoAlguno`), `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/routes/__tests__/rubricas.int.test.js`, `BACK:src/trk/routes/__tests__/desbloqueo.int.test.js`

**Interfaces:**
- Produces:
  - `rubricaDeCategoria(categoriaId) → { categoria: { id, codigo, nombre, abierta }, rubrica: { codigo, nombre }, criterios: [{ id, codigo, nombre, descripcion, puntaje_max, orden }], puntaje_total_max }`.
  - `misCalificaciones(juradoId) → [{ id, participante_id, total, bloqueada }]` (solo las propias, R8).
  - `desbloquear(calificacionId, ctx) → Calificacion` (409 `NO_BLOQUEADA` si ya está desbloqueada; auditoría `DESBLOQUEAR`).
  - `trkPermisoAlguno(...acciones) → middleware` (403 `SIN_PERMISO` si no tiene ninguna).

- [ ] **Step 1: Escribir las pruebas que fallan**

`BACK:src/trk/routes/__tests__/rubricas.int.test.js`:

```js
const request = require('supertest');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria, calificar } = require('../../testing/fabricas');
const db = require('../../../models');

const app = crearAppTrk();
beforeEach(limpiar);
afterAll(cerrar);

test('TRK-RUB-001 devuelve criterios de la rúbrica de la categoría con máximo y descripción (HU-8 CA2)', async () => {
  const jurado = await crearOperativo('TRK_JURADO');
  const fam = await categoria('FAMILIAR');
  const r = await request(app).get(`/api/trk/v1/rubricas/${fam.id}`).set('Authorization', `Bearer ${jurado.token}`);
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-RUB-001');
  const enBd = await db.TrkCriterio.findAll({ where: { rubrica_id: fam.rubrica_id }, order: [['orden', 'ASC']] });
  expect(r.body.data.criterios.map((c) => [c.codigo, c.puntaje_max])).toEqual(enBd.map((c) => [c.codigo, c.puntaje_max]));
  expect(r.body.data.criterios[0].descripcion).toEqual(expect.any(String));
  expect(r.body.data.puntaje_total_max).toBe(enBd.reduce((s, c) => s + c.puntaje_max, 0));
});

test('admin también puede ver la rúbrica; cabina no', async () => {
  const admin = await crearAdmin();
  const cabina = await crearOperativo('TRK_CABINA');
  const cat = await categoria('PEQ_MED');
  expect((await request(app).get(`/api/trk/v1/rubricas/${cat.id}`).set('Authorization', `Bearer ${admin.token}`)).status).toBe(200);
  expect((await request(app).get(`/api/trk/v1/rubricas/${cat.id}`).set('Authorization', `Bearer ${cabina.token}`)).status).toBe(403);
});

test('TRK-CAL-001 cada jurado ve solo sus calificaciones (R8)', async () => {
  const j1 = await crearOperativo('TRK_JURADO');
  const j2 = await crearOperativo('TRK_JURADO');
  const a = await crearParticipante({ estado: 'PRESENTADO' });
  const b = await crearParticipante({ estado: 'PRESENTADO' });
  const max = { CREATIVIDAD: 10, SEGURIDAD: 10, ELABORACION: 10, PASARELA: 10 };
  await calificar(a, j1.usuario, max);
  await calificar(b, j2.usuario, max);
  const r = await request(app).get('/api/trk/v1/calificaciones/mias').set('Authorization', `Bearer ${j1.token}`);
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-CAL-001');
  expect(r.body.data.map((c) => c.participante_id)).toEqual([a.id]);
});
```

`BACK:src/trk/routes/__tests__/desbloqueo.int.test.js`:

```js
const request = require('supertest');
const db = require('../../../models');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, criteriosDe } = require('../../testing/fabricas');

const app = crearAppTrk();
let admin; let jurado;
beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
  jurado = await crearOperativo('TRK_JURADO');
});
afterAll(cerrar);

const puntajes = async (p, k) => (await criteriosDe(p)).map((c) => ({ criterio_id: c.id, puntaje: Math.max(c.puntaje_max - k, 0) }));
const enviar = (p, ps) => request(app).put(`/api/trk/v1/calificaciones/${p.id}`).set('Authorization', `Bearer ${jurado.token}`).send({ puntajes: ps });
const desbloquear = (id, quien = admin) => request(app).post(`/api/trk/v1/calificaciones/${id}/desbloquear`).set('Authorization', `Bearer ${quien.token}`);

test('§13.3 bloqueada → 409; tras desbloqueo del admin se permite modificar y queda auditado', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const cal = (await enviar(p, await puntajes(p, 1))).body.data;
  expect((await enviar(p, await puntajes(p, 3))).status).toBe(409);

  const r = await desbloquear(cal.id);
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-CAL-003');
  expect(r.body.data.bloqueada).toBe(false);

  const nuevos = await puntajes(p, 3);
  const reenvio = await enviar(p, nuevos);
  expect(reenvio.status).toBe(200);
  expect(reenvio.body.data).toMatchObject({ bloqueada: true, total: nuevos.reduce((s, x) => s + x.puntaje, 0) });

  const acciones = (await db.TrkAuditoria.findAll({ where: { entidad: 'calificacion', entidad_id: String(cal.id) }, order: [['id', 'ASC']] }))
    .map((a) => [a.accion, a.api_codigo]);
  expect(acciones).toEqual([['CREAR', 'TRK-CAL-002'], ['DESBLOQUEAR', 'TRK-CAL-003'], ['REENVIAR', 'TRK-CAL-002']]);
  const desb = await db.TrkAuditoria.findOne({ where: { accion: 'DESBLOQUEAR' } });
  expect(desb.usuario_id).toBe(admin.usuario.id);
  expect(desb.antes).toMatchObject({ bloqueada: true });
});

test('solo el admin desbloquea (R7)', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const cal = (await enviar(p, await puntajes(p, 1))).body.data;
  expect((await desbloquear(cal.id, jurado)).status).toBe(403);
});

test('desbloquear una no bloqueada → 409 NO_BLOQUEADA', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const cal = (await enviar(p, await puntajes(p, 1))).body.data;
  await desbloquear(cal.id);
  const r = await desbloquear(cal.id);
  expect(r.status).toBe(409);
  expect(r.body.motivo).toBe('NO_BLOQUEADA');
});
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/rubricas.int.test.js src/trk/routes/__tests__/desbloqueo.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Agregar a `BACK:src/trk/middleware/trkAuth.js` (y exportar `trkPermisoAlguno`):

```js
const { tienePermiso } = require('../utils/permisos');

// Pasa si el usuario tiene alguno de los permisos TRK indicados (misma fuente: roles.permisos.trk).
const trkPermisoAlguno = (...acciones) => (req, res, next) => {
  if (acciones.some((a) => tienePermiso(req.usuario, a))) return next();
  return next(new TrkError(403, 'SIN_PERMISO', `Requiere uno de: ${acciones.join(', ')}`));
};
```

Agregar a `BACK:src/trk/services/calificaciones.service.js` (y exportar `rubricaDeCategoria`, `misCalificaciones`, `desbloquear`):

```js
async function rubricaDeCategoria(categoriaId) {
  const categoria = await db.TrkCategoria.findByPk(categoriaId, { include: [{ model: db.TrkRubrica, as: 'rubrica' }] });
  if (!categoria) throw new TrkError(404, 'NO_ENCONTRADO', 'Categoría no encontrada');
  const criterios = await db.TrkCriterio.findAll({ where: { rubrica_id: categoria.rubrica_id }, order: [['orden', 'ASC']] });
  return {
    categoria: { id: categoria.id, codigo: categoria.codigo, nombre: categoria.nombre, abierta: Boolean(categoria.abierta) },
    rubrica: { codigo: categoria.rubrica.codigo, nombre: categoria.rubrica.nombre },
    criterios: criterios.map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, descripcion: c.descripcion, puntaje_max: c.puntaje_max, orden: c.orden })),
    puntaje_total_max: criterios.reduce((s, c) => s + c.puntaje_max, 0)
  };
}

async function misCalificaciones(juradoId) {
  const filas = await db.TrkCalificacion.findAll({ where: { jurado_id: juradoId }, order: [['enviada_at', 'DESC']] });
  return filas.map((c) => ({ id: c.id, participante_id: c.participante_id, total: c.total, bloqueada: Boolean(c.bloqueada) }));
}

async function desbloquear(calificacionId, ctx) {
  const cal = await db.sequelize.transaction(async (transaction) => {
    const c = await db.TrkCalificacion.findByPk(calificacionId, { ...conDetalles, transaction, lock: transaction.LOCK.UPDATE });
    if (!c) throw new TrkError(404, 'NO_ENCONTRADO', 'Calificación no encontrada');
    if (!c.bloqueada) throw new TrkError(409, 'NO_BLOQUEADA', 'La calificación ya está desbloqueada');
    await c.update({ bloqueada: false, desbloqueada_at: new Date() }, { transaction });
    await registrarAuditoria(ctx, {
      entidad: 'calificacion', entidadId: c.id, accion: 'DESBLOQUEAR',
      antes: { bloqueada: true, total: c.total }, despues: { bloqueada: false }
    }, { transaction });
    return c;
  });
  return vistaCalificacion(cal);
}
```

Agregar a `BACK:src/trk/controllers/calificaciones.controller.js`:

```js
exports.mias = async (req, res) => ok(res, await svc.misCalificaciones(req.usuario.id));
exports.desbloquear = async (req, res) => ok(res, await svc.desbloquear(req.params.id, ctxDe(req)));
```

Agregar a `BACK:src/trk/routes/calificaciones.routes.js` (antes de la ruta PUT):

```js
const esquemaIdNum = Joi.object({ id: Joi.number().integer().positive().required() });
router.get('/mias', apiCodigo('TRK-CAL-001'), trkAuth, trkPermiso('calificar'), aw(ctrl.mias));
router.post('/:id/desbloquear', apiCodigo('TRK-CAL-003'), trkAuth, trkPermiso('calificaciones_desbloquear'), validar(esquemaIdNum, 'params'), aw(ctrl.desbloquear));
```

`BACK:src/trk/controllers/rubricas.controller.js`:

```js
const svc = require('../services/calificaciones.service');
const { ok } = require('../utils/respuesta');

exports.deCategoria = async (req, res) => ok(res, await svc.rubricaDeCategoria(req.params.categoriaId));
```

`BACK:src/trk/routes/rubricas.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth, trkPermisoAlguno } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const ctrl = require('../controllers/rubricas.controller');

const router = express.Router();
router.get('/:categoriaId', apiCodigo('TRK-RUB-001'), trkAuth, trkPermisoAlguno('calificar', 'administrar'),
  validar(Joi.object({ categoriaId: Joi.number().integer().positive().required() }), 'params'), aw(ctrl.deCategoria));

module.exports = { prefijo: '/rubricas', router };
```

En `BACK:src/trk/routes/index.js` agregar `require('./rubricas.routes'),`. En `BACK:src/trk/config/apiCodigos.js`:

```js
  'TRK-RUB-001': { metodo: 'GET', ruta: '/rubricas/:categoriaId', descripcion: 'Criterios de la rúbrica de la categoría' },
  'TRK-CAL-001': { metodo: 'GET', ruta: '/calificaciones/mias', descripcion: 'Calificaciones del jurado en sesión (insignias)' },
  'TRK-CAL-003': { metodo: 'POST', ruta: '/calificaciones/:id/desbloquear', descripcion: 'Desbloquea una calificación (auditado)' },
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): rubrica por categoria, mis calificaciones y desbloqueo auditado (R7, R8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5.3: Cola offline de calificaciones (IndexedDB) y PWA

Cubre: HU-8 CA5, RNF-4, D13.

**Files:**
- Create: `FRONT:src/utils/colaOffline.js`, `FRONT:src/stores/calificacion.js`
- Modify: `FRONT:vite.config.js` (`vite-plugin-pwa`)
- Test: `FRONT:src/stores/__tests__/calificacion.spec.js`

**Interfaces:**
- Produces:
  - `colaOffline.encolar({ juradoId, participanteId, puntajes })`, `obtener(juradoId, participanteId)`, `listar(juradoId) → Item[]`, `quitar(juradoId, participanteId)`; `Item = { juradoId, participanteId, puntajes, encoladaEn }`. Clave `${juradoId}:${participanteId}`.
  - `useCalificacionStore()` — state `{ pendientes: { [participanteId]: Item }, sincronizando }`; actions `cargarPendientes(juradoId)`, `enviar(juradoId, participanteId, puntajes) → { estado: 'ENVIADA' | 'PENDIENTE' | 'RECHAZADA', calificacion?, error? }`, `intentar(juradoId, participanteId)`, `sincronizar(juradoId)`, `iniciarAutoSincronizacion(juradoId, intervaloMs = 10000) → detener()`.
  - Reintentan (quedan `PENDIENTE`): sin conexión (`status 0`), 401, 408, 429, ≥ 500. Cualquier otro error (409/422/400/403/404) saca el ítem de la cola y devuelve `RECHAZADA`.

- [ ] **Step 1: Escribir la prueba que falla**

`FRONT:src/stores/__tests__/calificacion.spec.js`:

```js
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { clear, createStore } from 'idb-keyval'

vi.mock('@/services/api', () => ({ api: {}, trk: { put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))

import { trk } from '@/services/api'
import * as cola from '@/utils/colaOffline'
import { useCalificacionStore } from '@/stores/calificacion'

const PUNTAJES = [{ criterio_id: 1, puntaje: 10 }]

beforeEach(async () => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  await clear(createStore('trikipeludos', 'cola_calificaciones'))
})
afterEach(() => vi.useRealTimers())

test('envío exitoso no deja nada en la cola', async () => {
  trk.put.mockResolvedValue({ data: { id: 1, bloqueada: true } })
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(trk.put).toHaveBeenCalledWith('/calificaciones/p1', { puntajes: PUNTAJES })
  expect(r.estado).toBe('ENVIADA')
  expect(await cola.listar(7)).toEqual([])
  expect(s.pendientes).toEqual({})
})

test('sin conexión queda pendiente de sincronizar (CA5) y sobrevive a recargar', async () => {
  trk.put.mockRejectedValue({ status: 0, motivo: 'SIN_CONEXION' })
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('PENDIENTE')
  expect(s.pendientes.p1.puntajes).toEqual(PUNTAJES)
  setActivePinia(createPinia())
  const s2 = useCalificacionStore()
  await s2.cargarPendientes(7)
  expect(Object.keys(s2.pendientes)).toEqual(['p1'])
})

test('la cola es por jurado', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.enviar(7, 'p1', PUNTAJES)
  await s.cargarPendientes(8)
  expect(s.pendientes).toEqual({})
})

test('un 409/422 saca la calificación de la cola y se informa', async () => {
  trk.put.mockRejectedValue({ status: 409, motivo: 'CALIFICACION_BLOQUEADA', message: 'Bloqueada' })
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(r).toMatchObject({ estado: 'RECHAZADA', error: { motivo: 'CALIFICACION_BLOQUEADA' } })
  expect(await cola.listar(7)).toEqual([])
})

test('reintento automático al volver la conexión y cada 10 s', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  trk.put.mockRejectedValueOnce({ status: 0 }).mockResolvedValue({ data: { id: 1, bloqueada: true } })
  const s = useCalificacionStore()
  await s.enviar(7, 'p1', PUNTAJES)
  const detener = s.iniciarAutoSincronizacion(7)
  window.dispatchEvent(new Event('online'))
  await vi.waitFor(() => expect(s.pendientes).toEqual({}))
  detener()
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd FRONT && npx vitest run src/stores/__tests__/calificacion.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/utils/colaOffline.js`:

```js
import { createStore, get, set, del, entries } from 'idb-keyval'

// Cola persistente de calificaciones no sincronizadas (HU-8 CA5). Sobrevive a recargas y cierres.
const almacen = createStore('trikipeludos', 'cola_calificaciones')
const clave = (juradoId, participanteId) => `${juradoId}:${participanteId}`

export async function encolar({ juradoId, participanteId, puntajes }) {
  const item = { juradoId, participanteId, puntajes, encoladaEn: Date.now() }
  await set(clave(juradoId, participanteId), item, almacen)
  return item
}

export const obtener = (juradoId, participanteId) => get(clave(juradoId, participanteId), almacen)

export async function listar(juradoId) {
  return (await entries(almacen)).map(([, v]) => v).filter((v) => v.juradoId === juradoId)
}

export const quitar = (juradoId, participanteId) => del(clave(juradoId, participanteId), almacen)
```

`FRONT:src/stores/calificacion.js`:

```js
import { defineStore } from 'pinia'
import { trk } from '@/services/api'
import * as cola from '@/utils/colaOffline'

const reintentable = (e) => !e || e.status === 0 || e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500

export const useCalificacionStore = defineStore('calificacion', {
  state: () => ({ pendientes: {}, sincronizando: false }),
  actions: {
    async cargarPendientes(juradoId) {
      const items = await cola.listar(juradoId)
      this.pendientes = Object.fromEntries(items.map((i) => [i.participanteId, i]))
    },
    async enviar(juradoId, participanteId, puntajes) {
      const item = await cola.encolar({ juradoId, participanteId, puntajes })
      this.pendientes = { ...this.pendientes, [participanteId]: item }
      return this.intentar(juradoId, participanteId)
    },
    async intentar(juradoId, participanteId) {
      const item = await cola.obtener(juradoId, participanteId)
      if (!item) return { estado: 'ENVIADA' }
      try {
        const { data } = await trk.put(`/calificaciones/${participanteId}`, { puntajes: item.puntajes })
        await this.sacar(juradoId, participanteId)
        return { estado: 'ENVIADA', calificacion: data }
      } catch (e) {
        if (reintentable(e)) return { estado: 'PENDIENTE' }
        await this.sacar(juradoId, participanteId)
        return { estado: 'RECHAZADA', error: e }
      }
    },
    async sacar(juradoId, participanteId) {
      await cola.quitar(juradoId, participanteId)
      const resto = { ...this.pendientes }
      delete resto[participanteId]
      this.pendientes = resto
    },
    async sincronizar(juradoId) {
      if (this.sincronizando) return
      this.sincronizando = true
      try {
        await this.cargarPendientes(juradoId)
        for (const participanteId of Object.keys(this.pendientes)) await this.intentar(juradoId, participanteId)
      } finally {
        this.sincronizando = false
      }
    },
    iniciarAutoSincronizacion(juradoId, intervaloMs = 10000) {
      const correr = () => this.sincronizar(juradoId)
      window.addEventListener('online', correr)
      const temporizador = setInterval(correr, intervaloMs)
      return () => {
        window.removeEventListener('online', correr)
        clearInterval(temporizador)
      }
    }
  }
})
```

En `FRONT:vite.config.js`: agregar `import { VitePWA } from 'vite-plugin-pwa'` y reemplazar `plugins: [vue()],` por:

```js
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'TRIKIPELUDOS',
        short_name: 'TRIKIPELUDOS',
        start_url: '/trikipeludos/jurado',
        scope: '/trikipeludos/',
        display: 'standalone',
        background_color: '#FFF6E6',
        theme_color: '#47206A',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
      },
      workbox: {
        // Solo el shell: los datos van por la cola de IndexedDB, no por el service worker (D13).
        globPatterns: ['**/*.{js,css,html,svg}'],
        navigateFallback: '/trikipeludos/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//]
      }
    })
  ],
```

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build && ls dist/sw.js dist/manifest.webmanifest`
Expected: PASS; existen `dist/sw.js` y `dist/manifest.webmanifest`.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src vite.config.js
git commit -m "feat(front): cola offline de calificaciones en IndexedDB con reintento y shell PWA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5.4: Pantalla de calificación del jurado

Cubre: R1 (deslizador + ± con máximo visible), HU-8 CA2, CA3 (total en vivo), CA4 (confirmación, todos los criterios tocados, bloqueo), CA5 (indicador pendiente); §10 `/jurado/calificar/:id`; RNF-1.

**Files:**
- Create: `FRONT:src/components/ControlPuntaje.vue`, `FRONT:src/views/CalificarView.vue`
- Modify: `FRONT:src/router/index.js`
- Test: `FRONT:src/components/__tests__/ControlPuntaje.spec.js`, `FRONT:src/views/__tests__/CalificarView.spec.js`

**Interfaces:**
- Consumes: `TRK-PAR-002`, `TRK-RUB-001`, `TRK-CAL-001`, `useCalificacionStore` (5.3), `FichaMascota` (4.5).
- Produces: `<ControlPuntaje :criterio="{ id, nombre, descripcion, puntaje_max }" v-model="valor" />` (`valor` `null` = sin tocar; `−` desde `null` → 0; `+` desde `null` → 1; límites 0..`puntaje_max`).

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/components/__tests__/ControlPuntaje.spec.js`:

```js
import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ControlPuntaje from '@/components/ControlPuntaje.vue'

const criterio = { id: 1, nombre: 'Creatividad', descripcion: 'Idea novedosa', puntaje_max: 35 }
const montar = (modelValue = null) => mount(ControlPuntaje, { props: { criterio, modelValue, 'onUpdate:modelValue': (v) => w.setProps({ modelValue: v }) } })
let w

test('muestra nombre, descripción y máximo visible; sin tocar muestra —', () => {
  w = montar()
  expect(w.text()).toContain('Creatividad')
  expect(w.text()).toContain('Idea novedosa')
  expect(w.text()).toContain('— / 35')
  expect(w.get('input[type="range"]').attributes('max')).toBe('35')
})

test('± respeta límites y arranca explícito desde sin tocar', async () => {
  w = montar()
  await w.get('[data-test="menos"]').trigger('click')
  expect(w.props('modelValue')).toBe(0)
  await w.get('[data-test="menos"]').trigger('click')
  expect(w.props('modelValue')).toBe(0)
  await w.setProps({ modelValue: 35 })
  await w.get('[data-test="mas"]').trigger('click')
  expect(w.props('modelValue')).toBe(35)
})

test('el deslizador emite enteros', async () => {
  w = montar(0)
  await w.get('input[type="range"]').setValue('17')
  expect(w.props('modelValue')).toBe(17)
})

test('botones de ±44 px', () => {
  w = montar()
  expect(w.get('[data-test="mas"]').classes()).toContain('min-w-tactil')
})
```

`FRONT:src/views/__tests__/CalificarView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'p1' } }), useRouter: () => ({ push }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))

import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import CalificarView from '@/views/CalificarView.vue'

const RUBRICA = {
  categoria: { id: 1, nombre: 'Pequeños', abierta: true }, rubrica: { codigo: 'INDIVIDUAL' }, puntaje_total_max: 100,
  criterios: [
    { id: 1, nombre: 'Creatividad', descripcion: 'd1', puntaje_max: 35 }, { id: 2, nombre: 'Seguridad', descripcion: 'd2', puntaje_max: 30 },
    { id: 3, nombre: 'Elaboración', descripcion: 'd3', puntaje_max: 20 }, { id: 4, nombre: 'Pasarela', descripcion: 'd4', puntaje_max: 15 }
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().usuario = { id: 7, permisos: { calificar: true } }
  window.confirm = vi.fn(() => true)
  trk.get.mockImplementation(async (url) => {
    if (url === '/participantes/p1') return { data: { id: 'p1', mascota_nombre: 'Canela', categoria_id: 1, estado: 'EN_PASARELA', categoria: { nombre: 'Pequeños' } } }
    if (url === '/rubricas/1') return { data: RUBRICA }
    if (url === '/calificaciones/mias') return { data: [] }
    throw new Error(url)
  })
})

async function tocarTodos(w, valores = [30, 25, 15, 10]) {
  const rangos = w.findAll('input[type="range"]')
  for (const [i, v] of valores.entries()) await rangos[i].setValue(String(v))
}

test('muestra criterios de su categoría y total en vivo x / 100 (CA2, CA3)', async () => {
  const w = mount(CalificarView)
  await flushPromises()
  expect(w.text()).toContain('Canela')
  expect(w.findAll('input[type="range"]')).toHaveLength(4)
  expect(w.get('[data-test="total"]').text()).toBe('0 / 100')
  await tocarTodos(w)
  expect(w.get('[data-test="total"]').text()).toBe('80 / 100')
})

test('no se puede enviar con criterios sin tocar (CA4)', async () => {
  const w = mount(CalificarView)
  await flushPromises()
  const rangos = w.findAll('input[type="range"]')
  await rangos[0].setValue('10')
  expect(w.get('[data-test="enviar"]').attributes('disabled')).toBeDefined()
})

test('enviar pide confirmación y deja la calificación bloqueada', async () => {
  const s = useCalificacionStore()
  s.enviar = vi.fn(async () => ({ estado: 'ENVIADA', calificacion: { total: 80, bloqueada: true } }))
  const w = mount(CalificarView)
  await flushPromises()
  await tocarTodos(w)
  await w.get('[data-test="enviar"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalled()
  expect(s.enviar).toHaveBeenCalledWith(7, 'p1', [{ criterio_id: 1, puntaje: 30 }, { criterio_id: 2, puntaje: 25 }, { criterio_id: 3, puntaje: 15 }, { criterio_id: 4, puntaje: 10 }])
  expect(w.text()).toContain('Calificación enviada')
  expect(w.find('input[type="range"]').exists()).toBe(false)
})

test('sin conexión muestra "pendiente de sincronizar" (CA5)', async () => {
  const s = useCalificacionStore()
  s.enviar = vi.fn(async () => ({ estado: 'PENDIENTE' }))
  const w = mount(CalificarView)
  await flushPromises()
  await tocarTodos(w)
  await w.get('[data-test="enviar"]').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('Pendiente de sincronizar')
})

test('si ya la calificó, se muestra bloqueada sin controles', async () => {
  trk.get.mockImplementation(async (url) => {
    if (url === '/calificaciones/mias') return { data: [{ id: 3, participante_id: 'p1', total: 77, bloqueada: true }] }
    if (url === '/participantes/p1') return { data: { id: 'p1', mascota_nombre: 'Canela', categoria_id: 1, estado: 'PRESENTADO' } }
    return { data: RUBRICA }
  })
  const w = mount(CalificarView)
  await flushPromises()
  expect(w.text()).toContain('77 / 100')
  expect(w.find('input[type="range"]').exists()).toBe(false)
})
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd FRONT && npx vitest run src/components/__tests__/ControlPuntaje.spec.js src/views/__tests__/CalificarView.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/components/ControlPuntaje.vue`:

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({
  criterio: { type: Object, required: true },
  modelValue: { type: Number, default: null },
  deshabilitado: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const max = computed(() => props.criterio.puntaje_max)
const tocado = computed(() => props.modelValue !== null && props.modelValue !== undefined)
const fijar = (v) => emit('update:modelValue', Math.min(Math.max(Math.round(Number(v)), 0), max.value))
const menos = () => fijar(tocado.value ? props.modelValue - 1 : 0)
const mas = () => fijar(tocado.value ? props.modelValue + 1 : 1)
</script>

<template>
  <div class="tarjeta flex flex-col gap-2" :class="tocado ? '' : 'border-2 border-dashed border-calabaza-300'">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-lg font-bold">{{ criterio.nombre }}</h3>
      <span class="text-2xl font-extrabold tabular-nums" :class="tocado ? 'text-morado-800' : 'text-gray-400'">{{ tocado ? modelValue : '—' }} / {{ max }}</span>
    </div>
    <p class="text-sm text-morado-600">{{ criterio.descripcion }}</p>
    <div class="flex items-center gap-2">
      <button type="button" data-test="menos" class="btn min-w-tactil bg-morado-100 text-2xl text-morado-900" :disabled="deshabilitado" :aria-label="`Restar a ${criterio.nombre}`" @click="menos">−</button>
      <input
        type="range" min="0" :max="max" step="1" class="h-11 flex-1 accent-calabaza-600"
        :class="tocado ? '' : 'opacity-40'" :value="tocado ? modelValue : 0" :disabled="deshabilitado"
        :aria-label="criterio.nombre" :aria-valuetext="tocado ? `${modelValue} de ${max}` : 'sin calificar'"
        @input="fijar($event.target.value)"
      />
      <button type="button" data-test="mas" class="btn min-w-tactil bg-morado-100 text-2xl text-morado-900" :disabled="deshabilitado" :aria-label="`Sumar a ${criterio.nombre}`" @click="mas">+</button>
    </div>
  </div>
</template>
```

`FRONT:src/views/CalificarView.vue`:

```vue
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import { mensajeDeError } from '@/utils/errores'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FichaMascota from '@/components/FichaMascota.vue'
import ControlPuntaje from '@/components/ControlPuntaje.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const store = useCalificacionStore()
const juradoId = computed(() => auth.usuario && auth.usuario.id)

const participante = ref(null)
const rubrica = ref(null)
const valores = ref({})
const enviada = ref(null)
const error = ref('')
const enviando = ref(false)
let detenerSync = null

const total = computed(() => Object.values(valores.value).reduce((s, v) => s + (v ?? 0), 0))
const completos = computed(() => rubrica.value && rubrica.value.criterios.every((c) => valores.value[c.id] !== null && valores.value[c.id] !== undefined))
const pendiente = computed(() => Boolean(store.pendientes[route.params.id]))

async function cargar() {
  try {
    participante.value = (await trk.get(`/participantes/${route.params.id}`)).data
    const [rub, mias] = await Promise.all([
      trk.get(`/rubricas/${participante.value.categoria_id}`),
      trk.get('/calificaciones/mias')
    ])
    rubrica.value = rub.data
    valores.value = Object.fromEntries(rub.data.criterios.map((c) => [c.id, null]))
    const previa = mias.data.find((c) => c.participante_id === route.params.id && c.bloqueada)
    if (previa) enviada.value = previa
  } catch (e) { error.value = mensajeDeError(e) }
}

async function enviar() {
  if (!completos.value) return
  if (!window.confirm(`¿Enviar ${total.value} / ${rubrica.value.puntaje_total_max} para ${participante.value.mascota_nombre}? Después no podrás modificarla.`)) return
  enviando.value = true
  error.value = ''
  const puntajes = rubrica.value.criterios.map((c) => ({ criterio_id: c.id, puntaje: valores.value[c.id] }))
  try {
    const r = await store.enviar(juradoId.value, route.params.id, puntajes)
    if (r.estado === 'ENVIADA') enviada.value = r.calificacion
    else if (r.estado === 'RECHAZADA') error.value = mensajeDeError(r.error)
  } finally { enviando.value = false }
}

onMounted(async () => {
  await store.cargarPendientes(juradoId.value)
  detenerSync = store.iniciarAutoSincronizacion(juradoId.value)
  await cargar()
})
onBeforeUnmount(() => detenerSync && detenerSync())
</script>

<template>
  <div class="min-h-screen pb-28">
    <BarraSuperior titulo="Calificar" />
    <main class="mx-auto flex max-w-xl flex-col gap-3 p-4">
      <button class="btn-claro self-start" @click="router.push('/jurado')">◀ Volver</button>
      <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
      <FichaMascota v-if="participante" :participante="participante" />

      <p v-if="enviada" class="tarjeta border-2 border-green-600 text-center text-xl" role="status">
        ✅ Calificación enviada: <strong>{{ enviada.total }}<template v-if="rubrica"> / {{ rubrica.puntaje_total_max }}</template></strong><br />
        <span class="text-sm">Está bloqueada. Si necesitas corregirla, pide al administrador que la desbloquee.</span>
      </p>
      <p v-else-if="pendiente" class="tarjeta border-2 border-calabaza-500 text-center" role="status">
        ⏳ Pendiente de sincronizar. Se enviará sola cuando vuelva la conexión.
      </p>

      <template v-if="rubrica && !enviada && !pendiente">
        <p v-if="!rubrica.categoria.abierta" class="rounded-xl bg-red-100 p-3 text-red-800">La categoría está cerrada.</p>
        <ControlPuntaje v-for="c in rubrica.criterios" :key="c.id" v-model="valores[c.id]" :criterio="c" :deshabilitado="!rubrica.categoria.abierta" />
      </template>
    </main>

    <div v-if="rubrica && !enviada && !pendiente" class="fixed inset-x-0 bottom-0 flex items-center gap-3 bg-white/95 p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      <span data-test="total" class="text-2xl font-extrabold tabular-nums">{{ total }} / {{ rubrica.puntaje_total_max }}</span>
      <button class="btn-primario min-h-[56px] flex-1 text-xl" data-test="enviar" :disabled="!completos || enviando || !rubrica.categoria.abierta" @click="enviar">Enviar</button>
    </div>
  </div>
</template>
```

En `FRONT:src/router/index.js` agregar:
`{ path: '/jurado/calificar/:id', component: () => import('@/views/CalificarView.vue'), meta: { permiso: 'calificar' } },`

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): calificacion con deslizadores y +-, total en vivo, confirmacion y estado pendiente (HU-8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5.5: Inicio del jurado (en pasarela + galería) y E2E del jurado

Cubre: HU-8 CA1 (por defecto la mascota en pasarela; galería con insignia Calificada/Pendiente), CA5 (E2E sin conexión), §12 Fase 4/5 (tercer cliente en tiempo real).

**Files:**
- Create: `FRONT:src/views/JuradoView.vue`, `FRONT:e2e/jurado.spec.js`
- Modify: `FRONT:src/router/index.js`, `FRONT:e2e/pasarela.spec.js` (agregar jurado como cliente)
- Test: `FRONT:src/views/__tests__/JuradoView.spec.js`

**Interfaces:**
- Consumes: `useEventoStore`, `useTiempoReal`, `useCalificacionStore`, `TRK-PAR-001`, `TRK-CAL-001`.

- [ ] **Step 1: Escribir la prueba que falla**

`FRONT:src/views/__tests__/JuradoView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn((o) => { o.sincronizar(); return { conectado: { value: true } } }) }))

import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import JuradoView from '@/views/JuradoView.vue'

const toby = { id: 't', mascota_nombre: 'Toby', estado: 'EN_PASARELA', categoria: { nombre: 'Pequeños' } }
const kira = { id: 'k', mascota_nombre: 'Kira', estado: 'PRESENTADO', categoria: { nombre: 'Pequeños' } }
const luna = { id: 'l', mascota_nombre: 'Luna', estado: 'PRESENTADO', categoria: { nombre: 'Felinos' } }
const rex = { id: 'r', mascota_nombre: 'Rex', estado: 'PRESENTE', categoria: { nombre: 'Grandes' } }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().usuario = { id: 7, permisos: { calificar: true } }
  trk.get.mockImplementation(async (url) => {
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: toby, categoria_pantalla: null, ranking: null } }
    if (url === '/calificaciones/mias') return { data: [{ participante_id: 'k', total: 80, bloqueada: true }] }
    return { data: [toby, kira, luna, rex] }
  })
})

test('por defecto muestra la mascota en pasarela con botón Calificar (CA1)', async () => {
  const w = mount(JuradoView)
  await flushPromises()
  expect(w.get('[data-test="en-pasarela"]').text()).toContain('Toby')
  await w.get('[data-test="calificar-en-pasarela"]').trigger('click')
  expect(push).toHaveBeenCalledWith('/jurado/calificar/t')
})

test('galería con insignias Calificada / Por sincronizar / Pendiente y mascotas aún no calificables', async () => {
  useCalificacionStore().pendientes = { l: { participanteId: 'l' } }
  useCalificacionStore().cargarPendientes = vi.fn(async () => {})
  const w = mount(JuradoView)
  await flushPromises()
  expect(w.get('[data-test="insignia-k"]').text()).toBe('Calificada')
  expect(w.get('[data-test="insignia-l"]').text()).toBe('Por sincronizar')
  expect(w.get('[data-test="insignia-t"]').text()).toBe('Pendiente')
  expect(w.get('[data-test="insignia-r"]').text()).toBe('Aún no sale')
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd FRONT && npx vitest run src/views/__tests__/JuradoView.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/views/JuradoView.vue`:

```vue
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useEventoStore } from '@/stores/evento'
import { useCalificacionStore } from '@/stores/calificacion'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FichaMascota from '@/components/FichaMascota.vue'
import FotoMascota from '@/components/FotoMascota.vue'

const router = useRouter()
const auth = useAuthStore()
const evento = useEventoStore()
const cola = useCalificacionStore()
const galeria = ref([])
const mias = ref({})
const error = ref('')
let detenerSync = null

const CALIFICABLES = ['EN_PASARELA', 'PRESENTADO']
function insignia(p) {
  if (mias.value[p.id]) return ['Calificada', 'bg-green-100 text-green-900']
  if (cola.pendientes[p.id]) return ['Por sincronizar', 'bg-calabaza-100 text-calabaza-900']
  if (!CALIFICABLES.includes(p.estado)) return ['Aún no sale', 'bg-gray-200 text-gray-700']
  return ['Pendiente', 'bg-morado-100 text-morado-900']
}
const enPasarela = computed(() => evento.enPasarela)

async function cargar() {
  try {
    const [g, m] = await Promise.all([trk.get('/participantes'), trk.get('/calificaciones/mias')])
    galeria.value = g.data
    mias.value = Object.fromEntries(m.data.filter((c) => c.bloqueada).map((c) => [c.participante_id, c]))
  } catch (e) { error.value = mensajeDeError(e) }
}

const calificar = (id) => router.push(`/jurado/calificar/${id}`)

useTiempoReal({
  token: auth.token,
  sincronizar: async () => { await evento.sincronizar(); await cargar() },
  eventos: {
    'pasarela:cambio': (m) => { evento.alCambioPasarela(m); cargar() },
    'foto:nueva': (m) => evento.alFotoNueva(m)
  }
})

onMounted(async () => {
  await cola.cargarPendientes(auth.usuario && auth.usuario.id)
  detenerSync = cola.iniciarAutoSincronizacion(auth.usuario && auth.usuario.id)
})
onBeforeUnmount(() => detenerSync && detenerSync())
</script>

<template>
  <div class="min-h-screen pb-8">
    <BarraSuperior titulo="Jurado" />
    <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>

      <section v-if="enPasarela" data-test="en-pasarela" class="tarjeta flex flex-col gap-3 border-2 border-calabaza-500">
        <p class="text-sm font-bold uppercase text-calabaza-800">🎃 En pasarela ahora</p>
        <FichaMascota :participante="enPasarela" />
        <button v-if="!mias[enPasarela.id]" class="btn-primario min-h-[56px] text-xl" data-test="calificar-en-pasarela" @click="calificar(enPasarela.id)">Calificar</button>
        <p v-else class="text-center font-semibold text-green-800">Ya la calificaste ✅</p>
      </section>
      <p v-else class="tarjeta text-center">Aún no hay mascota en pasarela.</p>

      <h2 class="text-xl font-bold">Galería</h2>
      <ul class="grid grid-cols-2 gap-3">
        <li v-for="p in galeria" :key="p.id">
          <button class="tarjeta flex w-full flex-col gap-2 p-2 text-left disabled:opacity-60" :disabled="!CALIFICABLES.includes(p.estado)" @click="calificar(p.id)">
            <FotoMascota :participante="p" clase="aspect-[4/5] w-full rounded-xl" />
            <span class="font-semibold">{{ p.mascota_nombre }}</span>
            <span :data-test="`insignia-${p.id}`" :class="['self-start rounded-full px-2 py-0.5 text-xs font-semibold', insignia(p)[1]]">{{ insignia(p)[0] }}</span>
          </button>
        </li>
      </ul>
    </main>
  </div>
</template>
```

En `FRONT:src/router/index.js` agregar:
`{ path: '/jurado', component: () => import('@/views/JuradoView.vue'), meta: { permiso: 'calificar' } },`

- [ ] **Step 4: E2E del jurado** — `FRONT:e2e/jurado.spec.js`:

```js
import { test, expect } from '@playwright/test'
import { entrarConPin, sinScrollHorizontal } from './utilidades'

async function ponerEnPasarela(request, nombre) {
  const usuarios = (await (await request.get('http://localhost:3021/api/trk/v1/auth/usuarios-pin')).json()).data
  const comentarista = usuarios.find((u) => u.nombre === 'Comentarista E2E')
  const { data } = await (await request.post('http://localhost:3021/api/trk/v1/auth/pin', { data: { usuario_id: comentarista.id, pin: '222222' } })).json()
  const auth = { Authorization: `Bearer ${data.token}` }
  const cola = (await (await request.get('http://localhost:3021/api/trk/v1/participantes', { headers: auth })).json()).data
  const p = cola.find((x) => x.mascota_nombre === nombre)
  await request.post(`http://localhost:3021/api/trk/v1/pasarela/${p.id}`, { headers: auth })
}

async function llenarTodos(page) {
  const rangos = page.locator('input[type="range"]')
  const n = await rangos.count()
  for (let i = 0; i < n; i++) await rangos.nth(i).fill('5')
}

test('jurado califica la mascota en pasarela y la calificación queda bloqueada', async ({ page, request }) => {
  await entrarConPin(page, 'Jurado E2E 1', '333331')
  await ponerEnPasarela(request, 'Toby')
  await expect(page.getByTestId('en-pasarela')).toContainText('Toby', { timeout: 3000 })
  expect(await sinScrollHorizontal(page)).toBe(true)
  await page.getByTestId('calificar-en-pasarela').click()
  await llenarTodos(page)
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('enviar').click()
  await expect(page.getByText('Calificación enviada')).toBeVisible()
  expect(await sinScrollHorizontal(page)).toBe(true)
})

test('sin conexión la calificación queda pendiente y se sincroniza al volver (HU-8 CA5)', async ({ page, context, request }) => {
  await entrarConPin(page, 'Jurado E2E 2', '333332')
  await ponerEnPasarela(request, 'Kira')
  await expect(page.getByTestId('en-pasarela')).toContainText('Kira', { timeout: 3000 })
  await page.getByTestId('calificar-en-pasarela').click()
  await llenarTodos(page)
  await context.setOffline(true)
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('enviar').click()
  await expect(page.getByText('Pendiente de sincronizar')).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: '◀ Volver' }).click()
  await expect(page.locator('[data-test^="insignia-"]', { hasText: 'Calificada' })).toHaveCount(1, { timeout: 15_000 })
})
```

En `FRONT:e2e/pasarela.spec.js`, agregar un jurado como tercer tipo de cliente: crear `ctxJurado = await nuevoContexto(browser)` y `jurado = await ctxJurado.newPage()`, `await entrarConPin(jurado, 'Jurado E2E 3', '333333')` antes del click, y añadir al `Promise.all` del primer llamado:
`expect(jurado.getByTestId('en-pasarela')).toContainText('Toby', { timeout: 2000 }),` (y cerrar `ctxJurado` al final).

> Orden de los archivos E2E: Playwright los corre alfabéticamente (`cabina` → `jurado` → `pasarela`). `jurado.spec.js` deja a Kira en pasarela; `pasarela.spec.js` empieza llamando a la primera de la cola (Toby, ya `PRESENTADO`) y luego a la siguiente, así que funciona igual. Si el orden cambia, cada archivo debe seguir siendo válido por sí mismo.

- [ ] **Step 5: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx playwright test`
Expected: PASS (unit + 4 E2E).

- [ ] **Step 6: Commit**

```bash
cd FRONT
git add src e2e
git commit -m "feat(front): inicio del jurado con mascota en pasarela y galeria; E2E con modo sin conexion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Cierre de Fase 5

- [ ] Run: suite completa + Playwright. Reportar al usuario y esperar aprobación.

---
## Fase 6 — Ranking, desempates, publicación, exportación y corrección de datos

**Hecho cuando:** pasan las pruebas de R3–R6 con casos de empate (§13.4–13.6, §13.15), §13.7 y §13.13, la publicación congela el resultado y el admin opera todo desde la UI.

### Task 6.1: Cálculo del ranking (función pura)

Cubre: R3, R4, R5, R6, HU-10 CA1, CA2; §13.4, §13.5, §13.6, §13.15.

**Files:**
- Create: `BACK:src/trk/services/ranking.service.js`
- Test: `BACK:src/trk/services/__tests__/ranking.test.js`

**Interfaces:**
- Produces: `calcularRanking({ participantes, criterios, calificaciones, juradosActivos, puestosPremiados }) → { filas: FilaRanking[], empates_sin_resolver: string[][] }`
  - Entrada: `participantes: [{ id, mascota_nombre, desempate_manual }]`; `criterios: [{ id, codigo, nombre, peso_desempate }]`; `calificaciones: [{ participante_id, jurado_id, total, puntajes: { [criterio_id]: number } }]`; `juradosActivos: number[]`; `puestosPremiados: number`.
  - `FilaRanking = { participante_id, mascota_nombre, puesto: number | null, puntaje_final: number | null, promedios: { [codigo]: number | null }, n_calificaciones, n_jurados, completa, premiado, empate_sin_resolver, desempate_manual }`.
  - Reglas: solo cuentan calificaciones de jurados activos; promedio redondeado a 2 decimales (R3); completa = todos los activos calificaron (R4); orden por `puntaje_final`, luego criterios con `peso_desempate` ascendente (R5), luego `desempate_manual` ascendente; un grupo empatado sin `desempate_manual` distinto para todos comparte puesto y, si su puesto ≤ `puestosPremiados`, se marca `empate_sin_resolver` (afecta podio o borde N/N+1); incompletas al final con `puesto: null`.

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/services/__tests__/ranking.test.js`:

```js
const { calcularRanking } = require('../ranking.service');

// Fixture: los máximos no importan aquí; solo códigos y orden de desempate (datos de la rúbrica).
const CRITERIOS = [
  { id: 1, codigo: 'CREATIVIDAD', nombre: 'Creatividad', peso_desempate: 1 },
  { id: 2, codigo: 'SEGURIDAD', nombre: 'Seguridad', peso_desempate: 2 },
  { id: 3, codigo: 'ELABORACION', nombre: 'Elaboración', peso_desempate: null },
  { id: 4, codigo: 'PASARELA', nombre: 'Pasarela', peso_desempate: null }
];
const JURADOS = [11, 12, 13];
const cal = (participante_id, jurado_id, [c, s, e, p]) => ({ participante_id, jurado_id, total: c + s + e + p, puntajes: { 1: c, 2: s, 3: e, 4: p } });
const todos = (pid, valores) => JURADOS.map((j) => cal(pid, j, valores));
const part = (id, desempate_manual = null) => ({ id, mascota_nombre: id, desempate_manual });
const ranking = (participantes, calificaciones, extra = {}) => calcularRanking({
  participantes, criterios: CRITERIOS, calificaciones, juradosActivos: JURADOS, puestosPremiados: 3, ...extra
});
const fila = (r, id) => r.filas.find((f) => f.participante_id === id);

test('R3: puntaje final = promedio de jurados (no suma), redondeado a 2 decimales', () => {
  const r = ranking([part('A')], [cal('A', 11, [30, 25, 15, 10]), cal('A', 12, [30, 25, 15, 10]), cal('A', 13, [30, 25, 15, 11])]);
  expect(fila(r, 'A').puntaje_final).toBe(80.33);
  expect(fila(r, 'A').promedios).toEqual({ CREATIVIDAD: 30, SEGURIDAD: 25, ELABORACION: 15, PASARELA: 10.33 });
});

test('§13.4 empate en total: gana más Creatividad', () => {
  const r = ranking([part('A'), part('B')], [...todos('A', [30, 20, 15, 15]), ...todos('B', [25, 25, 15, 15])]);
  expect(r.filas.map((f) => [f.participante_id, f.puesto])).toEqual([['A', 1], ['B', 2]]);
  expect(r.empates_sin_resolver).toEqual([]);
});

test('R5: empate en total y Creatividad → decide Seguridad', () => {
  const r = ranking([part('A'), part('B')], [...todos('A', [30, 20, 20, 10]), ...todos('B', [30, 25, 10, 15])]);
  expect(r.filas.map((f) => f.participante_id)).toEqual(['B', 'A']);
});

test('§13.5 empate en total, Creatividad y Seguridad → "empate sin resolver"', () => {
  const r = ranking([part('A'), part('B'), part('C')], [...todos('A', [30, 25, 15, 10]), ...todos('B', [30, 25, 10, 15]), ...todos('C', [10, 10, 10, 10])]);
  expect(fila(r, 'A')).toMatchObject({ puesto: 1, empate_sin_resolver: true });
  expect(fila(r, 'B')).toMatchObject({ puesto: 1, empate_sin_resolver: true });
  expect(fila(r, 'C')).toMatchObject({ puesto: 3, empate_sin_resolver: false });
  expect(r.empates_sin_resolver).toEqual([expect.arrayContaining(['A', 'B'])]);
});

test('desempate_manual del admin resuelve el empate', () => {
  const r = ranking([part('A', 2), part('B', 1)], [...todos('A', [30, 25, 15, 10]), ...todos('B', [30, 25, 10, 15])]);
  expect(r.filas.map((f) => [f.participante_id, f.puesto, f.empate_sin_resolver])).toEqual([['B', 1, false], ['A', 2, false]]);
  expect(r.empates_sin_resolver).toEqual([]);
});

test('§13.6 / R4: con 2 de 3 jurados queda "incompleta", fuera del podio y al final', () => {
  const r = ranking([part('A'), part('B')], [...todos('A', [10, 10, 10, 10]), cal('B', 11, [35, 30, 20, 15]), cal('B', 12, [35, 30, 20, 15])]);
  expect(fila(r, 'B')).toMatchObject({ completa: false, puesto: null, premiado: false, n_calificaciones: 2, n_jurados: 3, puntaje_final: 100 });
  expect(r.filas.map((f) => f.participante_id)).toEqual(['A', 'B']);
  expect(fila(r, 'A')).toMatchObject({ puesto: 1, premiado: true });
});

test('calificaciones de jurados inactivos no cuentan', () => {
  const r = calcularRanking({
    participantes: [part('A')], criterios: CRITERIOS, juradosActivos: [11, 12], puestosPremiados: 3,
    calificaciones: [cal('A', 11, [10, 10, 10, 10]), cal('A', 12, [20, 20, 20, 20]), cal('A', 99, [0, 0, 0, 0])]
  });
  expect(fila(r, 'A')).toMatchObject({ completa: true, puntaje_final: 60, n_calificaciones: 2 });
});

test('§13.15 empate entre 3.º y 4.º se señala; entre 4.º y 5.º no', () => {
  const ps = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => part(id));
  const r = ranking(ps, [
    ...todos('A', [35, 30, 20, 15]), ...todos('B', [34, 30, 20, 15]),
    ...todos('C', [30, 25, 15, 10]), ...todos('D', [30, 25, 10, 15]),
    ...todos('E', [20, 20, 10, 10]), ...todos('F', [20, 20, 15, 5])
  ]);
  expect(fila(r, 'C')).toMatchObject({ puesto: 3, empate_sin_resolver: true, premiado: true });
  expect(fila(r, 'D')).toMatchObject({ puesto: 3, empate_sin_resolver: true });
  expect(fila(r, 'E')).toMatchObject({ puesto: 5, empate_sin_resolver: false, premiado: false });
  expect(fila(r, 'F')).toMatchObject({ puesto: 5, empate_sin_resolver: false });
  expect(r.empates_sin_resolver).toHaveLength(1);
});

test('puestos premiados configurables (§14.3)', () => {
  const ps = ['A', 'B', 'C', 'D', 'E'].map((id) => part(id));
  const califs = ps.flatMap((p, i) => todos(p.id, [30 - i, 20, 10, 10]));
  const r = ranking(ps, califs, { puestosPremiados: 5 });
  expect(r.filas.filter((f) => f.premiado)).toHaveLength(5);
});

test('participante sin calificaciones: incompleto, sin puntaje', () => {
  const r = ranking([part('A')], []);
  expect(fila(r, 'A')).toMatchObject({ completa: false, puntaje_final: null, n_calificaciones: 0, puesto: null });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest src/trk/services/__tests__/ranking.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BACK:src/trk/services/ranking.service.js`:

```js
// ============================================
// Ranking por categoría (R3–R6). Función PURA: sin BD, sin Express.
// El orden de desempate sale de criterios[].peso_desempate (dato de la rúbrica).
// ============================================
const redondear2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function compararManual(a, b) {
  if (a.desempate_manual == null && b.desempate_manual == null) return 0;
  if (a.desempate_manual == null) return 1;
  if (b.desempate_manual == null) return -1;
  return a.desempate_manual - b.desempate_manual;
}

function calcularRanking({ participantes, criterios, calificaciones, juradosActivos, puestosPremiados }) {
  const activos = new Set(juradosActivos);
  const criteriosDesempate = criterios
    .filter((c) => c.peso_desempate != null)
    .sort((a, b) => a.peso_desempate - b.peso_desempate);

  const base = participantes.map((p) => {
    const propias = calificaciones.filter((c) => c.participante_id === p.id && activos.has(c.jurado_id));
    const n = propias.length;
    const promedio = (fn) => (n ? redondear2(propias.reduce((s, c) => s + fn(c), 0) / n) : null);
    return {
      participante_id: p.id,
      mascota_nombre: p.mascota_nombre,
      puesto: null,
      puntaje_final: promedio((c) => c.total),
      promedios: Object.fromEntries(criterios.map((cr) => [cr.codigo, promedio((c) => c.puntajes[cr.id] ?? 0)])),
      n_calificaciones: n,
      n_jurados: activos.size,
      completa: activos.size > 0 && [...activos].every((j) => propias.some((c) => c.jurado_id === j)),
      premiado: false,
      empate_sin_resolver: false,
      desempate_manual: p.desempate_manual ?? null
    };
  });

  const clave = (f) => [f.puntaje_final, ...criteriosDesempate.map((c) => f.promedios[c.codigo])];
  const compararAutomatico = (a, b) => {
    const ka = clave(a);
    const kb = clave(b);
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return 0;
  };

  const completas = base
    .filter((f) => f.completa)
    .sort((a, b) => compararAutomatico(a, b) || compararManual(a, b) || a.mascota_nombre.localeCompare(b.mascota_nombre));

  const empates = [];
  let puesto = 1;
  for (let i = 0; i < completas.length;) {
    let j = i;
    while (j + 1 < completas.length && compararAutomatico(completas[i], completas[j + 1]) === 0) j += 1;
    const grupo = completas.slice(i, j + 1);
    const manuales = grupo.map((f) => f.desempate_manual);
    const resuelto = grupo.length === 1 || (manuales.every((m) => m != null) && new Set(manuales).size === manuales.length);
    if (resuelto) {
      grupo.forEach((f, k) => { f.puesto = puesto + k; });
    } else {
      grupo.forEach((f) => { f.puesto = puesto; });
      if (puesto <= puestosPremiados) {
        grupo.forEach((f) => { f.empate_sin_resolver = true; });
        empates.push(grupo.map((f) => f.participante_id));
      }
    }
    puesto += grupo.length;
    i = j + 1;
  }
  completas.forEach((f) => { f.premiado = f.puesto <= puestosPremiados; });

  const incompletas = base
    .filter((f) => !f.completa)
    .sort((a, b) => (b.puntaje_final ?? -1) - (a.puntaje_final ?? -1) || a.mascota_nombre.localeCompare(b.mascota_nombre));

  return { filas: [...completas, ...incompletas], empates_sin_resolver: empates };
}

module.exports = { calcularRanking, redondear2 };
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk/services/__tests__/ranking.test.js`
Expected: PASS (10 pruebas).

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): calculo de ranking puro con promedio, completitud, desempates y puestos premiados (R3-R6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6.2: Ranking en vivo, desempate manual, cierre y publicación por categoría

Cubre: HU-4 CA1, CA2, CA4, CA5; HU-10 CA1, CA2; R8; §8.1 (snapshot congelado); §9.1 `TRK-RNK-001/002`, `TRK-CAT-001..004`; HU-9 CA2 (datos para pantalla).

**Files:**
- Create: `BACK:src/trk/services/rankingDatos.service.js`, `BACK:src/trk/controllers/ranking.controller.js`, `BACK:src/trk/routes/ranking.routes.js`
- Modify: `BACK:src/trk/services/categorias.service.js` (`abrir`, `cerrar`, `publicar`, `actualizar`), `BACK:src/trk/controllers/categorias.controller.js`, `BACK:src/trk/routes/categorias.routes.js`, `BACK:src/trk/services/evento.service.js` (`estadoPublico` incluye `ranking` en modo RANKING), `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/routes/__tests__/ranking.int.test.js`

**Interfaces:**
- Consumes: `calcularRanking` (6.1), `serializarParticipante`, `vistaCategoria` (2.3).
- Produces:
  - `rankingEnVivo(categoriaId) → RankingCategoria = { categoria: { id, codigo, nombre, abierta, ranking_publicado, puestos_premiados }, criterios: [{ codigo, nombre }], filas: (FilaRanking & { participante: Participante(PUBLICO), calificaciones: [{ id, jurado_id, jurado_nombre, total, bloqueada }] })[], empates_sin_resolver, generado_at }` (solo admin).
  - `rankingPublicado(categoriaId) → RankingCategoria sin "calificaciones" + publicado_at` (404 `RANKING_NO_PUBLICADO` si no hay).
  - `fijarDesempate(categoriaId, orden: string[], ctx) → RankingCategoria`.
  - `categorias.abrir(id, ctx)`, `cerrar(id, ctx)`, `actualizar(id, { puestos_premiados }, ctx)` → `vistaCategoria`; `publicar(id, ctx) → RankingCategoria publicado` (409 `EMPATE_SIN_RESOLVER` si hay empates en puestos premiados); emite `ranking:publicado` con `{ categoria_id }`.

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/routes/__tests__/ranking.int.test.js`:

```js
const request = require('supertest');
const db = require('../../../models');
const { bus } = require('../../sockets/bus');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria, calificar, criteriosDe } = require('../../testing/fabricas');

const app = crearAppTrk();
let admin; let jurados; let cat; let eventos;
const escuchar = (e) => eventos.push(e);

beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
  jurados = [];
  for (const n of [1, 2, 3]) jurados.push(await crearOperativo('TRK_JURADO', { nombre: `J${n}` }));
  cat = await categoria('PEQ_MED');
  eventos = [];
  bus.on('trk', escuchar);
});
afterEach(() => bus.off('trk', escuchar));
afterAll(cerrar);

const comoAdmin = (r) => r.set('Authorization', `Bearer ${admin.token}`);
const puntos = (c, s, e, p) => ({ CREATIVIDAD: c, SEGURIDAD: s, ELABORACION: e, PASARELA: p });
async function calificadoPorTodos(nombre, valores) {
  const p = await crearParticipante({ mascota_nombre: nombre, estado: 'PRESENTADO' });
  for (const j of jurados) await calificar(p, j.usuario, valores);
  return p;
}

test('TRK-RNK-001 admin ve el ranking en vivo con promedios, completitud y calificaciones por jurado', async () => {
  const a = await calificadoPorTodos('A', puntos(30, 25, 15, 10));
  const b = await crearParticipante({ mascota_nombre: 'B', estado: 'PRESENTADO' });
  await calificar(b, jurados[0].usuario, puntos(35, 30, 20, 15));
  const r = await comoAdmin(request(app).get(`/api/trk/v1/ranking/${cat.id}`));
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-RNK-001');
  expect(r.body.data.filas.map((f) => [f.mascota_nombre, f.puesto, f.completa])).toEqual([['A', 1, true], ['B', null, false]]);
  const filaA = r.body.data.filas[0];
  expect(filaA.calificaciones.map((c) => c.jurado_nombre).sort()).toEqual(['J1', 'J2', 'J3']);
  expect(filaA.participante).toMatchObject({ id: a.id, mascota_nombre: 'A' });
  expect(filaA.participante).not.toHaveProperty('responsable_telefono');
});

test('R8: sin publicar, jurado o público reciben 404 RANKING_NO_PUBLICADO', async () => {
  await calificadoPorTodos('A', puntos(30, 25, 15, 10));
  const publico = await request(app).get(`/api/trk/v1/ranking/${cat.id}`);
  expect(publico.status).toBe(404);
  expect(publico.body.motivo).toBe('RANKING_NO_PUBLICADO');
  const comoJurado = await request(app).get(`/api/trk/v1/ranking/${cat.id}`).set('Authorization', `Bearer ${jurados[0].token}`);
  expect(comoJurado.status).toBe(404);
});

test('publicar con empate sin resolver → 409; TRK-RNK-002 lo resuelve y TRK-CAT-003 publica', async () => {
  const a = await calificadoPorTodos('A', puntos(30, 25, 15, 10));
  const b = await calificadoPorTodos('B', puntos(30, 25, 10, 15));
  const bloqueado = await comoAdmin(request(app).post(`/api/trk/v1/categorias/${cat.id}/publicar`));
  expect(bloqueado.status).toBe(409);
  expect(bloqueado.body).toMatchObject({ error: 'TRK-CAT-003', motivo: 'EMPATE_SIN_RESOLVER' });

  const des = await comoAdmin(request(app).put(`/api/trk/v1/ranking/${cat.id}/desempate`)).send({ orden: [b.id, a.id] });
  expect(des.status).toBe(200);
  expect(des.headers['x-trk-api']).toBe('TRK-RNK-002');
  expect(des.body.data.filas.map((f) => f.mascota_nombre)).toEqual(['B', 'A']);

  const pub = await comoAdmin(request(app).post(`/api/trk/v1/categorias/${cat.id}/publicar`));
  expect(pub.status).toBe(200);
  expect(eventos.some((e) => e.evento === 'ranking:publicado' && e.payload.categoria_id === cat.id)).toBe(true);
  expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-RNK-002' } })).toBe(1);
});

test('lo publicado no cambia si luego se modifica una calificación (snapshot §8.1); sin calificaciones por jurado', async () => {
  const a = await calificadoPorTodos('A', puntos(30, 25, 15, 10));
  await comoAdmin(request(app).post(`/api/trk/v1/categorias/${cat.id}/publicar`)).expect(200);
  await db.TrkCalificacion.update({ total: 1 }, { where: { participante_id: a.id } });
  const publico = await request(app).get(`/api/trk/v1/ranking/${cat.id}`);
  expect(publico.status).toBe(200);
  expect(publico.body.data.filas[0].puntaje_final).toBe(80);
  expect(publico.body.data.filas[0]).not.toHaveProperty('calificaciones');
  const vivo = await comoAdmin(request(app).get(`/api/trk/v1/ranking/${cat.id}`));
  expect(vivo.body.data.filas[0].puntaje_final).toBe(1);
});

test('TRK-CAT-002 cerrar impide calificar; TRK-CAT-001 reabrir lo permite (HU-4 CA1)', async () => {
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const ps = (await criteriosDe(p)).map((c) => ({ criterio_id: c.id, puntaje: 0 }));
  expect((await comoAdmin(request(app).post(`/api/trk/v1/categorias/${cat.id}/cerrar`))).body.data.abierta).toBe(false);
  const intento = await request(app).put(`/api/trk/v1/calificaciones/${p.id}`).set('Authorization', `Bearer ${jurados[0].token}`).send({ puntajes: ps });
  expect(intento.body.motivo).toBe('CATEGORIA_CERRADA');
  expect((await comoAdmin(request(app).post(`/api/trk/v1/categorias/${cat.id}/abrir`))).body.data.abierta).toBe(true);
  expect((await request(app).put(`/api/trk/v1/calificaciones/${p.id}`).set('Authorization', `Bearer ${jurados[0].token}`).send({ puntajes: ps })).status).toBe(200);
});

test('TRK-CAT-004 puestos premiados configurables', async () => {
  for (const [i, n] of ['A', 'B', 'C', 'D'].entries()) await calificadoPorTodos(n, puntos(30 - i, 20, 10, 10));
  const r = await comoAdmin(request(app).patch(`/api/trk/v1/categorias/${cat.id}`)).send({ puestos_premiados: 4 });
  expect(r.status).toBe(200);
  expect(r.body.data.puestos_premiados).toBe(4);
  const vivo = await comoAdmin(request(app).get(`/api/trk/v1/ranking/${cat.id}`));
  expect(vivo.body.data.filas.filter((f) => f.premiado)).toHaveLength(4);
});

test('desactivar un jurado completa a quien tenía 2 de 3 (R4 sobre jurados activos)', async () => {
  const p = await crearParticipante({ mascota_nombre: 'P', estado: 'PRESENTADO' });
  await calificar(p, jurados[0].usuario, puntos(10, 10, 10, 10));
  await calificar(p, jurados[1].usuario, puntos(10, 10, 10, 10));
  await jurados[2].usuario.update({ activo: false });
  const vivo = await comoAdmin(request(app).get(`/api/trk/v1/ranking/${cat.id}`));
  expect(vivo.body.data.filas[0]).toMatchObject({ completa: true, puesto: 1 });
});

test('estado público en modo RANKING incluye el ranking publicado (HU-9 CA2)', async () => {
  await calificadoPorTodos('A', puntos(30, 25, 15, 10));
  await comoAdmin(request(app).post(`/api/trk/v1/categorias/${cat.id}/publicar`)).expect(200);
  await comoAdmin(request(app).put('/api/trk/v1/evento/pantalla')).send({ modo: 'RANKING', categoria_id: cat.id }).expect(200);
  const r = await request(app).get('/api/trk/v1/evento/estado');
  expect(r.body.data.ranking.filas[0]).toMatchObject({ mascota_nombre: 'A', puesto: 1 });
});

test('sin permisos: jurado no publica ni cierra', async () => {
  expect((await request(app).post(`/api/trk/v1/categorias/${cat.id}/publicar`).set('Authorization', `Bearer ${jurados[0].token}`)).status).toBe(403);
  expect((await request(app).post(`/api/trk/v1/categorias/${cat.id}/cerrar`).set('Authorization', `Bearer ${jurados[0].token}`)).status).toBe(403);
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/ranking.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BACK:src/trk/services/rankingDatos.service.js`:

```js
const db = require('../../models');
const TrkError = require('../utils/TrkError');
const { calcularRanking } = require('./ranking.service');
const { serializarParticipante } = require('../utils/serializar');
const { registrarAuditoria } = require('./auditoria.service');
const { INCLUIR_CATEGORIA } = require('./participantes.service');
const { vistaCategoria } = require('./categorias.service');
const { ROL_JURADO, ESTADOS_VISIBLES_PUBLICO } = require('../config/constantes');
const { nombreVisible } = require('./authPin.service');

async function buscarCategoria(categoriaId) {
  const categoria = await db.TrkCategoria.findByPk(categoriaId, { include: [{ model: db.TrkRubrica, as: 'rubrica' }] });
  if (!categoria) throw new TrkError(404, 'NO_ENCONTRADO', 'Categoría no encontrada');
  return categoria;
}

async function rankingEnVivo(categoriaId) {
  const categoria = await buscarCategoria(categoriaId);
  const criterios = await db.TrkCriterio.findAll({ where: { rubrica_id: categoria.rubrica_id }, order: [['orden', 'ASC']] });
  const participantes = await db.TrkParticipante.findAll({
    where: { categoria_id: categoria.id, fusionado_en_id: null, estado: ESTADOS_VISIBLES_PUBLICO },
    include: INCLUIR_CATEGORIA
  });
  const calificaciones = participantes.length ? await db.TrkCalificacion.findAll({
    where: { participante_id: participantes.map((p) => p.id) },
    include: [{ model: db.TrkCalificacionDetalle, as: 'detalles' }, { model: db.Usuario, as: 'jurado', attributes: ['id', 'nombre', 'apellido', 'activo'] }]
  }) : [];
  const jurados = await db.Usuario.findAll({
    where: { activo: true }, attributes: ['id'],
    include: [{ model: db.Rol, as: 'rol', where: { nombre: ROL_JURADO }, attributes: [] }]
  });

  const { filas, empates_sin_resolver } = calcularRanking({
    participantes: participantes.map((p) => ({ id: p.id, mascota_nombre: p.mascota_nombre, desempate_manual: p.desempate_manual })),
    criterios: criterios.map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, peso_desempate: c.peso_desempate })),
    calificaciones: calificaciones.map((c) => ({
      participante_id: c.participante_id, jurado_id: c.jurado_id, total: c.total,
      puntajes: Object.fromEntries(c.detalles.map((d) => [d.criterio_id, d.puntaje]))
    })),
    juradosActivos: jurados.map((j) => j.id),
    puestosPremiados: categoria.puestos_premiados
  });

  const porId = new Map(participantes.map((p) => [p.id, serializarParticipante(p, 'PUBLICO')]));
  return {
    categoria: vistaCategoria(categoria),
    criterios: criterios.map((c) => ({ codigo: c.codigo, nombre: c.nombre })),
    filas: filas.map((f) => ({
      ...f,
      participante: porId.get(f.participante_id),
      calificaciones: calificaciones.filter((c) => c.participante_id === f.participante_id).map((c) => ({
        id: c.id, jurado_id: c.jurado_id, jurado_nombre: c.jurado ? nombreVisible(c.jurado) : null,
        jurado_activo: Boolean(c.jurado && c.jurado.activo), total: c.total, bloqueada: Boolean(c.bloqueada)
      }))
    })),
    empates_sin_resolver,
    generado_at: new Date().toISOString()
  };
}

// Lo que se congela al publicar: sin detalle por jurado (no es público).
const paraPublicar = (ranking) => ({ ...ranking, filas: ranking.filas.map(({ calificaciones: _omitidas, ...f }) => f) });

async function rankingPublicado(categoriaId) {
  const categoria = await db.TrkCategoria.findByPk(categoriaId);
  const snapshot = categoria && categoria.ranking_publicado
    ? await db.TrkRankingSnapshot.findOne({ where: { categoria_id: categoria.id }, order: [['publicado_at', 'DESC'], ['id', 'DESC']] })
    : null;
  if (!snapshot) throw new TrkError(404, 'RANKING_NO_PUBLICADO', 'El ranking de esta categoría aún no se ha publicado');
  return { ...snapshot.datos, publicado_at: snapshot.publicado_at };
}

async function fijarDesempate(categoriaId, orden, ctx) {
  await db.sequelize.transaction(async (transaction) => {
    const filas = await db.TrkParticipante.findAll({ where: { id: orden, categoria_id: categoriaId, fusionado_en_id: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (filas.length !== orden.length) throw new TrkError(400, 'VALIDACION', 'Todos los participantes deben pertenecer a la categoría');
    const antes = Object.fromEntries(filas.map((f) => [f.id, f.desempate_manual]));
    for (const [i, id] of orden.entries()) await db.TrkParticipante.update({ desempate_manual: i + 1 }, { where: { id }, transaction });
    await registrarAuditoria(ctx, { entidad: 'categoria', entidadId: categoriaId, accion: 'FIJAR_DESEMPATE', antes, despues: Object.fromEntries(orden.map((id, i) => [id, i + 1])) }, { transaction });
  });
  return rankingEnVivo(categoriaId);
}

module.exports = { rankingEnVivo, rankingPublicado, fijarDesempate, paraPublicar };
```

> Dependencia circular: `categorias.service` no debe requerir `rankingDatos.service` en el nivel superior; `publicar` lo requiere dentro de la función (ver abajo).

Agregar a `BACK:src/trk/services/categorias.service.js` (y exportar `abrir, cerrar, publicar, actualizar`):

```js
const TrkError = require('../utils/TrkError');
const { registrarAuditoria } = require('./auditoria.service');
const { emitir } = require('../sockets/bus');

async function modificar(id, cambios, accion, ctx) {
  const categoria = await db.sequelize.transaction(async (transaction) => {
    const c = await db.TrkCategoria.findByPk(id, { include: [{ model: db.TrkRubrica, as: 'rubrica' }], transaction, lock: transaction.LOCK.UPDATE });
    if (!c) throw new TrkError(404, 'NO_ENCONTRADO', 'Categoría no encontrada');
    const antes = vistaCategoria(c);
    await c.update(cambios, { transaction });
    await registrarAuditoria(ctx, { entidad: 'categoria', entidadId: c.id, accion, antes, despues: vistaCategoria(c) }, { transaction });
    return c;
  });
  return vistaCategoria(categoria);
}

const abrir = (id, ctx) => modificar(id, { abierta: true }, 'ABRIR', ctx);
const cerrar = (id, ctx) => modificar(id, { abierta: false }, 'CERRAR', ctx);
const actualizar = (id, { puestos_premiados: puestosPremiados }, ctx) => modificar(id, { puestos_premiados: puestosPremiados }, 'EDITAR', ctx);

async function publicar(id, ctx) {
  const { rankingEnVivo, paraPublicar } = require('./rankingDatos.service');
  const ranking = await rankingEnVivo(id);
  if (ranking.empates_sin_resolver.length) {
    throw new TrkError(409, 'EMPATE_SIN_RESOLVER', 'Hay empates sin resolver en los puestos premiados; define el desempate manual');
  }
  const publicado = paraPublicar({ ...ranking, categoria: { ...ranking.categoria, ranking_publicado: true } });
  await db.sequelize.transaction(async (transaction) => {
    await db.TrkRankingSnapshot.create({ categoria_id: Number(id), publicado_por: ctx.usuarioId, datos: publicado }, { transaction });
    await db.TrkCategoria.update({ ranking_publicado: true }, { where: { id }, transaction });
    await registrarAuditoria(ctx, { entidad: 'categoria', entidadId: id, accion: 'PUBLICAR_RANKING', despues: { filas: publicado.filas.length } }, { transaction });
  });
  emitir('ranking:publicado', { categoria_id: Number(id) });
  return publicado;
}
```

Agregar a `BACK:src/trk/controllers/categorias.controller.js`:

```js
const { ctxDe } = require('../utils/ctx');

exports.abrir = async (req, res) => ok(res, await svc.abrir(req.params.id, ctxDe(req)));
exports.cerrar = async (req, res) => ok(res, await svc.cerrar(req.params.id, ctxDe(req)));
exports.publicar = async (req, res) => ok(res, await svc.publicar(req.params.id, ctxDe(req)));
exports.actualizar = async (req, res) => ok(res, await svc.actualizar(req.params.id, req.body, ctxDe(req)));
```

Agregar a `BACK:src/trk/routes/categorias.routes.js` (importar `Joi`, `validar`, `trkPermiso`):

```js
const esquemaId = Joi.object({ id: Joi.number().integer().positive().required() });
const esquemaActualizar = Joi.object({ puestos_premiados: Joi.number().integer().min(1).max(20).required() });

router.post('/:id/abrir', apiCodigo('TRK-CAT-001'), trkAuth, trkPermiso('administrar'), validar(esquemaId, 'params'), aw(ctrl.abrir));
router.post('/:id/cerrar', apiCodigo('TRK-CAT-002'), trkAuth, trkPermiso('administrar'), validar(esquemaId, 'params'), aw(ctrl.cerrar));
router.post('/:id/publicar', apiCodigo('TRK-CAT-003'), trkAuth, trkPermiso('publicar'), validar(esquemaId, 'params'), aw(ctrl.publicar));
router.patch('/:id', apiCodigo('TRK-CAT-004'), trkAuth, trkPermiso('administrar'), validar(esquemaId, 'params'), validar(esquemaActualizar), aw(ctrl.actualizar));
```

`BACK:src/trk/controllers/ranking.controller.js`:

```js
const svc = require('../services/rankingDatos.service');
const { ok } = require('../utils/respuesta');
const { ctxDe } = require('../utils/ctx');
const { tienePermiso } = require('../utils/permisos');

// Admin: en vivo (o ?vista=publicado). Resto/público: solo lo publicado (R8).
exports.obtener = async (req, res) => {
  const enVivo = tienePermiso(req.usuario, 'administrar') && req.query.vista !== 'publicado';
  ok(res, enVivo ? await svc.rankingEnVivo(req.params.categoriaId) : await svc.rankingPublicado(req.params.categoriaId));
};
exports.desempate = async (req, res) => ok(res, await svc.fijarDesempate(req.params.categoriaId, req.body.orden, ctxDe(req)));
```

`BACK:src/trk/routes/ranking.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth, trkAuthOpcional, trkPermiso } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const ctrl = require('../controllers/ranking.controller');

const esquemaCategoria = Joi.object({ categoriaId: Joi.number().integer().positive().required() });
const esquemaVista = Joi.object({ vista: Joi.string().valid('publicado') });
const esquemaDesempate = Joi.object({ orden: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).min(2).unique().required() });

const router = express.Router();
router.get('/:categoriaId', apiCodigo('TRK-RNK-001'), trkAuthOpcional, validar(esquemaCategoria, 'params'), validar(esquemaVista, 'query'), aw(ctrl.obtener));
router.put('/:categoriaId/desempate', apiCodigo('TRK-RNK-002'), trkAuth, trkPermiso('administrar'), validar(esquemaCategoria, 'params'), validar(esquemaDesempate), aw(ctrl.desempate));

module.exports = { prefijo: '/ranking', router };
```

En `BACK:src/trk/services/evento.service.js`, dentro de `estadoPublico()`, reemplazar `ranking: null` del objeto devuelto por el valor calculado:

```js
  let ranking = null;
  if (estado.modo_pantalla === 'RANKING' && estado.categoria_pantalla_id) {
    const { rankingPublicado } = require('./rankingDatos.service');
    ranking = await rankingPublicado(estado.categoria_pantalla_id).catch(() => null);
  }
```

y devolver `ranking` en el objeto.

En `BACK:src/trk/routes/index.js` agregar `require('./ranking.routes'),`. En `BACK:src/trk/config/apiCodigos.js`:

```js
  'TRK-CAT-001': { metodo: 'POST', ruta: '/categorias/:id/abrir', descripcion: 'Abre la categoría para calificar' },
  'TRK-CAT-002': { metodo: 'POST', ruta: '/categorias/:id/cerrar', descripcion: 'Cierra la categoría (no se califica más)' },
  'TRK-CAT-003': { metodo: 'POST', ruta: '/categorias/:id/publicar', descripcion: 'Publica el ranking (snapshot)' },
  'TRK-CAT-004': { metodo: 'PATCH', ruta: '/categorias/:id', descripcion: 'Edita puestos premiados' },
  'TRK-RNK-001': { metodo: 'GET', ruta: '/ranking/:categoriaId', descripcion: 'Ranking en vivo (admin) o publicado (resto)' },
  'TRK-RNK-002': { metodo: 'PUT', ruta: '/ranking/:categoriaId/desempate', descripcion: 'Fija desempate manual' },
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): ranking en vivo, desempate manual, cierre y publicacion con snapshot (HU-4, HU-10)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6.3: Fusión de duplicados y confirmación de cambio de categoría

Cubre: HU-3 CA1, CA2; §13.7, §13.13; §9.1 `TRK-PAR-006/007`; RNF-6.

**Files:**
- Modify: `BACK:src/trk/services/participantes.service.js` (`fusionar`, `confirmarCategoria`), `BACK:src/trk/controllers/participantes.controller.js`, `BACK:src/trk/routes/participantes.routes.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/routes/__tests__/correccion.int.test.js`

**Interfaces:**
- Produces:
  - `fusionar(origenId, destinoId, ctx) → Participante (COMPLETO, destino)`: 409 `FUSION_CON_CHOQUE` (con `errors: [{ campo: 'jurado_id', mensaje }]`) si un mismo jurado calificó ambos; 409 `CATEGORIAS_DISTINTAS` si el origen tiene calificaciones y otra categoría; mueve calificaciones; conserva la foto oficial más reciente; el destino adopta el estado más avanzado; el origen queda con `fusionado_en_id` (y deja de estar `EN_PASARELA`).
  - `confirmarCategoria(id, { confirmar }, ctx) → Participante (COMPLETO)`: 400 si no hay propuesta; 409 `CONFIRMACION_REQUERIDA` si hay calificaciones y `confirmar !== true`; si confirma, borra calificaciones (auditadas en `antes`), aplica la categoría, limpia `desempate_manual` y lo pone al final de la cola de la nueva categoría.

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/routes/__tests__/correccion.int.test.js`:

```js
const request = require('supertest');
const db = require('../../../models');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria, calificar } = require('../../testing/fabricas');

const app = crearAppTrk();
let admin; let j1; let j2;
const P = { CREATIVIDAD: 10, SEGURIDAD: 10, ELABORACION: 10, PASARELA: 10 };
beforeEach(async () => {
  await limpiar();
  admin = await crearAdmin();
  j1 = await crearOperativo('TRK_JURADO');
  j2 = await crearOperativo('TRK_JURADO');
});
afterAll(cerrar);
const comoAdmin = (r) => r.set('Authorization', `Bearer ${admin.token}`);

describe('TRK-PAR-007 confirmar cambio de categoría (§13.7)', () => {
  test('exige confirmación, borra calificaciones y deja auditoría con lo borrado', async () => {
    const grandes = await categoria('GRANDES');
    const p = await crearParticipante({ estado: 'PRESENTADO', categoria_propuesta_id: grandes.id, desempate_manual: 1 });
    await calificar(p, j1.usuario, P);
    await calificar(p, j2.usuario, P);

    const sin = await comoAdmin(request(app).post(`/api/trk/v1/participantes/${p.id}/categoria/confirmar`)).send({});
    expect(sin.status).toBe(409);
    expect(sin.body).toMatchObject({ error: 'TRK-PAR-007', motivo: 'CONFIRMACION_REQUERIDA' });
    expect(sin.body.message).toContain('2');
    expect(await db.TrkCalificacion.count({ where: { participante_id: p.id } })).toBe(2);

    const con = await comoAdmin(request(app).post(`/api/trk/v1/participantes/${p.id}/categoria/confirmar`)).send({ confirmar: true });
    expect(con.status).toBe(200);
    expect(con.body.data).toMatchObject({ categoria_id: grandes.id, categoria_propuesta_id: null, desempate_manual: null });
    expect(await db.TrkCalificacion.count({ where: { participante_id: p.id } })).toBe(0);
    const aud = await db.TrkAuditoria.findOne({ where: { api_codigo: 'TRK-PAR-007', accion: 'CAMBIAR_CATEGORIA' } });
    expect(aud.antes.calificaciones).toHaveLength(2);
    expect(aud.despues).toMatchObject({ categoria_id: grandes.id, calificaciones_borradas: 2 });
  });

  test('sin propuesta → 400', async () => {
    const p = await crearParticipante();
    expect((await comoAdmin(request(app).post(`/api/trk/v1/participantes/${p.id}/categoria/confirmar`)).send({ confirmar: true })).status).toBe(400);
  });

  test('solo admin (editar) confirma', async () => {
    const cabina = await crearOperativo('TRK_CABINA');
    const p = await crearParticipante();
    expect((await request(app).post(`/api/trk/v1/participantes/${p.id}/categoria/confirmar`).set('Authorization', `Bearer ${cabina.token}`).send({ confirmar: true })).status).toBe(403);
  });
});

describe('TRK-PAR-006 fusionar (§13.13)', () => {
  test('mismo jurado en ambos → 409 FUSION_CON_CHOQUE y no cambia nada', async () => {
    const origen = await crearParticipante({ mascota_nombre: 'Thor', estado: 'PRESENTADO' });
    const destino = await crearParticipante({ mascota_nombre: 'THOR', estado: 'PRESENTADO' });
    await calificar(origen, j1.usuario, P);
    await calificar(destino, j1.usuario, P);
    const r = await comoAdmin(request(app).post(`/api/trk/v1/participantes/${origen.id}/fusionar`)).send({ destino_id: destino.id });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: 'TRK-PAR-006', motivo: 'FUSION_CON_CHOQUE' });
    await origen.reload();
    expect(origen.fusionado_en_id).toBeNull();
  });

  test('sin choque: mueve calificaciones, conserva la foto más reciente y oculta el origen', async () => {
    const viejo = new Date('2026-10-30T10:00:00-05:00');
    const nuevo = new Date('2026-10-30T11:00:00-05:00');
    const origen = await crearParticipante({ mascota_nombre: 'Thor', estado: 'PRESENTADO', foto_oficial_path: 'nueva.jpg', foto_oficial_at: nuevo });
    const destino = await crearParticipante({ mascota_nombre: 'Thor 2', estado: 'INSCRITO', foto_oficial_path: 'vieja.jpg', foto_oficial_at: viejo });
    await calificar(origen, j1.usuario, P);
    await calificar(destino, j2.usuario, P);
    const r = await comoAdmin(request(app).post(`/api/trk/v1/participantes/${origen.id}/fusionar`)).send({ destino_id: destino.id });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ id: destino.id, estado: 'PRESENTADO', foto_url: '/uploads/trk/fotos/nueva.jpg' });
    expect(await db.TrkCalificacion.count({ where: { participante_id: destino.id } })).toBe(2);
    await origen.reload();
    expect(origen.fusionado_en_id).toBe(destino.id);
    const lista = await comoAdmin(request(app).get('/api/trk/v1/participantes'));
    expect(lista.body.data.map((x) => x.id)).toEqual([destino.id]);
    expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-PAR-006', accion: 'FUSIONAR' } })).toBe(2);
  });

  test('origen con calificaciones en otra categoría → 409 CATEGORIAS_DISTINTAS', async () => {
    const origen = await crearParticipante({ estado: 'PRESENTADO', categoriaCodigo: 'GRANDES' });
    const destino = await crearParticipante({ estado: 'PRESENTADO', categoriaCodigo: 'FAMILIAR' });
    await calificar(origen, j1.usuario, P);
    const r = await comoAdmin(request(app).post(`/api/trk/v1/participantes/${origen.id}/fusionar`)).send({ destino_id: destino.id });
    expect(r.status).toBe(409);
    expect(r.body.motivo).toBe('CATEGORIAS_DISTINTAS');
  });

  test('fusionar consigo mismo → 400', async () => {
    const p = await crearParticipante();
    expect((await comoAdmin(request(app).post(`/api/trk/v1/participantes/${p.id}/fusionar`)).send({ destino_id: p.id })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/correccion.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Agregar a `BACK:src/trk/services/participantes.service.js` (y exportar `fusionar`, `confirmarCategoria`):

```js
// Orden de avance para decidir el estado del destino tras fusionar.
const AVANCE = ['AUSENTE', 'INSCRITO', 'PRESENTE', 'PRESENTADO', 'EN_PASARELA'];

async function fusionar(origenId, destinoId, ctx) {
  if (origenId === destinoId) throw new TrkError(400, 'VALIDACION', 'No se puede fusionar un registro consigo mismo');
  const destino = await db.sequelize.transaction(async (transaction) => {
    const origen = await buscarModelo(origenId, { transaction, lock: true });
    const dest = await buscarModelo(destinoId, { transaction, lock: true });
    const [calsOrigen, calsDestino] = await Promise.all([
      db.TrkCalificacion.findAll({ where: { participante_id: origen.id }, transaction, lock: transaction.LOCK.UPDATE }),
      db.TrkCalificacion.findAll({ where: { participante_id: dest.id }, transaction })
    ]);
    const choques = calsOrigen.filter((c) => calsDestino.some((d) => d.jurado_id === c.jurado_id));
    if (choques.length) {
      throw new TrkError(409, 'FUSION_CON_CHOQUE', 'Un mismo jurado calificó ambos registros; desbloquea o elimina una de las calificaciones antes de fusionar',
        choques.map((c) => ({ campo: 'jurado_id', mensaje: `Jurado ${c.jurado_id} calificó ambos` })));
    }
    if (calsOrigen.length && origen.categoria_id !== dest.categoria_id) {
      throw new TrkError(409, 'CATEGORIAS_DISTINTAS', 'El origen tiene calificaciones de otra categoría; cambia primero su categoría o la del destino');
    }

    const antesDestino = dest.get({ plain: true });
    for (const c of calsOrigen) await c.update({ participante_id: dest.id }, { transaction });

    const cambios = {};
    if (origen.foto_oficial_at && (!dest.foto_oficial_at || origen.foto_oficial_at > dest.foto_oficial_at)) {
      cambios.foto_oficial_path = origen.foto_oficial_path;
      cambios.foto_oficial_at = origen.foto_oficial_at;
    }
    if (AVANCE.indexOf(origen.estado) > AVANCE.indexOf(dest.estado)) cambios.estado = origen.estado;
    if (!dest.llegada_at && origen.llegada_at) cambios.llegada_at = origen.llegada_at;
    if (Object.keys(cambios).length) await dest.update(cambios, { transaction });

    if (origen.estado === 'EN_PASARELA') {
      await db.TrkEventoEstado.update({ participante_en_pasarela_id: dest.id }, { where: { id: 1, participante_en_pasarela_id: origen.id }, transaction });
    }
    await origen.update({ fusionado_en_id: dest.id, estado: origen.estado === 'EN_PASARELA' ? 'PRESENTADO' : origen.estado }, { transaction });

    await registrarAuditoria(ctx, { entidad: 'participante', entidadId: origen.id, accion: 'FUSIONAR', despues: { fusionado_en_id: dest.id } }, { transaction });
    await registrarAuditoria(ctx, {
      entidad: 'participante', entidadId: dest.id, accion: 'FUSIONAR',
      antes: { foto_oficial_path: antesDestino.foto_oficial_path, estado: antesDestino.estado },
      despues: { origen_id: origen.id, calificaciones_movidas: calsOrigen.length, ...cambios }
    }, { transaction });
    return dest;
  });
  emitir('participante:actualizado', { participante: destino.get({ plain: true }) });
  return recargarCompleto(destino);
}

async function confirmarCategoria(id, { confirmar }, ctx) {
  const p = await db.sequelize.transaction(async (transaction) => {
    const participante = await buscarModelo(id, { transaction, lock: true });
    if (!participante.categoria_propuesta_id) throw new TrkError(400, 'VALIDACION', 'No hay un cambio de categoría propuesto');
    const calificaciones = await db.TrkCalificacion.findAll({ where: { participante_id: participante.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (calificaciones.length && confirmar !== true) {
      throw new TrkError(409, 'CONFIRMACION_REQUERIDA', `Confirmar borrará ${calificaciones.length} calificación(es) porque la rúbrica cambia`);
    }
    const antes = {
      categoria_id: participante.categoria_id,
      calificaciones: calificaciones.map((c) => ({ id: c.id, jurado_id: c.jurado_id, total: c.total }))
    };
    await db.TrkCalificacion.destroy({ where: { participante_id: participante.id }, transaction });
    const nueva = participante.categoria_propuesta_id;
    const maximo = await db.TrkParticipante.max('orden_pasarela', { where: { categoria_id: nueva }, transaction });
    await participante.update({
      categoria_id: nueva, categoria_propuesta_id: null, desempate_manual: null,
      orden_pasarela: participante.orden_pasarela == null ? null : (maximo || 0) + 1
    }, { transaction });
    await registrarAuditoria(ctx, {
      entidad: 'participante', entidadId: participante.id, accion: 'CAMBIAR_CATEGORIA',
      antes, despues: { categoria_id: nueva, calificaciones_borradas: calificaciones.length }
    }, { transaction });
    return participante;
  });
  emitir('participante:actualizado', { participante: p.get({ plain: true }) });
  return recargarCompleto(p);
}
```

Agregar a `BACK:src/trk/controllers/participantes.controller.js`:

```js
exports.fusionar = async (req, res) => ok(res, await svc.fusionar(req.params.id, req.body.destino_id, ctxDe(req)));
exports.confirmarCategoria = async (req, res) => ok(res, await svc.confirmarCategoria(req.params.id, req.body, ctxDe(req)));
```

Agregar a `BACK:src/trk/routes/participantes.routes.js`:

```js
const esquemaFusion = Joi.object({ destino_id: Joi.string().guid({ version: 'uuidv4' }).required() });
const esquemaConfirmar = Joi.object({ confirmar: Joi.boolean().default(false) });

router.post('/:id/fusionar', apiCodigo('TRK-PAR-006'), trkAuth, trkPermiso('editar'), validar(esquemaId, 'params'), validar(esquemaFusion), aw(ctrl.fusionar));
router.post('/:id/categoria/confirmar', apiCodigo('TRK-PAR-007'), trkAuth, trkPermiso('editar'), validar(esquemaId, 'params'), validar(esquemaConfirmar), aw(ctrl.confirmarCategoria));
```

En `BACK:src/trk/config/apiCodigos.js`:

```js
  'TRK-PAR-006': { metodo: 'POST', ruta: '/participantes/:id/fusionar', descripcion: 'Fusiona el registro (origen) en destino_id' },
  'TRK-PAR-007': { metodo: 'POST', ruta: '/participantes/:id/categoria/confirmar', descripcion: 'Confirma categoría propuesta; borra calificaciones' },
```

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): fusion de duplicados y confirmacion de cambio de categoria auditados (HU-3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6.4: Exportación de resultados a Excel

Cubre: HU-4 CA3; §9.1 `TRK-EXP-001`.

**Files:**
- Create: `BACK:src/trk/services/export.service.js`, `BACK:src/trk/controllers/export.controller.js`, `BACK:src/trk/routes/export.routes.js`
- Modify: `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/routes/__tests__/export.int.test.js`

**Interfaces:**
- Produces: `generarResultadosXlsx() → Promise<Buffer>` con una hoja por categoría (código) con columnas `Puesto, Mascota, Disfraz, Puntaje final, <promedio por criterio…>, Calificaciones, Estado, Premiado, Empate sin resolver`, y una hoja `Detalle` (desde `trk_vw_calificacion_totales`) con `Categoría, Mascota, Jurado, Criterio, Puntaje, Total del jurado, Enviada`. Sin datos personales del responsable.

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/routes/__tests__/export.int.test.js`:

```js
const ExcelJS = require('exceljs');
const request = require('supertest');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, calificar, criteriosDe } = require('../../testing/fabricas');

const app = crearAppTrk();
beforeEach(limpiar);
afterAll(cerrar);

const binario = (res, cb) => {
  const partes = [];
  res.on('data', (c) => partes.push(c));
  res.on('end', () => cb(null, Buffer.concat(partes)));
};

test('TRK-EXP-001 genera Excel con hoja por categoría y detalle por jurado y criterio (HU-4 CA3)', async () => {
  const admin = await crearAdmin();
  const j = await crearOperativo('TRK_JURADO', { nombre: 'Jurado Ana' });
  const p = await crearParticipante({ mascota_nombre: 'Canela', estado: 'PRESENTADO', responsable_telefono: '3009990000' });
  await calificar(p, j.usuario, { CREATIVIDAD: 30, SEGURIDAD: 25, ELABORACION: 15, PASARELA: 10 });

  const r = await request(app).get('/api/trk/v1/export/resultados.xlsx').set('Authorization', `Bearer ${admin.token}`).buffer(true).parse(binario);
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-EXP-001');
  expect(r.headers['content-type']).toContain('spreadsheetml');
  expect(r.headers['content-disposition']).toMatch(/attachment; filename="trikipeludos-resultados-\d{8}-\d{4}\.xlsx"/);

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(r.body);
  expect(libro.worksheets.map((h) => h.name)).toEqual(['PEQ_MED', 'GRANDES', 'FELINOS', 'FAMILIAR', 'Detalle']);
  const peq = libro.getWorksheet('PEQ_MED');
  expect(peq.getRow(1).values).toEqual(expect.arrayContaining(['Puesto', 'Mascota', 'Puntaje final', 'Creatividad']));
  expect(peq.getRow(2).getCell(2).value).toBe('Canela');
  const detalle = libro.getWorksheet('Detalle');
  expect(detalle.rowCount - 1).toBe((await criteriosDe(p)).length);
  expect(detalle.getRow(2).values).toEqual(expect.arrayContaining(['Canela', 'Jurado Ana']));

  let todo = '';
  libro.eachSheet((h) => h.eachRow((fila) => { todo += JSON.stringify(fila.values); }));
  expect(todo).not.toContain('3009990000');
});

test('solo con permiso exportar', async () => {
  const jurado = await crearOperativo('TRK_JURADO');
  const r = await request(app).get('/api/trk/v1/export/resultados.xlsx').set('Authorization', `Bearer ${jurado.token}`);
  expect(r.status).toBe(403);
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/export.int.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`BACK:src/trk/services/export.service.js`:

```js
const ExcelJS = require('exceljs');
const { QueryTypes } = require('sequelize');
const db = require('../../models');
const { rankingEnVivo } = require('./rankingDatos.service');

const encabezadoEnNegrita = (hoja) => { hoja.getRow(1).font = { bold: true }; hoja.views = [{ state: 'frozen', ySplit: 1 }]; };

async function generarResultadosXlsx() {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'TRIKIPELUDOS';
  const categorias = await db.TrkCategoria.findAll({ order: [['orden', 'ASC']] });

  for (const categoria of categorias) {
    const ranking = await rankingEnVivo(categoria.id);
    const hoja = libro.addWorksheet(categoria.codigo);
    hoja.addRow(['Puesto', 'Mascota', 'Disfraz', 'Puntaje final', ...ranking.criterios.map((c) => c.nombre), 'Calificaciones', 'Estado', 'Premiado', 'Empate sin resolver']);
    for (const f of ranking.filas) {
      hoja.addRow([
        f.puesto, f.mascota_nombre, f.participante ? f.participante.disfraz_nombre : null, f.puntaje_final,
        ...ranking.criterios.map((c) => f.promedios[c.codigo]),
        `${f.n_calificaciones}/${f.n_jurados}`, f.completa ? 'Completa' : 'Incompleta', f.premiado ? 'Sí' : 'No', f.empate_sin_resolver ? 'Sí' : 'No'
      ]);
    }
    encabezadoEnNegrita(hoja);
  }

  const detalle = libro.addWorksheet('Detalle');
  detalle.addRow(['Categoría', 'Mascota', 'Jurado', 'Criterio', 'Puntaje', 'Total del jurado', 'Enviada']);
  const filas = await db.sequelize.query(
    `SELECT c.codigo AS categoria, v.mascota_nombre, v.jurado_nombre, v.criterio_nombre, v.puntaje, v.total, v.enviada_at
       FROM trk_vw_calificacion_totales v JOIN trk_categorias c ON c.id = v.categoria_id
      ORDER BY c.orden, v.mascota_nombre, v.jurado_nombre, v.criterio_orden`,
    { type: QueryTypes.SELECT }
  );
  for (const f of filas) detalle.addRow([f.categoria, f.mascota_nombre, f.jurado_nombre, f.criterio_nombre, f.puntaje, f.total, f.enviada_at]);
  encabezadoEnNegrita(detalle);

  return Buffer.from(await libro.xlsx.writeBuffer());
}

module.exports = { generarResultadosXlsx };
```

`BACK:src/trk/controllers/export.controller.js`:

```js
const { generarResultadosXlsx } = require('../services/export.service');

const dos = (n) => String(n).padStart(2, '0');

exports.resultados = async (req, res) => {
  const ahora = new Date();
  const sello = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  const buffer = await generarResultadosXlsx();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="trikipeludos-resultados-${sello}.xlsx"`);
  res.send(buffer);
};
```

`BACK:src/trk/routes/export.routes.js`:

```js
const express = require('express');
const apiCodigo = require('../middleware/apiCodigo');
const { trkAuth, trkPermiso } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const ctrl = require('../controllers/export.controller');

const router = express.Router();
router.get('/resultados.xlsx', apiCodigo('TRK-EXP-001'), trkAuth, trkPermiso('exportar'), aw(ctrl.resultados));

module.exports = { prefijo: '/export', router };
```

En `BACK:src/trk/routes/index.js` agregar `require('./export.routes'),`. En `BACK:src/trk/config/apiCodigos.js`:
`'TRK-EXP-001': { metodo: 'GET', ruta: '/export/resultados.xlsx', descripcion: 'Exporta resultados a Excel con detalle por jurado y criterio' },`

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest src/trk && npx jest -c jest.trk-int.config.js --runInBand src/trk`
Expected: PASS. En este punto `apiCodigos.test.js` debe cubrir **todos** los códigos de §9.1 (33 + `TRK-CAT-005`).

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk
git commit -m "feat(trk): exportacion de resultados a Excel por categoria y detalle por jurado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6.5: Ranking del admin (en vivo, desempates, publicación, exportación, pantalla)

Cubre: HU-10 CA1, CA2; HU-4 CA1–CA6; R7 (desbloqueo desde la UI); §10 `/admin/ranking`.

**Files:**
- Create: `FRONT:src/views/admin/RankingView.vue`, `FRONT:src/utils/descargas.js`
- Modify: `FRONT:src/router/index.js` (hijo `ranking`)
- Test: `FRONT:src/views/admin/__tests__/RankingView.spec.js`

**Interfaces:**
- Consumes: `TRK-RNK-001/002`, `TRK-CAT-001..005`, `TRK-CAL-003`, `TRK-EVT-002`, `TRK-EXP-001`.
- Produces: `descargarBlob(blob, nombreArchivo)`.

- [ ] **Step 1: Escribir la prueba que falla**

`FRONT:src/views/admin/__tests__/RankingView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn(() => ({ conectado: { value: true } })) }))
vi.mock('@/utils/descargas', () => ({ descargarBlob: vi.fn() }))

import { trk } from '@/services/api'
import { descargarBlob } from '@/utils/descargas'
import RankingView from '@/views/admin/RankingView.vue'

const CATS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños', abierta: true, ranking_publicado: false, puestos_premiados: 3 }]
const RANKING = {
  categoria: CATS[0],
  criterios: [{ codigo: 'CREATIVIDAD', nombre: 'Creatividad' }, { codigo: 'SEGURIDAD', nombre: 'Seguridad' }],
  empates_sin_resolver: [['a', 'b']],
  filas: [
    { participante_id: 'a', mascota_nombre: 'A', puesto: 1, puntaje_final: 80, promedios: { CREATIVIDAD: 30, SEGURIDAD: 25 }, n_calificaciones: 3, n_jurados: 3, completa: true, premiado: true, empate_sin_resolver: true, participante: { id: 'a', mascota_nombre: 'A' }, calificaciones: [{ id: 9, jurado_nombre: 'J1', total: 80, bloqueada: true }] },
    { participante_id: 'b', mascota_nombre: 'B', puesto: 1, puntaje_final: 80, promedios: { CREATIVIDAD: 30, SEGURIDAD: 25 }, n_calificaciones: 3, n_jurados: 3, completa: true, premiado: true, empate_sin_resolver: true, participante: { id: 'b', mascota_nombre: 'B' }, calificaciones: [] },
    { participante_id: 'c', mascota_nombre: 'C', puesto: null, puntaje_final: 90, promedios: {}, n_calificaciones: 2, n_jurados: 3, completa: false, premiado: false, empate_sin_resolver: false, participante: { id: 'c', mascota_nombre: 'C' }, calificaciones: [] }
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  window.confirm = vi.fn(() => true)
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATS }
    if (url === '/ranking/1') return { data: RANKING }
    if (url === '/export/resultados.xlsx') return new Blob(['xlsx'])
    throw new Error(url)
  })
})

test('muestra ranking, incompletas y empates sin resolver (HU-10)', async () => {
  const w = mount(RankingView)
  await flushPromises()
  expect(w.text()).toContain('Incompleta (2/3)')
  expect(w.get('[data-test="empates"]').text()).toContain('A')
  expect(w.findAll('[data-test="fila-empate"]')).toHaveLength(2)
})

test('resolver empate envía el orden elegido', async () => {
  trk.put.mockResolvedValue({ data: { ...RANKING, empates_sin_resolver: [] } })
  const w = mount(RankingView)
  await flushPromises()
  await w.get('[data-test="bajar-empate-a"]').trigger('click')
  await w.get('[data-test="guardar-desempate"]').trigger('click')
  await flushPromises()
  expect(trk.put).toHaveBeenCalledWith('/ranking/1/desempate', { orden: ['b', 'a'] })
})

test('cerrar, publicar, mostrar en pantalla y exportar', async () => {
  trk.post.mockResolvedValue({ data: { ...CATS[0], abierta: false } })
  trk.put.mockResolvedValue({ data: {} })
  const w = mount(RankingView)
  await flushPromises()
  await w.get('[data-test="cerrar"]').trigger('click')
  expect(trk.post).toHaveBeenCalledWith('/categorias/1/cerrar')
  await w.get('[data-test="publicar"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalled()
  expect(trk.post).toHaveBeenCalledWith('/categorias/1/publicar')
  await w.get('[data-test="mostrar-pantalla"]').trigger('click')
  expect(trk.put).toHaveBeenCalledWith('/evento/pantalla', { modo: 'RANKING', categoria_id: 1 })
  await w.get('[data-test="exportar"]').trigger('click')
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/export/resultados.xlsx', { responseType: 'blob' })
  expect(descargarBlob).toHaveBeenCalled()
})

test('puestos premiados y desbloqueo de una calificación', async () => {
  trk.patch.mockResolvedValue({ data: { ...CATS[0], puestos_premiados: 5 } })
  trk.post.mockResolvedValue({ data: { id: 9, bloqueada: false } })
  const w = mount(RankingView)
  await flushPromises()
  await w.get('[data-test="puestos"]').setValue('5')
  await w.get('[data-test="guardar-puestos"]').trigger('click')
  expect(trk.patch).toHaveBeenCalledWith('/categorias/1', { puestos_premiados: 5 })
  await w.get('[data-test="detalle-a"]').trigger('click')
  await w.get('[data-test="desbloquear-9"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/calificaciones/9/desbloquear')
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd FRONT && npx vitest run src/views/admin/__tests__/RankingView.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/utils/descargas.js`:

```js
export function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
```

`FRONT:src/views/admin/RankingView.vue`:

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCategoriasStore } from '@/stores/categorias'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'
import { descargarBlob } from '@/utils/descargas'

const auth = useAuthStore()
const categorias = useCategoriasStore()
const categoriaId = ref(null)
const ranking = ref(null)
const puestos = ref(3)
const ordenEmpate = ref({})
const abiertas = ref(new Set())
const error = ref('')
const aviso = ref('')

const categoria = computed(() => (ranking.value ? ranking.value.categoria : null))
const filaPorId = (id) => ranking.value.filas.find((f) => f.participante_id === id)

async function cargar() {
  if (!categoriaId.value) return
  try {
    ranking.value = (await trk.get(`/ranking/${categoriaId.value}`)).data
    puestos.value = ranking.value.categoria.puestos_premiados
    ordenEmpate.value = Object.fromEntries(ranking.value.empates_sin_resolver.map((g, i) => [i, [...g]]))
  } catch (e) { error.value = mensajeDeError(e) }
}

async function accion(fn, exito) {
  error.value = ''
  aviso.value = ''
  try {
    await fn()
    if (exito) aviso.value = exito
    await cargar()
  } catch (e) { error.value = mensajeDeError(e) }
}

const elegir = (id) => { categoriaId.value = id; cargar() }
const abrirCerrar = () => accion(() => trk.post(`/categorias/${categoriaId.value}/${categoria.value.abierta ? 'cerrar' : 'abrir'}`))
const guardarPuestos = () => accion(() => trk.patch(`/categorias/${categoriaId.value}`, { puestos_premiados: Number(puestos.value) }), 'Puestos premiados actualizados')
const publicar = () => {
  if (!window.confirm('¿Publicar el ranking de esta categoría? Se verá en la pantalla pública y para el comentarista.')) return
  return accion(() => trk.post(`/categorias/${categoriaId.value}/publicar`), 'Ranking publicado')
}
const mostrarEnPantalla = () => accion(() => trk.put('/evento/pantalla', { modo: 'RANKING', categoria_id: categoriaId.value }), 'La pantalla muestra este ranking')
const desbloquear = (cal) => accion(() => trk.post(`/calificaciones/${cal.id}/desbloquear`), `Calificación de ${cal.jurado_nombre} desbloqueada`)
const guardarDesempate = (i) => accion(() => trk.put(`/ranking/${categoriaId.value}/desempate`, { orden: ordenEmpate.value[i] }), 'Desempate guardado')

function moverEmpate(i, id, paso) {
  const lista = [...ordenEmpate.value[i]]
  const a = lista.indexOf(id)
  const b = a + paso
  if (b < 0 || b >= lista.length) return
  ;[lista[a], lista[b]] = [lista[b], lista[a]]
  ordenEmpate.value = { ...ordenEmpate.value, [i]: lista }
}

function alternarDetalle(id) {
  const s = new Set(abiertas.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  abiertas.value = s
}

async function exportar() {
  try { descargarBlob(await trk.get('/export/resultados.xlsx', { responseType: 'blob' }), 'trikipeludos-resultados.xlsx') } catch (e) { error.value = mensajeDeError(e) }
}

useTiempoReal({ token: auth.token, sincronizar: cargar, intervaloMs: 10000, eventos: { 'calificacion:recibida': cargar } })
onMounted(async () => {
  try {
    await categorias.cargar(true)
    if (categorias.lista.length) elegir(categorias.lista[0].id)
  } catch (e) { error.value = mensajeDeError(e) }
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold">Ranking en vivo</h2>
      <button class="btn-claro" data-test="exportar" @click="exportar">⬇️ Exportar Excel</button>
    </div>
    <nav class="flex gap-1 overflow-x-auto">
      <button v-for="c in categorias.lista" :key="c.id" class="btn whitespace-nowrap" :class="c.id === categoriaId ? 'bg-calabaza-700 text-white' : 'bg-white text-morado-800'" @click="elegir(c.id)">{{ c.nombre }}</button>
    </nav>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
    <p v-if="aviso" class="rounded-xl bg-green-100 p-3 text-green-900" role="status">{{ aviso }}</p>

    <template v-if="ranking">
      <div class="tarjeta flex flex-wrap items-end gap-3">
        <span class="font-semibold">{{ categoria.abierta ? '🟢 Abierta' : '🔴 Cerrada' }} · {{ categoria.ranking_publicado ? 'Publicada' : 'Sin publicar' }}</span>
        <button class="btn-claro" data-test="cerrar" @click="abrirCerrar">{{ categoria.abierta ? 'Cerrar categoría' : 'Reabrir categoría' }}</button>
        <label class="flex items-center gap-2">Puestos premiados
          <input v-model="puestos" data-test="puestos" type="number" min="1" max="20" class="campo w-20" />
        </label>
        <button class="btn-claro" data-test="guardar-puestos" @click="guardarPuestos">Guardar</button>
        <button class="btn-primario" data-test="publicar" :disabled="ranking.empates_sin_resolver.length > 0" @click="publicar">Publicar</button>
        <button class="btn-secundario" data-test="mostrar-pantalla" :disabled="!categoria.ranking_publicado" @click="mostrarEnPantalla">Mostrar en pantalla</button>
      </div>

      <div v-if="ranking.empates_sin_resolver.length" data-test="empates" class="tarjeta border-2 border-calabaza-500">
        <h3 class="font-bold">⚖️ Empates sin resolver</h3>
        <p class="text-sm">Ordena de mejor a peor y guarda. Esto define el desempate manual (R5).</p>
        <div v-for="(grupo, i) in ordenEmpate" :key="i" class="mt-2 flex flex-col gap-1">
          <div v-for="id in grupo" :key="id" data-test="fila-empate" class="flex items-center gap-2">
            <span class="flex-1">{{ filaPorId(id).mascota_nombre }}</span>
            <button class="btn min-w-tactil" :data-test="`subir-empate-${id}`" :aria-label="`Subir ${filaPorId(id).mascota_nombre}`" @click="moverEmpate(i, id, -1)">▲</button>
            <button class="btn min-w-tactil" :data-test="`bajar-empate-${id}`" :aria-label="`Bajar ${filaPorId(id).mascota_nombre}`" @click="moverEmpate(i, id, 1)">▼</button>
          </div>
          <button class="btn-primario self-start" data-test="guardar-desempate" @click="guardarDesempate(i)">Guardar desempate</button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="bg-morado-50">
            <tr><th class="p-2">#</th><th class="p-2">Mascota</th><th class="p-2">Final</th><th v-for="c in ranking.criterios" :key="c.codigo" class="p-2">{{ c.nombre }}</th><th class="p-2">Estado</th><th class="p-2"></th></tr>
          </thead>
          <tbody>
            <template v-for="f in ranking.filas" :key="f.participante_id">
              <tr :class="f.premiado ? 'bg-calabaza-50' : ''" class="border-t border-morado-100">
                <td class="p-2 font-bold">{{ f.puesto ?? '—' }}<span v-if="f.empate_sin_resolver" title="Empate sin resolver"> ⚖️</span></td>
                <td class="p-2">{{ f.mascota_nombre }}</td>
                <td class="p-2 font-semibold">{{ f.puntaje_final ?? '—' }}</td>
                <td v-for="c in ranking.criterios" :key="c.codigo" class="p-2">{{ f.promedios[c.codigo] ?? '—' }}</td>
                <td class="p-2">{{ f.completa ? 'Completa' : `Incompleta (${f.n_calificaciones}/${f.n_jurados})` }}</td>
                <td class="p-2"><button class="btn min-h-0 py-1 text-morado-700" :data-test="`detalle-${f.participante_id}`" @click="alternarDetalle(f.participante_id)">Jurados</button></td>
              </tr>
              <tr v-if="abiertas.has(f.participante_id)">
                <td :colspan="5 + ranking.criterios.length" class="bg-morado-50 p-2">
                  <p v-if="!f.calificaciones.length">Sin calificaciones.</p>
                  <div v-for="cal in f.calificaciones" :key="cal.id" class="flex items-center gap-2 py-1">
                    <span class="flex-1">{{ cal.jurado_nombre }}: <strong>{{ cal.total }}</strong> {{ cal.bloqueada ? '🔒' : '🔓' }}</span>
                    <button v-if="cal.bloqueada" class="btn-claro min-h-0 py-1" :data-test="`desbloquear-${cal.id}`" @click="desbloquear(cal)">Desbloquear</button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
```

En `FRONT:src/router/index.js`, hijos de `/admin`: `{ path: 'ranking', component: () => import('@/views/admin/RankingView.vue') },`

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): ranking del admin con desempates, publicacion, pantalla, desbloqueo y exportacion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6.6: Ranking publicado en la pantalla pública y para el comentarista

Cubre: HU-9 CA2, CA3; HU-4 CA2 (visible para el comentarista).

**Files:**
- Create: `FRONT:src/components/PodioRanking.vue`
- Modify: `FRONT:src/views/PantallaView.vue` (rama `RANKING`), `FRONT:src/views/ComentaristaView.vue` (panel "Ranking publicado")
- Test: `FRONT:src/components/__tests__/PodioRanking.spec.js`, `FRONT:src/views/__tests__/PantallaView.spec.js` (ampliar), `FRONT:src/views/__tests__/ComentaristaView.spec.js` (ampliar)

**Interfaces:**
- Produces: `<PodioRanking :ranking="RankingPublicado" :grande="true" />` — podio con los primeros 3 premiados (2.º · 1.º · 3.º) con foto y puntaje, el resto de premiados en lista y luego la tabla completa (incompletas marcadas).

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/components/__tests__/PodioRanking.spec.js`:

```js
import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PodioRanking from '@/components/PodioRanking.vue'

const fila = (id, puesto, puntaje, extra = {}) => ({
  participante_id: id, mascota_nombre: id, puesto, puntaje_final: puntaje, premiado: puesto !== null && puesto <= 3,
  completa: puesto !== null, participante: { id, mascota_nombre: id, foto_url: `/${id}.jpg` }, ...extra
})
const ranking = {
  categoria: { nombre: 'Pequeños', puestos_premiados: 3 },
  filas: [fila('A', 1, 90), fila('B', 2, 85), fila('C', 3, 80), fila('D', 4, 70), fila('E', null, 95, { n_calificaciones: 2, n_jurados: 3 })]
}

test('podio con los 3 primeros en orden 2-1-3 con foto y puntaje (HU-9 CA2)', () => {
  const w = mount(PodioRanking, { props: { ranking } })
  const podio = w.findAll('[data-test="podio"] [data-puesto]')
  expect(podio.map((p) => p.attributes('data-puesto'))).toEqual(['2', '1', '3'])
  expect(w.get('[data-puesto="1"]').text()).toContain('90')
  expect(w.get('[data-puesto="1"] img').attributes('src')).toBe('/A.jpg')
})

test('luego la tabla completa, con incompletas marcadas', () => {
  const w = mount(PodioRanking, { props: { ranking } })
  const tabla = w.get('[data-test="tabla"]').text()
  for (const n of ['A', 'B', 'C', 'D', 'E']) expect(tabla).toContain(n)
  expect(tabla).toContain('Incompleta')
})
```

Agregar a `FRONT:src/views/__tests__/PantallaView.spec.js`:

```js
test('modo ranking: muestra el podio de la categoría publicada', async () => {
  trk.get.mockResolvedValue({ data: {
    modo_pantalla: 'RANKING', categoria_pantalla: { nombre: 'Pequeños' }, en_pasarela: null,
    ranking: { categoria: { nombre: 'Pequeños', puestos_premiados: 3 }, filas: [{ participante_id: 'a', mascota_nombre: 'Canela', puesto: 1, puntaje_final: 91.5, premiado: true, completa: true, participante: { id: 'a', mascota_nombre: 'Canela' } }] }
  } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.get('[data-test="podio"]').text()).toContain('Canela')
  expect(w.text()).toContain('91.5')
})
```

Agregar a `FRONT:src/views/__tests__/ComentaristaView.spec.js`:

```js
test('el comentarista ve el ranking publicado de la categoría (HU-4 CA2)', async () => {
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATS }
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: null, categoria_pantalla: null, ranking: null } }
    if (url === '/ranking/1') return { data: { categoria: { nombre: 'Pequeños', puestos_premiados: 3 }, filas: [{ participante_id: 'a', mascota_nombre: 'Canela', puesto: 1, puntaje_final: 90, premiado: true, completa: true, participante: { id: 'a', mascota_nombre: 'Canela' } }] } }
    return { data: cola }
  })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="ver-ranking"]').trigger('click')
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/ranking/1')
  expect(w.get('[data-test="podio"]').text()).toContain('Canela')
})

test('si no está publicado lo indica', async () => {
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATS }
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: null, categoria_pantalla: null, ranking: null } }
    if (url === '/ranking/1') throw { status: 404, motivo: 'RANKING_NO_PUBLICADO', message: 'El ranking de esta categoría aún no se ha publicado' }
    return { data: cola }
  })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="ver-ranking"]').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('aún no se ha publicado')
})
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd FRONT && npx vitest run src/components src/views`
Expected: FAIL en las nuevas.

- [ ] **Step 3: Implementar**

`FRONT:src/components/PodioRanking.vue`:

```vue
<script setup>
import { computed } from 'vue'
import FotoMascota from './FotoMascota.vue'

const props = defineProps({ ranking: { type: Object, required: true }, grande: { type: Boolean, default: false } })
const premiados = computed(() => props.ranking.filas.filter((f) => f.premiado).sort((a, b) => a.puesto - b.puesto))
const podio = computed(() => {
  const [primero, segundo, tercero] = premiados.value
  return [segundo, primero, tercero].filter(Boolean)
})
const restoPremiados = computed(() => premiados.value.slice(3))
const ALTURA = { 1: 'md:mt-0', 2: 'md:mt-10', 3: 'md:mt-16' }
const MEDALLA = { 1: '🥇', 2: '🥈', 3: '🥉' }
</script>

<template>
  <div class="flex flex-col gap-6">
    <div data-test="podio" class="grid items-end gap-4 sm:grid-cols-3">
      <article v-for="f in podio" :key="f.participante_id" :data-puesto="f.puesto" :class="['flex flex-col items-center gap-2 text-center', ALTURA[f.puesto]]">
        <span :class="grande ? 'text-6xl' : 'text-4xl'">{{ MEDALLA[f.puesto] || f.puesto }}</span>
        <FotoMascota :participante="f.participante" :clase="`aspect-[4/5] w-full rounded-2xl ${f.puesto === 1 ? 'ring-4 ring-calabaza-400' : ''}`" />
        <h3 :class="['font-extrabold', grande ? 'text-4xl' : 'text-2xl']">{{ f.mascota_nombre }}</h3>
        <p :class="['font-bold text-calabaza-600', grande ? 'text-3xl' : 'text-xl']">{{ f.puntaje_final }}</p>
      </article>
    </div>
    <ol v-if="restoPremiados.length" class="flex flex-col gap-1">
      <li v-for="f in restoPremiados" :key="f.participante_id" class="text-xl">{{ f.puesto }}. {{ f.mascota_nombre }} — {{ f.puntaje_final }}</li>
    </ol>
    <table data-test="tabla" class="w-full text-left" :class="grande ? 'text-2xl' : 'text-base'">
      <thead><tr><th class="p-1">#</th><th class="p-1">Mascota</th><th class="p-1">Puntaje</th></tr></thead>
      <tbody>
        <tr v-for="f in ranking.filas" :key="f.participante_id" class="border-t border-white/10">
          <td class="p-1">{{ f.puesto ?? '—' }}</td>
          <td class="p-1">{{ f.mascota_nombre }}</td>
          <td class="p-1">{{ f.completa ? f.puntaje_final : 'Incompleta' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

En `FRONT:src/views/PantallaView.vue`: importar `PodioRanking` y, después de la `<section v-if="evento.modoPantalla === 'PASARELA'">…</section>`, agregar:

```vue
    <section v-else-if="evento.modoPantalla === 'RANKING' && evento.ranking" class="mx-auto w-full max-w-6xl">
      <h1 class="mb-6 text-center text-5xl font-extrabold">🏆 {{ evento.ranking.categoria.nombre }}</h1>
      <PodioRanking :ranking="evento.ranking" grande />
    </section>
    <section v-else class="flex flex-1 items-center justify-center">
      <img data-test="logo" :src="logo" alt="TRIKIPELUDOS" class="w-full max-w-xl" />
    </section>
```

En `FRONT:src/views/ComentaristaView.vue`:
- importar `PodioRanking` y agregar estado: `const rankingPublicado = ref(null)`, `const mensajeRanking = ref('')`, `const viendoRanking = ref(false)`;
- agregar función:

```js
async function verRanking() {
  viendoRanking.value = !viendoRanking.value
  if (!viendoRanking.value) return
  rankingPublicado.value = null
  mensajeRanking.value = ''
  try {
    rankingPublicado.value = (await trk.get(`/ranking/${categoriaId.value}`)).data
  } catch (e) { mensajeRanking.value = mensajeDeError(e) }
}
```

- en el `<nav>` de categorías, al final: `<button class="btn whitespace-nowrap bg-morado-700 text-white" data-test="ver-ranking" @click="verRanking">🏆 Ranking</button>`
- debajo del `<nav>`:

```vue
    <section v-if="viendoRanking" class="mx-auto max-w-5xl p-4">
      <p v-if="mensajeRanking" class="tarjeta text-2xl">{{ mensajeRanking }}</p>
      <div v-else-if="rankingPublicado" class="tarjeta"><PodioRanking :ranking="rankingPublicado" grande /></div>
    </section>
```

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): podio y tabla del ranking publicado en pantalla publica y para el comentarista

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6.7: Participantes del admin (edición, propuesta de categoría, fusión)

Cubre: HU-3 CA1, CA2 (UI); §10 `/admin/participantes`; §7.2 (advertencias visibles en el registro).

**Files:**
- Create: `FRONT:src/views/admin/ParticipantesView.vue`
- Modify: `FRONT:src/router/index.js` (hijo `participantes`)
- Test: `FRONT:src/views/admin/__tests__/ParticipantesView.spec.js`

**Interfaces:**
- Consumes: `TRK-PAR-001/004/006/007/008`, `TRK-CAT-005`.

- [ ] **Step 1: Escribir la prueba que falla**

`FRONT:src/views/admin/__tests__/ParticipantesView.spec.js`:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))

import { trk } from '@/services/api'
import ParticipantesView from '@/views/admin/ParticipantesView.vue'

const CATS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños' }, { id: 2, codigo: 'GRANDES', nombre: 'Grandes' }]
const thor = { id: 't1', mascota_nombre: 'Thor', responsable_nombre: 'Carlos', responsable_documento: '3040', categoria_id: 2, categoria: CATS[1], categoria_propuesta_id: 1, estado: 'PRESENTADO', advertencias_importacion: [{ codigo: 'POSIBLE_DUPLICADO', mensaje: 'Misma mascota en dos categorías' }], notas_importacion: 'validar categoría' }
const thor2 = { id: 't2', mascota_nombre: 'THOR', responsable_nombre: 'Carlos', categoria_id: 2, categoria: CATS[1], estado: 'INSCRITO', advertencias_importacion: null }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  window.confirm = vi.fn(() => true)
  trk.get.mockImplementation(async (url) => (url === '/categorias' ? { data: CATS } : { data: [thor, thor2] }))
})

test('lista con advertencias y notas de importación visibles', async () => {
  const w = mount(ParticipantesView)
  await flushPromises()
  expect(w.text()).toContain('Misma mascota en dos categorías')
  expect(w.text()).toContain('validar categoría')
})

test('confirmar categoría propuesta: pide confirmación al recibir CONFIRMACION_REQUERIDA y reintenta', async () => {
  trk.post
    .mockRejectedValueOnce({ status: 409, motivo: 'CONFIRMACION_REQUERIDA', message: 'Confirmar borrará 2 calificación(es)' })
    .mockResolvedValueOnce({ data: { ...thor, categoria_id: 1, categoria_propuesta_id: null } })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="confirmar-categoria-t1"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('borrará 2'))
  expect(trk.post).toHaveBeenLastCalledWith('/participantes/t1/categoria/confirmar', { confirmar: true })
})

test('fusionar en otro registro', async () => {
  trk.post.mockResolvedValue({ data: thor2 })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="fusionar-t1"]').trigger('click')
  await w.get('[data-test="destino-fusion"]').setValue('t2')
  await w.get('[data-test="confirmar-fusion"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/participantes/t1/fusionar', { destino_id: 't2' })
})

test('choque de jurado en la fusión se muestra', async () => {
  trk.post.mockRejectedValue({ status: 409, motivo: 'FUSION_CON_CHOQUE', message: 'Un mismo jurado calificó ambos registros', errors: [] })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="fusionar-t1"]').trigger('click')
  await w.get('[data-test="destino-fusion"]').setValue('t2')
  await w.get('[data-test="confirmar-fusion"]').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('Un mismo jurado calificó ambos registros')
})

test('editar datos del responsable', async () => {
  trk.patch.mockResolvedValue({ data: { participante: { ...thor, responsable_documento: '999' }, requiere_confirmacion: false } })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="editar-t1"]').trigger('click')
  await w.get('[data-test="campo-responsable_documento"]').setValue('999')
  await w.get('[data-test="guardar-edicion"]').trigger('submit')
  await flushPromises()
  expect(trk.patch).toHaveBeenCalledWith('/participantes/t1', { responsable_documento: '999' })
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd FRONT && npx vitest run src/views/admin/__tests__/ParticipantesView.spec.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`FRONT:src/views/admin/ParticipantesView.vue`:

```vue
<script setup>
import { ref, reactive, onMounted } from 'vue'
import { trk } from '@/services/api'
import { useCategoriasStore } from '@/stores/categorias'
import { mensajeDeError } from '@/utils/errores'
import EstadoChip from '@/components/EstadoChip.vue'

const categorias = useCategoriasStore()
const filtros = reactive({ categoria: '', estado: '', q: '' })
const lista = ref([])
const error = ref('')
const aviso = ref('')
const editando = ref(null)
const formulario = reactive({})
const fusionando = ref(null)
const destinoFusion = ref('')

const CAMPOS = [
  ['mascota_nombre', 'Mascota'], ['disfraz_nombre', 'Disfraz'], ['raza', 'Raza'], ['edad_texto', 'Edad'],
  ['responsable_nombre', 'Responsable'], ['responsable_documento', 'Documento'], ['responsable_telefono', 'Teléfono'], ['responsable_correo', 'Correo']
]
const ESTADOS = ['INSCRITO', 'PRESENTE', 'EN_PASARELA', 'PRESENTADO', 'AUSENTE']
const nombreCategoria = (id) => (categorias.porId(id) || {}).nombre || '—'

async function cargar() {
  error.value = ''
  try {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''))
    lista.value = (await trk.get('/participantes', { params })).data
  } catch (e) { error.value = mensajeDeError(e) }
}

function reemplazar(p) {
  const i = lista.value.findIndex((x) => x.id === p.id)
  if (i >= 0) lista.value[i] = { ...lista.value[i], ...p }
}

function editar(p) {
  editando.value = p
  for (const [campo] of CAMPOS) formulario[campo] = p[campo] ?? ''
}

async function guardarEdicion() {
  const cambios = Object.fromEntries(CAMPOS.map(([c]) => [c, formulario[c]]).filter(([c, v]) => v !== (editando.value[c] ?? '')))
  if (!Object.keys(cambios).length) { editando.value = null; return }
  try {
    const { data } = await trk.patch(`/participantes/${editando.value.id}`, cambios)
    reemplazar(data.participante)
    editando.value = null
    aviso.value = 'Cambios guardados'
  } catch (e) { error.value = mensajeDeError(e) }
}

async function confirmarCategoria(p, confirmar = false) {
  error.value = ''
  try {
    const { data } = await trk.post(`/participantes/${p.id}/categoria/confirmar`, { confirmar })
    reemplazar(data)
    aviso.value = `Categoría de ${p.mascota_nombre} actualizada`
  } catch (e) {
    if (e.motivo === 'CONFIRMACION_REQUERIDA' && !confirmar && window.confirm(`${e.message}. ¿Continuar?`)) return confirmarCategoria(p, true)
    error.value = mensajeDeError(e)
  }
}

async function fusionar() {
  error.value = ''
  try {
    await trk.post(`/participantes/${fusionando.value.id}/fusionar`, { destino_id: destinoFusion.value })
    aviso.value = `${fusionando.value.mascota_nombre} fusionado`
    fusionando.value = null
    destinoFusion.value = ''
    await cargar()
  } catch (e) { error.value = mensajeDeError(e) }
}

onMounted(async () => {
  try { await categorias.cargar() } catch (e) { error.value = mensajeDeError(e) }
  await cargar()
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-2xl font-bold">Participantes</h2>
    <form class="tarjeta grid gap-2 sm:grid-cols-4" @submit.prevent="cargar">
      <input v-model="filtros.q" class="campo sm:col-span-2" type="search" placeholder="Buscar mascota, responsable o documento" />
      <select v-model="filtros.categoria" class="campo"><option value="">Todas las categorías</option><option v-for="c in categorias.lista" :key="c.id" :value="c.id">{{ c.nombre }}</option></select>
      <select v-model="filtros.estado" class="campo"><option value="">Todos los estados</option><option v-for="e in ESTADOS" :key="e" :value="e">{{ e }}</option></select>
      <button class="btn-secundario sm:col-span-4" type="submit">Filtrar</button>
    </form>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
    <p v-if="aviso" class="rounded-xl bg-green-100 p-3 text-green-900" role="status">{{ aviso }}</p>

    <ul class="flex flex-col gap-2">
      <li v-for="p in lista" :key="p.id" class="tarjeta flex flex-col gap-2">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-lg font-bold">{{ p.mascota_nombre }} <span class="text-sm font-normal text-morado-600">· {{ p.responsable_nombre }} · {{ p.responsable_documento }}</span></p>
            <p class="text-sm">{{ nombreCategoria(p.categoria_id) }}<span v-if="p.categoria_propuesta_id" class="text-calabaza-800"> → propuesta: {{ nombreCategoria(p.categoria_propuesta_id) }}</span></p>
          </div>
          <EstadoChip :estado="p.estado" />
        </div>
        <ul v-if="p.advertencias_importacion && p.advertencias_importacion.length" class="text-sm">
          <li v-for="(a, i) in p.advertencias_importacion" :key="i" class="text-calabaza-900">⚠️ {{ a.mensaje }}</li>
        </ul>
        <p v-if="p.notas_importacion" class="text-sm text-morado-700">📝 {{ p.notas_importacion }}</p>
        <div class="flex flex-wrap gap-2">
          <button class="btn-claro" :data-test="`editar-${p.id}`" @click="editar(p)">Editar</button>
          <button v-if="p.categoria_propuesta_id" class="btn-primario" :data-test="`confirmar-categoria-${p.id}`" @click="confirmarCategoria(p)">Confirmar categoría</button>
          <button class="btn-claro" :data-test="`fusionar-${p.id}`" @click="fusionando = p">Fusionar…</button>
        </div>

        <form v-if="editando && editando.id === p.id" data-test="guardar-edicion" class="grid gap-2 sm:grid-cols-2" @submit.prevent="guardarEdicion">
          <label v-for="[campo, texto] in CAMPOS" :key="campo" class="flex flex-col gap-1 text-sm">{{ texto }}
            <input v-model="formulario[campo]" class="campo" :data-test="`campo-${campo}`" />
          </label>
          <button class="btn-primario sm:col-span-2" type="submit">Guardar</button>
        </form>

        <div v-if="fusionando && fusionando.id === p.id" class="flex flex-col gap-2 rounded-xl bg-morado-50 p-3">
          <p class="text-sm">Fusionar <strong>{{ p.mascota_nombre }}</strong> en (se conserva el destino):</p>
          <select v-model="destinoFusion" class="campo" data-test="destino-fusion">
            <option value="">Elige el registro destino</option>
            <option v-for="o in lista.filter((x) => x.id !== p.id)" :key="o.id" :value="o.id">{{ o.mascota_nombre }} · {{ o.responsable_nombre }}</option>
          </select>
          <button class="btn-primario" data-test="confirmar-fusion" :disabled="!destinoFusion" @click="fusionar">Fusionar</button>
        </div>
      </li>
    </ul>
  </section>
</template>
```

En `FRONT:src/router/index.js`, hijos de `/admin`: `{ path: 'participantes', component: () => import('@/views/admin/ParticipantesView.vue') },`

- [ ] **Step 4: Correr y verificar**

Run: `cd FRONT && npx vitest run && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd FRONT
git add src
git commit -m "feat(front): gestion de participantes del admin con edicion, categoria propuesta y fusion (HU-3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Cierre de Fase 6

- [ ] Run: suite completa + Playwright. Verificar que `apiCodigos.test.js` cubre los 34 códigos. Reportar al usuario y esperar aprobación.

---

## Fase 7 — Endurecimiento: auditoría, respaldo, carga ligera y despliegue

**Hecho cuando:** auditoría y logs verificados de punta a punta, respaldo probado, prueba de carga ligera bajo umbral, documentación de despliegue lista y ensayo general hecho con dispositivos reales (por el usuario).

### Task 7.1: Auditoría y logs de punta a punta

Cubre: RNF-6; regla "código en logs y en `trk_auditoria`".

**Files:**
- Test: `BACK:src/trk/__tests__/auditoria.int.test.js`, `BACK:src/trk/middleware/__tests__/logs.test.js`

**Interfaces:**
- Consumes: todo lo anterior. No crea código de producción salvo que alguna prueba revele un hueco (en ese caso, corregir en el servicio correspondiente y anotarlo en el commit).

- [ ] **Step 1: Escribir las pruebas**

`BACK:src/trk/middleware/__tests__/logs.test.js`:

```js
const express = require('express');
const request = require('supertest');
const logger = require('../../../utils/logger');
const apiCodigo = require('../apiCodigo');

test('cada request deja una línea de log con api_codigo, status y duración', async () => {
  const info = jest.fn();
  const child = jest.spyOn(logger, 'child').mockReturnValue({ info, warn: jest.fn(), error: jest.fn() });
  const app = express();
  app.get('/x', apiCodigo('TRK-EVT-901'), (req, res) => res.status(204).end());
  await request(app).get('/x');
  expect(child).toHaveBeenCalledWith({ modulo: 'trk', api_codigo: 'TRK-EVT-901' });
  expect(info).toHaveBeenCalledWith('trk request', expect.objectContaining({ metodo: 'GET', status: 204, ms: expect.any(Number) }));
  child.mockRestore();
});
```

`BACK:src/trk/__tests__/auditoria.int.test.js`:

```js
const request = require('supertest');
const db = require('../../models');
const { crearAppTrk } = require('../testing/app');
const { limpiar, cerrar } = require('../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria, criteriosDe } = require('../testing/fabricas');

const app = crearAppTrk();
beforeEach(limpiar);
afterAll(cerrar);

test('RNF-6: crear, desbloquear y reenviar calificación, cambiar categoría y fusionar quedan auditados con quién, qué, antes, después y código', async () => {
  const admin = await crearAdmin();
  const jurado = await crearOperativo('TRK_JURADO');
  const cabina = await crearOperativo('TRK_CABINA');
  const comoAdmin = (r) => r.set('Authorization', `Bearer ${admin.token}`);
  const p = await crearParticipante({ estado: 'EN_PASARELA' });
  const ps = (await criteriosDe(p)).map((c) => ({ criterio_id: c.id, puntaje: 1 }));

  const cal = (await request(app).put(`/api/trk/v1/calificaciones/${p.id}`).set('Authorization', `Bearer ${jurado.token}`).send({ puntajes: ps })).body.data;
  await comoAdmin(request(app).post(`/api/trk/v1/calificaciones/${cal.id}/desbloquear`)).expect(200);
  await request(app).put(`/api/trk/v1/calificaciones/${p.id}`).set('Authorization', `Bearer ${jurado.token}`).send({ puntajes: ps.map((x) => ({ ...x, puntaje: 2 })) }).expect(200);

  const grandes = await categoria('GRANDES');
  await request(app).patch(`/api/trk/v1/participantes/${p.id}`).set('Authorization', `Bearer ${cabina.token}`).send({ categoria_id: grandes.id }).expect(200);
  await comoAdmin(request(app).post(`/api/trk/v1/participantes/${p.id}/categoria/confirmar`)).send({ confirmar: true }).expect(200);

  const otro = await crearParticipante({ estado: 'PRESENTE', categoriaCodigo: 'GRANDES' });
  await comoAdmin(request(app).post(`/api/trk/v1/participantes/${otro.id}/fusionar`)).send({ destino_id: p.id }).expect(200);

  const filas = await db.TrkAuditoria.findAll({ order: [['id', 'ASC']] });
  const resumen = filas.map((a) => `${a.api_codigo}:${a.accion}`);
  expect(resumen).toEqual(expect.arrayContaining([
    'TRK-CAL-002:CREAR', 'TRK-CAL-003:DESBLOQUEAR', 'TRK-CAL-002:REENVIAR',
    'TRK-PAR-004:PROPONER_CATEGORIA', 'TRK-PAR-007:CAMBIAR_CATEGORIA', 'TRK-PAR-006:FUSIONAR'
  ]));
  for (const a of filas) {
    expect(a.api_codigo).toMatch(/^TRK-[A-Z]+-\d{3}$/);
    expect(a.usuario_id).toEqual(expect.any(Number));
    expect(a.created_at).toBeInstanceOf(Date);
  }
  const reenvio = filas.find((a) => a.accion === 'REENVIAR');
  expect(reenvio.antes.total).not.toBe(reenvio.despues.total);
});
```

- [ ] **Step 2: Correr**

Run: `cd BACK && npx jest src/trk/middleware/__tests__/logs.test.js && npx jest -c jest.trk-int.config.js --runInBand src/trk/__tests__/auditoria.int.test.js`
Expected: PASS. Si alguna acción no aparece, la prueba falla: agregar la llamada a `registrarAuditoria` que falte en el servicio y volver a correr.

- [ ] **Step 3: Commit**

```bash
cd BACK
git add src/trk
git commit -m "test(trk): auditoria y logs con codigo de API de punta a punta (RNF-6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7.2: Script de respaldo al cierre del evento

Cubre: RNF-7.

**Files:**
- Create: `BACK:src/trk/scripts/respaldo.sh`
- Test: `BACK:src/trk/scripts/__tests__/respaldo.int.test.js`

**Interfaces:**
- Produces: `bash src/trk/scripts/respaldo.sh [destino]` → carpeta `trikipeludos-AAAAMMDD-HHMMSS/` con `trk_tablas.sql` (tablas y vistas `trk_*`), `trk_roles_usuarios.sql` (roles `TRK_*` y usuarios operativos), `fotos.tar.gz` y `SHA256SUMS`; imprime la ruta. Variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `TRK_FOTOS_PATH`; `MYSQL`/`MYSQLDUMP` permiten usar los binarios de un contenedor.

- [ ] **Step 1: Escribir la prueba que falla**

`BACK:src/trk/scripts/__tests__/respaldo.int.test.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const hayDocker = (() => { try { execFileSync('docker', ['ps'], { stdio: 'ignore' }); return true; } catch { return false; } })();
(hayDocker ? test : test.skip)('genera respaldo con tablas trk_*, roles/usuarios TRK, fotos y checksums', () => {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'trk-respaldo-'));
  fs.mkdirSync(process.env.TRK_FOTOS_PATH, { recursive: true });
  fs.writeFileSync(path.join(process.env.TRK_FOTOS_PATH, 'prueba.jpg'), 'x');
  const salida = execFileSync('bash', [path.join(__dirname, '..', 'respaldo.sh'), destino], {
    env: {
      ...process.env,
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      MYSQL: 'docker exec -i -e MYSQL_PWD mysql-trk-test mysql',
      MYSQLDUMP: 'docker exec -i -e MYSQL_PWD mysql-trk-test mysqldump'
    }
  }).toString().trim();
  const carpeta = salida.split('\n').pop();
  const sql = fs.readFileSync(path.join(carpeta, 'trk_tablas.sql'), 'utf8');
  expect(sql).toContain('CREATE TABLE `trk_participantes`');
  expect(sql).toContain('trk_vw_calificacion_totales');
  expect(sql).not.toContain('CREATE TABLE `usuarios`');
  expect(fs.readFileSync(path.join(carpeta, 'trk_roles_usuarios.sql'), 'utf8')).toContain('TRK_JURADO');
  expect(fs.existsSync(path.join(carpeta, 'fotos.tar.gz'))).toBe(true);
  expect(fs.readFileSync(path.join(carpeta, 'SHA256SUMS'), 'utf8')).toContain('trk_tablas.sql');
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/scripts/__tests__/respaldo.int.test.js`
Expected: FAIL (script inexistente).

- [ ] **Step 3: Implementar**

`BACK:src/trk/scripts/respaldo.sh`:

```bash
#!/usr/bin/env bash
# ============================================================================
# TRIKIPELUDOS — respaldo completo al cierre del evento (RNF-7)
# Uso: bash src/trk/scripts/respaldo.sh [destino]
# Lee DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME y TRK_FOTOS_PATH (o .env).
# MYSQL / MYSQLDUMP permiten usar binarios de un contenedor (pruebas).
# ============================================================================
set -euo pipefail

if [ -f .env ]; then set -a; . ./.env; set +a; fi

DESTINO="${1:-$HOME/respaldos/trikipeludos}"
FOTOS="${TRK_FOTOS_PATH:-$(pwd)/uploads/trk/fotos}"
MYSQL_BIN="${MYSQL:-mysql}"
MYSQLDUMP_BIN="${MYSQLDUMP:-mysqldump}"
export MYSQL_PWD="${DB_PASSWORD}"   # evita exponer la clave en la lista de procesos
CONEXION=(-h "${DB_HOST}" -P "${DB_PORT:-3306}" -u "${DB_USER}")

CARPETA="${DESTINO}/trikipeludos-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${CARPETA}"

OBJETOS=$(${MYSQL_BIN} "${CONEXION[@]}" -N -B -e \
  "SELECT table_name FROM information_schema.tables WHERE table_schema = '${DB_NAME}' AND table_name LIKE 'trk\\_%' ORDER BY table_type, table_name")
if [ -z "${OBJETOS}" ]; then echo "No hay tablas trk_* en ${DB_NAME}" >&2; exit 1; fi

# shellcheck disable=SC2086
${MYSQLDUMP_BIN} "${CONEXION[@]}" --single-transaction --routines --triggers "${DB_NAME}" ${OBJETOS} > "${CARPETA}/trk_tablas.sql"

{
  ${MYSQLDUMP_BIN} "${CONEXION[@]}" --single-transaction --no-create-info --where="nombre LIKE 'TRK\\_%'" "${DB_NAME}" roles
  ${MYSQLDUMP_BIN} "${CONEXION[@]}" --single-transaction --no-create-info --where="email LIKE '%@trikipeludos.local'" "${DB_NAME}" usuarios
} > "${CARPETA}/trk_roles_usuarios.sql"

if [ -d "${FOTOS}" ]; then
  tar -czf "${CARPETA}/fotos.tar.gz" -C "$(dirname "${FOTOS}")" "$(basename "${FOTOS}")"
else
  echo "Aviso: no existe la carpeta de fotos ${FOTOS}" >&2
fi

( cd "${CARPETA}" && { command -v sha256sum >/dev/null && sha256sum ./* || shasum -a 256 ./*; } > SHA256SUMS )
echo "${CARPETA}"
```

Run: `chmod +x BACK:src/trk/scripts/respaldo.sh`

- [ ] **Step 4: Correr y verificar**

Run: `cd BACK && npx jest -c jest.trk-int.config.js --runInBand src/trk/scripts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd BACK
git add src/trk/scripts
git commit -m "feat(trk): script de respaldo de tablas trk_*, usuarios operativos y fotos (RNF-7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7.3: Prueba de carga ligera

Cubre: RNF-3 (~150 participantes, ~10 dispositivos), HU-7 CA2 bajo carga.

**Files:**
- Create: `BACK:src/trk/scripts/carga-ligera.js`

**Interfaces:**
- Consumes: servidor E2E (`node src/trk/scripts/e2e-servidor.js`) con sus usuarios de PIN conocido.
- Produces: `node src/trk/scripts/carga-ligera.js [--url http://localhost:3021] [--participantes 150] [--clientes 10] [--llamadas 30]` imprime p50/p95/máx de: alta + foto en cabina, propagación de `pasarela:cambio` a todos los clientes y envío de calificaciones; sale con código 1 si p95 de propagación ≥ 2000 ms o hay errores.

- [ ] **Step 1: Escribir el script**

`BACK:src/trk/scripts/carga-ligera.js`:

```js
/**
 * Prueba de carga ligera (RNF-3) contra el servidor E2E.
 * 1) Cabina da de alta N participantes y sube su foto (→ PRESENTE).
 * 2) Conecta K clientes Socket.IO (3 jurados, comentarista, pantallas).
 * 3) El comentarista hace L llamadas a pasarela; se mide cuánto tarda cada cambio en llegar a TODOS.
 * 4) Los 3 jurados califican a cada mascota llamada.
 */
const sharp = require('sharp');
const { io } = require('socket.io-client');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('url', 'http://localhost:3021');
const N = Number(arg('participantes', 150));
const K = Number(arg('clientes', 10));
const L = Number(arg('llamadas', 30));
const API = `${URL_BASE}/api/trk/v1`;

const percentil = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const resumen = (nombre, xs) => console.log(`${nombre}: n=${xs.length} p50=${percentil(xs, 50)}ms p95=${percentil(xs, 95)}ms max=${Math.max(...xs)}ms`);

async function json(url, opciones = {}) {
  const r = await fetch(url, opciones);
  const cuerpo = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${cuerpo.error} ${cuerpo.message}`);
  return cuerpo.data;
}

async function login(nombre, pin) {
  const usuarios = await json(`${API}/auth/usuarios-pin`);
  const u = usuarios.find((x) => x.nombre === nombre);
  const { token } = await json(`${API}/auth/pin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: u.id, pin }) });
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, token };
}

(async () => {
  const errores = [];
  const cabina = await login('Cabina E2E', '111111');
  const comentarista = await login('Comentarista E2E', '222222');
  const jurados = [await login('Jurado E2E 1', '333331'), await login('Jurado E2E 2', '333332'), await login('Jurado E2E 3', '333333')];
  const categorias = await json(`${API}/categorias`, { headers: cabina });
  const peq = categorias.find((c) => c.codigo === 'PEQ_MED');
  const foto = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#E8711A' } }).jpeg({ quality: 80 }).toBuffer();

  const tiemposAlta = [];
  const ids = [];
  for (let i = 0; i < N; i += 1) {
    const t0 = Date.now();
    try {
      const p = await json(`${API}/participantes`, { method: 'POST', headers: cabina, body: JSON.stringify({
        responsable_nombre: `Carga ${i}`, responsable_telefono: '3000000000', responsable_documento: String(900000 + i),
        mascota_nombre: `Carga ${i}`, especie: 'PERRO', categoria_id: peq.id
      }) });
      const form = new FormData();
      form.append('foto', new Blob([foto], { type: 'image/jpeg' }), 'f.jpg');
      await json(`${API}/participantes/${p.id}/foto`, { method: 'POST', headers: { Authorization: cabina.Authorization }, body: form });
      ids.push(p.id);
    } catch (e) { errores.push(`alta ${i}: ${e.message}`); }
    tiemposAlta.push(Date.now() - t0);
  }
  resumen('Alta + foto (cabina)', tiemposAlta);

  const tokens = [...jurados.map((j) => j.token), comentarista.token, ...Array(Math.max(0, K - 4)).fill(null)];
  const clientes = await Promise.all(tokens.map((token) => new Promise((resolve, reject) => {
    const s = io(`${URL_BASE}/trk`, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  })));

  const propagacion = [];
  const tiemposCalificacion = [];
  for (let i = 0; i < Math.min(L, ids.length); i += 1) {
    const id = ids[i];
    const llegadas = clientes.map((s) => new Promise((resolve) => {
      const h = (m) => { if (m.participante && m.participante.id === id) { s.off('pasarela:cambio', h); resolve(Date.now()); } };
      s.on('pasarela:cambio', h);
    }));
    const t0 = Date.now();
    await json(`${API}/pasarela/${id}`, { method: 'POST', headers: comentarista });
    const tiempos = await Promise.race([Promise.all(llegadas), new Promise((r) => setTimeout(() => r(null), 5000))]);
    if (!tiempos) errores.push(`pasarela ${i}: no llegó a todos en 5 s`);
    else propagacion.push(Math.max(...tiempos) - t0);

    const rubrica = await json(`${API}/rubricas/${peq.id}`, { headers: jurados[0] });
    await Promise.all(jurados.map(async (j) => {
      const t1 = Date.now();
      try {
        await json(`${API}/calificaciones/${id}`, { method: 'PUT', headers: j, body: JSON.stringify({ puntajes: rubrica.criterios.map((c) => ({ criterio_id: c.id, puntaje: Math.floor(c.puntaje_max / 2) })) }) });
      } catch (e) { errores.push(`calificación ${i}: ${e.message}`); }
      tiemposCalificacion.push(Date.now() - t1);
    }));
  }
  resumen(`Propagación pasarela:cambio a ${clientes.length} clientes`, propagacion);
  resumen('Envío de calificación', tiemposCalificacion);
  clientes.forEach((s) => s.close());

  const p95 = percentil(propagacion, 95);
  if (errores.length) console.error(`❌ ${errores.length} errores:\n${errores.slice(0, 10).join('\n')}`);
  if (p95 >= 2000) console.error(`❌ p95 de propagación ${p95} ms ≥ 2000 ms`);
  process.exit(errores.length || p95 >= 2000 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr y verificar**

Run (dos terminales):
```bash
cd BACK && npm run trk:db:test && node src/trk/scripts/e2e-servidor.js
```
```bash
cd BACK && node src/trk/scripts/carga-ligera.js
```
Expected: tres líneas de resumen, sin errores, `p95` de propagación < 2000 ms y código de salida 0. Anotar los números en el reporte de la fase.

- [ ] **Step 3: Commit**

```bash
cd BACK
git add src/trk/scripts/carga-ligera.js
git commit -m "test(trk): prueba de carga ligera (150 participantes, 10 clientes, propagacion de pasarela)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7.4: Despliegue: configuración, Nginx y documentación

Cubre: RNF-10, §11 (despliegue), D15; actualiza `decisiones.md` con lo aprendido al implementar.

**Files:**
- Create: `FRONT:docs/despliegue.md`, `FRONT:deploy/nginx-trikipeludos.conf`, `FRONT:.env.production.example`
- Modify: `FRONT:.gitignore` (`!.env.production.example`), `FRONT:docs/specs/decisiones.md`

- [ ] **Step 1: Configuración del frontend**

`FRONT:.env.production.example`:

```bash
# Copiar a .env.production antes de `npm run build`
VITE_API_URL=https://mantix-api.losolivoscucuta.com:8444/api
VITE_SOCKET_URL=https://mantix-api.losolivoscucuta.com:8444
# Opcional: logo oficial de Los Olivos (si no, usa public/logo-evento.svg)
# VITE_LOGO_URL=https://.../logo-los-olivos.svg
```

En `FRONT:.gitignore` agregar `!.env.production.example` debajo de `!.env.example`.

- [ ] **Step 2: Bloque Nginx** — `FRONT:deploy/nginx-trikipeludos.conf`:

```nginx
# ===== TRIKIPELUDOS — fragmentos para el server de mantix-api (:8444) =====
# Socket.IO (WebSocket) hacia el mismo proceso de mantix-backend
location /socket.io/ {
    proxy_pass http://127.0.0.1:3020;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}

# Fotos oficiales servidas por Nginx (nombres UUID, no adivinables)
location /uploads/trk/fotos/ {
    alias /var/lib/trikipeludos/fotos/;
    expires 7d;
    add_header Cache-Control "public, immutable";
}

# Subida de fotos desde cabina
client_max_body_size 15m;

# ===== Para el server que sirve las SPAs (igual que /cym/, /elecciones/) =====
location /trikipeludos/ {
    alias /var/www/trikipeludos/;
    try_files $uri $uri/ /trikipeludos/index.html;
}
```

- [ ] **Step 3: Documentación** — `FRONT:docs/despliegue.md`:

````markdown
# TRIKIPELUDOS — Despliegue

## 0. Verificaciones previas en `serfuweb` (una vez)

```sql
SHOW CREATE TABLE usuarios;   -- usuarios.id debe ser INT con signo (las FK trk_* lo asumen)
SELECT id, nombre FROM roles WHERE LOWER(nombre) LIKE '%admin%';   -- estos roles recibirán permisos trk
```

Si `usuarios.id` es `INT UNSIGNED`, crear una migración `006_ajuste_fk_usuarios.sql` antes de seguir (no editar 001).

## 1. Variables de entorno de `mantix-backend` (.env)

| Variable | Ejemplo | Para qué |
|---|---|---|
| `TRK_JWT_SECRET` | 64 caracteres aleatorios (`openssl rand -hex 32`) | Firma de tokens de PIN (distinto de `JWT_SECRET`) |
| `TRK_FOTOS_PATH` | `/var/lib/trikipeludos/fotos` | Carpeta de fotos oficiales |
| `TRK_FOTOS_URL_BASE` | `https://mantix-api.losolivoscucuta.com:8444/uploads/trk/fotos` | URL absoluta de fotos (el frontend vive en otro origen) |
| `TRK_PIN_MAX_INTENTOS` | `5` | Intentos de PIN por minuto por IP+usuario |

```bash
sudo mkdir -p /var/lib/trikipeludos/fotos && sudo chown <usuario-pm2> /var/lib/trikipeludos/fotos
```

## 2. Backend

1. Fusionar `feature/trikipeludos` en `main` del repo `ebor94/mantix` (vía PR).
2. En `srv-backend`: `bash ~/apps/mantix/mantix-backend/scripts/deploy-mantix.sh` (instala `socket.io` y reinicia PM2).
3. `cd ~/apps/mantix/mantix-backend && npm run trk:setup` → aplica migraciones `trk_*` y seeds. Es idempotente.
   - El `sequelize.sync()` de Mantix no crea tablas `trk_*` (los modelos TRK lo neutralizan), así que el orden 2→3 es seguro.
4. Verificar: `curl -s https://mantix-api.losolivoscucuta.com:8444/api/trk/v1/evento/estado` → `{"success":true,...}` y encabezado `X-TRK-API: TRK-EVT-001`.
5. Agregar los bloques de `deploy/nginx-trikipeludos.conf`, `sudo nginx -t && sudo systemctl reload nginx`.

## 3. Frontend

```bash
cp .env.production.example .env.production   # ajustar si cambia el dominio
npm ci && npm run build
rsync -av --delete dist/ <servidor>:/var/www/trikipeludos/
```

HTTPS es obligatorio (la cámara del navegador lo exige).

## 4. Preparar el evento

1. Admin entra con su usuario de Mantix en `/trikipeludos/login` → "Administrador".
2. `/admin/usuarios`: crear Cabina, Comentarista y los 3 jurados; anotar los PIN (se muestran una sola vez).
3. `/admin/importar`: subir el CSV exportado de la hoja `TRIKIPELUDOS`, revisar advertencias y confirmar.
4. Abrir `/trikipeludos/pantalla` en el TV/proyector.

## 5. Cierre

```bash
cd ~/apps/mantix/mantix-backend && bash src/trk/scripts/respaldo.sh ~/respaldos/trikipeludos
```

Copiar la carpeta generada fuera del servidor y verificar `SHA256SUMS`.
````

- [ ] **Step 4: Actualizar `decisiones.md`** — en `FRONT:docs/specs/decisiones.md` agregar al final una sección:

```markdown
## 4. Ajustes hechos durante el plan e implementación

- **D3 (Sequelize):** los modelos se llaman `Trk*` (convención `R44*`/`Cym*` del repo) y su `Model.sync()` es un no-op, así el `sequelize.sync()` de Mantix nunca crea tablas `trk_*`; el orden de despliegue deja de ser un riesgo.
- **D3:** no se creó pool `mysql2` propio; las consultas crudas usan `db.sequelize.query` (una sola conexión, menos piezas).
- **D8:** se agregó entorno `test` a `src/config/database.js` y `jest.testPathIgnorePatterns` para separar las pruebas de integración (`*.int.test.js`, `npm run test:trk:int`).
- **§9.1:** se agregó `TRK-CAT-005 GET /categorias` (selectores de importador, cabina y comentarista).
- **Ranking:** el ranking en vivo del admin incluye calificaciones por jurado (para desbloquear); el snapshot publicado las omite.
```

- [ ] **Step 5: Verificar build de producción**

Run: `cd FRONT && cp .env.production.example .env.production && npx vite build && rm .env.production`
Expected: build OK; `dist/index.html` referencia `/trikipeludos/`.

- [ ] **Step 6: Commit**

```bash
cd FRONT
git add docs deploy .env.production.example .gitignore
git commit -m "docs: despliegue, configuracion de Nginx y ajustes de decisiones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7.5: Ensayo general (con el usuario y dispositivos reales)

Cubre: §12 Fase 7 ("Ensayo general con dispositivos reales").

**Files:**
- Create: `FRONT:docs/ensayo-general.md`

- [ ] **Step 1: Escribir la lista de verificación** — `FRONT:docs/ensayo-general.md`:

```markdown
# Ensayo general TRIKIPELUDOS

Dispositivos: 1 portátil (admin), 1 celular con cámara (cabina), 1 tablet (comentarista), 3 celulares (jurados), 1 TV/proyector (pantalla). Red: Wi-Fi del lugar + datos móviles en un jurado.

| # | Paso | Esperado | OK |
|---|---|---|---|
| 1 | Admin importa el CSV real | Advertencias de §7.2 visibles; nada se guarda hasta confirmar | ☐ |
| 2 | Cabina busca sin tildes y toma foto con cámara trasera | Foto recortada 4:5, estado Presente, < 500 KB subidos | ☐ |
| 3 | Cabina inscribe un participante de último minuto | Aparece en la cola del comentarista | ☐ |
| 4 | Comentarista llama a pasarela | Jurados y pantalla cambian en < 2 s | ☐ |
| 5 | Un jurado califica en modo avión y luego se reconecta | "Pendiente de sincronizar" y luego "Calificada" | ☐ |
| 6 | Un jurado intenta corregir; admin desbloquea; jurado reenvía | 409 antes del desbloqueo; auditoría registrada | ☐ |
| 7 | Admin resuelve un empate y publica | Pantalla en modo ranking muestra podio | ☐ |
| 8 | Comentarista ve el ranking publicado | Podio y tabla | ☐ |
| 9 | Exportar Excel | Hoja por categoría + Detalle; sin teléfonos ni documentos | ☐ |
| 10 | Revisar a 360 px en el celular más pequeño | Sin scroll horizontal, botones cómodos | ☐ |
| 11 | Ejecutar `respaldo.sh` | Carpeta con SQL, fotos y SHA256SUMS | ☐ |
| 12 | Revisar logs (`api_codigo`) y `trk_auditoria` | Cada acción con su código TRK | ☐ |
```

- [ ] **Step 2: Correr la suite completa una última vez**

Run: `cd BACK && npx jest && npm run test:trk:int` · `cd FRONT && npx vitest run && npx playwright test`
Expected: todo PASS.

- [ ] **Step 3: Commit**

```bash
cd FRONT
git add docs/ensayo-general.md
git commit -m "docs: lista de verificacion del ensayo general

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4:** Entregar al usuario la lista para el ensayo con dispositivos reales (lo ejecuta el equipo del evento). Preguntar si se abre PR de `feature/trikipeludos` en ambos repos.

### Cierre de Fase 7

- [ ] Reportar al usuario: resumen de todo lo hecho, números de la prueba de carga, resultado del respaldo, pendientes (ensayo general en sitio, PRs, despliegue).
