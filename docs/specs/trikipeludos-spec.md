# SPEC — TRIKIPELUDOS: Plataforma de evaluación de concurso de disfraces de mascotas

> Documento fuente para desarrollo guiado por especificación (Spec-Driven Development).
> Destino: `docs/specs/trikipeludos-spec.md` dentro del repositorio del proyecto.
> Organización: Serfunorte Los Olivos — Coordinación TIC.
> Estado: **v2 — diseño aprobado en brainstorming (2026-10-19). Stack y desviaciones en `docs/specs/decisiones.md`.**

---

## 1. Contexto y objetivo

TRIKIPELUDOS es un concurso de disfraces de mascotas organizado por Serfunorte Los Olivos. Los participantes se inscribieron por un formulario (Google Sheets, hoja `TRIKIPELUDOS`). El día del evento:

1. Cada participante pasa por una **cabina de recepción**, donde se le toma la foto oficial a la mascota ya disfrazada.
2. Un **comentarista** presenta en tarima a cada mascota con su dueño.
3. Un panel de **jurados** califica cada mascota según los criterios de su categoría.
4. El sistema calcula y publica el **ranking** por categoría.

**Objetivo:** construir una aplicación web responsive (prioridad móvil/tablet) que soporte ese flujo de punta a punta, en tiempo real, durante un evento presencial de unas pocas horas.

### 1.1 Fuera de alcance (v1)
- Pagos, inscripción pública nueva, votación del público, transmisión de video.
- Integración bidireccional con Google Sheets (solo importación).

---

## 2. Roles

| Rol | Dispositivo típico | Qué hace |
|---|---|---|
| **Administrador** | Portátil | Importa participantes, configura jurados, corrige datos, desbloquea calificaciones, cierra categorías, publica ganadores. |
| **Cabina (recepción)** | Celular/tablet con cámara | Busca al participante, confirma asistencia, toma la foto oficial con disfraz, registra/edita nombre del disfraz. |
| **Comentarista** | Tablet | Ve la ficha de presentación, controla el orden de salida y marca qué mascota está "en pasarela". |
| **Jurado** (N, configurable; esperado 3) | Celular | Ve la mascota en pasarela (o la elige de la galería), califica cada criterio y envía. |
| **Pantalla pública** | TV/proyector | Muestra la mascota en pasarela y, cuando el admin lo habilite, el ranking. Solo lectura, sin login. |

### 2.1 Identidad y acceso (sobre usuarios y roles de Mantix)
- Todos los actores son filas de la tabla `usuarios` de Mantix, con su rol en `roles`. No existe tabla propia de usuarios.
- Permisos en `roles.permisos.trk` (JSON), verificados con el middleware existente `requirePermiso('trk', '<acción>')`; `es_super_admin` pasa siempre.

| Rol | Cómo se obtiene | `permisos.trk` | Cómo entra |
|---|---|---|---|
| Administrador | Roles admin existentes de Mantix (se les agrega `trk` con `JSON_MERGE_PATCH`) | `administrar, importar, editar, calificaciones_desbloquear, publicar, exportar, pasarela, cabina` | Login normal de Mantix (`POST /api/auth/login`, LDAP/local) y su JWT |
| Cabina | Rol nuevo `TRK_CABINA`, un usuario compartido | `cabina` | PIN |
| Comentarista | Rol nuevo `TRK_COMENTARISTA`, un usuario compartido | `pasarela` | PIN |
| Jurado | Rol nuevo `TRK_JURADO`, un usuario por jurado | `calificar` | PIN |

- Usuarios operativos: correo sintético (`jurado1@trikipeludos.local`) y contraseña aleatoria inutilizable; no pueden entrar por el login de Mantix.
- El PIN y la versión de token viven en `trk_accesos`. El token de PIN se firma con `TRK_JWT_SECRET`, lleva `{ id, scope: 'trk', tv }` y **solo es válido en `/api/trk/v1`**.
- Jurados esperados: **3, y todos califican todas las categorías** (§14.1).

---

## 3. Modelo de evaluación

### 3.1 Categorías — v2, aprobada por la organización (2026-10-23)
Son **datos** en `trk_categorias` (semilla 003 + migración 008), no constantes de código.

| Orden | Código | Nombre | Tipo de rúbrica |
|---|---|---|---|
| 1 | `PEQUENOS` | Caninos pequeños | Individual |
| 2 | `MEDIANOS` | Caninos medianos | Individual |
| 3 | `GRANDES` | Caninos grandes | Individual |
| 4 | `FELINOS` | Felinos | Individual |
| 5 | `FAMILIAR` | Disfraz familiar (mascota + acompañante/s) | Familiar |

> v1 tenía `PEQ_MED` (Caninos pequeños y medianos). La migración 008 la **renombra en sitio** a `PEQUENOS` (mismo id: conserva participantes y calificaciones) y crea `MEDIANOS`; los medianos se reubican reimportando el CSV (§7.1).

### 3.2 Rúbrica (INDIVIDUAL y FAMILIAR, total 100) — v2, confirmada por la organización (2026-10-23)
Ambas rúbricas tienen los mismos criterios (migración `007_rubrica_v2.sql`; reemplaza la v1 de 4 y 5 criterios).

| Criterio | Qué se valora | Máx |
|---|---|---|
| Creatividad | Creatividad, elaboración y originalidad del disfraz | 50 |
| Bienestar | Seguridad, comodidad y bienestar de la mascota; un disfraz que le permita movilidad | 30 |
| Pasarela | Participación, vínculo con el público y desarrollo de la pasarela de la mascota y su tutor o la familia | 20 |

### 3.3 (Retirada en v2) Rúbrica FAMILIAR propia
La categoría familiar usa la misma tabla de §3.2. La 007 borró las calificaciones, borradores y rankings publicados hechos con la rúbrica anterior; el evento aún no había comenzado.

> Las rúbricas son **datos**, no código: viven en tablas (`rubricas`, `criterios`) y se cargan por seed. Cambiar un puntaje máximo no debe requerir desplegar.

