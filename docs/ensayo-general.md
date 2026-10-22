# Ensayo general TRIKIPELUDOS

Dispositivos: 1 portátil (admin), 1 celular con cámara (cabina), 1 tablet (comentarista), 3 celulares (jurados), 1 TV/proyector (pantalla). Red: Wi-Fi del lugar + datos móviles en un jurado.

| # | Paso | Esperado | OK |
|---|---|---|---|
| 1 | Admin importa el CSV real | Advertencias de §7.2 visibles; nada se guarda hasta confirmar | ☐ |
| 2 | Cabina busca sin tildes y toma foto con cámara trasera | Foto recortada 4:5, estado Presente, < 500 KB subidos | ☐ |
| 3 | Cabina inscribe un participante de último minuto | Aparece en la cola del comentarista | ☐ |
| 4 | Comentarista llama a pasarela | Jurados y pantalla cambian en < 2 s | ☐ |
| 5 | Un jurado anota en la matriz en modo avión y luego se reconecta | Fila "Sin conexión" y luego "Guardado"; tras recargar conserva los valores | ☐ |
| 5b | Con varias mascotas desfiladas, el jurado ajusta puntajes y revisa "Puesto tentativo" (empates con "=") a 360 px | Tabla con columna de nombre fija y scroll horizontal solo dentro de la tabla; casillas cómodas | ☐ |
| 5c | El jurado envía "Calificación final (N)" de la categoría; luego desfila otra mascota de la misma categoría | Confirmación con ranking tentativo; filas ✓ bloqueadas; el botón vuelve a habilitarse para la nueva (N = 1) | ☐ |
| 6 | Un jurado intenta corregir una fila ✓; admin desbloquea; el jurado la corrige en la matriz y reenvía con el botón final | Fila editable tras el desbloqueo; auditoría DESBLOQUEAR y REENVIAR (TRK-CAL-006) | ☐ |
| 7 | Admin resuelve un empate y publica | Pantalla en modo ranking muestra podio | ☐ |
| 8 | Comentarista ve el ranking publicado | Podio y tabla | ☐ |
| 9 | Exportar Excel | Hoja por categoría + Detalle; sin teléfonos ni documentos | ☐ |
| 10 | Revisar a 360 px en el celular más pequeño | Sin scroll horizontal, botones cómodos | ☐ |
| 11 | Ejecutar `respaldo.sh` | Carpeta con SQL, fotos y SHA256SUMS | ☐ |
| 12 | Revisar logs (`api_codigo`) y `trk_auditoria` | Cada acción con su código TRK | ☐ |
