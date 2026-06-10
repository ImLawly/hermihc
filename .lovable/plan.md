
# Plan de implementación

Voy a entregar todo en **3 fases** porque son ~9 funcionalidades grandes y mezclar todo en un solo cambio rompería el sistema. Primero confirma el plan y luego ejecuto fase por fase.

Antes de empezar necesito una **decisión clave** sobre el punto 1:

> "El superusuario puede ver las contraseñas (claves) de los usuarios."

**Esto es técnicamente imposible y un riesgo legal grave** en un sistema clínico. Supabase Auth (como todo sistema serio) guarda las contraseñas con hash bcrypt — nadie, ni el dueño del proyecto, ni yo, ni Supabase, puede leerlas. Si alguien te ofrece "ver contraseñas en claro" está guardándolas en texto plano, lo cual viola HIPAA/GDPR/normativa de historia clínica y te expone a una filtración catastrófica.

**Lo que sí puedo hacer (y ya está implementado parcialmente):**
- Superusuario ve correo + nombre + rol + último login de cada usuario.
- Superusuario puede **cambiar** la contraseña de cualquier usuario (reset forzado).
- Superusuario puede eliminar usuarios.

Voy a asumir esa interpretación. Si insistes en almacenar claves en claro, dilo explícitamente y asume la responsabilidad — no lo recomiendo.

---

## Fase 1 — Trazabilidad, bloqueo de historias, auditoría visible, panel de control

**1. Trazabilidad clínica visible (punto 2)**
- En cada tarjeta de evolución, nota, orden, monitoreo, interconsulta, laboratorio: badge visible con `created_by` (nombre del usuario) + `created_at` y, si fue editado, `updated_by` + `updated_at`.
- Migración: agregar columnas `updated_by uuid` donde falten + trigger que las rellene automáticamente.
- Componente `<AuthorStamp userId date label />` reutilizable que resuelve el nombre desde `profiles`.

**2. Bloqueo y publicación de historias por rangos (punto 4)**
- Nuevo enum de estado en `evolutions` / `medical_orders` / `clinical_notes`: `borrador`, `en_revision`, `publicado`.
- Si el autor es R1 → entra como `borrador`. Botón "Confirmar y publicar" visible solo para R2/R3/especialista.
- Si el autor es R2+ → entra directamente como `publicado` (con botón "Confirmar y publicar" habilitado).
- **Bloqueo concurrente**: tabla `record_locks (record_type, record_id, locked_by, locked_at, expires_at)`. Cuando R2/R3 abre la historia para verificar, se crea un lock de 10 min auto-renovado por heartbeat. Mientras exista, el formulario del R1 muestra "En verificación por Dr. X — solo lectura".
- Una vez `publicado`, RLS bloquea cualquier UPDATE (excepto superusuario).

**3. Auditoría visible (punto 1 — panel ya existe, se mejora)**
- El panel `/superuser/audit` actual muestra operación + tabla + id. Lo amplío para mostrar el diff (before/after) de cada fila y filtros por fecha.

**4. Módulo de control — checklist dinámico (punto 6)**
- Nueva ruta `/superuser/estado-sistema` con un checklist hardcoded de las 9 funcionalidades, marcando cuáles ya están "live" en el sistema (consulta a la DB para verificar existencia de tablas/columnas clave).

---

## Fase 2 — Chat interno vigilado + links de acceso temporal

**5. Chat interno (punto 3)**
- Tablas: `chat_conversations (id, participant_a, participant_b)` y `chat_messages (id, conversation_id, sender_id, body, sent_at, delivered_at)`.
- RLS: los dos participantes pueden leer/escribir; **superusuario lee todo** vía `is_superuser()` en la policy (los participantes no se enteran porque solo es lectura backend).
- Realtime: suscripción al canal `chat:<conversation_id>`.
- UI: ruta `/chat` con lista de conversaciones + ventana. Check de entrega (✓) cuando se inserta `delivered_at` (al recibir el realtime el cliente del receptor hace UPDATE). **Sin** check de lectura.
- Vista oculta del superusuario: `/superuser/chats` lista todas las conversaciones y permite leerlas.

**6. Links temporales (punto 5)**
- Tabla `temporary_access_tokens (token text primary key, patient_id uuid, expires_at, created_by, revoked)`.
- Server fn `createTempLink({ patientId, durationMinutes })` que genera token criptográfico (`crypto.randomUUID()+random hex`).
- Ruta pública `/v/$token` que valida el token server-side (sin requerir auth), carga la historia en modo solo lectura, y bloquea automáticamente al expirar.
- Selector: 15 min / 30 min / 1h / 6h / 24h / 48h.

---

## Fase 3 — Módulo de evidencia fotográfica (puntos 7-9)

**7. Compresión + marca de agua en cliente**
- Librería `browser-image-compression` para reducir a ~1-2MB / max 2000px.
- Marca de agua: canvas API — diagonal tileada con texto genérico tipo "EVIDENCIA CLÍNICA — NO EDITAR" semitransparente. Sin datos del paciente.

**8. Almacenamiento en Google Drive**
- Connector `google_drive` de Lovable (OAuth de la cuenta del hospital, no por usuario).
- Server fn `uploadEvidence(patientId, admissionId, base64Image, mimeType)` que sube vía gateway a una carpeta designada y devuelve el `fileId`.
- Tabla `evidence_photos (id, patient_id, admission_id, drive_file_id, uploaded_by, uploaded_at, kind)` — kind = laboratorio | eco | placa | otro.

**9. Visualización**
- Componente que renderiza `https://drive.google.com/uc?id=<fileId>` (requiere que el archivo sea visible para "anyone with link" — alternativa: server fn que streamea el archivo vía gateway con auth, más seguro). Voy con la opción server fn por seguridad clínica.
- Panel dentro de la historia: "Evidencias del paciente" con grid de miniaturas + lightbox.

---

## Detalle técnico clave

- **Schema changes**: ~6 migraciones (estados de registro, record_locks, chat tables, temp tokens, evidence_photos, updated_by columns + triggers).
- **Realtime policies**: extender la policy actual de `realtime.messages` para permitir `chat:<conversation_id>` cuando el uid sea participante.
- **Connector Google Drive**: necesito que confirmes y autorices el connector cuando llegue Fase 3. La carpeta destino se crea on-the-fly en la raíz del Drive del hospital.
- **Sin contraseñas en claro**: confirmado arriba.

---

## Pregunta antes de empezar

¿Confirmas que arranco con **Fase 1** (trazabilidad + bloqueo de historias + auditoría mejorada + panel de control)? Las fases 2 y 3 las ejecuto después una por una para mantener el sistema estable y no romper nada en producción.
