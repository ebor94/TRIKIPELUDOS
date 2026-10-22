# TRIKIPELUDOS v2.1 — Matriz de calificación del jurado (HU-8b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la calificación mascota-por-mascota del jurado por una matriz por categoría con puntajes tentativos guardados en el servidor (borradores), total y puesto tentativo, autoguardado offline-tolerante y un envío final por categoría que convierte los borradores en calificaciones bloqueadas (spec §15, HU-8b).

**Architecture:** En el backend se agrega la tabla `trk_borradores` (migración 006, modelo `TrkBorrador`) y tres endpoints: `TRK-CAL-004 GET /jurado/matriz`, `TRK-CAL-005 PUT /borradores/:participanteId` (servicio nuevo `matriz.service.js`) y `TRK-CAL-006 POST /calificaciones/finalizar` (en `calificaciones.service.js`, que se refactoriza para que `TRK-CAL-002` y `TRK-CAL-006` compartan el mismo núcleo de validación, bloqueo y auditoría `CREAR`/`REENVIAR`). El ranking y el tablero no se tocan: siguen leyendo solo `trk_calificaciones` (se agrega prueba de regresión). En el frontend el store `calificacion` pasa a ser la cola de **borradores** (misma cola IndexedDB, misma guarda de sesión, última escritura gana por fila, autoguardado con pausa), `JuradoView` muestra la tarjeta "En pasarela" + el componente `MatrizCalificacion`, y se retiran `/jurado/calificar/:id`, `CalificarView` y `ControlPuntaje`.

**Tech Stack:** Node.js + Express 4 (CommonJS), Sequelize 6 + mysql2, MySQL 8, Joi, Jest 29 + Supertest · Vue 3.5 + Pinia 3 + Vue Router 4 + Tailwind 3.4, idb-keyval, Vitest + @vue/test-utils + fake-indexeddb, Playwright.

**Fuentes de verdad:** `peludos/docs/specs/trikipeludos-spec.md` §15 (HU-8b), §8.0, §9.0/§9.1, §3.4 (R3–R7) y `peludos/docs/specs/decisiones.md`. Ante duda gana el spec; si el repo contradice el spec, gana el repo y se anota en `decisiones.md` (Task 7).

## Global Constraints

- Rúbricas, criterios y puntajes máximos son **datos** (`trk_criterios`), **nunca** constantes en el código: encabezados de la matriz, validación 0..máx y total máximo salen de la BD. Ningún archivo `.js`/`.vue` de producción contiene 35/30/20/15/25/10 como máximos de criterio; los fixtures del frontend usan máximos ficticios (9, 8).
- Jurados nunca reciben datos del responsable (`responsable_*`, incluido `responsable_primer_nombre`) en la matriz (HU-8b CA2): filtrado en el backend.
- Convención §8.0: tabla `trk_borradores`, único `uq_trk_borradores_part_jur_crit`, índice `idx_trk_borradores_jurado`, FKs `fk_trk_borradores_participantes` / `fk_trk_borradores_usuarios` / `fk_trk_borradores_criterios`; modelo `TrkBorrador` con `tableName: 'trk_borradores'`, `freezeTableName: true` y `sync()` neutralizado; el esquema lo crea solo la migración `src/trk/migrations/006_borradores.sql`.
- Todo endpoint nuevo: entrada en `src/trk/config/apiCodigos.js`, `apiCodigo('<código>')` como **primer** middleware, prueba de integración que verifica `X-TRK-API`. Códigos: `TRK-CAL-004` (GET `/jurado/matriz`), `TRK-CAL-005` (PUT `/borradores/:participanteId`), `TRK-CAL-006` (POST `/calificaciones/finalizar`). Permiso `calificar`.
- Respuestas `{ success: true, data }` / `{ success: false, error: '<TRK-...>', motivo, message, errors? }`; errores con `TrkError(status, motivo, message, errors?)`. Motivos nuevos: 422 `CALIFICACION_INCOMPLETA`, 409 `SIN_PENDIENTES`.
- Orden de bloqueo del módulo en transacciones: `trk_evento_estado` → `trk_participantes` → `trk_categorias`.
- R7: una calificación final bloqueada solo se corrige con el desbloqueo del admin (`TRK-CAL-003`). R3–R6: el ranking oficial y el tablero cuentan **solo** `trk_calificaciones`; los borradores son privados del jurado y no se auditan.
- Mobile-first: `/jurado` funciona a **360 px** sin scroll horizontal de la página (la tabla se desplaza dentro de su contenedor); áreas táctiles ≥ 44 px (`h-11`); contraste AA. Textos en español.
- Commits: uno por tarea, en la rama `feature/trk-matriz` de cada repo (creada desde `main`); mensaje en español estilo `feat(trk): …` terminado con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Sin push** salvo que el usuario lo pida.

---

## Repositorios y rutas

| Alias | Ruta local | Rama |
|---|---|---|
| **BACK** | `/Users/Shared/Files From c.localized/apps/mantix/mantix-git` | `feature/trk-matriz` (desde `main`) |
| **FRONT** | `/Users/Shared/Files From c.localized/apps/mantix/peludos` | `feature/trk-matriz` (desde `main`) |

Las rutas llevan prefijo `BACK:` o `FRONT:` y son relativas a la raíz del repo. Las rutas tienen espacios: en la terminal, siempre entre comillas. Antes de la primera tarea de cada repo:

```bash
cd "/Users/Shared/Files From c.localized/apps/mantix/mantix-git" && git switch -c feature/trk-matriz
cd "/Users/Shared/Files From c.localized/apps/mantix/peludos" && git switch -c feature/trk-matriz
```

## Convenciones para las tareas

- **Backend unit:** `cd BACK && npx jest <ruta>` (sin BD).
- **Backend integración:** MySQL de prueba arriba: `cd BACK && npm run trk:db:test` (una vez por sesión), luego `npx jest -c jest.trk-int.config.js --runInBand <ruta>` (el `globalSetup` recrea `serfuweb_test` y aplica **todas** las migraciones, incluida la 006).
- **Frontend:** `cd FRONT && npx vitest run <ruta>`. **E2E:** `cd FRONT && npx playwright test <archivo>` (levanta backend de prueba en 3021 y Vite en 5174).
- Patrón de ruta: `router.<metodo>('<path>', apiCodigo('TRK-X-NNN'), trkAuth, trkPermiso('<accion>'), [validar(esquema, fuente)], aw(ctrl.fn))`.

## Mapa de archivos

### BACK

| Archivo | Cambio | Tarea |
|---|---|---|
| `src/trk/migrations/006_borradores.sql` | Crear tabla `trk_borradores` | 1 |
| `src/trk/models/TrkBorrador.js` | Modelo nuevo | 1 |
| `src/trk/models/index.js` | Registrar `TrkBorrador` | 1 |
| `src/trk/testing/db.js` | `trk_borradores` en `TABLAS_DATOS` | 1 |
| `src/trk/testing/fabricas.js` | Fábrica `borrador(participante, juradoUsuario, puntajesPorCodigo)` | 1 |
| `src/trk/migrations/__tests__/esquema.int.test.js`, `src/trk/models/__tests__/modelos.test.js` | Cubrir la tabla/modelo nuevos | 1 |
| `src/trk/utils/borrador.js` (+ test) | `borradorVigente(criterios, propios, delFinal)` puro | 2 |
| `src/trk/services/matriz.service.js` | `obtenerMatriz`, `guardarBorrador` | 2 |
| `src/trk/controllers/matriz.controller.js` | `matriz`, `guardarBorrador` | 2 |
| `src/trk/routes/jurado.routes.js`, `src/trk/routes/borradores.routes.js` | `TRK-CAL-004`, `TRK-CAL-005` | 2 |
| `src/trk/routes/index.js`, `src/trk/config/apiCodigos.js` | Montaje y registro | 2, 3 |
| `src/trk/services/calificaciones.service.js` | `criteriosDeRubrica`, export `CALIFICABLES` (T2); núcleo `registrarFinalEnTx` + `finalizarCategoria` (T3) | 2, 3 |
| `src/trk/controllers/calificaciones.controller.js`, `src/trk/routes/calificaciones.routes.js` | `TRK-CAL-006` | 3 |
| `src/trk/routes/__tests__/matriz.int.test.js`, `src/trk/routes/__tests__/finalizar.int.test.js` | Pruebas de integración | 2, 3 |

### FRONT

| Archivo | Cambio | Tarea |
|---|---|---|
| `src/utils/matriz.js` (+ spec) | Total, completitud, puesto tentativo con "=", entrada numérica, conversiones lista/mapa | 4 |
| `src/stores/calificacion.js` (+ spec) | Cola de borradores: `anotar` (autoguardado), `guardarBorrador`, `estados` por fila, `finalizar` | 4 |
| `src/components/MatrizCalificacion.vue` (+ spec) | Tabla: columna fija, casillas 0..máx, Total, Puesto, ✓, indicador por fila | 5 |
| `src/views/JuradoView.vue` (+ spec) | Tarjeta "En pasarela" + selector de categoría + matriz + botón final con confirmación | 5 |
| `src/router/index.js` (+ `src/router/__tests__/rutas.spec.js`) | Quitar `/jurado/calificar/:id` | 6 |
| `src/views/CalificarView.vue`, `src/views/__tests__/CalificarView.spec.js`, `src/components/ControlPuntaje.vue`, `src/components/__tests__/ControlPuntaje.spec.js` | Eliminar | 6 |
| `e2e/jurado.spec.js` | Flujo de la matriz y offline | 6 |
| `docs/specs/trikipeludos-spec.md`, `docs/specs/decisiones.md`, `docs/despliegue.md`, `docs/ensayo-general.md` | Documentación v2.1 | 7 |

---

### Task 1: Tabla `trk_borradores` (migración 006) y modelo `TrkBorrador`

Cubre: spec §15 "Modelo", §8.0.

**Files:**
- Create: `BACK:src/trk/migrations/006_borradores.sql`, `BACK:src/trk/models/TrkBorrador.js`
- Modify: `BACK:src/trk/models/index.js`, `BACK:src/trk/testing/db.js`, `BACK:src/trk/testing/fabricas.js`
- Test: `BACK:src/trk/migrations/__tests__/esquema.int.test.js`, `BACK:src/trk/models/__tests__/modelos.test.js`

**Interfaces:**
- Consumes: tablas `trk_participantes(id CHAR(36))`, `usuarios(id INT)`, `trk_criterios(id INT)`; fábricas `criteriosDe(participante)`.
- Produces:
  - Modelo `db.TrkBorrador` con atributos `{ id, participante_id (UUID), jurado_id (INT), criterio_id (INT), puntaje (TINYINT UNSIGNED | null), updated_at }`, asociaciones `participante`, `jurado` (Usuario), `criterio`.
  - Fábrica `borrador(participante, juradoUsuario, puntajesPorCodigo) → Promise<void>`: inserta/actualiza borradores directo en BD; `puntajesPorCodigo` es `{ CODIGO_CRITERIO: entero|null }` (solo los códigos presentes).
  - `limpiar()` borra `trk_borradores`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `BACK:src/trk/migrations/__tests__/esquema.int.test.js`, agregar `'trk_borradores'` a la constante `TABLAS` (después de `'trk_calificacion_detalle'`) y al final del archivo:

```js
test('v2.1: único de borradores por participante, jurado y criterio', async () => {
  const filas = await q("SELECT index_name AS i, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'trk_borradores' AND non_unique = 0 GROUP BY index_name");
  expect(filas).toEqual(expect.arrayContaining([{ i: 'uq_trk_borradores_part_jur_crit', cols: 'participante_id,jurado_id,criterio_id' }]));
});

test('v2.1: trk_borradores.puntaje admite NULL (casilla vacía) y tiene sus tres FKs', async () => {
  const [col] = await q("SELECT is_nullable AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'trk_borradores' AND column_name = 'puntaje'");
  expect(col.n).toBe('YES');
  const fks = await q("SELECT constraint_name AS c FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'trk_borradores' AND constraint_type = 'FOREIGN KEY' ORDER BY constraint_name");
  expect(fks.map((f) => f.c)).toEqual(['fk_trk_borradores_criterios', 'fk_trk_borradores_participantes', 'fk_trk_borradores_usuarios']);
});
```

En `BACK:src/trk/models/__tests__/modelos.test.js`, reemplazar la lista esperada del primer test por:

```js
  expect(Object.keys(modelos).sort()).toEqual([
    'TrkAcceso', 'TrkAuditoria', 'TrkBorrador', 'TrkCalificacion', 'TrkCalificacionDetalle', 'TrkCategoria', 'TrkCriterio',
    'TrkEventoEstado', 'TrkImportacion', 'TrkParticipante', 'TrkRankingSnapshot', 'TrkRubrica'
  ]);
```

y agregar al final:

```js
test('v2.1: borrador pertenece a participante, jurado (usuarios) y criterio; puntaje admite null', () => {
  const b = modelos.TrkBorrador;
  expect(b.options.tableName).toBe('trk_borradores');
  expect(b.rawAttributes.puntaje.allowNull).toBe(true);
  expect(b.rawAttributes.created_at).toBeUndefined();
  expect(b.associations.participante.foreignKey).toBe('participante_id');
  expect(b.associations.jurado.target.options.tableName).toBe('usuarios');
  expect(b.associations.criterio.foreignKey).toBe('criterio_id');
});
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `cd "/Users/Shared/Files From c.localized/apps/mantix/mantix-git" && npx jest src/trk/models/__tests__/modelos.test.js`
Expected: FAIL — la lista de modelos no contiene `TrkBorrador` (`Cannot read properties of undefined (reading 'options')` en el test nuevo).

Run: `npm run trk:db:test && npx jest -c jest.trk-int.config.js --runInBand src/trk/migrations/__tests__/esquema.int.test.js`
Expected: FAIL — `existen todas las tablas trk_*` no encuentra `trk_borradores`.

- [ ] **Step 3: Migración** — `BACK:src/trk/migrations/006_borradores.sql`:

```sql
-- ================================================================
-- TRIKIPELUDOS — 006 Borradores del jurado (v2.1, HU-8b)
-- Puntajes tentativos privados de cada jurado. NO cuentan en el ranking ni en el tablero
-- (solo trk_calificaciones). Se conservan tras el envío final (trazabilidad). No se auditan.
-- ================================================================

CREATE TABLE trk_borradores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  participante_id CHAR(36) NOT NULL,
  jurado_id INT NOT NULL,
  criterio_id INT NOT NULL,
  puntaje TINYINT UNSIGNED NULL COMMENT 'NULL = casilla vacía; 0 <= puntaje <= trk_criterios.puntaje_max (servicio)',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_trk_borradores_part_jur_crit UNIQUE (participante_id, jurado_id, criterio_id),
  INDEX idx_trk_borradores_jurado (jurado_id),
  CONSTRAINT fk_trk_borradores_participantes FOREIGN KEY (participante_id) REFERENCES trk_participantes (id) ON DELETE CASCADE,
  CONSTRAINT fk_trk_borradores_usuarios FOREIGN KEY (jurado_id) REFERENCES usuarios (id),
  CONSTRAINT fk_trk_borradores_criterios FOREIGN KEY (criterio_id) REFERENCES trk_criterios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

(MySQL crea para `criterio_id` un índice con el nombre de la FK, `fk_trk_borradores_criterios`, que cumple §8.0.)

- [ ] **Step 4: Modelo** — `BACK:src/trk/models/TrkBorrador.js`:

```js
// trk_borradores — puntajes tentativos privados de cada jurado (HU-8b). No cuentan en el ranking (CA9).
module.exports = (sequelize, DataTypes) => {
  const TrkBorrador = sequelize.define('TrkBorrador', {
    id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    participante_id: { type: DataTypes.UUID, allowNull: false },
    jurado_id:       { type: DataTypes.INTEGER, allowNull: false },
    criterio_id:     { type: DataTypes.INTEGER, allowNull: false },
    puntaje:         { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    updated_at:      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'trk_borradores',
    freezeTableName: true,
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
  });

  TrkBorrador.associate = (models) => {
    TrkBorrador.belongsTo(models.TrkParticipante, { foreignKey: 'participante_id', as: 'participante' });
    TrkBorrador.belongsTo(models.Usuario, { foreignKey: 'jurado_id', as: 'jurado' });
    TrkBorrador.belongsTo(models.TrkCriterio, { foreignKey: 'criterio_id', as: 'criterio' });
  };
  return TrkBorrador;
};
```