### 3.4 Reglas de cálculo
- **R1.** Cada jurado asigna a cada criterio un entero entre 0 y el máximo del criterio. El control de UI es un deslizador + botones ± con el máximo visible.
- **R2.** Puntaje de un jurado = suma de sus criterios (0–100).
- **R3.** **Puntaje final** de la mascota = **promedio** de los puntajes de los jurados que la calificaron, redondeado a 2 decimales. (Promedio, no suma, para que una calificación faltante no hunda a un participante.)
- **R4.** Una mascota entra al ranking solo si tiene calificación **enviada** de **todos** los jurados activos (usuarios con rol `TRK_JURADO` y `activo = 1`); si no, aparece como "Incompleta" con el número de calificaciones recibidas y queda fuera de los puestos premiados.
- **R5. Desempate** (en orden): mayor promedio en *Creatividad* → mayor promedio en *Bienestar* (prioriza el bienestar animal) → decisión manual del admin (campo `desempate_manual`, menor valor = mejor puesto). El orden de criterios para desempatar sale de `trk_criterios.peso_desempate` (dato, no código).
- **R6.** El ranking se calcula **por categoría**. Se destacan los primeros `trk_categorias.puestos_premiados` (3 por defecto, configurable por el admin; §14.3). Un empate no resuelto se marca "empate sin resolver" cuando afecta un puesto premiado o el borde (puesto N contra N+1).
- **R7.** Una vez enviada, la calificación de un jurado queda **bloqueada**. Solo el admin puede desbloquearla (queda registro en auditoría).
- **R8.** Un jurado no ve las calificaciones de otros jurados ni el ranking hasta que el admin lo publique.

---

## 4. Ciclo de vida del participante

```
INSCRITO ──(cabina confirma + foto)──> PRESENTE ──(comentarista)──> EN_PASARELA ──(sale)──> PRESENTADO
    │                                                                                   │
    └──(no llega)──> AUSENTE                                    (todos los jurados) ──> EVALUADO
```

- `EVALUADO` es un estado **derivado** (tiene calificación enviada de todos los jurados activos); no se guarda en `estado`.
- Un participante fusionado en otro (`fusionado_en_id` no nulo) no aparece en ninguna lista ni en el ranking.
- Solo mascotas `PRESENTE` o posteriores aparecen para comentarista y jurados.
- Solo **una** mascota puede estar `EN_PASARELA` a la vez (global).
- Los jurados pueden calificar desde que la mascota está `EN_PASARELA` hasta que el admin cierre la categoría.

---

## 5. Historias de usuario y criterios de aceptación

Formato: **HU-n** — historia. *CA* = criterios de aceptación verificables (base para pruebas).

### Administración
**HU-1 — Importar participantes.** Como admin, quiero cargar el CSV exportado de la hoja `TRIKIPELUDOS` para tener la lista de participantes.
- CA1: Acepta CSV con los encabezados de la hoja (ver §7). El orden de columnas no importa; se mapea por nombre normalizado (sin tildes, minúsculas, sin espacios dobles).
- CA2: Muestra una **vista previa** con advertencias antes de confirmar (ver §7.2). Nada se guarda hasta confirmar. La vista previa devuelve un `preview_token` (SHA-256 del archivo; vigente 30 min en memoria del proceso). `confirm` recibe el token y las decisiones del admin (fila a conservar en duplicados, aceptar o no la categoría sugerida, filas a omitir) y persiste todo en una sola transacción.
- CA3: Reimportar no duplica: la clave natural es `responsable_documento + mascota_nombre_norm` (único en BD). Las filas existentes se actualizan solo en campos vacíos; nunca sobrescribe la foto oficial ni calificaciones.
- CA3b: Una mascota compite en **una sola categoría**. Si el CSV trae la misma clave natural en varias filas (ej. GRANDES y FAMILIAR), la vista previa las agrupa y el admin elige cuál conservar (por defecto la primera); el resto no se importa.
- CA4: Si la fila trae enlace de Google Drive en "FOTOGRAFÍA PARTICIPANTE", se guarda como `foto_inscripcion_url` (referencia, no se descarga en v1).

**HU-2 — Gestionar jurados y accesos.** Como admin, quiero crear jurados y generar PIN de acceso para cada rol.
- CA1: Cada jurado es un usuario de Mantix con rol `TRK_JURADO`, nombre, PIN de 6 dígitos (en `trk_accesos`) y estado activo/inactivo (`usuarios.activo`). El admin lo gestiona desde TRIKIPELUDOS sin entrar a Mantix.
- CA2: Cabina y comentarista tienen PIN compartido por rol (un usuario por rol).
- CA3: Cambiar un PIN incrementa `token_version` e invalida las sesiones existentes de ese usuario.
- CA4: El PIN se muestra una sola vez al generarlo; solo se guarda su hash bcrypt.

**HU-3 — Corregir datos.** Como admin, quiero editar cualquier participante (incluida la categoría) y fusionar duplicados.
- CA1: Cambiar la categoría de una mascota con calificaciones exige confirmación y **borra** sus calificaciones (con auditoría), porque la rúbrica cambia.
- CA2: Fusionar origen → destino conserva la foto oficial más reciente y todas las calificaciones del destino; las calificaciones del origen pasan al destino. Si **el mismo jurado calificó a ambos**, la fusión se rechaza (409 `FUSION_CON_CHOQUE`) hasta que el admin resuelva el choque. El origen no se borra: queda con `fusionado_en_id` y sale de todas las listas. Todo queda en auditoría.

**HU-4 — Control del evento.** Como admin, quiero abrir/cerrar categorías, desbloquear calificaciones y publicar el ranking.
- CA1: Categoría cerrada = los jurados ya no pueden calificar en ella.
- CA2: "Publicar ranking" de una categoría lo hace visible en la pantalla pública y para el comentarista.
- CA3: Exportar resultados a Excel con detalle por jurado y criterio.
- CA4: Cerrar y publicar son acciones separadas **por categoría**; el admin decide cuándo publicar cada una (§14.2). Publicar guarda un snapshot que no cambia aunque luego se desbloquee una calificación.
- CA5: El admin configura `puestos_premiados` por categoría (3 por defecto).
- CA6: El admin cambia el modo de la pantalla pública (Pasarela / Ranking de una categoría publicada).

