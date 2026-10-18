# Clean Code Skill (Local Copy)
Source: c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md

Define las convenciones de calidad de código del proyecto: Zod como única fuente de tipos, reglas de declaración de funciones, tabla de nomenclatura estándar y obligatoriedad de JSDoc en Server Actions y utilidades de negocio.

## Core Rules
1. Zod como única fuente de tipos (z.infer<>). Sin interfaces TypeScript manuales ni any.
2. Declaración de funciones para exports (`export function`, `export default function`), arrow solo para internas/callbacks.
3. Early returns para evitar anidamiento profundo (> 2 niveles).
4. kebab-case para archivos, PascalCase para componentes, camelCase para funciones/variables.
5. JSDoc con @param y @returns para Server Actions y utilidades de negocio.