En `BACK:src/trk/models/index.js`, dentro de `const modelos = { … }`, agregar después de la línea de `TrkCalificacionDetalle`:

```js
  TrkBorrador:            require('./TrkBorrador')(sequelize, DataTypes),
```

- [ ] **Step 5: Limpieza y fábrica de pruebas**

En `BACK:src/trk/testing/db.js`, primera entrada de `TABLAS_DATOS`:

```js
const TABLAS_DATOS = [
  'trk_borradores',
  'trk_calificacion_detalle',
```

En `BACK:src/trk/testing/fabricas.js`, antes de `module.exports`:

```js
// Inserta/actualiza borradores directo en BD (pruebas de matriz y envío final). { CODIGO: entero|null }.
async function borrador(participante, juradoUsuario, puntajesPorCodigo) {
  const criterios = await criteriosDe(participante);
  const filas = criterios
    .filter((c) => Object.prototype.hasOwnProperty.call(puntajesPorCodigo, c.codigo))
    .map((c) => ({ participante_id: participante.id, jurado_id: juradoUsuario.id, criterio_id: c.id, puntaje: puntajesPorCodigo[c.codigo] }));
  await db.TrkBorrador.bulkCreate(filas, { updateOnDuplicate: ['puntaje', 'updated_at'] });
}
```

y exportarla:

```js
module.exports = { sufijo, crearAdmin, crearOperativo, categoria, crearParticipante, criteriosDe, calificar, borrador };
```

- [ ] **Step 6: Correr las pruebas y verificar que pasan**

Run: `npx jest src/trk/models/__tests__/modelos.test.js`
Expected: PASS (7 tests).

Run: `npx jest -c jest.trk-int.config.js --runInBand src/trk/migrations/__tests__/esquema.int.test.js src/trk/scripts/__tests__/migrador.int.test.js`
Expected: PASS (incluye los dos tests v2.1 y la convención de nombres de índices/FKs).

- [ ] **Step 7: Commit**

```bash
cd "/Users/Shared/Files From c.localized/apps/mantix/mantix-git"
git add src/trk/migrations/006_borradores.sql src/trk/models/TrkBorrador.js src/trk/models/index.js src/trk/testing/db.js src/trk/testing/fabricas.js src/trk/migrations/__tests__/esquema.int.test.js src/trk/models/__tests__/modelos.test.js
git commit -m "feat(trk): tabla trk_borradores y modelo TrkBorrador para la matriz del jurado (v2.1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Matriz del jurado (`TRK-CAL-004`) y borradores (`TRK-CAL-005`) + regresión CA9

Cubre: HU-8b CA1 (categoría por defecto), CA2 (filas y privacidad), CA3 (criterios de la rúbrica sembrada), CA5 (guardado parcial, última escritura gana), CA7 (estado final/desbloqueada en la matriz), CA9 (borradores privados; ranking y tablero sin borradores); errores de `TRK-CAL-005` (§15).

**Files:**
- Create: `BACK:src/trk/utils/borrador.js`, `BACK:src/trk/services/matriz.service.js`, `BACK:src/trk/controllers/matriz.controller.js`, `BACK:src/trk/routes/jurado.routes.js`, `BACK:src/trk/routes/borradores.routes.js`
- Modify: `BACK:src/trk/services/calificaciones.service.js` (helper `criteriosDeRubrica` + export `CALIFICABLES`), `BACK:src/trk/routes/index.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/utils/__tests__/borrador.test.js`, `BACK:src/trk/routes/__tests__/matriz.int.test.js`

**Interfaces:**
- Consumes: `db.TrkBorrador`, fábrica `borrador(...)` (Task 1); `buscarModelo(id, { transaction, lock })`, `INCLUIR_CATEGORIA` (participantes.service); `serializarParticipante(p, 'PUBLICO')`; `conDetalles` (calificaciones.service); `TrkError`; `ok(res, data)`; `ctxDe(req) → { usuarioId, … }`.
- Produces:
  - `borradorVigente(criterios: [{id}], propios: Map<criterioId, puntaje|null>, delFinal: Map<criterioId, puntaje>) → { [criterioId]: puntaje|null }` — manda el borrador; si no hay fila de borrador para el criterio, se usa la calificación final; si no, `null`.
  - `criteriosDeRubrica(rubricaId, transaction?) → TrkCriterio[]` (ordenados por `orden`) y `CALIFICABLES = ['EN_PASARELA', 'PRESENTADO']`, exportados por `calificaciones.service`.
  - `obtenerMatriz(categoriaId?: number|string, ctx) → Matriz` con
    `Matriz = { categoria: { id, codigo, nombre, abierta } | null, categorias: [{ id, codigo, nombre, abierta }], criterios: [{ id, codigo, nombre, descripcion, puntaje_max, orden }], puntaje_total_max: number, filas: Fila[] }`,
    `Fila = { participante: <PUBLICO sin responsable_primer_nombre>, borrador: { [criterioId]: number|null }, final: { estado: 'FINAL'|'DESBLOQUEADA'|null, total: number|null, puntajes: { [criterioId]: number }|null } }`.
    Sin `categoriaId` usa la categoría de quien está `EN_PASARELA` (o `categoria: null` y `filas: []` si no hay nadie). Filas: `EN_PASARELA` primero, luego `PRESENTADO` por `orden_pasarela`, `llegada_at`, `mascota_nombre`; sin fusionados.
  - `guardarBorrador(participanteId, puntajes: [{ criterio_id, puntaje: number|null }], ctx) → { participante_id, borrador: { [criterioId]: number|null } }`. Errores: 409 `ESTADO_INVALIDO`, 409 `CATEGORIA_CERRADA`, 409 `CALIFICACION_BLOQUEADA`, 400 `VALIDACION` (criterio repetido/ajeno), 422 `PUNTAJE_FUERA_DE_RANGO`.
  - HTTP: `GET /api/trk/v1/jurado/matriz?categoria=<id>` → `{ success, data: Matriz }`; `PUT /api/trk/v1/borradores/:participanteId` body `{ puntajes: [{ criterio_id, puntaje|null }] }` → `{ success, data: { participante_id, borrador } }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`BACK:src/trk/utils/__tests__/borrador.test.js`:

```js
const { borradorVigente } = require('../borrador');

const criterios = [{ id: 1 }, { id: 2 }, { id: 3 }];

test('manda el borrador (incluido un null explícito); sin borrador usa la final; sin nada → null', () => {
  const propios = new Map([[1, 4], [2, null]]);
  const delFinal = new Map([[1, 9], [2, 8], [3, 7]]);
  expect(borradorVigente(criterios, propios, delFinal)).toEqual({ 1: 4, 2: null, 3: 7 });
});

test('sin borrador ni final: todas las casillas vacías', () => {
  expect(borradorVigente(criterios)).toEqual({ 1: null, 2: null, 3: null });
});
```

`BACK:src/trk/routes/__tests__/matriz.int.test.js`:

```js
const request = require('supertest');
const { servir, cerrarServidores } = require('../../../testing/servidorPrueba');
const db = require('../../../models');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria, criteriosDe, calificar, borrador } = require('../../testing/fabricas');

const app = crearAppTrk();
let servidor;
beforeAll(async () => { servidor = await servir(app); });
afterAll(cerrarServidores);
afterAll(cerrar);

let jurado; let otro;
beforeEach(async () => {
  await limpiar();
  jurado = await crearOperativo('TRK_JURADO', { nombre: 'J1' });
  otro = await crearOperativo('TRK_JURADO', { nombre: 'J2' });
});

const conToken = (r, quien) => r.set('Authorization', `Bearer ${quien.token}`);
const matriz = (quien = jurado, query = '') => conToken(request(servidor).get(`/api/trk/v1/jurado/matriz${query}`), quien);
const guardar = (p, puntajes, quien = jurado) => conToken(request(servidor).put(`/api/trk/v1/borradores/${p.id}`).send({ puntajes }), quien);
async function enPasarela(p) {
  await p.update({ estado: 'EN_PASARELA' });
  await db.TrkEventoEstado.update({ participante_en_pasarela_id: p.id }, { where: { id: 1 } });
}
const puntos = (c, s, e, pa) => ({ CREATIVIDAD: c, SEGURIDAD: s, ELABORACION: e, PASARELA: pa });
const DATOS_RESPONSABLE = ['responsable_nombre', 'responsable_documento', 'responsable_telefono', 'responsable_correo', 'responsable_primer_nombre'];

test('TRK-CAL-004 por defecto muestra la categoría de quien está en pasarela: EN_PASARELA primero y luego PRESENTADO (CA1, CA2)', async () => {
  const kira = await crearParticipante({ mascota_nombre: 'Kira', estado: 'PRESENTADO', orden_pasarela: 1 });
  const toby = await crearParticipante({ mascota_nombre: 'Toby', orden_pasarela: 2 });
  await enPasarela(toby);
  await crearParticipante({ mascota_nombre: 'Rocky', estado: 'PRESENTE' });
  await crearParticipante({ mascota_nombre: 'Canela', estado: 'INSCRITO' });
  await crearParticipante({ mascota_nombre: 'Nube', estado: 'AUSENTE' });
  await crearParticipante({ mascota_nombre: 'Copia', estado: 'PRESENTADO', fusionado_en_id: kira.id });
  await crearParticipante({ mascota_nombre: 'Misu', estado: 'PRESENTADO', categoriaCodigo: 'FELINOS', especie: 'GATO' });

  const r = await matriz();
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-CAL-004');
  const cat = await categoria('PEQ_MED');
  expect(r.body.data.categoria).toEqual({ id: cat.id, codigo: 'PEQ_MED', nombre: cat.nombre, abierta: true });
  expect(r.body.data.categorias.map((c) => c.codigo)).toEqual(['PEQ_MED', 'GRANDES', 'FELINOS', 'FAMILIAR']);
  expect(r.body.data.filas.map((f) => f.participante.mascota_nombre)).toEqual(['Toby', 'Kira']);
  for (const f of r.body.data.filas) for (const campo of DATOS_RESPONSABLE) expect(f.participante).not.toHaveProperty(campo);
});

test('criterios y máximos salen de la rúbrica sembrada; fila nueva con borrador vacío y sin final (CA3)', async () => {
  const toby = await crearParticipante({ mascota_nombre: 'Toby' });
  await enPasarela(toby);
  const criterios = await criteriosDe(toby);
  const { data } = (await matriz()).body;
  expect(data.criterios.map((c) => [c.id, c.codigo, c.puntaje_max])).toEqual(criterios.map((c) => [c.id, c.codigo, c.puntaje_max]));
  expect(data.puntaje_total_max).toBe(criterios.reduce((s, c) => s + c.puntaje_max, 0));
  expect(data.filas[0].borrador).toEqual(Object.fromEntries(criterios.map((c) => [String(c.id), null])));
  expect(data.filas[0].final).toEqual({ estado: null, total: null, puntajes: null });
});

test('?categoria= muestra otra categoría; inexistente → 404; sin nadie en pasarela ni parámetro → categoria null', async () => {
  await crearParticipante({ mascota_nombre: 'Misu', estado: 'PRESENTADO', categoriaCodigo: 'FELINOS', especie: 'GATO' });
  const felinos = await categoria('FELINOS');
  const vacia = (await matriz()).body.data;
  expect(vacia).toMatchObject({ categoria: null, criterios: [], filas: [], puntaje_total_max: 0 });
  expect(vacia.categorias).toHaveLength(4);
  const r = await matriz(jurado, `?categoria=${felinos.id}`);
  expect(r.body.data.filas.map((f) => f.participante.mascota_nombre)).toEqual(['Misu']);
  const no = await matriz(jurado, '?categoria=9999');
  expect([no.status, no.body.motivo, no.body.error]).toEqual([404, 'NO_ENCONTRADO', 'TRK-CAL-004']);
});

test('TRK-CAL-005 guarda parcial, la última escritura gana, null vacía la casilla y es privado del jurado (CA5, CA9)', async () => {
  const toby = await crearParticipante({ mascota_nombre: 'Toby' });
  await enPasarela(toby);
  const [c1, c2] = await criteriosDe(toby);

  let r = await guardar(toby, [{ criterio_id: c1.id, puntaje: 10 }]);
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-CAL-005');
  expect(r.body.data.participante_id).toBe(toby.id);
  expect(r.body.data.borrador[c1.id]).toBe(10);
  expect(r.body.data.borrador[c2.id]).toBeNull();

  r = await guardar(toby, [{ criterio_id: c1.id, puntaje: 12 }, { criterio_id: c2.id, puntaje: 3 }]);
  expect(r.body.data.borrador).toMatchObject({ [c1.id]: 12, [c2.id]: 3 });
  r = await guardar(toby, [{ criterio_id: c2.id, puntaje: null }]);
  expect(r.body.data.borrador).toMatchObject({ [c1.id]: 12, [c2.id]: null });
  expect(await db.TrkBorrador.count()).toBe(2);

  expect((await matriz()).body.data.filas[0].borrador[c1.id]).toBe(12);
  expect((await matriz(otro)).body.data.filas[0].borrador[c1.id]).toBeNull();
  expect(await db.TrkCalificacion.count()).toBe(0);
  expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-CAL-005' } })).toBe(0);
});

test('TRK-CAL-005: puntaje fuera de 0..máx o decimal → 422; criterio ajeno o repetido → 400; nada se guarda', async () => {
  const toby = await crearParticipante({ mascota_nombre: 'Toby' });
  await enPasarela(toby);
  const [c1] = await criteriosDe(toby);
  const familiar = await crearParticipante({ estado: 'PRESENTADO', categoriaCodigo: 'FAMILIAR' });
  const ajeno = (await criteriosDe(familiar)).find((c) => c.codigo === 'INTEGRACION');

  const alto = await guardar(toby, [{ criterio_id: c1.id, puntaje: c1.puntaje_max + 1 }]);
  expect([alto.status, alto.body.motivo, alto.body.error]).toEqual([422, 'PUNTAJE_FUERA_DE_RANGO', 'TRK-CAL-005']);
  expect((await guardar(toby, [{ criterio_id: c1.id, puntaje: 1.5 }])).status).toBe(422);
  expect((await guardar(toby, [{ criterio_id: c1.id, puntaje: -1 }])).status).toBe(422);
  const ajenoR = await guardar(toby, [{ criterio_id: ajeno.id, puntaje: 1 }]);
  expect([ajenoR.status, ajenoR.body.motivo]).toEqual([400, 'VALIDACION']);
  expect((await guardar(toby, [{ criterio_id: c1.id, puntaje: 1 }, { criterio_id: c1.id, puntaje: 2 }])).status).toBe(400);
  expect((await guardar(toby, [])).status).toBe(400);
  expect(await db.TrkBorrador.count()).toBe(0);
});

test('TRK-CAL-005: no ha desfilado → 409 ESTADO_INVALIDO; final bloqueada → 409 CALIFICACION_BLOQUEADA; categoría cerrada → 409 CATEGORIA_CERRADA', async () => {
  const rocky = await crearParticipante({ estado: 'PRESENTE' });
  const [c] = await criteriosDe(rocky);
  const r1 = await guardar(rocky, [{ criterio_id: c.id, puntaje: 1 }]);
  expect([r1.status, r1.body.motivo]).toEqual([409, 'ESTADO_INVALIDO']);

  const kira = await crearParticipante({ estado: 'PRESENTADO' });
  await calificar(kira, jurado.usuario, puntos(30, 25, 15, 10));
  const r2 = await guardar(kira, [{ criterio_id: c.id, puntaje: 1 }]);
  expect([r2.status, r2.body.motivo]).toEqual([409, 'CALIFICACION_BLOQUEADA']);
  expect((await guardar(kira, [{ criterio_id: c.id, puntaje: 1 }], otro)).status).toBe(200);

  const luna = await crearParticipante({ estado: 'PRESENTADO' });
  await db.TrkCategoria.update({ abierta: false }, { where: { id: luna.categoria_id } });
  const r3 = await guardar(luna, [{ criterio_id: c.id, puntaje: 1 }]);
  expect([r3.status, r3.body.motivo]).toEqual([409, 'CATEGORIA_CERRADA']);
});

test('la matriz muestra FINAL / DESBLOQUEADA; desbloqueada sin borrador parte de la calificación final y vuelve a ser editable (CA7)', async () => {
  const kira = await crearParticipante({ mascota_nombre: 'Kira', estado: 'PRESENTADO' });
  const cat = await categoria('PEQ_MED');
  const valores = puntos(30, 25, 15, 10);
  const cal = await calificar(kira, jurado.usuario, valores);
  const criterios = await criteriosDe(kira);
  const esperado = Object.fromEntries(criterios.map((c) => [String(c.id), valores[c.codigo]]));

  let fila = (await matriz(jurado, `?categoria=${cat.id}`)).body.data.filas[0];
  expect(fila.final).toEqual({ estado: 'FINAL', total: 80, puntajes: esperado });

  await cal.update({ bloqueada: false });
  fila = (await matriz(jurado, `?categoria=${cat.id}`)).body.data.filas[0];
  expect(fila.final.estado).toBe('DESBLOQUEADA');
  expect(fila.borrador).toEqual(esperado);
  expect((await guardar(kira, [{ criterio_id: criterios[0].id, puntaje: 1 }])).status).toBe(200);
  fila = (await matriz(jurado, `?categoria=${cat.id}`)).body.data.filas[0];
  expect(fila.borrador[criterios[0].id]).toBe(1);
  expect(fila.borrador[criterios[1].id]).toBe(valores[criterios[1].codigo]);
});

test('sin permiso calificar → 403 en ambos endpoints', async () => {
  const cabina = await crearOperativo('TRK_CABINA');
  const toby = await crearParticipante({ estado: 'PRESENTADO' });
  const [c] = await criteriosDe(toby);
  expect((await matriz(cabina)).status).toBe(403);
  expect((await guardar(toby, [{ criterio_id: c.id, puntaje: 1 }], cabina)).status).toBe(403);
});

test('CA9 (regresión): los borradores no cuentan en el ranking en vivo ni en el tablero de progreso', async () => {
  const admin = await crearAdmin();
  const toby = await crearParticipante({ mascota_nombre: 'Toby', estado: 'PRESENTADO' });
  await borrador(toby, jurado.usuario, puntos(33, 28, 18, 13));
  const cat = await categoria('PEQ_MED');

  const rk = await conToken(request(servidor).get(`/api/trk/v1/ranking/${cat.id}`), admin);
  expect(rk.status).toBe(200);
  const fila = rk.body.data.filas.find((f) => f.participante_id === toby.id);
  expect(fila).toMatchObject({ completa: false, puesto: null });
  expect(fila.calificaciones).toEqual([]);

  const tb = await conToken(request(servidor).get('/api/trk/v1/evento/tablero'), admin);
  expect(tb.body.data.jurados.find((j) => j.id === jurado.usuario.id)).toMatchObject({ calificadas: 0, pendientes: 1 });
});
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `cd "/Users/Shared/Files From c.localized/apps/mantix/mantix-git" && npx jest src/trk/utils/__tests__/borrador.test.js`
Expected: FAIL — `Cannot find module '../borrador'`.

Run: `npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/matriz.int.test.js`
Expected: FAIL — `GET /jurado/matriz` y `PUT /borradores/:id` responden 404 `NO_ENCONTRADO` (ruta no existe). El test CA9 ya pasa (los borradores se insertan con la fábrica): es la regresión que debe seguir pasando.

- [ ] **Step 3: Utilidad pura** — `BACK:src/trk/utils/borrador.js`:

```js
// Puntaje vigente por criterio de una fila de la matriz (HU-8b): manda el borrador del jurado (incluido un
// null explícito = casilla vaciada); si no hay borrador para ese criterio se parte de la calificación final
// existente (p. ej. desbloqueada por el admin). La usan la matriz (TRK-CAL-004) y el envío final (TRK-CAL-006).
function borradorVigente(criterios, propios = new Map(), delFinal = new Map()) {
  return Object.fromEntries(criterios.map((c) => {
    if (propios.has(c.id)) return [c.id, propios.get(c.id)];
    return [c.id, delFinal.has(c.id) ? delFinal.get(c.id) : null];
  }));
}