### Cabina
**HU-5 — Registrar llegada y foto.** Como recepcionista, quiero buscar al participante y tomarle la foto con el disfraz.
- CA1: Búsqueda por nombre de mascota, nombre del responsable o últimos dígitos del documento, tolerante a tildes y mayúsculas.
- CA2: El botón "Tomar foto" abre la cámara trasera del dispositivo (`<input type="file" accept="image/*" capture="environment">`) con opción de elegir de galería.
- CA3: La imagen se recorta a 4:5, se comprime en el cliente (lado mayor ≤ 1600 px, JPEG ~0.8, objetivo < 500 KB) y se sube. Muestra progreso y permite repetir.
- CA4: Al guardar la foto, el estado pasa a `PRESENTE`. Se puede editar el nombre del disfraz y la categoría. Si la mascota **no** tiene calificaciones, el cambio de categoría se aplica directo; si las tiene, queda en `categoria_propuesta_id` y el admin la confirma (HU-3 CA1).
- CA5: Si la mascota no tiene foto oficial, en todas las vistas se muestra: foto de inscripción si existe → si no, avatar genérico por especie (perro/gato/familia).
- CA6: Botón "Agregar participante" para inscripciones de último minuto (datos mínimos: responsable, teléfono, mascota, especie, categoría).

### Comentarista
**HU-6 — Ficha de presentación.** Como comentarista, quiero ver una ficha grande y legible para presentar a la mascota.
- CA1: Muestra foto oficial, nombre de la mascota, nombre del disfraz, raza, edad, sexo, categoría y **solo el primer nombre** del responsable. No muestra documento, teléfono ni correo.
- CA2: Navegación anterior/siguiente dentro de la cola de la categoría actual.

**HU-7 — Controlar la pasarela.** Como comentarista, quiero marcar quién sale a pasarela para que jurados y pantalla se sincronicen.
- CA1: "Llamar a pasarela" pone la mascota en `EN_PASARELA` y la anterior pasa a `PRESENTADO`.
- CA2: En < 2 s, los jurados y la pantalla pública ven la mascota nueva sin recargar.
- CA3: La cola se ordena por categoría y luego por hora de llegada a cabina; el comentarista puede reordenar arrastrando.

### Jurado
**HU-8 — Calificar.** Como jurado, quiero calificar a la mascota en pasarela rápidamente desde mi celular.
> **Reemplazada por HU-8b (v2.1, §15).** CA1–CA5 describen el flujo original mascota por mascota; siguen vigentes CA6 (el total lo calcula el servidor), la idempotencia de CA5 para `TRK-CAL-002` y el bloqueo R7 de las calificaciones finales.
- CA1: Al entrar, ve por defecto la mascota `EN_PASARELA`. También puede abrir una galería de mascotas presentes con insignia "Calificada / Pendiente" para él.
- CA2: La pantalla de calificación muestra la foto oficial, datos de la mascota (mismos campos que HU-6) y los criterios de la rúbrica de **su** categoría con su máximo y descripción.
- CA3: Muestra el total en vivo (x / 100) mientras se ajusta.
- CA4: "Enviar" pide confirmación y bloquea la calificación (R7). No se puede enviar con criterios sin tocar (cada criterio debe tener un valor explícito, aunque sea 0).
- CA5: Si se pierde la conexión, la calificación se guarda en el dispositivo (IndexedDB) y se reintenta automáticamente (al volver `online` y cada 10 s); el jurado ve un indicador "pendiente de sincronizar". El servidor es idempotente (clave `jurado_id + participante_id`): un reenvío **idéntico** de una calificación ya enviada responde 200 con la existente sin escribir; uno **distinto** responde 409 `CALIFICACION_BLOQUEADA`. Un 409/422 saca la calificación de la cola y muestra el motivo.
- CA6: El total lo calcula siempre el servidor; se ignora cualquier total enviado por el cliente.

### Pantalla pública y ranking
**HU-9 — Pantalla pública.** Como asistente, quiero ver en la pantalla grande quién está en pasarela y luego los ganadores.
- CA1: Modo "Pasarela": foto grande + nombre de la mascota + disfraz + categoría.
- CA2: Modo "Ranking": por categoría publicada, podio de los 3 primeros con foto y puntaje, luego la tabla completa.
- CA3: Se actualiza en tiempo real; no requiere login.

**HU-10 — Ranking.** Como admin, quiero ver el ranking en vivo de cada categoría aunque no esté publicado.
- CA1: Aplica R3–R6. Muestra puntaje final, promedio por criterio, número de jurados que calificaron y estado (completa/incompleta).
- CA2: Señala empates no resueltos para que el admin aplique `desempate_manual`.

---

## 6. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-1 | **Responsive / mobile-first.** Usable con una mano en un celular de 360 px de ancho. Áreas táctiles ≥ 44 px. |
| RNF-2 | **Tiempo real** vía WebSockets (Socket.IO) para cambio de pasarela, nuevas fotos, calificaciones recibidas y publicación de ranking. Con polling de respaldo si el socket cae. |
| RNF-3 | **Capacidad:** ~150 participantes, ~10 dispositivos conectados simultáneamente. |
| RNF-4 | **Red del evento:** asumir Wi-Fi inestable. Fotos comprimidas en cliente, cola offline para calificaciones (HU-8 CA5). |
| RNF-5 | **Datos personales (Ley 1581/2012):** documento, teléfono y correo solo visibles para admin y cabina. El filtrado se hace en el backend con una única función `serializarPorRol` (lista blanca), usada tanto en REST como en eventos de socket. Las URLs de fotos no son adivinables (UUID) y Sharp elimina EXIF/GPS. |
| RNF-6 | **Auditoría:** toda creación/edición/desbloqueo de calificación y cambio de categoría queda en `auditoria` (quién, qué, antes, después, cuándo). |
| RNF-7 | **Respaldo:** script de exportación completa (`mysqldump` de las tablas y vistas `trk_*` de `serfuweb` + fotos) ejecutable al cierre del evento. |
| RNF-10 | **Exposición:** la app se publica en internet por HTTPS (§14.4) detrás del Nginx de la API de Mantix; los jurados pueden entrar con datos móviles. |
| RNF-8 | **Branding:** paleta Halloween/otoñal coherente con la pieza gráfica del evento (naranja calabaza, morado, crema); logo de Los Olivos configurable. |
| RNF-9 | **Accesibilidad básica:** contraste AA, textos de la ficha del comentarista ≥ 24 px. |

---

## 7. Importación de datos

