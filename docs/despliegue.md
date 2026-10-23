# TRIKIPELUDOS — Despliegue

## 0. Verificaciones previas en `serfuweb` (una vez)

```sql
SHOW CREATE TABLE usuarios;   -- usuarios.id debe ser INT con signo (las FK trk_* lo asumen)
SELECT id, nombre FROM roles WHERE LOWER(nombre) LIKE '%admin%';   -- estos roles recibirán permisos trk
```

Si `usuarios.id` es `INT UNSIGNED`, crear una migración `007_ajuste_fk_usuarios.sql` antes de seguir (no editar 001).

## 1. Variables de entorno de `mantix-backend` (.env)

| Variable | Ejemplo | Para qué |
|---|---|---|
| `TRK_JWT_SECRET` | 64 caracteres aleatorios (`openssl rand -hex 32`) | Firma de tokens de PIN. **Obligatoria** y distinta de `JWT_SECRET`/`IDENTIDAD_JWT_SECRET`: si falta o coincide, todo `/api/trk/*` responde `503 TRK_DESHABILITADO` (Mantix sigue funcionando) y se registra un error al arrancar |
| `TRK_FOTOS_PATH` | `/var/lib/trikipeludos/fotos` | Carpeta de fotos oficiales (por defecto `<cwd>/uploads/trk/fotos`) |
| `TRK_FOTOS_URL_BASE` | `https://mantix-api.losolivoscucuta.com:8444/uploads/trk/fotos` | Prefijo de la URL de cada foto (`<base>/<uuid>.jpg`). Por defecto `/uploads/trk/fotos` (relativa; el frontend vive en otro origen, así que en producción debe ser absoluta) |
| `TRK_PIN_MAX_INTENTOS` | `5` | Intentos de PIN por minuto por IP+usuario (por defecto 5). El usuario se cuenta por su id normalizado (`"01"`, `" 1"`, `"1e0"` son el mismo usuario); IPv6 se agrupa por /64 |
| `TRK_PIN_MAX_FALLOS_USUARIO` | `10` | PIN **fallidos** por usuario en 15 min, desde cualquier IP (por defecto 10). Los ingresos correctos no cuentan. Al superarlo, ese usuario queda bloqueado hasta 15 min, incluso con el PIN correcto |
| `TRK_PIN_MAX_POR_IP` | `100` | Intentos de PIN (correctos o no) por IP en 15 min (por defecto 100). Todo el evento comparte IP pública: no bajarlo de forma que impida los ingresos legítimos |
| `PORT` | `3020` | Puerto del backend (por defecto 3020); debe coincidir con `proxy_pass` de Nginx |

Requisitos:

- **`TRK_JWT_SECRET` DEBE ser distinto de `JWT_SECRET` (e `IDENTIDAD_JWT_SECRET`).** El backend lo verifica al cargar: si falta o coincide, el módulo TRK queda deshabilitado (503) y el log muestra `TRIKIPELUDOS deshabilitado: …`. Además Mantix rechaza cualquier token con `scope: 'trk'`. Con menos de 32 caracteres solo se registra una advertencia.
- Los PIN fallidos se registran (`trk pin fallido`, solo `usuario_id`): muchos seguidos indican un ataque. Un atacante puede bloquear a un usuario hasta 15 min fallando a propósito; regenerar el PIN no lo desbloquea (los contadores están en memoria: esperar o `pm2 restart` del backend).
- **Node ≥ 16.9** (el módulo usa `Object.hasOwn`). `package.json` no declara `engines`; comprobar `node -v` en `srv-backend`.

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
   - Socket.IO se sirve en el namespace `/trk` con `path` `/socket.io` (el frontend conecta a `VITE_SOCKET_URL` + `/trk`).

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

Genera una carpeta `trikipeludos-<fecha>` (permisos 700) con `trk_tablas.sql`, `trk_roles_usuarios.sql`, `fotos.tar.gz` y `SHA256SUMS` (archivos 600). Copiarla fuera del servidor y verificar `SHA256SUMS`.

## 6. Actualización v2.1 (matriz del jurado)

1. Backend: fusionar `feature/trk-matriz` en `main` de `ebor94/mantix`; en `srv-backend`, `bash ~/apps/mantix/mantix-backend/scripts/deploy-mantix.sh` y luego `npm run trk:setup` (aplica la migración 006; no hay variables de entorno nuevas) → debe listar `✅ 006_borradores.sql`. Verificar:
   ```sql
   SHOW CREATE TABLE trk_borradores;
   SELECT nombre FROM trk_migraciones ORDER BY nombre DESC LIMIT 1;  -- 006_borradores.sql
   ```
2. Frontend: fusionar `feature/trk-matriz` en `main` de `ebor94/TRIKIPELUDOS`, `npm ci && npm run build` y `rsync` de `dist/` (igual que §3).
3. Orden: **backend primero** (la nueva interfaz llama a `TRK-CAL-004/005/006`; la anterior sigue funcionando con el backend nuevo porque `TRK-CAL-002` no cambió).
4. Si algún celular de jurado tiene calificaciones v2 pendientes en su cola local, al abrir la versión nueva se guardan como borrador de esa fila y el jurado las confirma con "Enviar calificación final".

## 7. Actualización rúbrica v2 (2026-10-23)

Criterios confirmados para **todas** las categorías: Creatividad 50, Bienestar 30, Pasarela 20 (spec §3.2).

1. Backend: `main` de `ebor94/mantix`; en `srv-backend`, desplegar como siempre y luego `npm run trk:setup` → debe listar `✅ 007_rubrica_v2.sql`.
2. **La 007 borra** las calificaciones, borradores, rankings publicados, desempates manuales y el modo RANKING de la pantalla (eran de la rúbrica anterior; aprobado porque el evento no ha comenzado). Los participantes, fotos y usuarios no se tocan. Hacer un respaldo antes si se quiere conservar lo de prueba (`respaldo.sh`, §5).
3. Verificar:
   ```sql
   SELECT r.codigo, c.codigo, c.puntaje_max, c.peso_desempate
   FROM trk_criterios c JOIN trk_rubricas r ON r.id = c.rubrica_id ORDER BY r.codigo, c.orden;
   -- 6 filas: por rúbrica CREATIVIDAD 50 (1), BIENESTAR 30 (2), PASARELA 20 (NULL)
   ```
4. Frontend: no requiere despliegue (la matriz lee criterios y máximos de la API). Si un celular de jurado tenía borradores sin enviar con criterios viejos, el servidor los rechaza (criterio ajeno) y la fila queda vacía para anotarla de nuevo.
