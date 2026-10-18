# Clean Code Methodology
Source: c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md

- Zod as single source of truth for types: export type X = z.infer<typeof XSchema>; NO manual TypeScript interfaces.
- Function syntax: export async function for Server Actions / exported functions, arrow for internal/callbacks.
- Early returns to avoid deep nesting.
- Naming: kebab-case files, PascalCaseSchema, camelCase vars/funcs.
- Prohibit any type: use unknown and narrowing.
- JSDoc on Server Actions and business utilities with @param and @returns.
