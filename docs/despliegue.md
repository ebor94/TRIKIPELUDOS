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
| `TRK_JWT_SECRET` | 64 caracteres aleatorios (`openssl rand -hex 32`) | Firma de tokens de PIN. **Obligatoria**: sin ella el login con PIN falla (`Falta TRK_JWT_SECRET`) |
| `TRK_FOTOS_PATH` | `/var/lib/trikipeludos/fotos` | Carpeta de fotos oficiales (por defecto `<cwd>/uploads/trk/fotos`) |
| `TRK_FOTOS_URL_BASE` | `https://mantix-api.losolivoscucuta.com:8444/uploads/trk/fotos` | Prefijo de la URL de cada foto (`<base>/<uuid>.jpg`). Por defecto `/uploads/trk/fotos` (relativa; el frontend vive en otro origen, así que en producción debe ser absoluta) |
| `TRK_PIN_MAX_INTENTOS` | `5` | Intentos de PIN por minuto por IP+usuario (por defecto 5) |
| `PORT` | `3020` | Puerto del backend (por defecto 3020); debe coincidir con `proxy_pass` de Nginx |

Requisitos:

- **`TRK_JWT_SECRET` DEBE ser distinto de `JWT_SECRET`.** El backend **no lo verifica** (solo comprueba que exista): revisarlo a mano antes de desplegar. Si fueran iguales, el aislamiento `scope: 'trk'` entre tokens de PIN y tokens de Mantix pierde su respaldo criptográfico.
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