module.exports = { borradorVigente };
```

- [ ] **Step 4: Helper compartido en `calificaciones.service.js`**

En `BACK:src/trk/services/calificaciones.service.js`, debajo de `const mismos = …`, agregar:

```js
const criteriosDeRubrica = (rubricaId, transaction) =>
  db.TrkCriterio.findAll({ where: { rubrica_id: rubricaId }, order: [['orden', 'ASC']], transaction });
```

y reemplazar el `module.exports` por:

```js
module.exports = { CALIFICABLES, criteriosDeRubrica, validarPuntajes, enviarCalificacion, vistaCalificacion, conDetalles, rubricaDeCategoria, misCalificaciones, desbloquear };
```

- [ ] **Step 5: Servicio** — `BACK:src/trk/services/matriz.service.js`:

```js
// ============================================
// Matriz del jurado (HU-8b, v2.1): vista por categoría y borradores privados por jurado.
// Los borradores NO son calificaciones: ranking, tablero y exportación solo leen trk_calificaciones (CA9).
// ============================================
const db = require('../../models');
const TrkError = require('../utils/TrkError');
const { serializarParticipante } = require('../utils/serializar');
const { borradorVigente } = require('../utils/borrador');
const { buscarModelo, INCLUIR_CATEGORIA } = require('./participantes.service');
const { CALIFICABLES, criteriosDeRubrica, conDetalles } = require('./calificaciones.service');

const vistaCategoria = (c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, abierta: Boolean(c.abierta) });
const vistaCriterio = (c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, descripcion: c.descripcion, puntaje_max: c.puntaje_max, orden: c.orden });
const ORDEN_FILAS = [
  [db.sequelize.literal('`TrkParticipante`.`orden_pasarela` IS NULL'), 'ASC'],
  ['orden_pasarela', 'ASC'],
  ['llegada_at', 'ASC'],
  ['mascota_nombre', 'ASC']
];

// CA2: el jurado no recibe ningún dato del responsable, ni siquiera el primer nombre.
function participanteParaJurado(p) {
  const { responsable_primer_nombre: _omitido, ...publico } = serializarParticipante(p, 'PUBLICO');
  return publico;
}

async function categoriaPorDefecto(categorias) {
  const estado = await db.TrkEventoEstado.findByPk(1, { include: [{ model: db.TrkParticipante, as: 'enPasarela' }] });
  const enPasarela = estado && estado.enPasarela;
  return enPasarela ? categorias.find((c) => c.id === enPasarela.categoria_id) || null : null;
}

async function obtenerMatriz(categoriaId, ctx) {
  const categorias = await db.TrkCategoria.findAll({ order: [['orden', 'ASC']] });
  let categoria;
  if (categoriaId) {
    categoria = categorias.find((c) => c.id === Number(categoriaId));
    if (!categoria) throw new TrkError(404, 'NO_ENCONTRADO', 'Categoría no encontrada');
  } else {
    categoria = await categoriaPorDefecto(categorias);
  }
  const base = { categorias: categorias.map(vistaCategoria) };
  if (!categoria) return { ...base, categoria: null, criterios: [], puntaje_total_max: 0, filas: [] };

  const criterios = await criteriosDeRubrica(categoria.rubrica_id);
  const participantes = (await db.TrkParticipante.findAll({
    where: { categoria_id: categoria.id, fusionado_en_id: null, estado: CALIFICABLES },
    include: INCLUIR_CATEGORIA,
    order: ORDEN_FILAS
  })).sort((a, b) => Number(b.estado === 'EN_PASARELA') - Number(a.estado === 'EN_PASARELA'));
  const ids = participantes.map((p) => p.id);
  const [borradores, finales] = ids.length
    ? await Promise.all([
      db.TrkBorrador.findAll({ where: { jurado_id: ctx.usuarioId, participante_id: ids } }),
      db.TrkCalificacion.findAll({ where: { jurado_id: ctx.usuarioId, participante_id: ids }, ...conDetalles })
    ])
    : [[], []];

  const filas = participantes.map((p) => {
    const cal = finales.find((c) => c.participante_id === p.id) || null;
    const delFinal = new Map(cal ? cal.detalles.map((d) => [d.criterio_id, d.puntaje]) : []);
    const propios = new Map(borradores.filter((b) => b.participante_id === p.id).map((b) => [b.criterio_id, b.puntaje]));
    return {
      participante: participanteParaJurado(p),
      borrador: borradorVigente(criterios, propios, delFinal),
      final: {
        estado: cal ? (cal.bloqueada ? 'FINAL' : 'DESBLOQUEADA') : null,
        total: cal ? cal.total : null,
        puntajes: cal ? Object.fromEntries(criterios.map((c) => [c.id, delFinal.has(c.id) ? delFinal.get(c.id) : null])) : null
      }
    };
  });

  return {
    ...base,
    categoria: vistaCategoria(categoria),
    criterios: criterios.map(vistaCriterio),
    puntaje_total_max: criterios.reduce((s, c) => s + c.puntaje_max, 0),
    filas
  };
}

// Parcial: solo se validan los criterios enviados. null = casilla vacía.
function validarBorrador(criterios, puntajes) {
  const ids = puntajes.map((x) => Number(x.criterio_id));
  if (new Set(ids).size !== ids.length) throw new TrkError(400, 'VALIDACION', 'Hay criterios repetidos');
  const porId = new Map(criterios.map((c) => [c.id, c]));
  if (ids.some((id) => !porId.has(id))) throw new TrkError(400, 'VALIDACION', 'Hay criterios que no pertenecen a la rúbrica de la categoría');
  for (const x of puntajes) {
    if (x.puntaje === null) continue;
    const c = porId.get(Number(x.criterio_id));
    if (!Number.isInteger(x.puntaje) || x.puntaje < 0 || x.puntaje > c.puntaje_max) {
      throw new TrkError(422, 'PUNTAJE_FUERA_DE_RANGO', `${c.nombre} debe ser un entero entre 0 y ${c.puntaje_max}`);
    }
  }
}

async function guardarBorrador(participanteId, puntajes, ctx) {
  return db.sequelize.transaction(async (transaction) => {
    // Bloquear la fila del participante serializa con el envío final (TRK-CAL-006), que también la bloquea.
    const p = await buscarModelo(participanteId, { transaction, lock: true });
    if (!CALIFICABLES.includes(p.estado)) throw new TrkError(409, 'ESTADO_INVALIDO', 'La mascota aún no ha salido a pasarela');
    const categoria = await db.TrkCategoria.findByPk(p.categoria_id, { transaction });
    if (!categoria.abierta) throw new TrkError(409, 'CATEGORIA_CERRADA', 'La categoría está cerrada; ya no se puede calificar');
    const final = await db.TrkCalificacion.findOne({ where: { participante_id: p.id, jurado_id: ctx.usuarioId }, transaction });
    if (final && final.bloqueada) throw new TrkError(409, 'CALIFICACION_BLOQUEADA', 'La calificación ya fue enviada y está bloqueada');

    const criterios = await criteriosDeRubrica(categoria.rubrica_id, transaction);
    validarBorrador(criterios, puntajes);
    await db.TrkBorrador.bulkCreate(
      puntajes.map((x) => ({ participante_id: p.id, jurado_id: ctx.usuarioId, criterio_id: Number(x.criterio_id), puntaje: x.puntaje })),
      { updateOnDuplicate: ['puntaje', 'updated_at'], transaction }
    );
    const propios = await db.TrkBorrador.findAll({ where: { participante_id: p.id, jurado_id: ctx.usuarioId }, transaction });
    const delFinal = final ? new Map((await db.TrkCalificacionDetalle.findAll({ where: { calificacion_id: final.id }, transaction })).map((d) => [d.criterio_id, d.puntaje])) : new Map();
    return {
      participante_id: p.id,
      borrador: borradorVigente(criterios, new Map(propios.map((b) => [b.criterio_id, b.puntaje])), delFinal)
    };
  });
}

module.exports = { obtenerMatriz, guardarBorrador, validarBorrador };
```

- [ ] **Step 6: Controlador, rutas y registro de códigos**

`BACK:src/trk/controllers/matriz.controller.js`:

```js
const svc = require('../services/matriz.service');
const { ok } = require('../utils/respuesta');
const { ctxDe } = require('../utils/ctx');

exports.matriz = async (req, res) => ok(res, await svc.obtenerMatriz(req.query.categoria, ctxDe(req)));
exports.guardarBorrador = async (req, res) => ok(res, await svc.guardarBorrador(req.params.participanteId, req.body.puntajes, ctxDe(req)));
```

`BACK:src/trk/routes/jurado.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth, trkPermiso } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const ctrl = require('../controllers/matriz.controller');

const esquemaMatriz = Joi.object({ categoria: Joi.number().integer().positive() });

const router = express.Router();
router.get('/matriz', apiCodigo('TRK-CAL-004'), trkAuth, trkPermiso('calificar'), validar(esquemaMatriz, 'query'), aw(ctrl.matriz));

module.exports = { prefijo: '/jurado', router };
```

`BACK:src/trk/routes/borradores.routes.js`:

```js
const express = require('express');
const Joi = require('joi');
const apiCodigo = require('../middleware/apiCodigo');
const validar = require('../middleware/validar');
const { trkAuth, trkPermiso } = require('../middleware/trkAuth');
const aw = require('../utils/aw');
const ctrl = require('../controllers/matriz.controller');

const esquemaParticipante = Joi.object({ participanteId: Joi.string().guid({ version: 'uuidv4' }).required() });
// Parcial: cualquier subconjunto de criterios; null vacía la casilla. El rango 0..máx lo valida el servicio → 422.
const esquemaBorrador = Joi.object({
  puntajes: Joi.array().items(Joi.object({
    criterio_id: Joi.number().integer().positive().required(),
    puntaje: Joi.number().allow(null).required()
  })).min(1).required()
});

const router = express.Router();
router.put('/:participanteId', apiCodigo('TRK-CAL-005'), trkAuth, trkPermiso('calificar'), validar(esquemaParticipante, 'params'), validar(esquemaBorrador), aw(ctrl.guardarBorrador));

module.exports = { prefijo: '/borradores', router };
```

En `BACK:src/trk/routes/index.js`, dentro de `const modulos = [ … ]`, después de `require('./calificaciones.routes'),`:

```js
  require('./jurado.routes'),
  require('./borradores.routes'),
```

En `BACK:src/trk/config/apiCodigos.js`, después de la entrada `'TRK-CAL-003'`:

```js
  'TRK-CAL-004': { metodo: 'GET', ruta: '/jurado/matriz', descripcion: 'Matriz del jurado: criterios y filas con borrador y estado final (v2.1)' },
  'TRK-CAL-005': { metodo: 'PUT', ruta: '/borradores/:participanteId', descripcion: 'Guarda puntajes tentativos parciales del jurado (v2.1)' },
```

- [ ] **Step 7: Correr las pruebas y verificar que pasan**

Run: `npx jest src/trk/utils/__tests__/borrador.test.js src/trk/config/__tests__/apiCodigos.test.js`
Expected: PASS (el registro coincide con las rutas: 4 tests de `apiCodigos`).

Run: `npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/matriz.int.test.js src/trk/routes/__tests__/calificaciones.int.test.js src/trk/routes/__tests__/ranking.int.test.js`
Expected: PASS (9 tests en `matriz.int.test.js`; calificaciones y ranking sin cambios).

- [ ] **Step 8: Commit**

```bash
git add src/trk/utils/borrador.js src/trk/utils/__tests__/borrador.test.js src/trk/services/matriz.service.js src/trk/services/calificaciones.service.js src/trk/controllers/matriz.controller.js src/trk/routes/jurado.routes.js src/trk/routes/borradores.routes.js src/trk/routes/index.js src/trk/config/apiCodigos.js src/trk/routes/__tests__/matriz.int.test.js
git commit -m "feat(trk): matriz del jurado (TRK-CAL-004) y borradores privados (TRK-CAL-005)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Envío final por categoría (`TRK-CAL-006`) con núcleo compartido con `TRK-CAL-002`

Cubre: HU-8b CA6 (todo o nada, bloqueo R7, auditoría `CREAR`, `calificacion:recibida` al admin), CA7 (desbloqueada → reenvío con auditoría `REENVIAR`), CA8 (mascota que desfila después vuelve a habilitar el envío); errores de `TRK-CAL-006` (§15).

**Files:**
- Modify: `BACK:src/trk/services/calificaciones.service.js` (archivo completo abajo), `BACK:src/trk/controllers/calificaciones.controller.js`, `BACK:src/trk/routes/calificaciones.routes.js`, `BACK:src/trk/config/apiCodigos.js`
- Test: `BACK:src/trk/routes/__tests__/finalizar.int.test.js` (nuevo); regresión: `calificaciones.int.test.js`, `desbloqueo.int.test.js`, `validarPuntajes.test.js`