### 7.1 Mapeo de columnas (hoja `TRIKIPELUDOS`)
| Encabezado en la hoja | Campo |
|---|---|
| Nombre del responsable | `responsable_nombre` |
| Documento de identidad | `responsable_documento` (solo dígitos; quitar puntos y espacios) |
| Telefono | `responsable_telefono` |
| Correo electrónico | `responsable_correo` |
| Nombre de la mascota | `mascota_nombre` |
| especie | `especie` (normalizar a `PERRO` / `GATO`) |
| raza | `raza` |
| edad de la mascota | `edad_texto` (texto libre: "3", "1 año y 4 meses", "10 MESES") |
| sexo | `sexo` (`MACHO` / `HEMBRA`) |
| Cateogoría de participación (sic) | `categoria_codigo` (ver mapeo abajo) |
| autorizacion de datos | `autoriza_datos` (`on` → true) |
| Autorizacion de reglamento | `autoriza_reglamento` |
| Fecha inscripción | `fecha_inscripcion` (formato "octubre 5, 2026") |
| NOMBRE DEL DISFRAZ | `disfraz_nombre` |
| FOTOGRAFÍA PARTICIPANTE | `foto_inscripcion_url` |
| (columnas sin encabezado con notas) | `notas_importacion` |

Mapeo de categoría (v2, `mapearCategoria` en el backend): texto con "pequeño(s)" (`Perros pequeños.`) → `PEQUENOS`; con "mediano(s)" (`Perros medianos.`) → `MEDIANOS`; `Perros grandes.` → `GRANDES`; `Gaticos.` → `FELINOS`; `Disfraz familiar: mascota y acompañante/s.` → `FAMILIAR`.

- Texto antiguo combinado `Perros pequeños y medianos.` → `PEQUENOS` con advertencia `CATEGORIA_COMBINADA` ("Categoría antigua 'pequeños y medianos': revisa si es mediano", sugerencia `MEDIANOS`) visible en la vista previa. No aplica a gatos (ya reciben la sugerencia `FELINOS`).
- **Reimportación y categoría.** Si la mascota ya existe y la categoría final de la fila (la decidida en la vista previa o la del CSV) es otra: si no tiene calificaciones, no está `EN_PASARELA`/`PRESENTADO` y no está fusionada, nadie cambió su categoría a mano (auditoría `CAMBIAR_CATEGORIA`/`PROPONER_CATEGORIA` fuera de `TRK-IMP-002`) y la categoría destino está abierta y sin ranking publicado, se **mueve** directamente (`orden_pasarela` al final de la nueva categoría si tenía orden, `desempate_manual` a NULL; auditoría `CAMBIAR_CATEGORIA`); si no, queda como **propuesta** (`categoria_propuesta_id`, auditoría `PROPONER_CATEGORIA`) para confirmarla en Admin → Participantes (`TRK-PAR-007`, que avisa del borrado de calificaciones). Los registros fusionados no cambian. Una fila con el texto combinado sin categoría decidida en la vista previa no toca la categoría. Si la hoja coincide con la categoría actual y había una propuesta pendiente, se descarta (`DESCARTAR_PROPUESTA_CATEGORIA`). `TRK-PAR-007` responde 409 `CATEGORIA_CERRADA` si el destino está cerrado (abrirlo primero). La respuesta de `TRK-IMP-002` incluye `recategorizados` y `propuestas`. Foto oficial y estado nunca se sobrescriben.

### 7.2 Validaciones obligatorias en la vista previa
Detectadas en los datos reales de la hoja; el importador debe marcarlas como **advertencia** (no bloquean) para que el admin decida:

| Caso | Ejemplo real en la hoja | Acción sugerida |
|---|---|---|
| Especie incoherente con categoría | Perro (Pinscher, Doberman, Pit bull…) inscrito en `Gaticos.`; gato inscrito en "Perros pequeños" | Sugerir categoría por especie; admin confirma |
| Especie con texto extra | `Perro(cupo lleno)` | Normalizar a `PERRO` y guardar el texto en `notas_importacion` |
| Mascota registrada dos veces en distintas categorías | Misma mascota en `PERROS GRANDES` y `FAMILIAR`; gato registrado en dos categorías | Agrupar como posible duplicado |
| Una fila con varias mascotas | "Trompis y princesa. Dos perritas", "Valentino y Paris" | Marcar para dividir manualmente |
| Raza pequeña en "Perros grandes" | Pinscher, Yorkie, Mini pinscher en `Perros grandes.` | Advertencia de posible error de categoría |
| Documento con formato | `88.251.117` | Normalizar a dígitos |
| Teléfono inválido | Menos o más de 10 dígitos (`302268158`) | Advertencia |
| Notas en columnas sueltas | "confirmar si es uno o dos y categoría", "validar en cual categoría ira" | Mostrar como nota visible en el registro |

> La especificación **no** codifica las filas concretas; se dan como ejemplos para escribir pruebas del importador con fixtures anonimizados.

---

## 8. Modelo de datos (lógico)

### 8.0 Convención de nombres (obligatoria)

TRIKIPELUDOS es un módulo de `mantix-backend` y vive en la base **`serfuweb`**, que comparte con Mantix, afiliaciones, SerVentas, R-44, etc. Todo objeto propio debe identificarse a simple vista:

| Objeto | Convención | Ejemplo |
|---|---|---|
| Base de datos | `serfuweb` (existente; conexión `DB_*` de Mantix) | `serfuweb` |
| Tablas | prefijo `trk_` + sustantivo en plural, snake_case | `trk_participantes` |
| Vistas | prefijo `trk_vw_` | `trk_vw_calificacion_totales` |
| Procedimientos / funciones | prefijo `trk_sp_` / `trk_fn_` | `trk_sp_publicar_ranking` |
| Índices | `idx_trk_<tabla>_<columnas>` | `idx_trk_participantes_estado` |
| Únicos | `uq_trk_<tabla>_<columnas>` | `uq_trk_calificaciones_part_jur` |
| Llaves foráneas | `fk_trk_<tabla>_<referida>` | `fk_trk_calificaciones_usuarios` |
| Migraciones | `src/trk/migrations/NNN_<nombre>.sql`, registradas en `trk_migraciones` | `001_esquema.sql` |

Las únicas tablas sin prefijo que TRIKIPELUDOS usa son las compartidas de Mantix: `usuarios` y `roles` (§2.1). TRIKIPELUDOS solo **inserta** filas en ellas (roles `TRK_*`, usuarios operativos) y agrega la clave `trk` a `roles.permisos`; nunca altera su esquema.

