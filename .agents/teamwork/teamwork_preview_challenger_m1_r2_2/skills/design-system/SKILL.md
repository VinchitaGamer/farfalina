---
name: design-system
description: Reglas para el uso de Shadcn UI, Tailwind CSS, CVA, Lucide React y convenciones de diseño UI/UX. Incluye protocolo de cuestionario obligatorio antes de maquetar. Usar cuando se cree o modifique cualquier componente visual o interfaz en cualquier proyecto web.
---

# Design System

Gobierna todas las decisiones de interfaz visual: qué librerías usar, cómo construir componentes con CVA, cómo escribir clases Tailwind, cuándo escalar a Framer Motion, y el protocolo de cuestionario obligatorio que el agente debe ejecutar antes de maquetar cualquier UI.

## When to Use
- Al crear o modificar cualquier componente visual
- Al iniciar el desarrollo de una nueva página, sección o landing
- Al agregar un componente de Shadcn UI al proyecto
- Al implementar animaciones o transiciones
- Al aplicar estilos responsivos con Tailwind

## Step 5: Aplicar responsividad Mobile-First
Las clases base son para móvil — escalar hacia arriba.
Breakpoints: sm: 640px, md: 768px, lg: 1024px, xl: 1280px.
Touch target ergonomics: >= 44x44px.
Safe area utilities: env(safe-area-inset-bottom).
Font-size guard: >= 16px on inputs in mobile.
