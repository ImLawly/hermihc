# Fase 4 — Offline-First + Notificaciones

## A. PWA (base para offline y push)

1. Instalar `vite-plugin-pwa` y configurar manifest + Service Worker (estrategia `NetworkFirst` para `/`, `CacheFirst` para assets, `NetworkOnly` para `/api`).
2. Manifest con nombre "Historias Clínicas", icono, color tema (`#0f3460` azul oscuro de tabs activos), `display: standalone` para instalar en móvil.
3. Registrar el SW desde `src/start.ts` (cliente).

## B. Lectura offline + cola de escritura

1. Añadir `dexie` (IndexedDB wrapper).
2. Crear `src/lib/offline/db.ts` con tablas:
   - `cachedPatients`, `cachedAdmissions`, `cachedEvolutions`, `cachedOrders`, `cachedMonitoring`, `cachedNotes` (key = id, value = JSON + `updated_at`).
   - `writeQueue` (id auto, table, op, payload, created_at, retries).
3. Hook `useOfflineCache.ts`: envuelve las queries de TanStack — al éxito guarda en Dexie; cuando `!navigator.onLine`, las queries leen de Dexie como fallback.
4. Hook `useOfflineMutation.ts`: si offline, encola en `writeQueue` y muestra toast "Guardado localmente, se sincronizará al reconectar".
5. `SyncEngine` (`src/lib/offline/sync.ts`): escucha `online`, drena cola FIFO con reintentos exponenciales, invalida queries al finalizar.
6. Indicador en el header existente (`OnlineStatus`): mostrar # de cambios pendientes en la cola.

**Alcance:** Lectura offline para Pestañas 1–6 ya visitadas. Cola de escritura para evoluciones, órdenes, monitoreo, notas y administración de medicamentos por enfermería (los casos críticos de "estoy en piso sin señal").

## C. Notificaciones in-app (campana)

1. Componente `<NotificationBell />` en el header con badge de no leídas.
2. Suscripción Supabase Realtime al `INSERT` en `notifications` filtrado por rol/servicio del usuario.
3. Habilitar realtime en la tabla: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` + `ALTER TABLE public.notifications REPLICA IDENTITY FULL;`.
4. Dropdown con últimas 20, marcar como leída al hacer click (UPDATE `read_at`), navega al recurso (paciente, interconsulta, traslado).
5. Tipos de notificación ya emitidos por triggers: `transfer`. Añadir disparadores para:
   - Nueva interconsulta → notifica al `target_service`.
   - Respuesta de interconsulta → notifica al `created_by` original.
   - Registro pendiente de R1 → notifica a `especialista`/`r3`/`r2` del servicio.

## D. Web Push (VAPID)

1. Tabla nueva `push_subscriptions(user_id, endpoint, p256dh, auth, user_agent, created_at)` con RLS: el usuario solo gestiona las suyas.
2. Generar par VAPID y guardar como secretos: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto). Solicitar al usuario vía `add_secret` con instrucciones para generarlos (`npx web-push generate-vapid-keys`). La pública también se expone como `VITE_VAPID_PUBLIC_KEY`.
3. Service Worker: handler `push` que muestra `Notification`, handler `notificationclick` que abre la ruta del payload.
4. UI: botón "Activar alertas en este dispositivo" en el header de usuario que llama `Notification.requestPermission()` → `pushManager.subscribe()` → guarda en `push_subscriptions`.
5. Server function `sendPushToTargets`: usa `@block65/webcrypto-web-push` (compatible con workerd) para firmar JWT VAPID y enviar a cada subscription. Marca como urgente solo para `kind in ('transfer', 'urgent_interconsult')`.
6. Hook de envío: trigger SQL → `pg_net` POST a `/api/public/push-dispatch` (firmado con HMAC) que itera notificaciones nuevas y dispara push solo para urgentes. Alternativa más simple: el cliente que crea la notificación llama directamente al server fn (más simple, lo hago así primero — el SQL trigger queda solo para in-app).

## E. Detalles técnicos

- `vite.config.ts`: añadir el plugin PWA con `registerType: 'autoUpdate'`, `injectRegister: false` (lo registro yo en `src/start.ts` solo en cliente para evitar SSR issues), `workbox.navigateFallbackDenylist: [/^\/api/]`.
- El SW custom (`src/sw.ts`) extiende el generado por workbox con los handlers de push/notificationclick.
- Dexie funciona solo en cliente: guardas siempre dentro de `if (typeof window !== 'undefined')`.
- En `_authenticated.tsx`, montar `<SyncEngineProvider>` que arranca la cola al cargar.

## F. Fuera de alcance (para fases futuras)

- Resolución de conflictos compleja (last-write-wins por ahora; suficiente porque cada usuario edita sus propios registros).
- Push a iOS Safari < 16.4 (limitación de plataforma).
- Cifrado local de la caché offline (sería un add-on de seguridad posterior).

## Resultado esperado

- App instalable en móvil y escritorio.
- Médicos pueden abrir historias ya vistas sin señal y registrar evoluciones/órdenes/monitoreo; al volver la señal todo se sincroniza solo.
- Campana en el header con realtime para traslados, interconsultas y revisiones pendientes.
- Personal de traslado recibe push del SO incluso con la app cerrada cuando hay una reubicación.