En Sequelize, los modelos pueden llamarse sin prefijo (`Participante`), pero **siempre** con `tableName` explícito (`trk_participantes`) y `freezeTableName: true`, registrados en la instancia central `src/models/index.js`. El esquema lo crean **solo** las migraciones (el `sync()` de Mantix no debe crear tablas TRK: las migraciones corren antes del despliegue).

### 8.1 Tablas

```
trk_categorias(id, codigo, nombre, rubrica_id, abierta bool, ranking_publicado bool, orden,
               puestos_premiados tinyint default 3)
trk_rubricas(id, codigo['INDIVIDUAL'|'FAMILIAR'], nombre)
trk_criterios(id, rubrica_id, codigo, nombre, descripcion, puntaje_max, orden, peso_desempate null)
  -- peso_desempate: 1 = primer criterio de desempate (Creatividad), 2 = segundo (Seguridad), null = no desempata

trk_participantes(
  id uuid, categoria_id, categoria_propuesta_id null,
  responsable_nombre, responsable_documento null, responsable_telefono, responsable_correo,
  mascota_nombre, mascota_nombre_norm, especie, raza, edad_texto, sexo,
  disfraz_nombre, foto_inscripcion_url, foto_oficial_path, foto_oficial_at,
  estado['INSCRITO'|'PRESENTE'|'EN_PASARELA'|'PRESENTADO'|'AUSENTE'],
  orden_pasarela, llegada_at, desempate_manual int null,
  autoriza_datos, autoriza_reglamento, fecha_inscripcion,
  notas_importacion, advertencias_importacion json,
  fusionado_en_id uuid null,            -- FK a trk_participantes(id)
  origen['IMPORTACION'|'CABINA'], created_at, updated_at,
  UNIQUE uq_trk_participantes_doc_mascota(responsable_documento, mascota_nombre_norm)
)

trk_accesos(usuario_id PK, pin_hash, token_version int default 0, created_at, updated_at)
  -- fk_trk_accesos_usuarios → usuarios(id). Solo usuarios operativos (cabina, comentarista, jurados).

trk_calificaciones(
  id, participante_id, jurado_id, total, enviada_at, bloqueada bool, desbloqueada_at null,
  created_at, updated_at,
  UNIQUE uq_trk_calificaciones_part_jur(participante_id, jurado_id)
)  -- jurado_id → usuarios(id) (fk_trk_calificaciones_usuarios)
trk_calificacion_detalle(id, calificacion_id, criterio_id, puntaje)
  -- 0 <= puntaje <= trk_criterios.puntaje_max, validado en el servicio
  -- UNIQUE uq_trk_calificacion_detalle_cal_crit(calificacion_id, criterio_id)
trk_borradores(id, participante_id, jurado_id, criterio_id, puntaje null, updated_at,
  UNIQUE uq_trk_borradores_part_jur_crit(participante_id, jurado_id, criterio_id)
)  -- v2.1 (HU-8b): puntajes tentativos privados del jurado; no cuentan en ranking ni tablero; no se auditan

trk_auditoria(id, usuario_id, api_codigo, entidad, entidad_id, accion, antes json, despues json, ip, created_at)
  -- usuario_id → usuarios(id)
trk_evento_estado(id=1, participante_en_pasarela_id, modo_pantalla['PASARELA'|'RANKING'], categoria_pantalla_id)
trk_ranking_snapshots(id, categoria_id, publicado_por, publicado_at, datos json)
trk_importaciones(id, usuario_id, archivo_nombre, archivo_sha256, filas_total, filas_ok, filas_advertencia, created_at)
trk_migraciones(nombre PK, aplicada_at)

trk_vw_calificacion_totales  -- vista: participante × jurado con total y puntaje por criterio (exportación y consultas)
```

El ranking (R3–R6) lo calcula un **servicio JS puro** (`rankingService.calcular`) a partir de las filas planas de `trk_calificaciones` + `trk_calificacion_detalle`; la vista `trk_vw_calificacion_totales` alimenta la exportación. Al publicar una categoría se guarda una copia en `trk_ranking_snapshots`, para que el resultado publicado no cambie si alguien desbloquea una calificación después.

---

## 9. API

### 9.0 Convención de códigos

- Todo endpoint vive bajo **`/api/trk/v1/`** y tiene un código **`TRK-<MÓDULO>-<NNN>`**: módulo de 3–4 letras de la tabla de abajo y correlativo de 3 dígitos dentro del módulo. Un código no se reutiliza nunca, aunque el endpoint se elimine.
- Módulos: `AUTH` (sesión), `USR` (usuarios y PIN), `IMP` (importación), `PAR` (participantes), `PAS` (pasarela), `EVT` (estado del evento y pantalla), `RUB` (rúbricas), `CAL` (calificaciones), `CAT` (categorías), `RNK` (ranking), `EXP` (exportación).
- El código aparece en:
  1. el encabezado **`X-TRK-API`** de toda respuesta, también en errores;
  2. el cuerpo de error: `{ success: false, error: 'TRK-CAL-002', motivo: 'CALIFICACION_BLOQUEADA', message }`;
  3. cada línea de log del request (`api_codigo`);
  4. `trk_auditoria.api_codigo`.
- El registro vive en `src/trk/config/apiCodigos.js` (espejo de §9.1). Una prueba recorre el router TRK y falla si alguna ruta no tiene código o tiene uno ausente del registro. **Un endpoint nuevo no se acepta sin código en §9.1.**
- Respuestas exitosas: `{ success: true, data }` (patrón de Mantix/SerVentas).

**Motivos de error:**

| HTTP | `motivo` | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | Validación Joi (con `errors[]` por campo) |
| 401 | `NO_AUTENTICADO` | Sin token, token inválido o `token_version` vieja |
| 403 | `SIN_PERMISO` | `requirePermiso('trk', …)` falla |
| 404 | `NO_ENCONTRADO` | — |
| 409 | `CALIFICACION_BLOQUEADA`, `CATEGORIA_CERRADA`, `FUSION_CON_CHOQUE`, `CONFIRMACION_REQUERIDA`, `PREVIEW_VENCIDO`, `DUPLICADO`, `ESTADO_INVALIDO`, `CATEGORIAS_DISTINTAS`, `EMPATE_SIN_RESOLVER`, `RANKING_NO_PUBLICADO`, `NO_BLOQUEADA`, `SIN_PENDIENTES` | Reglas de estado |
| 422 | `PUNTAJE_FUERA_DE_RANGO`, `CRITERIO_FALTANTE`, `CALIFICACION_INCOMPLETA` | R1, HU-8 CA4, HU-8b CA6 |
| 429 | `DEMASIADOS_INTENTOS` | Limitador del login con PIN |

