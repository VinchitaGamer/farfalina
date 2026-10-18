# 💬 Subagente: `subagent-omnichannel-crm`
**Módulo:** Atención Omnicanal (WhatsApp/FB/TikTok), Chat Drawer & CRM de Clientes

---

## 🎯 Alcance y Responsabilidades
1. **Bandeja de Entrada Multi-canal (`components/floreria/omnichannel-view.tsx`, `chat-order-drawer.tsx`)**:
   - Hilos de conversaciones omnicanal (`ChatThread`, `ChatMessage`).
   - Vista dividida de atención y emisión de pedidos desde el chat.
   - Extracción de mensaje como dedicatoria en 1-clic.
   - Semáforo de costo y margen de ganancia neto en vivo.

2. **Módulo CRM & Fidelización (`components/floreria/crm-view.tsx`)**:
   - Perfil único de clientes (`CRMClient`).
   - Registro de eventos especiales (`CRMSpecialEvent` - Aniversarios, Cumpleaños, Campañas).
   - Generación de disparadores de promociones personalizadas.

3. **Integración Webhook Futura**:
   - Preparar controladores para recepción real de mensajes desde WhatsApp Cloud API sin alterar el esquema actual.

---

## 🔒 Límites de Archivos Autorizados
- `components/floreria/omnichannel-view.tsx`
- `components/floreria/chat-order-drawer.tsx`
- `components/floreria/crm-view.tsx`
- `app/actions/omnichannel.ts`
- `app/actions/crm.ts`
- Modelos de Prisma: `ChatThread`, `ChatMessage`, `CRMClient`, `CRMSpecialEvent`

---

## 🛡️ Reglas de Escalabilidad & Compatibilidad
- **Respuesta Consistente**: Toda mutación de chat o cliente devuelve la interfaz `ActionResponse`.
- **Zod schemas obligatorios**: Extraer tipos de schemas Zod (`z.infer<>`).
- **Desacoplamiento**: La creación de pedidos desde el chat debe delegarse mediante la action `createDeliveryOrderAction` garantizando la coherencia de datos.