**Interfaces:**
- Consumes: `db.TrkBorrador`, fábrica `borrador` (Task 1); `borradorVigente`, `criteriosDeRubrica`, `CALIFICABLES` (Task 2); `registrarAuditoria(ctx, {...}, { transaction })`; `emitir(evento, payload, { rooms })`.
- Produces:
  - `registrarFinalEnTx(p, categoria, criterios, puntajes, ctx, transaction) → { calificacion: TrkCalificacion (con detalles), repetida: boolean }` — núcleo único de `TRK-CAL-002` y `TRK-CAL-006`: valida estado (409 `ESTADO_INVALIDO`), categoría abierta (409 `CATEGORIA_CERRADA`), puntajes (`validarPuntajes`), crea (`CREAR`) o reenvía una desbloqueada (`REENVIAR`); idéntico sobre bloqueada → `repetida`; distinto sobre bloqueada → 409 `CALIFICACION_BLOQUEADA`. El llamador ya bloqueó la fila del participante.
  - `finalizarCategoria(categoriaId, ctx) → { categoria_id: number, calificaciones: Calificacion[] }` (`Calificacion` = `vistaCalificacion`). Errores: 404 `NO_ENCONTRADO`, 409 `CATEGORIA_CERRADA`, 409 `SIN_PENDIENTES`, 422 `CALIFICACION_INCOMPLETA` con `errors: [{ campo: participanteId, mensaje: '<Mascota>: falta <Criterio>, …' }]`.
  - HTTP: `POST /api/trk/v1/calificaciones/finalizar` body `{ categoria_id }` → `{ success, data: { categoria_id, calificaciones } }`.

- [ ] **Step 1: Escribir la prueba que falla** — `BACK:src/trk/routes/__tests__/finalizar.int.test.js`:

```js
const request = require('supertest');
const { servir, cerrarServidores } = require('../../../testing/servidorPrueba');
const db = require('../../../models');
const { bus } = require('../../sockets/bus');
const { crearAppTrk } = require('../../testing/app');
const { limpiar, cerrar } = require('../../testing/db');
const { crearAdmin, crearOperativo, crearParticipante, categoria, criteriosDe, calificar, borrador } = require('../../testing/fabricas');

const app = crearAppTrk();
let servidor;
beforeAll(async () => { servidor = await servir(app); });
afterAll(cerrarServidores);
afterAll(cerrar);

let jurado; let otro; let cat; let eventos;
const escuchar = (e) => eventos.push(e);
beforeEach(async () => {
  await limpiar();
  jurado = await crearOperativo('TRK_JURADO', { nombre: 'J1' });
  otro = await crearOperativo('TRK_JURADO', { nombre: 'J2' });
  cat = await categoria('PEQ_MED');
  eventos = [];
  bus.on('trk', escuchar);
});
afterEach(() => bus.off('trk', escuchar));

const conToken = (r, quien) => r.set('Authorization', `Bearer ${quien.token}`);
const finalizar = (categoriaId = cat.id, quien = jurado) => conToken(request(servidor).post('/api/trk/v1/calificaciones/finalizar').send({ categoria_id: categoriaId }), quien);
const matriz = (quien = jurado) => conToken(request(servidor).get(`/api/trk/v1/jurado/matriz?categoria=${cat.id}`), quien);
const puntos = (c, s, e, pa) => ({ CREATIVIDAD: c, SEGURIDAD: s, ELABORACION: e, PASARELA: pa });
const porParticipante = (r) => Object.fromEntries(r.body.data.calificaciones.map((c) => [c.participante_id, c]));

test('TRK-CAL-006 convierte los borradores completos en calificaciones bloqueadas, audita CREAR y avisa al admin por fila (CA6)', async () => {
  const toby = await crearParticipante({ mascota_nombre: 'Toby', estado: 'PRESENTADO' });
  const kira = await crearParticipante({ mascota_nombre: 'Kira', estado: 'EN_PASARELA' });
  await borrador(toby, jurado.usuario, puntos(30, 25, 15, 10));
  await borrador(kira, jurado.usuario, puntos(20, 20, 10, 5));

  const r = await finalizar();
  expect(r.status).toBe(200);
  expect(r.headers['x-trk-api']).toBe('TRK-CAL-006');
  expect(r.body.data.categoria_id).toBe(cat.id);
  const cals = porParticipante(r);
  expect(cals[toby.id]).toMatchObject({ jurado_id: jurado.usuario.id, total: 80, bloqueada: true });
  expect(cals[kira.id]).toMatchObject({ total: 55, bloqueada: true });
  expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-CAL-006', accion: 'CREAR', entidad: 'calificacion' } })).toBe(2);
  expect(eventos.filter((e) => e.evento === 'calificacion:recibida').map((e) => e.rooms)).toEqual([['admin'], ['admin']]);
  expect(await db.TrkBorrador.count()).toBe(8); // se conservan para trazabilidad
  expect((await matriz()).body.data.filas.map((f) => f.final.estado)).toEqual(['FINAL', 'FINAL']);
  expect(await db.TrkCalificacion.count({ where: { jurado_id: otro.usuario.id } })).toBe(0);
});

test('todo o nada: una fila incompleta → 422 CALIFICACION_INCOMPLETA con los nombres y no se crea ninguna', async () => {
  const toby = await crearParticipante({ mascota_nombre: 'Toby', estado: 'PRESENTADO' });
  const kira = await crearParticipante({ mascota_nombre: 'Kira', estado: 'EN_PASARELA' });
  await borrador(toby, jurado.usuario, puntos(30, 25, 15, 10));
  await borrador(kira, jurado.usuario, { CREATIVIDAD: 10, SEGURIDAD: null });

  const r = await finalizar();
  expect([r.status, r.body.motivo, r.body.error]).toEqual([422, 'CALIFICACION_INCOMPLETA', 'TRK-CAL-006']);
  expect(r.body.message).toContain('Kira');
  expect(r.body.message).not.toContain('Toby');
  expect(r.body.errors).toEqual([{ campo: kira.id, mensaje: expect.stringMatching(/^Kira: falta Seguridad, Elaboración, Pasarela$/) }]);
  expect(await db.TrkCalificacion.count()).toBe(0);
  expect(await db.TrkAuditoria.count({ where: { entidad: 'calificacion' } })).toBe(0);
  expect(eventos.filter((e) => e.evento === 'calificacion:recibida')).toEqual([]);
});

test('solo envía las pendientes; sin pendientes → 409 SIN_PENDIENTES; una mascota que desfila después vuelve a habilitarlo (CA8)', async () => {
  const toby = await crearParticipante({ mascota_nombre: 'Toby', estado: 'PRESENTADO' });
  await borrador(toby, jurado.usuario, puntos(30, 25, 15, 10));
  expect((await finalizar()).status).toBe(200);

  const otraVez = await finalizar();
  expect([otraVez.status, otraVez.body.motivo]).toEqual([409, 'SIN_PENDIENTES']);

  const luna = await crearParticipante({ mascota_nombre: 'Luna', estado: 'EN_PASARELA' });
  await borrador(luna, jurado.usuario, puntos(10, 10, 10, 10));
  const r = await finalizar();
  expect(r.status).toBe(200);
  expect(r.body.data.calificaciones.map((c) => c.participante_id)).toEqual([luna.id]);
  expect(await db.TrkAuditoria.count({ where: { api_codigo: 'TRK-CAL-006', accion: 'CREAR' } })).toBe(2);
});

test('desbloqueada por el admin: se corrige el borrador y se reenvía con el botón final (auditoría REENVIAR) (CA7)', async () => {
  const admin = await crearAdmin();
  const toby = await crearParticipante({ mascota_nombre: 'Toby', estado: 'PRESENTADO' });
  await borrador(toby, jurado.usuario, puntos(30, 25, 15, 10));
  await finalizar();
  const cal = await db.TrkCalificacion.findOne({ where: { participante_id: toby.id } });

  const desb = await conToken(request(servidor).post(`/api/trk/v1/calificaciones/${cal.id}/desbloquear`), admin);
  expect(desb.status).toBe(200);
  const [creatividad] = await criteriosDe(toby);
  const corr = await conToken(request(servidor).put(`/api/trk/v1/borradores/${toby.id}`).send({ puntajes: [{ criterio_id: creatividad.id, puntaje: 1 }] }), jurado);
  expect(corr.status).toBe(200);

  const r = await finalizar();
  expect(r.status).toBe(200);
  expect(porParticipante(r)[toby.id]).toMatchObject({ id: cal.id, total: 51, bloqueada: true });
  const acciones = (await db.TrkAuditoria.findAll({ where: { entidad: 'calificacion', entidad_id: String(cal.id) }, order: [['id', 'ASC']] }))
    .map((a) => [a.accion, a.api_codigo]);
  expect(acciones).toEqual([['CREAR', 'TRK-CAL-006'], ['DESBLOQUEAR', 'TRK-CAL-003'], ['REENVIAR', 'TRK-CAL-006']]);
});

test('desbloqueada sin borradores (enviada con TRK-CAL-002) se reenvía con sus puntajes finales', async () => {
  const kira = await crearParticipante({ mascota_nombre: 'Kira', estado: 'PRESENTADO' });
  const cal = await calificar(kira, jurado.usuario, puntos(30, 25, 15, 10));
  await cal.update({ bloqueada: false });
  const r = await finalizar();
  expect(r.status).toBe(200);
  expect(porParticipante(r)[kira.id]).toMatchObject({ id: cal.id, total: 80, bloqueada: true });
  expect(await db.TrkAuditoria.count({ where: { accion: 'REENVIAR', api_codigo: 'TRK-CAL-006' } })).toBe(1);
});

test('categoría cerrada → 409 CATEGORIA_CERRADA; inexistente → 404; sin categoria_id → 400; sin sesión → 401', async () => {
  const toby = await crearParticipante({ mascota_nombre: 'Toby', estado: 'PRESENTADO' });
  await borrador(toby, jurado.usuario, puntos(30, 25, 15, 10));
  await db.TrkCategoria.update({ abierta: false }, { where: { id: cat.id } });
  const cerrada = await finalizar();
  expect([cerrada.status, cerrada.body.motivo]).toEqual([409, 'CATEGORIA_CERRADA']);
  expect(await db.TrkCalificacion.count()).toBe(0);
  expect((await finalizar(9999)).status).toBe(404);
  expect((await conToken(request(servidor).post('/api/trk/v1/calificaciones/finalizar').send({}), jurado)).status).toBe(400);
  expect((await request(servidor).post('/api/trk/v1/calificaciones/finalizar').send({ categoria_id: cat.id })).status).toBe(401);
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `cd "/Users/Shared/Files From c.localized/apps/mantix/mantix-git" && npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/finalizar.int.test.js`
Expected: FAIL — `POST /calificaciones/finalizar` responde 404 `NO_ENCONTRADO`.

- [ ] **Step 3: Refactor + implementación** — reemplazar `BACK:src/trk/services/calificaciones.service.js` completo por:

```js
// ============================================
// Calificaciones (HU-8, HU-8b): R1 rango por criterio, R2 total = suma, R7 bloqueo, idempotencia.
// Los máximos se leen de trk_criterios; nunca de constantes.
// TRK-CAL-002 (una mascota) y TRK-CAL-006 (envío final por categoría) comparten registrarFinalEnTx:
// misma validación, mismo bloqueo y misma auditoría CREAR / REENVIAR.
// ============================================
const db = require('../../models');
const TrkError = require('../utils/TrkError');
const { registrarAuditoria } = require('./auditoria.service');
const { buscarModelo } = require('./participantes.service');
const { emitir } = require('../sockets/bus');
const { borradorVigente } = require('../utils/borrador');

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

const criteriosDeRubrica = (rubricaId, transaction) =>
  db.TrkCriterio.findAll({ where: { rubrica_id: rubricaId }, order: [['orden', 'ASC']], transaction });

// Núcleo compartido. El llamador ya bloqueó la fila del participante dentro de `transaction`.
async function registrarFinalEnTx(p, categoria, criterios, puntajes, ctx, transaction) {
  if (!CALIFICABLES.includes(p.estado)) throw new TrkError(409, 'ESTADO_INVALIDO', 'La mascota aún no ha salido a pasarela');
  if (!categoria.abierta) throw new TrkError(409, 'CATEGORIA_CERRADA', 'La categoría está cerrada; ya no se puede calificar');
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
}

const avisarRecibida = (cal) => emitir(
  'calificacion:recibida',
  { participante_id: cal.participante_id, jurado_id: cal.jurado_id, total: cal.total },
  { rooms: ['admin'] }
);

async function enviarCalificacion(participanteId, puntajes, ctx, intento = 0) {
  try {
    const { calificacion, repetida } = await db.sequelize.transaction(async (transaction) => {
      // El bloqueo de la fila del participante serializa envíos simultáneos (reintentos offline).
      const p = await buscarModelo(participanteId, { transaction, lock: true });
      const categoria = await db.TrkCategoria.findByPk(p.categoria_id, { transaction });
      const criterios = await criteriosDeRubrica(categoria.rubrica_id, transaction);
      return registrarFinalEnTx(p, categoria, criterios, puntajes, ctx, transaction);
    });
    if (!repetida) avisarRecibida(calificacion);
    return vistaCalificacion(calificacion);
  } catch (e) {
    if (e && e.name === 'SequelizeUniqueConstraintError' && intento === 0) return enviarCalificacion(participanteId, puntajes, ctx, 1);
    throw e;
  }
}