### 9.1 Registro de endpoints

Prefijo `/api/trk/v1`. Permiso = clave en `roles.permisos.trk` (`requirePermiso`).

| Código | Método | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| TRK-AUTH-001 | POST | `/auth/pin` | público (limitado 5/min por IP+usuario) | `{ usuario_id, pin }` → JWT de PIN |
| TRK-AUTH-002 | GET | `/auth/usuarios-pin` | público | Lista nombre e id de usuarios activos con rol TRK (selector de `/login`) |
| TRK-AUTH-003 | GET | `/auth/yo` | cualquier sesión TRK | Usuario, rol y permisos `trk` (sirve para admin con token de Mantix) |
| TRK-USR-001 | GET | `/usuarios` | `administrar` | Usuarios operativos y su estado |
| TRK-USR-002 | POST | `/usuarios` | `administrar` | Crea usuario operativo (rol TRK) y devuelve su PIN una vez |
| TRK-USR-003 | PATCH | `/usuarios/:id` | `administrar` | Nombre / activo |
| TRK-USR-004 | POST | `/usuarios/:id/pin` | `administrar` | Regenera PIN e incrementa `token_version` |
| TRK-IMP-001 | POST | `/import/preview` | `importar` | Sube CSV → filas normalizadas, advertencias, `preview_token` |
| TRK-IMP-002 | POST | `/import/confirm` | `importar` | Persiste con las decisiones del admin |
| TRK-PAR-001 | GET | `/participantes?categoria=&estado=&q=` | cualquier sesión TRK (campos por rol) | Listado |
| TRK-PAR-002 | GET | `/participantes/:id` | cualquier sesión TRK (campos por rol) | Detalle |
| TRK-PAR-003 | POST | `/participantes` | `cabina` | Alta de último minuto |
| TRK-PAR-004 | PATCH | `/participantes/:id` | `cabina` (campos limitados) / `editar` | Edición |
| TRK-PAR-005 | POST | `/participantes/:id/foto` | `cabina` | Foto oficial (multipart) → `PRESENTE` |
| TRK-PAR-006 | POST | `/participantes/:id/fusionar` | `editar` | Fusiona `:id` (origen) en `destino_id` |
| TRK-PAR-007 | POST | `/participantes/:id/categoria/confirmar` | `editar` | Aplica categoría propuesta; borra calificaciones con auditoría |
| TRK-PAR-008 | PATCH | `/participantes/:id/estado` | `cabina` | Marca / desmarca `AUSENTE` |
| TRK-PAS-001 | POST | `/pasarela/:id` | `pasarela` | Pone en pasarela |
| TRK-PAS-002 | PUT | `/pasarela/orden` | `pasarela` | Reordena la cola |
| TRK-PAS-003 | POST | `/pasarela/terminar` | `pasarela` | Termina la pasarela: la mascota en pasarela queda PRESENTADO, nadie en pasarela y la pantalla vuelve a la portada (idempotente, auditado) |
| TRK-EVT-001 | GET | `/evento/estado` | público | En pasarela (campos públicos) + modo de pantalla; base del polling de respaldo |
| TRK-EVT-002 | PUT | `/evento/pantalla` | `administrar` | Modo y categoría de la pantalla pública |
| TRK-EVT-003 | GET | `/evento/tablero` | `administrar` | Contadores por estado/categoría y progreso por jurado |
| TRK-RUB-001 | GET | `/rubricas/:categoriaId` | `calificar` / `administrar` | Criterios de la categoría |
| TRK-CAL-001 | GET | `/calificaciones/mias` | `calificar` | Insignias Calificada / Pendiente del jurado |
| TRK-CAL-002 | PUT | `/calificaciones/:participanteId` | `calificar` | Crea/envía calificación (idempotente) |
| TRK-CAL-003 | POST | `/calificaciones/:id/desbloquear` | `calificaciones_desbloquear` | Desbloquea (auditado) |
| TRK-CAL-004 | GET | `/jurado/matriz?categoria=` | `calificar` | Matriz del jurado: criterios y filas (en pasarela + ya desfilaron) con borrador y estado final (v2.1) |
| TRK-CAL-005 | PUT | `/borradores/:participanteId` | `calificar` | Guarda puntajes tentativos parciales del jurado (v2.1) |
| TRK-CAL-006 | POST | `/calificaciones/finalizar` | `calificar` | Envío final de una categoría: borradores completos → calificaciones bloqueadas, todo o nada (v2.1) |
| TRK-CAT-001 | POST | `/categorias/:id/abrir` | `administrar` | Abre la categoría |
| TRK-CAT-002 | POST | `/categorias/:id/cerrar` | `administrar` | Cierra la categoría |
| TRK-CAT-003 | POST | `/categorias/:id/publicar` | `publicar` | Publica ranking (snapshot) |
| TRK-CAT-004 | PATCH | `/categorias/:id` | `administrar` | `puestos_premiados` |
| TRK-CAT-005 | GET | `/categorias` | cualquier sesión TRK | Lista categorías (estado, rúbrica, puestos premiados) para selectores |
| TRK-RNK-001 | GET | `/ranking/:categoriaId` | `administrar` (en vivo) / público (snapshot publicado) | Ranking |
| TRK-RNK-002 | PUT | `/ranking/:categoriaId/desempate` | `administrar` | Fija `desempate_manual` de los empatados |
| TRK-EXP-001 | GET | `/export/resultados.xlsx` | `exportar` | Exportación con detalle por jurado y criterio |

**Autenticación:** `trkAuth` acepta el JWT de Mantix (admin, vía `resolverUsuarioDesdeToken`) o el JWT de PIN (`TRK_JWT_SECRET`, `scope: 'trk'`, verifica `tv` contra `trk_accesos.token_version`). Ambos cargan `Usuario` + `Rol`. La ruta `/api/trk/` está exenta del limitador global de Mantix (todo el evento comparte IP pública); TRK aplica el suyo.

**Eventos Socket.IO** (namespace `/trk`; rooms `admin`, `cabina`, `comentarista`, `jurado` con token; `pantalla` sin token): `pasarela:cambio`, `participante:actualizado`, `foto:nueva`, `calificacion:recibida` (solo `admin`), `ranking:publicado`, `pantalla:modo`. Toda carga útil con datos de participante pasa por `serializarPorRol` según la room. Si el socket cae, el cliente hace polling de `TRK-EVT-001` cada 3 s.

