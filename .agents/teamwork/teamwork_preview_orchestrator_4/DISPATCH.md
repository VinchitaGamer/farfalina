# Dispatch Log

## 2026-10-09T18:19:46Z
Sender: 7607e67e-e2ef-41b2-94b9-6f68e7bc063c
Task: Implementación integral de diseño responsive para tablets y smartphones en el sistema SaaS de Florería Farfalina y Alquiler de Vestidos Carissma, eliminando bugs de zoom y teclado móvil, y manteniendo la ejecución continua del servidor de desarrollo activo.

Authoritative Requirements & Context:
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## Follow-up — 2026-10-09T18:17:28Z`)
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\AGENTS.md`
- Active skills in `c:\Users\Lenovo\Desktop\floreria\.agents\skills/` (`design-system`, `clean-code`, `nextjs-architecture`, etc.)

Critical Constraints:
1. R4 PRESERVACIÓN DEL SERVIDOR DE DESARROLLO ACTIVO: Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso `next dev` o `npm run dev` corriendo en la terminal de VS Code del cliente. Toda validación de compilación debe ejecutarse mediante comandos independientes como `npx tsc --noEmit`.
2. R1 Adaptación Responsive Integral (Mobile & Tablet First): Todos los módulos principales (POS, Pedidos/Kanban de entregas, Omnicanal/Chat, CRM, Catálogo, Arqueo/Contabilidad) para tablets (768px - 1024px) y smartphones (360px - 430px). En móviles (<768px), las tablas complejas y listas densas deben transformarse en tarjetas táctiles (cards apiladas) con espaciado ergonómico, manteniendo visualización tabular en tablet y desktop.
3. R2 Prevención de Bugs Móviles Nativos: Viewport Next.js (`width=device-width`, `initial-scale=1`, `interactiveWidget: 'resizes-content'`), inputs/selects/textareas con font-size mínimo de 16px (1rem) en móvil para evitar auto-zoom involuntario de Safari/Chrome/Android, y unidades `dvh`/`svh` para evitar saltos con teclado virtual.
4. R3 Ergonomía Táctil y Navegación Segura: Áreas de toque mínimas de 44x44px en botones, controles y selectores. Safe areas (`safe-area-inset-bottom`) en modales, drawers (omnicanal, notificaciones) y `MobileBottomNav` para evitar superposiciones y bloqueos de botones de acción.
5. Reglas de AGENTS.md: Next.js 14+ App Router, Tailwind CSS, Shadcn UI, Lucide React, TypeScript estricto sin `any`, kebab-case para archivos.
