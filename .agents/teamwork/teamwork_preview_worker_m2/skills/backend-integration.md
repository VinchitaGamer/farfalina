# Backend Integration Methodology
Source: c:\Users\Lenovo\Desktop\floreria\.agents\skills\backend-integration\SKILL.md

- Use native fetch (no Axios).
- Route Handlers in /app/api reserved for external integrations and webhooks.
- Early return for signature / auth validation.
- All handler logic wrapped in try/catch.
- Bilateral JSON contract on all responses: { success, data, error, code }.
- No plain strings or unhandled exceptions returned to callers.