---

## 10. Pantallas (rutas frontend)

| Ruta | Rol | Contenido |
|---|---|---|
| `/login` | — | Selector de usuario operativo (cabina, comentarista, jurados) + PIN; enlace "Soy administrador" → correo/contraseña de Mantix |
| `/admin/usuarios` | admin | Jurados y accesos: crear, activar/desactivar, regenerar PIN (HU-2) |
| `/admin` | admin | Tablero: contadores por estado y categoría, progreso de calificación por jurado |
| `/admin/importar` | admin | Carga CSV, vista previa con advertencias, confirmar |
| `/admin/participantes` | admin | Tabla filtrable, edición, fusión |
| `/admin/ranking` | admin | Ranking en vivo por categoría, desempates, publicar, exportar |
| `/cabina` | cabina | Buscador + lista; ficha con botón grande "Tomar foto" |
| `/comentarista` | comentarista | Cola por categoría + ficha grande + "Llamar a pasarela" |
| `/jurado` | jurado | Tarjeta "En pasarela" + matriz de calificación tentativa por categoría, total y puesto tentativo, "Enviar calificación final" (HU-8b) |
| `/pantalla` | público | Modo pasarela / ranking (controlado por el admin, HU-4 CA6) |

---

## 11. Stack (confirmado en Fase 0)

Detalle y justificación de cada desviación en **`docs/specs/decisiones.md`**. Resumen:

- **Backend:** módulo `src/trk/` dentro de `mantix-backend` (repo `github.com/ebor94/mantix`), montado en `/api/trk/v1`. Node.js + Express 4 (CommonJS), Sequelize 6 (instancia central) + pool `mysql2` del módulo, Socket.IO (namespace `/trk`, servidor HTTP compartido con Mantix), Multer + Sharp, JWT, Joi, `csv-parse`, `exceljs`, `winston`. Estructura calcada del módulo `sv/`.
- **Frontend:** app aparte en el repo `github.com/ebor94/TRIKIPELUDOS`. Vue 3 + Vite + Pinia + Vue Router + Tailwind 3, `@heroicons/vue`, `vue-toastification`, `axios`, `socket.io-client`, `vuedraggable`, `vite-plugin-pwa` (solo shell). Base `/trikipeludos/`.
- **BD:** MySQL, base existente `serfuweb`, tablas `trk_*`; usuarios y roles de Mantix (§2.1).
- **Archivos:** `TRK_FOTOS_PATH` (por defecto `uploads/trk/fotos`), nombres UUID.
- **Despliegue:** reinicio normal de `mantix-backend` (PM2, una instancia en fork) tras `npm run trk:setup`; Nginx con soporte WebSocket para `/socket.io/`; frontend bajo `/trikipeludos/` por HTTPS público.
- **Pruebas:** backend con **Jest + Supertest** (convención del repo) — unitarias sin BD y de integración contra MySQL 8 en Docker (`serfuweb_test`); frontend con Vitest + @vue/test-utils; E2E con Playwright a 360 px.

> **Regla:** si el repositorio tiene convenciones distintas, prevalecen las del repositorio; toda desviación se documenta en `docs/specs/decisiones.md`.

---

## 12. Plan de entrega (fases)

| Fase | Entregable | Hecho cuando |
|---|---|---|
| 0 | Reconocimiento del repo y ajuste de §11 | `decisiones.md` creado, stack confirmado |
| 1 | Esqueleto del módulo `src/trk/`, migraciones, seed de categorías/rúbricas/criterios y roles `TRK_*`, auth (PIN + token de Mantix), registro de códigos de API, gestión de usuarios (HU-2), esqueleto del frontend | Pruebas de seed, login, invalidación de PIN y registro de códigos pasan |
| 2 | Importador CSV con vista previa y validaciones §7.2 | Pruebas con fixture anonimizado basado en los casos reales |
| 3 | Cabina: búsqueda, alta rápida, captura/compresión/subida de foto | Flujo e2e en móvil emulado |
| 4 | Comentarista + pasarela + Socket.IO + pantalla pública (modo pasarela) | Cambio de pasarela visible en < 2 s en 3 clientes |
| 5 | Jurado: calificación, bloqueo, cola offline | Pruebas de R1, R2, R7 e idempotencia |
| 6 | Ranking, desempates, publicación, exportación Excel | Pruebas de R3–R6 con casos de empate |
| 7 | Endurecimiento: auditoría, respaldo, prueba de carga ligera, despliegue | Ensayo general con dispositivos reales |

---

## 13. Casos de prueba clave (mínimos)

| # | Caso | Nivel |
|---|---|---|
| 1 | Calificación con criterio > máximo → 422 `PUNTAJE_FUERA_DE_RANGO`. | Unitaria + integración |
| 2 | Jurado envía dos veces la misma calificación (reintento offline) → una sola fila, 200, sin error. | Integración |
| 3 | Jurado intenta modificar calificación bloqueada → 409 `CALIFICACION_BLOQUEADA`; tras desbloqueo del admin → permitido y auditado. | Integración |
| 4 | Ranking: A y B empatan en total; A tiene más Creatividad → A primero. | Unitaria |
| 5 | Empate en total, Creatividad y Seguridad → marcado "empate sin resolver"; con `desempate_manual` → resuelto. | Unitaria |
| 6 | Mascota con 2 de 3 jurados → "Incompleta", fuera de los puestos premiados. | Unitaria |
| 7 | Cambio de categoría con calificaciones → exige confirmación (409 `CONFIRMACION_REQUERIDA`), borra calificaciones, deja auditoría. | Integración |
| 8 | Jurado/comentarista/pantalla consultan `/api/trk/v1/participantes/:id` **y** reciben eventos de socket → no contienen documento, teléfono ni correo. | Integración |
| 9 | Importación repetida del mismo CSV → cero duplicados. | Integración |
| 10 | Fila "Perro(cupo lleno)" en "Gaticos." → advertencia de incoherencia especie/categoría y nota guardada. | Unitaria |
| 11 | Toda ruta TRK tiene código registrado en §9.1 y lo devuelve en `X-TRK-API`, también en errores. | Unitaria + integración |
| 12 | Cambiar PIN invalida el token anterior (401). Un token de PIN no sirve en rutas de Mantix fuera de `/api/trk`. | Integración |
| 13 | Fusión con el mismo jurado en ambos registros → 409 `FUSION_CON_CHOQUE`; sin choque → calificaciones movidas y origen oculto. | Integración |
| 14 | Dos llamadas a pasarela seguidas → solo una mascota `EN_PASARELA`, la anterior `PRESENTADO`. | Integración |
| 15 | Puestos premiados = 3 y empate entre 3.º y 4.º → empate sin resolver señalado. | Unitaria |
| 16 | Cambio de pasarela visible en < 2 s en 3 clientes (comentarista, jurado, pantalla) a 360 px. | E2E |

