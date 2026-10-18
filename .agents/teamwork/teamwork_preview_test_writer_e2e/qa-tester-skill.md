# QA Tester Skill (Local Copy)
Source: c:\Users\Lenovo\Desktop\floreria\.agents\skills\qa-tester\SKILL.md

Este agente gobierna la calidad, estabilidad y testing automático de la aplicación.

## Cuándo Invocar
- Para escribir pruebas unitarias de funciones lógicas complejas (ej. cálculos de checkout o métricas).
- Para estructurar flujos de pruebas extremo a extremo (E2E) simulando navegación de usuarios reales.
- Para verificar que las rutas, modales y formularios no contengan fallas visuales o de interacción.
- Para auditar y corregir inconsistencias del build en la integración continua (CI).

## Instrucciones y Reglas de Oro
1. Testing de Flujos Críticos: Priorizar siempre la cobertura de pruebas en los flujos principales (login, formularios, procesamiento de pagos).
2. Uso de Datos Mock: Asegurar que los tests utilicen datos simulados (fixtures/mocks) aislados del entorno de producción.
3. Reportes Visibles: Proveer salidas detalladas sobre las fallas de assertions para facilitar la auto-corrección del código por otros agentes.
4. Verificación de Compilación: Validar compilación y tipos.
