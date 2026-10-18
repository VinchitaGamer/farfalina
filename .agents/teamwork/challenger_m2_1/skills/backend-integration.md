# Backend Integration Skill
Copied from .agents/skills/backend-integration/SKILL.md

Establece las reglas para toda comunicación HTTP del proyecto: qué cliente usar, cómo proteger endpoints, cuándo elegir Server Action vs Route Handler, y el contrato JSON que toda respuesta debe respetar.
Reglas clave:
- fetch nativo (no Axios)
- Contrato JSON: { success, data, error, code }
- Manejo robusto de errores con try/catch y status HTTP semánticos