Los fixtures del importador son **anonimizados** (nombres ficticios) y reproducen cada caso de §7.2.

---

## 14. Preguntas abiertas — resueltas (2026-10-19)

1. **Jurados:** 3, y todos califican todas las categorías. El número es configurable (usuarios activos con rol `TRK_JURADO`).
2. **Revelación del ranking:** por categoría, cuando el admin decida. Cerrar y publicar son acciones separadas.
3. **Premios:** podio de 3 **o más**: `trk_categorias.puestos_premiados`, 3 por defecto, configurable por categoría.
4. **Red:** expuesta a internet por HTTPS, detrás del Nginx de la API de Mantix. Los jurados pueden usar datos móviles.
5. **Diplomas:** no en v1.

Decisiones adicionales tomadas en el brainstorming:
- Una mascota compite en una sola categoría (HU-1 CA3b).
- Una fusión con choque de jurado se bloquea (HU-3 CA2).
- Usuarios y roles sobre el modelo de Mantix; PIN solo para roles operativos (§2.1).


---

## 15. Cambio v2.1 — Matriz de calificación del jurado (2026-10-22)

Solicitud del evento: el jurado califica en una matriz tipo tabla, con puntajes **tentativos** que ajusta sobre la marcha, y al final envía la calificación definitiva. Decisiones (aprobadas por el usuario): borradores **en el servidor**; envío final **por categoría**; filas = **quien está en pasarela + las que ya desfilaron**; el ranking oficial usa **solo calificaciones finales**.

**HU-8b — Matriz del jurado.** Como jurado, quiero ver en una tabla a las mascotas de la categoría que está desfilando, anotar puntajes tentativos, ver el total y mi ranking tentativo, ajustarlos mientras avanza el desfile y al final enviar mi calificación definitiva.
- CA1: `/jurado` muestra arriba la tarjeta "En pasarela" (foto oficial, nombre, disfraz, categoría) en tiempo real. La matriz muestra la categoría de quien está en pasarela; un selector permite ver otra categoría.
- CA2: Filas: la mascota `EN_PASARELA` (resaltada, primera) y las `PRESENTADO` de la categoría. No aparecen `INSCRITO`, `PRESENTE` ni `AUSENTE`, ni las fusionadas. Nunca se envían datos del responsable.
- CA3: Columnas: nombre (+ foto miniatura, columna fija), un criterio por columna con su máximo en el encabezado (de la rúbrica sembrada, nunca constantes), **Total** y **Puesto tentativo**. A 360 px la tabla se desplaza horizontalmente.
- CA4: Cada casilla acepta enteros de 0 al máximo del criterio; puede quedar vacía. Total y puesto tentativo se recalculan al escribir. Puesto tentativo: orden por total descendente sobre las filas completas; empates marcados con "=" (las reglas oficiales R3–R6 solo aplican al ranking oficial).
- CA5: Guardado automático por fila (`TRK-CAL-005`), con indicador Guardado / Guardando… / Sin conexión. Sin red, el último borrador de cada fila espera en el dispositivo y se reenvía al volver (última escritura gana). El borrador se puede cambiar cuantas veces se quiera mientras la fila no sea final.
- CA6: Botón fijo "Enviar calificación final (N)" — N = filas no finales de la categoría. Habilitado solo si todas esas filas tienen todos los criterios. Pide confirmación mostrando el ranking tentativo. `TRK-CAL-006` convierte los borradores en calificaciones **bloqueadas** (R7) en una transacción: todo o nada; auditoría `CREAR` por calificación; emite `calificacion:recibida` al admin. Requiere conexión.
- CA7: Las filas finales se muestran con ✓ y no son editables; corregirlas sigue requiriendo el desbloqueo del admin (HU-4, `TRK-CAL-003`). Una calificación desbloqueada vuelve a ser editable en la matriz y se envía de nuevo con el botón final (auditoría `REENVIAR`).
- CA8: Si una mascota de la categoría desfila después del envío final, aparece como fila pendiente y el botón vuelve a habilitarse para ella.
- CA9: El ranking oficial (admin, comentarista, pantalla, exportación) y el tablero de progreso solo cuentan calificaciones finales; los borradores son privados de cada jurado.

**Errores de `TRK-CAL-006`:** 409 `CATEGORIA_CERRADA` si la categoría está cerrada; 422 `CALIFICACION_INCOMPLETA` con la lista de mascotas incompletas; 409 `SIN_PENDIENTES` si no hay nada que enviar. Las filas pendientes las calcula el servidor; una mascota que dejó de ser calificable simplemente sale del conjunto pendiente (no hay error por ello). **Errores de `TRK-CAL-005`:** 409 `CALIFICACION_BLOQUEADA` si la fila ya es final; 409 `CATEGORIA_CERRADA` si la categoría está cerrada; 422 `PUNTAJE_FUERA_DE_RANGO` si un puntaje no es entero entre 0 y el máximo del criterio; 400 `VALIDACION` si el cuerpo no tiene forma válida o trae criterios repetidos o ajenos. Si un participante cambia de categoría, sus borradores se conservan, pero la matriz y el envío final solo usan los criterios de la rúbrica vigente.

**Modelo:** nueva tabla `trk_borradores(id, participante_id, jurado_id, criterio_id, puntaje null, updated_at)`, única por `(participante_id, jurado_id, criterio_id)`, FK a participantes, usuarios y criterios. Los borradores no se auditan (son notas privadas); se conservan tras el envío final para trazabilidad.

**Se retira:** la ruta `/jurado/calificar/:id` y la galería de insignias; `TRK-CAL-002` se mantiene en la API (compatibilidad y pruebas) pero la interfaz ya no lo usa.
