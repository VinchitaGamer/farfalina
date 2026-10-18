# Dispatch Log

## 2026-10-06T06:02:11Z
You are the Project Orchestrator for this task.

Working directory: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_orchestrator_1
Original request file: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md

Please read c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md and coordinate specialists as needed to fulfill all requirements:

Requirements:
- R1. Desconexión y Cierre Definitivo de Servicios en VPS Antiguo (207.211.167.189):
  Detener y eliminar proceso PM2 `floreria` (`pm2 stop floreria && pm2 delete floreria && pm2 save`), detener Nginx en 207.211.167.189 usando la clave SSH en `C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key` con flags no interactivos (`-n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15`).
- R2. Recepción y Persistencia de Mensajes de Instagram Direct en Local:
  Asegurar que `app/api/webhooks/instagram/route.ts` procese sin errores los mensajes entrantes reales provenientes de la Graph API de Instagram Direct (`entry[].messaging[]`), asociándolos a `ChannelConfig`, creando/vinculando `CRMClient` y registrando el mensaje en `ChatMessage` dentro de `prisma/dev.db`.
- R3. Auditoría de Configuraciones y Bloqueos de Meta:
  Diagnosticar modo de app en Meta Developers, verificar evaluador `@sour_jhxn`, comprobar directiva de privacidad de acceso a mensajes, y verificar validación de firma `x-hub-signature-256` y `META_APP_SECRET`.

Ensure all acceptance criteria in ORIGINAL_REQUEST.md are verified with scripts/commands.
Update progress in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_orchestrator_1\progress.md` frequently.
When finished and verified, send your final completion report and claim victory.