// HU-8b CA6: envío final de una categoría, todo o nada. Pendiente = fila de la matriz (EN_PASARELA/PRESENTADO,
// sin fusionar) sin calificación final bloqueada de este jurado. Puntajes = borradorVigente (misma regla que la matriz).
async function finalizarCategoria(categoriaId, ctx) {
  const resultados = await db.sequelize.transaction(async (transaction) => {
    // Orden de bloqueo del módulo: evento → participantes → categoría (como pasarela, desempates y fusión).
    await db.TrkEventoEstado.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    const participantes = await db.TrkParticipante.findAll({
      where: { categoria_id: Number(categoriaId), fusionado_en_id: null, estado: CALIFICABLES },
      order: [['mascota_nombre', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    const categoria = await db.TrkCategoria.findByPk(categoriaId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!categoria) throw new TrkError(404, 'NO_ENCONTRADO', 'Categoría no encontrada');
    if (!categoria.abierta) throw new TrkError(409, 'CATEGORIA_CERRADA', 'La categoría está cerrada; ya no se puede calificar');

    const ids = participantes.map((p) => p.id);
    const existentes = ids.length
      ? await db.TrkCalificacion.findAll({ where: { participante_id: ids, jurado_id: ctx.usuarioId }, ...conDetalles, transaction })
      : [];
    const bloqueadas = new Set(existentes.filter((c) => c.bloqueada).map((c) => c.participante_id));
    const pendientes = participantes.filter((p) => !bloqueadas.has(p.id));
    if (!pendientes.length) throw new TrkError(409, 'SIN_PENDIENTES', 'No hay calificaciones pendientes por enviar en esta categoría');

    const criterios = await criteriosDeRubrica(categoria.rubrica_id, transaction);
    const borradores = await db.TrkBorrador.findAll({
      where: { jurado_id: ctx.usuarioId, participante_id: pendientes.map((p) => p.id) }, transaction
    });
    const filas = pendientes.map((p) => {
      const cal = existentes.find((c) => c.participante_id === p.id);
      const valores = borradorVigente(
        criterios,
        new Map(borradores.filter((b) => b.participante_id === p.id).map((b) => [b.criterio_id, b.puntaje])),
        new Map(cal ? cal.detalles.map((d) => [d.criterio_id, d.puntaje]) : [])
      );
      return { p, valores, faltan: criterios.filter((c) => valores[c.id] === null) };
    });
    const incompletas = filas.filter((f) => f.faltan.length);
    if (incompletas.length) {
      throw new TrkError(
        422,
        'CALIFICACION_INCOMPLETA',
        `Faltan puntajes de: ${incompletas.map((f) => f.p.mascota_nombre).join(', ')}`,
        incompletas.map((f) => ({ campo: f.p.id, mensaje: `${f.p.mascota_nombre}: falta ${f.faltan.map((c) => c.nombre).join(', ')}` }))
      );
    }

    const salida = [];
    for (const f of filas) {
      const puntajes = criterios.map((c) => ({ criterio_id: c.id, puntaje: f.valores[c.id] }));
      salida.push(await registrarFinalEnTx(f.p, categoria, criterios, puntajes, ctx, transaction));
    }
    return salida;
  });
  for (const r of resultados) if (!r.repetida) avisarRecibida(r.calificacion);
  return { categoria_id: Number(categoriaId), calificaciones: resultados.map((r) => vistaCalificacion(r.calificacion)) };
}

async function rubricaDeCategoria(categoriaId) {
  const categoria = await db.TrkCategoria.findByPk(categoriaId, { include: [{ model: db.TrkRubrica, as: 'rubrica' }] });
  if (!categoria) throw new TrkError(404, 'NO_ENCONTRADO', 'Categoría no encontrada');
  const criterios = await criteriosDeRubrica(categoria.rubrica_id);
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

module.exports = {
  CALIFICABLES, criteriosDeRubrica, validarPuntajes, registrarFinalEnTx, enviarCalificacion, finalizarCategoria,
  vistaCalificacion, conDetalles, rubricaDeCategoria, misCalificaciones, desbloquear
};
```

- [ ] **Step 4: Controlador, ruta y código**

En `BACK:src/trk/controllers/calificaciones.controller.js` agregar:

```js
exports.finalizar = async (req, res) => ok(res, await svc.finalizarCategoria(req.body.categoria_id, ctxDe(req)));
```

En `BACK:src/trk/routes/calificaciones.routes.js`, después de `const esquemaIdNum = …`:

```js
const esquemaFinalizar = Joi.object({ categoria_id: Joi.number().integer().positive().required() });
router.post('/finalizar', apiCodigo('TRK-CAL-006'), trkAuth, trkPermiso('calificar'), validar(esquemaFinalizar), aw(ctrl.finalizar));
```

En `BACK:src/trk/config/apiCodigos.js`, después de `'TRK-CAL-005'`:

```js
  'TRK-CAL-006': { metodo: 'POST', ruta: '/calificaciones/finalizar', descripcion: 'Envío final por categoría: borradores → calificaciones bloqueadas, todo o nada (v2.1)' },
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan (incluida la regresión de TRK-CAL-002)**

Run: `npx jest src/trk/services/__tests__/validarPuntajes.test.js src/trk/config/__tests__/apiCodigos.test.js`
Expected: PASS.

Run: `npx jest -c jest.trk-int.config.js --runInBand src/trk/routes/__tests__/finalizar.int.test.js src/trk/routes/__tests__/calificaciones.int.test.js src/trk/routes/__tests__/desbloqueo.int.test.js src/trk/routes/__tests__/matriz.int.test.js src/trk/routes/__tests__/correccion.int.test.js`
Expected: PASS (6 tests nuevos; `TRK-CAL-002` conserva idempotencia, 409/422 y auditoría `CREAR`/`REENVIAR` con su propio código).

- [ ] **Step 6: Commit**

```bash
git add src/trk/services/calificaciones.service.js src/trk/controllers/calificaciones.controller.js src/trk/routes/calificaciones.routes.js src/trk/config/apiCodigos.js src/trk/routes/__tests__/finalizar.int.test.js
git commit -m "feat(trk): envio final de calificaciones por categoria (TRK-CAL-006) con nucleo compartido con TRK-CAL-002

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cálculos de la matriz y store de borradores con cola offline

Cubre: HU-8b CA4 (total, puesto tentativo con "="), CA5 (autoguardado por fila, indicador, última escritura gana offline por jurado+participante, guarda de sesión), CA6 (envío final requiere conexión).

**Files:**
- Create: `FRONT:src/utils/matriz.js`, `FRONT:src/utils/__tests__/matriz.spec.js`
- Modify: `FRONT:src/stores/calificacion.js` (archivo completo abajo), `FRONT:src/stores/__tests__/calificacion.spec.js`

**Interfaces:**
- Consumes: `trk.put/post` (`@/services/api`, respuestas ya desenvueltas `{ success, data }` y errores normalizados `{ status, motivo, message, errors }`); `@/utils/colaOffline` (`encolar`, `obtener`, `listar`, `quitarSiVersion`; clave `juradoId:participanteId`, sin cambios); `idDelToken`, `mensajeDeError`; HTTP `PUT /borradores/:id` y `POST /calificaciones/finalizar` (Tasks 2–3).
- Produces:
  - `vacio(v) → boolean`; `totalDe(valores: {[criterioId]: number|null}, criterios: [{id}]) → number`; `completa(valores, criterios) → boolean`; `puestosTentativos(filas: [{ id, total, completa }]) → { [id]: '1' | '=2' | … }` (solo filas completas; empate → mismo puesto con "="; ranking de competencia 1, =2, =2, 4); `normalizarEntrada(texto, max) → number|null` (solo dígitos, tope en `max`, vacío → null); `aLista(valores, criterios) → [{ criterio_id, puntaje|null }]`; `aMapa(lista) → { [criterioId]: puntaje|null }`.
  - Store `useCalificacionStore` (mismo nombre e `id: 'calificacion'`; `BarraSuperior` y `services/sesion.js` siguen usando `pendientes`, `sincronizar`, `reiniciar` sin cambios):
    - state `{ pendientes: { [pid]: item }, rechazadas: { [pid]: { motivo, message } }, estados: { [pid]: 'GUARDANDO'|'GUARDADO'|'SIN_CONEXION'|'ERROR' }, sincronizando }`
    - `anotar(juradoId, participanteId, puntajes, esperaMs = ESPERA_AUTOGUARDADO_MS) → Promise<item>` (marca `GUARDANDO` en el acto, escribe IndexedDB y programa un único envío tras la pausa)
    - `guardarBorrador(juradoId, participanteId, puntajes) → Promise<{ estado: 'GUARDADO'|'PENDIENTE'|'RECHAZADA', borrador?, error? }>` (envío inmediato; reemplaza al antiguo `enviar`)
    - `finalizar(juradoId, categoriaId, participanteIds: string[]) → Promise<{ categoria_id, calificaciones }>`; rechaza con `{ status: 0, motivo: 'SIN_CONEXION' | 'BORRADOR_RECHAZADO', message, errors: [] }` si alguna fila de la categoría no quedó guardada.
    - `ESPERA_AUTOGUARDADO_MS = 700` (export).

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/utils/__tests__/matriz.spec.js`:

```js
import { test, expect } from 'vitest'
import { totalDe, completa, puestosTentativos, normalizarEntrada, aLista, aMapa } from '@/utils/matriz'

const criterios = [{ id: 1 }, { id: 2 }]

test('total suma solo lo escrito; completa exige todas las casillas', () => {
  expect(totalDe({ 1: 5, 2: null }, criterios)).toBe(5)
  expect(totalDe({}, criterios)).toBe(0)
  expect(completa({ 1: 5, 2: null }, criterios)).toBe(false)
  expect(completa({ 1: 0, 2: 0 }, criterios)).toBe(true)
  expect(completa({}, [])).toBe(false)
})

test('puesto tentativo: total descendente sobre filas completas y empates con "=" (CA4)', () => {
  const filas = [
    { id: 'a', total: 90, completa: true },
    { id: 'b', total: 85, completa: true },
    { id: 'c', total: 85, completa: true },
    { id: 'd', total: 70, completa: true },
    { id: 'e', total: 99, completa: false }
  ]
  expect(puestosTentativos(filas)).toEqual({ a: '1', b: '=2', c: '=2', d: '4' })
})

test('entrada numérica: solo dígitos, tope en el máximo, vacío = null', () => {
  expect(normalizarEntrada('12', 9)).toBe(9)
  expect(normalizarEntrada('a3', 9)).toBe(3)
  expect(normalizarEntrada('', 9)).toBeNull()
  expect(normalizarEntrada('-', 9)).toBeNull()
  expect(normalizarEntrada('0', 9)).toBe(0)
})

test('conversiones lista ↔ mapa para la cola y el API', () => {
  expect(aLista({ 1: 4 }, criterios)).toEqual([{ criterio_id: 1, puntaje: 4 }, { criterio_id: 2, puntaje: null }])
  expect(aMapa([{ criterio_id: 1, puntaje: 4 }, { criterio_id: 2, puntaje: null }])).toEqual({ 1: 4, 2: null })
})
```

En `FRONT:src/stores/__tests__/calificacion.spec.js`, adaptar las pruebas existentes al nuevo contrato (mismo comportamiento de cola, nuevo endpoint):

```bash
cd "/Users/Shared/Files From c.localized/apps/mantix/peludos"
sed -i '' \
  -e "s/trk: { put: vi.fn() }/trk: { put: vi.fn(), post: vi.fn() }/" \
  -e "s/s\.enviar(/s.guardarBorrador(/g" \
  -e "s#'/calificaciones/p1'#'/borradores/p1'#g" \
  -e "s/'ENVIADA'/'GUARDADO'/g" \
  src/stores/__tests__/calificacion.spec.js
```

y agregar al final del archivo:

```js
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

test('anotar escribe en IndexedDB al instante y envía una sola vez tras la pausa (autoguardado por fila, CA5)', async () => {
  trk.put.mockResolvedValue({ data: { participante_id: 'p1', borrador: { 1: 3 } } })
  const s = useCalificacionStore()
  await s.anotar(7, 'p1', [{ criterio_id: 1, puntaje: 2 }], 30)
  await s.anotar(7, 'p1', [{ criterio_id: 1, puntaje: 3 }], 30)
  expect(s.estados.p1).toBe('GUARDANDO')
  expect((await cola.obtener(7, 'p1')).puntajes).toEqual([{ criterio_id: 1, puntaje: 3 }])
  expect(trk.put).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(s.estados.p1).toBe('GUARDADO'))
  expect(trk.put).toHaveBeenCalledTimes(1)
  expect(trk.put).toHaveBeenCalledWith('/borradores/p1', { puntajes: [{ criterio_id: 1, puntaje: 3 }] })
  expect(s.pendientes).toEqual({})
})

test('sin red la fila queda "Sin conexión" y el borrador espera en el dispositivo (última escritura gana)', async () => {
  trk.put.mockRejectedValue({ status: 0, motivo: 'SIN_CONEXION' })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', [{ criterio_id: 1, puntaje: 2 }])
  await s.guardarBorrador(7, 'p1', [{ criterio_id: 1, puntaje: 5 }])
  expect(s.estados.p1).toBe('SIN_CONEXION')
  const q = await cola.listar(7)
  expect(q).toHaveLength(1)
  expect(q[0].puntajes).toEqual([{ criterio_id: 1, puntaje: 5 }])
})

test('409 CALIFICACION_BLOQUEADA marca la fila con ERROR, la informa y la saca de la cola', async () => {
  trk.put.mockRejectedValue({ status: 409, motivo: 'CALIFICACION_BLOQUEADA', message: 'Bloqueada' })
  const s = useCalificacionStore()
  const r = await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('RECHAZADA')
  expect(s.estados.p1).toBe('ERROR')
  expect(s.rechazadas.p1).toEqual({ motivo: 'CALIFICACION_BLOQUEADA', message: 'Bloqueada' })
  expect(await cola.listar(7)).toEqual([])
})

test('reiniciar cancela los autoguardados programados y limpia los estados', async () => {
  const s = useCalificacionStore()
  await s.anotar(7, 'p1', PUNTAJES, 30)
  s.reiniciar()
  await espera(60)
  expect(trk.put).not.toHaveBeenCalled()
  expect(s.estados).toEqual({})
})

test('finalizar guarda antes lo pendiente de la categoría y luego llama a TRK-CAL-006 (CA6)', async () => {
  trk.put.mockRejectedValueOnce({ status: 0 }).mockResolvedValue({ data: {} })
  trk.post.mockResolvedValue({ data: { categoria_id: 1, calificaciones: [{ id: 1 }, { id: 2 }] } })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(s.pendientes.p1).toBeTruthy()
  const r = await s.finalizar(7, 1, ['p1', 'p2'])
  expect(trk.put).toHaveBeenCalledTimes(2)
  expect(trk.post).toHaveBeenCalledWith('/calificaciones/finalizar', { categoria_id: 1 })
  expect(r.calificaciones).toHaveLength(2)
})

test('finalizar sin conexión no llama a TRK-CAL-006 y lo explica', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  await expect(s.finalizar(7, 1, ['p1'])).rejects.toMatchObject({ motivo: 'SIN_CONEXION' })
  expect(trk.post).not.toHaveBeenCalled()
})

test('finalizar respeta la guarda de sesión: con otro jurado en la pestaña no envía nada', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  trk.put.mockClear()
  useAuthStore().usuario = { id: 8 }
  await expect(s.finalizar(7, 1, ['p1'])).rejects.toMatchObject({ motivo: 'SIN_CONEXION' })
  expect(trk.put).not.toHaveBeenCalled()
  expect(trk.post).not.toHaveBeenCalled()
})

test('finalizar con una fila rechazada no envía y pide corregirla', async () => {
  trk.put.mockRejectedValue({ status: 422, motivo: 'PUNTAJE_FUERA_DE_RANGO', message: 'Fuera de rango' })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  await expect(s.finalizar(7, 1, ['p1'])).rejects.toMatchObject({ motivo: 'BORRADOR_RECHAZADO' })
  expect(trk.post).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/utils/__tests__/matriz.spec.js src/stores/__tests__/calificacion.spec.js`
Expected: FAIL — `Failed to resolve import "@/utils/matriz"` y `s.guardarBorrador is not a function`.

- [ ] **Step 3: Utilidades** — `FRONT:src/utils/matriz.js`:

```js
// Cálculos de la matriz del jurado (HU-8b). Los máximos vienen de la API (rúbrica sembrada), nunca de constantes.
export const vacio = (v) => v === null || v === undefined || v === ''

export function totalDe(valores = {}, criterios = []) {
  return criterios.reduce((s, c) => s + (vacio(valores[c.id]) ? 0 : Number(valores[c.id])), 0)
}

export const completa = (valores = {}, criterios = []) => criterios.length > 0 && criterios.every((c) => !vacio(valores[c.id]))

// CA4: orden por total descendente sobre las filas completas; los empatados comparten puesto y llevan "=".
// No aplica R3–R6 (eso es solo del ranking oficial).
export function puestosTentativos(filas = []) {
  const completas = filas.filter((f) => f.completa)
  const salida = {}
  for (const f of completas) {
    const mejores = completas.filter((g) => g.total > f.total).length
    const empatados = completas.filter((g) => g.total === f.total).length
    salida[f.id] = `${empatados > 1 ? '=' : ''}${mejores + 1}`
  }
  return salida
}

export function normalizarEntrada(texto, max) {
  const digitos = String(texto ?? '').replace(/\D/g, '')
  if (digitos === '') return null
  return Math.min(Number(digitos), max)
}

export const aLista = (valores = {}, criterios = []) =>
  criterios.map((c) => ({ criterio_id: c.id, puntaje: vacio(valores[c.id]) ? null : Number(valores[c.id]) }))

export const aMapa = (lista = []) => Object.fromEntries(lista.map((x) => [x.criterio_id, x.puntaje]))
```

- [ ] **Step 4: Store** — reemplazar `FRONT:src/stores/calificacion.js` completo por:

```js
import { defineStore } from 'pinia'
import { trk, tokenStorage } from '@/services/api'
import * as cola from '@/utils/colaOffline'
import { useAuthStore } from '@/stores/auth'
import { idDelToken } from '@/utils/sesionLocal'
import { mensajeDeError } from '@/utils/errores'

// Borradores de la matriz del jurado (HU-8b): una entrada por jurado+participante en IndexedDB, última escritura gana.
export const ESPERA_AUTOGUARDADO_MS = 700

// Solo es definitivo un 4xx (distinto de 401/408/429) con status entero; todo lo demás se reintenta.
const definitivo = (e) => {
  const s = e?.status
  return Number.isInteger(s) && s >= 400 && s < 500 && s !== 401 && s !== 408 && s !== 429
}

// Cadena de promesas por clave: el trabajo sobre un mismo participante nunca se intercala.
const cadenas = new Map()
const enSerie = (clave, tarea) => {
  const previa = cadenas.get(clave) || Promise.resolve()
  const actual = previa.then(tarea, tarea)
  const cola_ = actual.catch(() => {})
  cadenas.set(clave, cola_)
  cola_.then(() => cadenas.get(clave) === cola_ && cadenas.delete(clave))
  return actual
}

// Temporizadores de autoguardado por fila (clave jurado:participante).
const temporizadores = new Map()
const cancelarTemporizador = (clave) => {
  clearTimeout(temporizadores.get(clave))
  temporizadores.delete(clave)
}

// La sesión vale para un jurado solo si coincide el usuario de esta pestaña Y el id dentro del token que
// realmente se enviará (localStorage es compartido entre pestañas: otra pudo entrar como otro jurado).
const esSesionDe = (juradoId) =>
  String(useAuthStore().usuario?.id) === String(juradoId) && String(idDelToken(tokenStorage.leer())) === String(juradoId)

const errorLocal = (motivo, message) => Object.assign(new Error(message), { status: 0, motivo, errors: [] })

export const useCalificacionStore = defineStore('calificacion', {
  // estados: participanteId → 'GUARDANDO' | 'GUARDADO' | 'SIN_CONEXION' | 'ERROR' (indicador por fila, CA5).
  state: () => ({ pendientes: {}, rechazadas: {}, estados: {}, sincronizando: false }),
  actions: {
    reiniciar() {
      for (const clave of [...temporizadores.keys()]) cancelarTemporizador(clave)
      this.pendientes = {}
      this.rechazadas = {}
      this.estados = {}
    },
    marcar(participanteId, estado) {
      this.estados = { ...this.estados, [String(participanteId)]: estado }
    },
    async cargarPendientes(juradoId) {
      const items = await cola.listar(juradoId)
      const nuevos = Object.fromEntries(items.map((i) => [i.participanteId, i]))
      // Conserva lo agregado en memoria durante la espera si sigue existiendo en IndexedDB.
      for (const [pid, previo] of Object.entries(this.pendientes)) {
        if (nuevos[pid] || String(previo.juradoId) !== String(juradoId)) continue
        const guardado = await cola.obtener(juradoId, pid)
        if (guardado) nuevos[pid] = guardado
      }
      this.pendientes = nuevos
    },
    // Autoguardado: la fila queda en IndexedDB al instante y se envía una sola vez cuando el jurado hace una pausa.
    async anotar(juradoId, participanteId, puntajes, esperaMs = ESPERA_AUTOGUARDADO_MS) {
      const clave = `${juradoId}:${participanteId}`
      this.marcar(participanteId, 'GUARDANDO')
      this.quitarRechazo(participanteId)
      cancelarTemporizador(clave)
      const item = await cola.encolar({ juradoId, participanteId, puntajes })
      this.pendientes = { ...this.pendientes, [item.participanteId]: item }
      cancelarTemporizador(clave)
      temporizadores.set(clave, setTimeout(() => {
        temporizadores.delete(clave)
        this.intentar(juradoId, participanteId).catch(() => {})
      }, esperaMs))
      return item
    },
    async guardarBorrador(juradoId, participanteId, puntajes) {
      cancelarTemporizador(`${juradoId}:${participanteId}`)
      this.marcar(participanteId, 'GUARDANDO')
      this.quitarRechazo(participanteId)
      const item = await cola.encolar({ juradoId, participanteId, puntajes })
      this.pendientes = { ...this.pendientes, [item.participanteId]: item }
      return this.intentar(juradoId, participanteId)
    },
    intentar(juradoId, participanteId) {
      return enSerie(`${juradoId}:${participanteId}`, () => this._intentar(juradoId, participanteId))
    },
    async _intentar(juradoId, participanteId) {
      if (!esSesionDe(juradoId)) return { estado: 'PENDIENTE' }
      const item = await cola.obtener(juradoId, participanteId)
      if (!item) {
        this.olvidar(participanteId)
        return { estado: 'GUARDADO' }
      }
      let resultado
      try {
        const { data } = await trk.put(`/borradores/${participanteId}`, { puntajes: item.puntajes })
        resultado = { estado: 'GUARDADO', borrador: data }
        this.quitarRechazo(participanteId)
      } catch (e) {
        if (!definitivo(e)) {
          this.marcar(participanteId, 'SIN_CONEXION')
          return { estado: 'PENDIENTE' }
        }
        resultado = { estado: 'RECHAZADA', error: e }
      }
      // Solo se quita si la entrada sigue siendo la que se envió (pudo llegar una más nueva).
      if (await cola.quitarSiVersion(juradoId, participanteId, item.encoladaEn)) {
        this.olvidar(participanteId)
        if (resultado.estado === 'RECHAZADA') {
          const e = resultado.error
          this.rechazadas = { ...this.rechazadas, [String(participanteId)]: { motivo: e?.motivo || 'ERROR', message: mensajeDeError(e) } }
          this.marcar(participanteId, 'ERROR')
        } else {
          this.marcar(participanteId, 'GUARDADO')
        }
      }
      return resultado
    },
    quitarRechazo(participanteId) {
      if (!this.rechazadas[String(participanteId)]) return
      const resto = { ...this.rechazadas }
      delete resto[String(participanteId)]
      this.rechazadas = resto
    },
    olvidar(participanteId) {
      const resto = { ...this.pendientes }
      delete resto[String(participanteId)]
      this.pendientes = resto
    },
    async sincronizar(juradoId) {
      if (this.sincronizando) return
      if (!esSesionDe(juradoId)) return
      this.sincronizando = true
      try {
        await this.cargarPendientes(juradoId)
        for (const participanteId of Object.keys(this.pendientes)) await this.intentar(juradoId, participanteId)
      } finally {
        this.sincronizando = false
      }
    },
    iniciarAutoSincronizacion(juradoId, intervaloMs = 10000) {
      const correr = () => {
        this.sincronizar(juradoId).catch(() => {})
      }
      window.addEventListener('online', correr)
      const temporizador = setInterval(correr, intervaloMs)
      return () => {
        window.removeEventListener('online', correr)
        clearInterval(temporizador)
      }
    },
    // CA6: requiere conexión. Primero deja en el servidor lo que la categoría tenga pendiente; si algo no se pudo
    // guardar, no se envía nada (el servidor decide con sus borradores: todo o nada).
    async finalizar(juradoId, categoriaId, participanteIds) {
      const ids = participanteIds.map(String)
      for (const pid of ids) cancelarTemporizador(`${juradoId}:${pid}`)
      await Promise.all(ids.filter((pid) => this.pendientes[pid]).map((pid) => this.intentar(juradoId, pid)))
      if (ids.some((pid) => this.pendientes[pid])) {
        throw errorLocal('SIN_CONEXION', 'Hay puntajes sin guardar en el servidor. Revisa la conexión e inténtalo de nuevo.')
      }
      if (ids.some((pid) => this.rechazadas[pid])) {
        throw errorLocal('BORRADOR_RECHAZADO', 'Corrige las filas marcadas con error antes de enviar la calificación final.')
      }
      const { data } = await trk.post('/calificaciones/finalizar', { categoria_id: Number(categoriaId) })
      return data
    }
  }
})
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/utils/__tests__/matriz.spec.js src/stores/__tests__/calificacion.spec.js src/components/__tests__/BarraSuperior.spec.js src/services/__tests__/sesion.spec.js`
Expected: PASS (las pruebas previas de cola —versionado, guarda de sesión, reintentos— siguen verdes con el endpoint `/borradores`).

- [ ] **Step 6: Commit**

```bash
git add src/utils/matriz.js src/utils/__tests__/matriz.spec.js src/stores/calificacion.js src/stores/__tests__/calificacion.spec.js
git commit -m "feat(jurado): store de borradores con autoguardado, cola offline por fila y envio final

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pantalla del jurado con la matriz

Cubre: HU-8b CA1 (tarjeta "En pasarela" en tiempo real, categoría de quien desfila, selector), CA2, CA3 (columna fija con foto, criterios con su máximo, Total, Puesto; scroll horizontal propio a 360 px), CA4, CA5 (indicador por fila), CA6 (botón fijo "Enviar calificación final (N)" con confirmación y ranking tentativo), CA7 (filas finales ✓ de solo lectura), CA8.

**Files:**
- Create: `FRONT:src/components/MatrizCalificacion.vue`, `FRONT:src/components/__tests__/MatrizCalificacion.spec.js`
- Modify: `FRONT:src/views/JuradoView.vue` (archivo completo abajo), `FRONT:src/views/__tests__/JuradoView.spec.js` (archivo completo abajo)

**Interfaces:**
- Consumes: `GET /jurado/matriz` → `Matriz` (Task 2); store `useCalificacionStore` (`pendientes`, `estados`, `rechazadas`, `anotar`, `finalizar`, `cargarPendientes`, `iniciarAutoSincronizacion`) y `@/utils/matriz` (Task 4); `useEventoStore` (`enPasarela`, `sincronizar`, `alCambioPasarela`, `alFotoNueva`); `useTiempoReal({ token, sincronizar, eventos })`; `FichaMascota`, `FotoMascota`, `BarraSuperior`.
- Produces:
  - `<MatrizCalificacion :criterios :filas :puestos :estados :en-pasarela-id :deshabilitada @cambiar>` donde `filas = [{ id, participante, valores: {[criterioId]: number|null}, total, completa, esFinal }]` y `cambiar` emite `{ participanteId, criterioId, valor: number|null }`.
  - `data-test` estables para E2E: `en-pasarela`, `selector-categoria`, `matriz`, `fila-<pid>`, `celda-<pid>-<criterioId>`, `total-<pid>`, `puesto-<pid>`, `estado-<pid>`, `final-<pid>`, `enviar-final`, `confirmacion`, `confirmar-final`, `aviso`, `rechazadas`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/components/__tests__/MatrizCalificacion.spec.js`:

```js
import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MatrizCalificacion from '@/components/MatrizCalificacion.vue'

// Máximos ficticios: los reales vienen de la API.
const criterios = [{ id: 1, nombre: 'Creatividad', puntaje_max: 9 }, { id: 2, nombre: 'Seguridad', puntaje_max: 8 }]
const fila = (id, valores = {}, extra = {}) => ({ id, participante: { id, mascota_nombre: id.toUpperCase() }, valores, total: 0, completa: false, esFinal: false, ...extra })
const montar = (props) => mount(MatrizCalificacion, { props: { criterios, filas: [fila('t')], ...props } })

test('encabezados con el máximo de cada criterio, Total y Puesto; nombre en columna fija y scroll propio (CA3)', () => {
  const w = montar()
  expect(w.get('[data-test="criterio-1"]').text()).toContain('Creatividad')
  expect(w.get('[data-test="criterio-1"]').text()).toContain('/ 9')
  expect(w.get('thead').text()).toContain('Total')
  expect(w.get('thead').text()).toContain('Puesto')
  expect(w.get('[data-test="matriz"]').classes()).toContain('overflow-x-auto')
  expect(w.get('[data-test="fila-t"] th').classes()).toEqual(expect.arrayContaining(['sticky', 'left-0']))
})

test('casillas numéricas de 44 px: solo dígitos, tope en el máximo y vacío = null (CA4)', async () => {
  const w = montar()
  const celda = w.get('[data-test="celda-t-1"]')
  expect(celda.attributes('inputmode')).toBe('numeric')
  expect(celda.classes()).toContain('h-11')
  await celda.setValue('12')
  expect(w.emitted('cambiar').at(-1)[0]).toEqual({ participanteId: 't', criterioId: 1, valor: 9 })
  expect(celda.element.value).toBe('9')
  await celda.setValue('a3')
  expect(w.emitted('cambiar').at(-1)[0].valor).toBe(3)
  await celda.setValue('')
  expect(w.emitted('cambiar').at(-1)[0].valor).toBeNull()
})

test('total, puesto con "=" y "—" sin puesto; resalta la mascota en pasarela', () => {
  const w = montar({
    filas: [fila('t', { 1: 9, 2: 8 }, { total: 17, completa: true }), fila('k', { 1: 1 }, { total: 1 })],
    puestos: { t: '=1' },
    enPasarelaId: 't'
  })
  expect(w.get('[data-test="total-t"]').text()).toBe('17')
  expect(w.get('[data-test="puesto-t"]').text()).toBe('=1')
  expect(w.get('[data-test="puesto-k"]').text()).toBe('—')
  expect(w.get('[data-test="fila-t"]').classes()).toContain('bg-calabaza-50')
})

test('fila final: ✓ Enviada y casillas deshabilitadas (CA7)', () => {
  const w = montar({ filas: [fila('k', { 1: 9, 2: 8 }, { esFinal: true, total: 17, completa: true })] })
  expect(w.get('[data-test="final-k"]').text()).toContain('✓')
  expect(w.get('[data-test="celda-k-1"]').attributes('disabled')).toBeDefined()
})

test('indicador por fila Guardado / Guardando… / Sin conexión (CA5)', () => {
  const w = montar({ filas: [fila('a'), fila('b'), fila('c')], estados: { a: 'GUARDADO', b: 'GUARDANDO', c: 'SIN_CONEXION' } })
  expect(w.get('[data-test="estado-a"]').text()).toBe('Guardado')
  expect(w.get('[data-test="estado-b"]').text()).toBe('Guardando…')
  expect(w.get('[data-test="estado-c"]').text()).toBe('Sin conexión')
})
```

Reemplazar `FRONT:src/views/__tests__/JuradoView.spec.js` completo por:

```js
import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const tiempoReal = vi.hoisted(() => ({ opciones: null }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({
  useTiempoReal: vi.fn((o) => { tiempoReal.opciones = o; o.sincronizar(); return { conectado: { value: true } } })
}))

import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import JuradoView from '@/views/JuradoView.vue'

// Máximos ficticios (los reales vienen de la API).
const CRITERIOS = [{ id: 1, codigo: 'A', nombre: 'Creatividad', puntaje_max: 9, orden: 1 }, { id: 2, codigo: 'B', nombre: 'Seguridad', puntaje_max: 8, orden: 2 }]
const CATS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños', abierta: true }, { id: 3, codigo: 'FELINOS', nombre: 'Felinos', abierta: true }]
const toby = { id: 't', mascota_nombre: 'Toby', estado: 'EN_PASARELA', categoria_id: 1, categoria: { id: 1, nombre: 'Pequeños' }, responsable_primer_nombre: 'Ana' }
const kira = { id: 'k', mascota_nombre: 'Kira', estado: 'PRESENTADO', categoria_id: 1 }
const SIN_FINAL = { estado: null, total: null, puntajes: null }
let respuesta
const matrizBase = () => ({
  categoria: { ...CATS[0] }, categorias: CATS, criterios: CRITERIOS, puntaje_total_max: 17,
  filas: [
    { participante: toby, borrador: { 1: 5, 2: null }, final: { ...SIN_FINAL } },
    { participante: kira, borrador: { 1: 9, 2: 8 }, final: { ...SIN_FINAL } }
  ]
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().usuario = { id: 7, permisos: { calificar: true } }
  respuesta = matrizBase()
  trk.get.mockImplementation(async (url) => {
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: toby, categoria_pantalla: null, ranking: null } }
    if (url === '/jurado/matriz') return { data: respuesta }
    throw new Error(`GET inesperado ${url}`)
  })
  const cola = useCalificacionStore()
  cola.iniciarAutoSincronizacion = vi.fn(() => () => {})
  cola.cargarPendientes = vi.fn(async () => {})
  cola.anotar = vi.fn(async () => {})
})

const montar = async () => {
  const w = mount(JuradoView)
  await flushPromises()
  return w
}

test('tarjeta En pasarela (sin datos del responsable) y matriz de su categoría con la mascota en pasarela primero (CA1, CA2)', async () => {
  const w = await montar()
  const tarjeta = w.get('[data-test="en-pasarela"]')
  expect(tarjeta.text()).toContain('Toby')
  expect(tarjeta.text()).not.toContain('Ana')
  expect(trk.get).toHaveBeenCalledWith('/jurado/matriz', { params: {} })
  expect(w.findAll('[data-test^="fila-"]').map((f) => f.attributes('data-test'))).toEqual(['fila-t', 'fila-k'])
})

test('total y puesto tentativo; una fila incompleta no tiene puesto (CA4)', async () => {
  const w = await montar()
  expect(w.get('[data-test="total-t"]').text()).toBe('5')
  expect(w.get('[data-test="puesto-t"]').text()).toBe('—')
  expect(w.get('[data-test="total-k"]').text()).toBe('17')
  expect(w.get('[data-test="puesto-k"]').text()).toBe('1')
})

test('escribir recalcula total/puesto y anota el borrador de toda la fila (CA5)', async () => {
  const w = await montar()
  await w.get('[data-test="celda-t-2"]').setValue('3')
  expect(w.get('[data-test="total-t"]').text()).toBe('8')
  expect(w.get('[data-test="puesto-t"]').text()).toBe('2')
  expect(useCalificacionStore().anotar).toHaveBeenCalledWith(7, 't', [{ criterio_id: 1, puntaje: 5 }, { criterio_id: 2, puntaje: 3 }])
})

test('empates en el puesto tentativo se marcan con "="', async () => {
  const w = await montar()
  await w.get('[data-test="celda-t-1"]').setValue('9')
  await w.get('[data-test="celda-t-2"]').setValue('8')
  expect(w.get('[data-test="puesto-t"]').text()).toBe('=1')
  expect(w.get('[data-test="puesto-k"]').text()).toBe('=1')
})

test('un borrador local pendiente (IndexedDB) gana sobre el del servidor al cargar', async () => {
  useCalificacionStore().pendientes = { t: { participanteId: 't', puntajes: [{ criterio_id: 1, puntaje: 2 }, { criterio_id: 2, puntaje: 3 }] } }
  const w = await montar()
  expect(w.get('[data-test="celda-t-1"]').element.value).toBe('2')
  expect(w.get('[data-test="total-t"]').text()).toBe('5')
})

test('filas finales con ✓ y sin edición; el botón cuenta solo las no finales y exige filas completas (CA6, CA7)', async () => {
  respuesta.filas[1].final = { estado: 'FINAL', total: 17, puntajes: { 1: 9, 2: 8 } }
  const w = await montar()
  expect(w.get('[data-test="final-k"]').text()).toContain('✓')
  expect(w.get('[data-test="celda-k-1"]').attributes('disabled')).toBeDefined()
  const boton = w.get('[data-test="enviar-final"]')
  expect(boton.text()).toBe('Enviar calificación final (1)')
  expect(boton.attributes('disabled')).toBeDefined()
})

test('envío final: confirma mostrando el ranking tentativo y envía las filas pendientes de la categoría (CA6)', async () => {
  respuesta.filas[0].borrador = { 1: 4, 2: 4 }
  const cola = useCalificacionStore()
  cola.finalizar = vi.fn(async () => ({ categoria_id: 1, calificaciones: [{ id: 1 }, { id: 2 }] }))
  const w = await montar()
  await w.get('[data-test="enviar-final"]').trigger('click')
  expect(w.get('[data-test="confirmacion"]').text()).toMatch(/1\. Kira.*17.*2\. Toby.*8/s)
  await w.get('[data-test="confirmar-final"]').trigger('click')
  await flushPromises()
  expect(cola.finalizar).toHaveBeenCalledWith(7, 1, ['t', 'k'])
  expect(w.find('[data-test="confirmacion"]').exists()).toBe(false)
  expect(w.get('[data-test="aviso"]').text()).toContain('2 mascota(s)')
})

test('el error del envío final se muestra (p. ej. 422 CALIFICACION_INCOMPLETA)', async () => {
  respuesta.filas[0].borrador = { 1: 4, 2: 4 }
  useCalificacionStore().finalizar = vi.fn(async () => { throw { status: 422, motivo: 'CALIFICACION_INCOMPLETA', message: 'Faltan puntajes de: Toby', errors: [] } })
  const w = await montar()
  await w.get('[data-test="enviar-final"]').trigger('click')
  await w.get('[data-test="confirmar-final"]').trigger('click')
  await flushPromises()
  expect(w.get('[role="alert"]').text()).toContain('Faltan puntajes de: Toby')
})

test('sigue la pasarela en vivo; si el jurado elige otra categoría la conserva hasta que vuelva a la de la pasarela (CA1)', async () => {
  const w = await montar()
  trk.get.mockClear()
  tiempoReal.opciones.eventos['pasarela:cambio']({ participante: { ...kira, estado: 'EN_PASARELA' } })
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/jurado/matriz', { params: {} })

  await w.get('[data-test="selector-categoria"]').setValue('3')
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/jurado/matriz', { params: { categoria: 3 } })
  tiempoReal.opciones.eventos['pasarela:cambio']({ participante: toby })
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/jurado/matriz', { params: { categoria: 3 } })

  await w.get('[data-test="selector-categoria"]').setValue('1')
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/jurado/matriz', { params: {} })
})

test('categoría cerrada: casillas y botón deshabilitados con aviso', async () => {
  respuesta.categoria.abierta = false
  const w = await montar()
  expect(w.text()).toContain('La categoría está cerrada')
  expect(w.get('[data-test="celda-t-1"]').attributes('disabled')).toBeDefined()
  expect(w.get('[data-test="enviar-final"]').attributes('disabled')).toBeDefined()
})

test('arranca la auto-sincronización de la cola y la detiene al desmontar', async () => {
  const detener = vi.fn()
  const cola = useCalificacionStore()
  cola.iniciarAutoSincronizacion = vi.fn(() => detener)
  const w = await montar()
  expect(cola.iniciarAutoSincronizacion).toHaveBeenCalledWith(7)
  w.unmount()
  expect(detener).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/components/__tests__/MatrizCalificacion.spec.js src/views/__tests__/JuradoView.spec.js`
Expected: FAIL — `Failed to resolve import "@/components/MatrizCalificacion.vue"`; `JuradoView` aún pide `/participantes` (`GET inesperado /participantes`).

- [ ] **Step 3: Componente** — `FRONT:src/components/MatrizCalificacion.vue`:

```vue
<script setup>
import FotoMascota from '@/components/FotoMascota.vue'
import { normalizarEntrada } from '@/utils/matriz'

defineProps({
  criterios: { type: Array, required: true },
  // [{ id, participante, valores: { [criterioId]: number|null }, total, completa, esFinal }]
  filas: { type: Array, required: true },
  puestos: { type: Object, default: () => ({}) },
  estados: { type: Object, default: () => ({}) },
  enPasarelaId: { type: String, default: null },
  deshabilitada: { type: Boolean, default: false }
})
const emit = defineEmits(['cambiar'])

const TEXTO_ESTADO = { GUARDANDO: 'Guardando…', GUARDADO: 'Guardado', SIN_CONEXION: 'Sin conexión', ERROR: 'No guardado' }
const mostrar = (v) => (v === null || v === undefined ? '' : String(v))

function alEscribir(fila, criterio, evento) {
  const valor = normalizarEntrada(evento.target.value, criterio.puntaje_max)
  evento.target.value = mostrar(valor)
  emit('cambiar', { participanteId: fila.id, criterioId: criterio.id, valor })
}
</script>

<template>
  <div class="overflow-x-auto rounded-2xl bg-white shadow-sm" data-test="matriz">
    <table class="min-w-max border-collapse text-left">
      <thead>
        <tr class="bg-morado-50 text-sm text-morado-900">
          <th scope="col" class="sticky left-0 z-10 bg-morado-50 px-2 py-2">Mascota</th>
          <th v-for="c in criterios" :key="c.id" scope="col" class="px-1 py-2 text-center" :data-test="`criterio-${c.id}`">
            {{ c.nombre }}<br /><span class="text-xs font-normal">/ {{ c.puntaje_max }}</span>
          </th>
          <th scope="col" class="px-2 py-2 text-center">Total</th>
          <th scope="col" class="px-2 py-2 text-center">Puesto</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="f in filas" :key="f.id" :data-test="`fila-${f.id}`"
          :class="['border-t border-morado-100', f.id === enPasarelaId ? 'bg-calabaza-50' : '']"
        >
          <th scope="row" :class="['sticky left-0 z-10 max-w-[9rem] px-2 py-1 font-semibold', f.id === enPasarelaId ? 'bg-calabaza-50' : 'bg-white']">
            <div class="flex items-center gap-2">
              <FotoMascota :participante="f.participante" clase="h-10 w-10 shrink-0 rounded-lg" />
              <div class="min-w-0">
                <p class="truncate">{{ f.participante.mascota_nombre }}</p>
                <p v-if="f.esFinal" class="text-xs text-green-800" :data-test="`final-${f.id}`">✓ Enviada</p>
                <p v-else-if="estados[f.id]" class="text-xs text-morado-700" :data-test="`estado-${f.id}`">{{ TEXTO_ESTADO[estados[f.id]] }}</p>
              </div>
            </div>
          </th>
          <td v-for="c in criterios" :key="c.id" class="px-1 py-1 text-center">
            <input
              type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off"
              class="h-11 w-14 rounded-lg border border-morado-200 text-center text-lg tabular-nums disabled:bg-gray-100"
              :data-test="`celda-${f.id}-${c.id}`"
              :aria-label="`${c.nombre} de ${f.participante.mascota_nombre} (0 a ${c.puntaje_max})`"
              :value="mostrar(f.valores[c.id])"
              :disabled="f.esFinal || deshabilitada"
              @input="alEscribir(f, c, $event)"
            />
          </td>
          <td class="px-2 text-center text-lg font-extrabold tabular-nums" :data-test="`total-${f.id}`">{{ f.total }}</td>
          <td class="px-2 text-center text-lg font-bold" :data-test="`puesto-${f.id}`">{{ puestos[f.id] || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 4: Vista** — reemplazar `FRONT:src/views/JuradoView.vue` completo por:

```vue
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useEventoStore } from '@/stores/evento'
import { useCalificacionStore } from '@/stores/calificacion'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'
import { totalDe, completa, puestosTentativos, aLista, aMapa } from '@/utils/matriz'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FichaMascota from '@/components/FichaMascota.vue'
import MatrizCalificacion from '@/components/MatrizCalificacion.vue'

const auth = useAuthStore()
const evento = useEventoStore()
const cola = useCalificacionStore()
const juradoId = computed(() => auth.usuario && auth.usuario.id)

const matriz = ref(null) // respuesta de TRK-CAL-004
const valores = ref({}) // participanteId → { criterioId: puntaje|null } (lo que el jurado ve y edita)
const categoriaElegida = ref(null) // null = seguir la categoría de quien está en pasarela (CA1)
const errorCarga = ref('')
const error = ref('')
const aviso = ref('')
const confirmando = ref(false)
const enviando = ref(false)
let detenerSync = null

// CA1/CA2: el jurado ve foto, nombre, disfraz y categoría; nunca datos del responsable.
const enPasarela = computed(() => (evento.enPasarela ? { ...evento.enPasarela, responsable_primer_nombre: null } : null))
const criterios = computed(() => (matriz.value ? matriz.value.criterios : []))
const filas = computed(() => (matriz.value ? matriz.value.filas : []).map((f) => {
  const esFinal = f.final && f.final.estado === 'FINAL'
  const v = esFinal ? f.final.puntajes : (valores.value[f.participante.id] || {})
  return { id: f.participante.id, participante: f.participante, valores: v, total: totalDe(v, criterios.value), completa: completa(v, criterios.value), esFinal }
}))
const puestos = computed(() => puestosTentativos(filas.value))
const pendientes = computed(() => filas.value.filter((f) => !f.esFinal))
const abierta = computed(() => Boolean(matriz.value && matriz.value.categoria && matriz.value.categoria.abierta))
const puedeEnviar = computed(() => abierta.value && !enviando.value && pendientes.value.length > 0 && pendientes.value.every((f) => f.completa))
const rankingTentativo = computed(() => filas.value.filter((f) => f.completa).sort((a, b) => b.total - a.total))
const rechazadas = computed(() => Object.entries(cola.rechazadas).map(([pid, r]) => ({
  pid, nombre: (filas.value.find((f) => f.id === pid) || { participante: {} }).participante.mascota_nombre || 'Una mascota', message: r.message
})))

// Lo local manda: una fila pendiente en IndexedDB o que se está guardando conserva lo que el jurado escribió.
function aplicarMatriz(data) {
  const nuevos = {}
  for (const f of data.filas) {
    const pid = f.participante.id
    const local = cola.pendientes[pid]
    if (local) nuevos[pid] = aMapa(local.puntajes)
    else if (cola.estados[pid] === 'GUARDANDO' && valores.value[pid]) nuevos[pid] = valores.value[pid]
    else nuevos[pid] = { ...f.borrador }
  }
  matriz.value = data
  valores.value = nuevos
}

async function cargar() {
  try {
    const params = categoriaElegida.value ? { categoria: categoriaElegida.value } : {}
    aplicarMatriz((await trk.get('/jurado/matriz', { params })).data)
    errorCarga.value = ''
  } catch (e) { errorCarga.value = mensajeDeError(e) }
}

function alCambiar({ participanteId, criterioId, valor }) {
  aviso.value = ''
  valores.value = { ...valores.value, [participanteId]: { ...(valores.value[participanteId] || {}), [criterioId]: valor } }
  cola.anotar(juradoId.value, participanteId, aLista(valores.value[participanteId], criterios.value))
    .catch((e) => { error.value = mensajeDeError(e) })
}

function elegirCategoria(id) {
  const dePasarela = evento.enPasarela && evento.enPasarela.categoria_id
  categoriaElegida.value = Number(id) === Number(dePasarela) ? null : Number(id)
  cargar()
}

async function confirmarEnvio() {
  enviando.value = true
  error.value = ''
  try {
    const r = await cola.finalizar(juradoId.value, matriz.value.categoria.id, pendientes.value.map((f) => f.id))
    aviso.value = `Calificación final enviada: ${r.calificaciones.length} mascota(s).`
    await cargar()
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    confirmando.value = false
    enviando.value = false
  }
}

useTiempoReal({
  token: auth.token,
  sincronizar: async () => { await evento.sincronizar(); await cargar() },
  eventos: {
    'pasarela:cambio': (m) => { evento.alCambioPasarela(m); cargar() },
    'foto:nueva': (m) => { evento.alFotoNueva(m); cargar() }
  }
})

onMounted(async () => {
  detenerSync = cola.iniciarAutoSincronizacion(juradoId.value)
  try {
    await cola.cargarPendientes(juradoId.value)
    if (matriz.value) aplicarMatriz(matriz.value)
  } catch (e) { error.value = mensajeDeError(e) }
})
onBeforeUnmount(() => detenerSync && detenerSync())
</script>

<template>
  <div class="min-h-screen pb-28">
    <BarraSuperior titulo="Jurado" />
    <main class="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <p v-if="error || errorCarga" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error || errorCarga }}</p>
      <p v-if="aviso" class="rounded-xl bg-green-100 p-3 text-green-900" role="status" data-test="aviso">{{ aviso }}</p>
      <div v-if="rechazadas.length" data-test="rechazadas" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">
        <p class="font-semibold">Puntajes no guardados (revisa la fila):</p>
        <ul class="list-disc pl-5">
          <li v-for="r in rechazadas" :key="r.pid"><strong>{{ r.nombre }}</strong>: {{ r.message }}</li>
        </ul>
      </div>

      <section v-if="enPasarela" data-test="en-pasarela" class="tarjeta flex flex-col gap-3 border-2 border-calabaza-500 sm:flex-row">
        <p class="text-sm font-bold uppercase text-calabaza-800">🎃 En pasarela ahora</p>
        <FichaMascota :participante="enPasarela" />
      </section>
      <p v-else class="tarjeta text-center">Aún no hay mascota en pasarela.</p>

      <label v-if="matriz" class="flex flex-col gap-1">
        <span class="text-sm font-semibold text-morado-800">Categoría</span>
        <select class="campo" data-test="selector-categoria" :value="matriz.categoria ? matriz.categoria.id : ''" @change="elegirCategoria($event.target.value)">
          <option v-if="!matriz.categoria" value="" disabled>Elige una categoría</option>
          <option v-for="c in matriz.categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
      </label>

      <template v-if="matriz && matriz.categoria">
        <p v-if="!abierta" class="rounded-xl bg-red-100 p-3 text-red-800">La categoría está cerrada.</p>
        <p v-if="!filas.length" class="tarjeta text-center">Aún no desfila ninguna mascota de esta categoría.</p>
        <MatrizCalificacion
          v-else
          :criterios="criterios" :filas="filas" :puestos="puestos" :estados="cola.estados"
          :en-pasarela-id="evento.enPasarela ? evento.enPasarela.id : null" :deshabilitada="!abierta"
          @cambiar="alCambiar"
        />
      </template>
    </main>

    <div v-if="matriz && matriz.categoria" class="fixed inset-x-0 bottom-0 bg-white/95 p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      <button class="btn-primario min-h-[56px] w-full text-lg" data-test="enviar-final" :disabled="!puedeEnviar" @click="confirmando = true">Enviar calificación final ({{ pendientes.length }})</button>
    </div>

    <div v-if="confirmando" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacion" data-test="confirmacion" class="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div class="tarjeta flex max-h-[80vh] w-full max-w-md flex-col gap-3 overflow-y-auto">
        <h2 id="titulo-confirmacion" class="text-xl font-bold">¿Enviar calificación final?</h2>
        <p>Se enviarán {{ pendientes.length }} mascota(s) de {{ matriz.categoria.nombre }}. Después no podrás modificarlas.</p>
        <ol class="flex flex-col gap-1">
          <li v-for="f in rankingTentativo" :key="f.id" class="flex justify-between gap-2">
            <span>{{ puestos[f.id] }}. {{ f.participante.mascota_nombre }}<template v-if="f.esFinal"> ✓</template></span>
            <span class="font-bold tabular-nums">{{ f.total }}</span>
          </li>
        </ol>
        <div class="flex gap-2">
          <button class="btn-claro min-h-tactil flex-1" @click="confirmando = false">Cancelar</button>
          <button class="btn-primario min-h-tactil flex-1" data-test="confirmar-final" :disabled="enviando" @click="confirmarEnvio">Confirmar envío</button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/components/__tests__/MatrizCalificacion.spec.js src/views/__tests__/JuradoView.spec.js src/utils/__tests__/matriz.spec.js`
Expected: PASS (5 + 11 + 4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/MatrizCalificacion.vue src/components/__tests__/MatrizCalificacion.spec.js src/views/JuradoView.vue src/views/__tests__/JuradoView.spec.js
git commit -m "feat(jurado): matriz de calificacion con puesto tentativo, autoguardado y envio final por categoria

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Retiro de `/jurado/calificar/:id`, `CalificarView` y `ControlPuntaje` + E2E del jurado

Cubre: spec §15 "Se retira"; HU-8b CA1–CA6 de punta a punta a 360 px, incluido CA5 sin conexión.

**Files:**
- Delete: `FRONT:src/views/CalificarView.vue`, `FRONT:src/views/__tests__/CalificarView.spec.js`, `FRONT:src/components/ControlPuntaje.vue`, `FRONT:src/components/__tests__/ControlPuntaje.spec.js`
- Modify: `FRONT:src/router/index.js`, `FRONT:e2e/jurado.spec.js` (archivo completo abajo)
- Create: `FRONT:src/router/__tests__/rutas.spec.js`

**Interfaces:**
- Consumes: `data-test` de la Task 5; backend E2E (`src/trk/scripts/e2e-servidor.js`, semilla con Toby y Kira `PRESENTE` en `PEQ_MED` y jurados `Jurado E2E 1..3` / PIN `33333N`); utilidades `entrarConPin`, `sinScrollHorizontal`.
- Produces: ninguna interfaz nueva.

- [ ] **Step 1: Escribir las pruebas que fallan**

`FRONT:src/router/__tests__/rutas.spec.js`:

```js
import { test, expect } from 'vitest'
import { routes } from '@/router'

test('v2.1: el jurado solo tiene /jurado (la matriz); /jurado/calificar/:id se retiró', () => {
  const rutas = routes.map((r) => r.path)
  expect(rutas).toContain('/jurado')
  expect(rutas).not.toContain('/jurado/calificar/:id')
})
```

Reemplazar `FRONT:e2e/jurado.spec.js` completo por:

```js
import { test, expect } from '@playwright/test'
import { entrarConPin, sinScrollHorizontal } from './utilidades'

const API = 'http://localhost:3021/api/trk/v1'

async function ponerEnPasarela(request, nombre) {
  const usuarios = (await (await request.get(`${API}/auth/usuarios-pin`)).json()).data
  const comentarista = usuarios.find((u) => u.nombre === 'Comentarista E2E')
  const { data } = await (await request.post(`${API}/auth/pin`, { data: { usuario_id: comentarista.id, pin: '222222' } })).json()
  const auth = { Authorization: `Bearer ${data.token}` }
  const cola = (await (await request.get(`${API}/participantes`, { headers: auth })).json()).data
  const p = cola.find((x) => x.mascota_nombre === nombre)
  await request.post(`${API}/pasarela/${p.id}`, { headers: auth })
}

const fila = (page, nombre) => page.locator('[data-test^="fila-"]', { hasText: nombre })

async function llenarFila(page, nombre, valor) {
  const celdas = fila(page, nombre).locator('input[inputmode="numeric"]')
  await celdas.first().waitFor()
  const n = await celdas.count()
  for (let i = 0; i < n; i++) await celdas.nth(i).fill(valor)
}

test('jurado anota en la matriz, ve total y puesto tentativo y envía la calificación final de la categoría (HU-8b)', async ({ page, request }) => {
  await entrarConPin(page, 'Jurado E2E 1', '333331')
  await ponerEnPasarela(request, 'Toby')
  await expect(page.getByTestId('en-pasarela')).toContainText('Toby', { timeout: 3000 })
  await llenarFila(page, 'Toby', '5')
  await expect(fila(page, 'Toby').locator('[data-test^="estado-"]')).toHaveText('Guardado', { timeout: 5000 })

  await ponerEnPasarela(request, 'Kira')
  await expect(page.getByTestId('en-pasarela')).toContainText('Kira', { timeout: 3000 })
  await expect(page.locator('[data-test^="fila-"]').first()).toContainText('Kira')
  await llenarFila(page, 'Kira', '6')
  await expect(fila(page, 'Kira').locator('[data-test^="puesto-"]')).toHaveText('1')
  await expect(fila(page, 'Toby').locator('[data-test^="puesto-"]')).toHaveText('2')
  expect(await sinScrollHorizontal(page)).toBe(true)

  await expect(page.getByTestId('enviar-final')).toHaveText('Enviar calificación final (2)')
  await page.getByTestId('enviar-final').click()
  await expect(page.getByTestId('confirmacion')).toContainText('Kira')
  await page.getByTestId('confirmar-final').click()
  await expect(page.locator('[data-test^="final-"]')).toHaveCount(2, { timeout: 5000 })
  await expect(page.getByTestId('enviar-final')).toBeDisabled()
  expect(await sinScrollHorizontal(page)).toBe(true)
})

test('sin conexión el borrador espera en el dispositivo y se guarda al volver (HU-8b CA5)', async ({ page, context }) => {
  await entrarConPin(page, 'Jurado E2E 2', '333332')
  await expect(fila(page, 'Kira')).toBeVisible({ timeout: 5000 })
  await context.setOffline(true)
  await llenarFila(page, 'Kira', '7')
  await expect(fila(page, 'Kira').locator('[data-test^="estado-"]')).toHaveText('Sin conexión', { timeout: 5000 })
  await context.setOffline(false)
  await expect(fila(page, 'Kira').locator('[data-test^="estado-"]')).toHaveText('Guardado', { timeout: 15_000 })
  await page.reload()
  await expect(fila(page, 'Kira').locator('input[inputmode="numeric"]').first()).toHaveValue('7', { timeout: 5000 })
})
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `cd "/Users/Shared/Files From c.localized/apps/mantix/peludos" && npx vitest run src/router/__tests__/rutas.spec.js`
Expected: FAIL — `expected [...] not to contain '/jurado/calificar/:id'`.

- [ ] **Step 3: Retirar la ruta y el código muerto**

En `FRONT:src/router/index.js` borrar la línea:

```js
  { path: '/jurado/calificar/:id', component: () => import('@/views/CalificarView.vue'), meta: { permiso: 'calificar' } },
```

y eliminar los archivos:

```bash
git rm src/views/CalificarView.vue src/views/__tests__/CalificarView.spec.js src/components/ControlPuntaje.vue src/components/__tests__/ControlPuntaje.spec.js
grep -rn "CalificarView\|ControlPuntaje\|calificaciones/mias\|/jurado/calificar" src e2e
```

Expected del `grep`: solo las cadenas de prueba de redirección en `src/views/__tests__/LoginView.spec.js` y `src/services/__tests__/sesion.spec.js` (son rutas arbitrarias para probar `redirect`; no dependen de que la ruta exista). Ninguna referencia en código de producción.

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `npx vitest run`
Expected: PASS (toda la suite del frontend).

Run: `npm run build`
Expected: build sin errores (ningún import roto).

Run (requiere `npm run trk:db:test` en BACK): `npx playwright test e2e/jurado.spec.js`
Expected: PASS (2 tests).

Run: `npx playwright test`
Expected: PASS (cabina, jurado y pasarela: el estado final de Toby/Kira es el mismo que dejaba el E2E anterior).

- [ ] **Step 5: Commit**

```bash
git add -A src/router src/views src/components e2e/jurado.spec.js
git commit -m "feat(jurado): retira /jurado/calificar y CalificarView; E2E de la matriz y del modo sin conexion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verificación completa, documentación y notas de despliegue

Cubre: §9.0 (motivos nuevos), §8.1 (tabla nueva), registro de decisiones, despliegue y ensayo general v2.1.

**Files:**
- Modify: `FRONT:docs/specs/trikipeludos-spec.md`, `FRONT:docs/specs/decisiones.md`, `FRONT:docs/despliegue.md`, `FRONT:docs/ensayo-general.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: documentación coherente con el código.

- [ ] **Step 1: Suites completas**

```bash
cd "/Users/Shared/Files From c.localized/apps/mantix/mantix-git"
npm run trk:db:test
npx jest src/trk
npx jest -c jest.trk-int.config.js --runInBand
cd "/Users/Shared/Files From c.localized/apps/mantix/peludos"
npx vitest run
npx playwright test
```

Expected: todo en verde. Verificación manual adicional (en FRONT): `grep -nE "\b(35|30|20|15|25|10)\b" src/components/MatrizCalificacion.vue src/views/JuradoView.vue src/utils/matriz.js src/stores/calificacion.js` — las únicas coincidencias aceptables son clases de Tailwind (`z-10`, `z-20`, `h-10`, `w-10`); ninguna puede ser un máximo de criterio. En BACK, `grep -nE "puntaje_max *[:=<>]+ *[0-9]" src/trk/services/matriz.service.js src/trk/services/calificaciones.service.js` no devuelve nada.

- [ ] **Step 2: Spec** — en `FRONT:docs/specs/trikipeludos-spec.md`:

En §8.1, después del bloque de `trk_calificacion_detalle(...)`:

```
trk_borradores(id, participante_id, jurado_id, criterio_id, puntaje null, updated_at,
  UNIQUE uq_trk_borradores_part_jur_crit(participante_id, jurado_id, criterio_id)
)  -- v2.1 (HU-8b): puntajes tentativos privados del jurado; no cuentan en ranking ni tablero; no se auditan
```

En §9.0, tabla de motivos: la fila 409 agrega `SIN_PENDIENTES` y la fila 422 queda `PUNTAJE_FUERA_DE_RANGO`, `CRITERIO_FALTANTE`, `CALIFICACION_INCOMPLETA` con "Cuándo" = `R1, HU-8 CA4, HU-8b CA6`.

En §15, "Errores de `TRK-CAL-006`/`TRK-CAL-005`": reemplazar "422 `VALIDACION` si un puntaje excede el máximo" por "422 `PUNTAJE_FUERA_DE_RANGO` si un puntaje no es entero entre 0 y el máximo (400 `VALIDACION` si el cuerpo no tiene forma válida o trae criterios repetidos/ajenos)"; y "409 `CATEGORIA_CERRADA` si la categoría está cerrada" también para `TRK-CAL-005`.

- [ ] **Step 3: Decisiones** — agregar al final de `FRONT:docs/specs/decisiones.md`, sección 4:

```markdown
- **v2.1 — Matriz del jurado (HU-8b):**
  - `TRK-CAL-005` responde 422 `PUNTAJE_FUERA_DE_RANGO` (motivo existente de R1) en lugar de "422 `VALIDACION`"; `VALIDACION` sigue siendo 400 (forma del cuerpo, criterios repetidos o ajenos). También rechaza con 409 `CATEGORIA_CERRADA`.
  - `TRK-CAL-006` calcula las filas pendientes en el servidor bajo bloqueo (evento → participantes → categoría): una mascota que dejó de ser calificable simplemente no es pendiente; el 409 `ESTADO_INVALIDO` queda como defensa en el núcleo compartido `registrarFinalEnTx`.
  - Puntaje vigente de una fila = borrador del jurado; si no hay borrador de un criterio, el de la calificación final (caso: enviada con `TRK-CAL-002` y desbloqueada). Lo usan la matriz y el envío final (`utils/borrador.js`).
  - Sin nadie en pasarela y sin `?categoria=`, la matriz responde `categoria: null` y el jurado elige en el selector.
  - La matriz omite `responsable_primer_nombre` (CA2); la tarjeta "En pasarela" del jurado tampoco lo muestra.
  - Si un participante cambia de categoría (`TRK-PAR-007`), sus borradores no se borran: la matriz y el envío final solo usan los criterios de la rúbrica vigente.
  - Frontend: misma cola IndexedDB (`trikipeludos/cola_calificaciones`, clave `jurado:participante`, payload `[{ criterio_id, puntaje|null }]`) ahora para borradores; autoguardado tras 700 ms de pausa; el envío final exige que todas las filas de la categoría estén guardadas en el servidor.
  - `TRK-CAL-001`, `TRK-CAL-002` y `TRK-RUB-001` se mantienen en la API (compatibilidad y pruebas); la interfaz ya no los usa.
```

- [ ] **Step 4: Despliegue y ensayo**

En `FRONT:docs/despliegue.md`, línea de la verificación previa: cambiar `006_ajuste_fk_usuarios.sql` por `007_ajuste_fk_usuarios.sql` (la 006 ya es `006_borradores.sql`). Agregar al final:

````markdown
## 6. Actualización v2.1 (matriz del jurado)

1. Backend: fusionar `feature/trk-matriz` en `main` de `ebor94/mantix`; en `srv-backend`, `bash ~/apps/mantix/mantix-backend/scripts/deploy-mantix.sh` y luego `npm run trk:setup` → debe listar `✅ 006_borradores.sql`. Verificar:
   ```sql
   SHOW CREATE TABLE trk_borradores;
   SELECT nombre FROM trk_migraciones ORDER BY nombre DESC LIMIT 1;  -- 006_borradores.sql
   ```
2. Frontend: fusionar `feature/trk-matriz` en `main` de `ebor94/TRIKIPELUDOS`, `npm ci && npm run build` y `rsync` de `dist/` (igual que §3).
3. Orden: **backend primero** (la nueva interfaz llama a `TRK-CAL-004/005/006`; la anterior sigue funcionando con el backend nuevo porque `TRK-CAL-002` no cambió).
4. Si algún celular de jurado tiene calificaciones v2 pendientes en su cola local, al abrir la versión nueva se guardan como borrador de esa fila y el jurado las confirma con "Enviar calificación final".
````

En `FRONT:docs/ensayo-general.md`, reemplazar las filas 5, 5b y 6 por:

```markdown
| 5 | Un jurado anota en la matriz en modo avión y luego se reconecta | Fila "Sin conexión" y luego "Guardado"; tras recargar conserva los valores | ☐ |
| 5b | Con varias mascotas desfiladas, el jurado ajusta puntajes y revisa "Puesto tentativo" (empates con "=") a 360 px | Tabla con columna de nombre fija y scroll horizontal solo dentro de la tabla; casillas cómodas | ☐ |
| 5c | El jurado envía "Calificación final (N)" de la categoría; luego desfila otra mascota de la misma categoría | Confirmación con ranking tentativo; filas ✓ bloqueadas; el botón vuelve a habilitarse para la nueva (N = 1) | ☐ |
| 6 | Un jurado intenta corregir una fila ✓; admin desbloquea; el jurado la corrige en la matriz y reenvía con el botón final | Fila editable tras el desbloqueo; auditoría DESBLOQUEAR y REENVIAR (TRK-CAL-006) | ☐ |
```

- [ ] **Step 5: Commit (FRONT)**

```bash
cd "/Users/Shared/Files From c.localized/apps/mantix/peludos"
git add docs/specs/trikipeludos-spec.md docs/specs/decisiones.md docs/despliegue.md docs/ensayo-general.md
git commit -m "docs(trk): v2.1 matriz del jurado en spec, decisiones, despliegue y ensayo general

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Cierre** — reportar al usuario: ramas `feature/trk-matriz` en BACK (3 commits) y FRONT (4 commits) sin push, resultado de las suites, y los pasos de la sección 6 de `docs/despliegue.md` pendientes de ejecutar en el servidor.
