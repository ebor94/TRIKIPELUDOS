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
