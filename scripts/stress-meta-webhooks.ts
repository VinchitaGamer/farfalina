/**
 * Florería Farfalina & Carissma - Adversarial Stress & Oracle Test Harness
 *
 * Misión de Challenger 2:
 * Someter los Route Handlers GET de Meta Webhooks (/api/webhooks/whatsapp, facebook, instagram)
 * a condiciones hostiles y de estrés extremo:
 * 1. Cargas masivas: Strings de reto de 10KB y 64KB.
 * 2. Caracteres Unicode inusuales, emojis complejos, CJK, RTL, y codificación URL.
 * 3. Concurrencia masiva: Cientos de solicitudes simultáneas hacia los 3 endpoints a la vez.
 * 4. Ataques de inyección SQL, NoSQL, Path Traversal y XSS en hub.challenge y hub.verify_token.
 * 5. Oráculo de integridad de contenido (text/plain vs XSS, preservación verbatim exacta).
 */

import "dotenv/config";
import crypto from "crypto";
import { GET as getWhatsApp } from "../app/api/webhooks/whatsapp/route";
import { GET as getFacebook } from "../app/api/webhooks/facebook/route";
import { GET as getInstagram } from "../app/api/webhooks/instagram/route";

const DEFAULT_VERIFY_TOKEN = "farfalina_carissma_webhook_verify_token_2026";

// Capturar referencias reales a consola para que los tests puedan silenciar logs internos de rutas sin romper el runner
const realLog = console.log.bind(console);
const realWarn = console.warn.bind(console);
const realError = console.error.bind(console);

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

type RouteHandler = (req: Request) => Promise<Response>;

interface EndpointTarget {
  id: string;
  name: string;
  path: string;
  handler: RouteHandler;
}

const TARGETS: EndpointTarget[] = [
  { id: "whatsapp", name: "WhatsApp Cloud API", path: "/api/webhooks/whatsapp", handler: getWhatsApp },
  { id: "facebook", name: "Facebook Messenger", path: "/api/webhooks/facebook", handler: getFacebook },
  { id: "instagram", name: "Instagram Direct", path: "/api/webhooks/instagram", handler: getInstagram },
];

interface TestCaseResult {
  category: string;
  endpointId: string;
  name: string;
  passed: boolean;
  expectedStatus: number | number[];
  actualStatus: number;
  expectedContentType?: string;
  actualContentType?: string | null;
  bodyMatch: boolean;
  notes: string;
  durationMs: number;
}

const results: TestCaseResult[] = [];

// Helper to invoke handler with specific search params
async function invokeHandler(
  handler: RouteHandler,
  path: string,
  params: Record<string, string | undefined>
): Promise<{ status: number; contentType: string | null; body: string }> {
  const url = new URL(`http://localhost:3000${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const req = new Request(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "facebookexternalua",
      Accept: "*/*",
    },
  });

  const res = await handler(req);
  const body = await res.text();
  const contentType = res.headers.get("content-type");

  return { status: res.status, contentType, body };
}

// ----------------------------------------------------------------------------
// SUITE 1: RETOS EXTREMADAMENTE LARGOS (10 KB y 64 KB)
// ----------------------------------------------------------------------------
async function runLargeChallengeTests() {
  realLog(`\n${colors.cyan}${colors.bold}=== [SUITE 1] RETOS EXTREMADAMENTE LARGOS (10KB & 64KB) ===${colors.reset}`);

  const generateString = (sizeInBytes: number) => {
    return crypto.randomBytes(Math.ceil(sizeInBytes / 2)).toString("hex").slice(0, sizeInBytes);
  };

  const sizes = [
    { label: "10KB (10,240 bytes)", size: 10 * 1024 },
    { label: "64KB (65,536 bytes)", size: 64 * 1024 },
  ];

  for (const target of TARGETS) {
    for (const item of sizes) {
      const challengeStr = generateString(item.size);
      const start = performance.now();
      const res = await invokeHandler(target.handler, target.path, {
        "hub.mode": "subscribe",
        "hub.verify_token": DEFAULT_VERIFY_TOKEN,
        "hub.challenge": challengeStr,
      });
      const durationMs = performance.now() - start;

      const isStatus200 = res.status === 200;
      const isPlain = Boolean(res.contentType && res.contentType.includes("text/plain"));
      const isExactMatch = res.body === challengeStr;
      const passed = isStatus200 && isPlain && isExactMatch;

      results.push({
        category: "LARGE_CHALLENGE",
        endpointId: target.id,
        name: `Reto masivo ${item.label} en ${target.name}`,
        passed,
        expectedStatus: 200,
        actualStatus: res.status,
        expectedContentType: "text/plain",
        actualContentType: res.contentType,
        bodyMatch: isExactMatch,
        notes: passed
          ? `Preservación byte-por-byte intacta (${(res.body.length / 1024).toFixed(1)} KB) en ${durationMs.toFixed(1)}ms`
          : `Discrepancia: length recibido=${res.body.length}, esperado=${challengeStr.length}`,
        durationMs,
      });

      const sym = passed ? `${colors.green}✓ PASS` : `${colors.red}✗ FAIL`;
      realLog(`  ${sym}${colors.reset} [${target.id}] Reto ${item.label}: ${durationMs.toFixed(1)}ms`);
    }
  }
}

// ----------------------------------------------------------------------------
// SUITE 2: UNICODE INUSUAL, URL-ENCODING, EMOJIS, CJK, RTL, CARACTERES DE CONTROL
// ----------------------------------------------------------------------------
async function runUnicodeAndSpecialCharTests() {
  realLog(`\n${colors.cyan}${colors.bold}=== [SUITE 2] UNICODE INUSUAL, EMOJIS, CJK, RTL Y ENCODING ===${colors.reset}`);

  const testVectors: Array<{ label: string; challenge: string }> = [
    {
      label: "Emojis complejos y variaciones ZWJ",
      challenge: "💐🌸🌺🌷🌹👨‍👩‍👧‍👦✨🎉🎁🚀🔥💯❤️",
    },
    {
      label: "Caracteres CJK (Chino, Japonés, Coreano)",
      challenge: "こんにちは世界_你好世界_안녕하세요_フロレリア",
    },
    {
      label: "Texto RTL (Árabe y Hebreo con bidi marks)",
      challenge: "مرحبا بالعالم \u202Ereversed\u202C שלום עליכם",
    },
    {
      label: "Caracteres especiales de URL (&, ?, #, %, =, +, /, @, $, ;)",
      challenge: "test?param=1&foo=bar#section%20encoded+plus/slash@at$dollar;semi",
    },
    {
      label: "Diacríticos, tildes y símbolos matemáticos",
      challenge: "Árbol, cigüeña, niño, año, résumé, Schrödinger, ∑∏∫√≠±∞≈",
    },
    {
      label: "Espacios múltiples, tabs y saltos de línea en challenge",
      challenge: "Line 1\nLine 2\tTabbed   TripleSpace   End",
    },
    {
      label: "Cadenas con comillas simples, dobles y barras invertidas",
      challenge: `Challenge with 'single', "double", and \\backslashes\\ /slashes/`,
    },
  ];

  for (const target of TARGETS) {
    for (const vector of testVectors) {
      const start = performance.now();
      const res = await invokeHandler(target.handler, target.path, {
        "hub.mode": "subscribe",
        "hub.verify_token": DEFAULT_VERIFY_TOKEN,
        "hub.challenge": vector.challenge,
      });
      const durationMs = performance.now() - start;

      const isStatus200 = res.status === 200;
      const isPlain = Boolean(res.contentType && res.contentType.includes("text/plain"));
      const isExactMatch = res.body === vector.challenge;
      const passed = isStatus200 && isPlain && isExactMatch;

      results.push({
        category: "UNICODE_SPECIAL_CHARS",
        endpointId: target.id,
        name: `${vector.label} en ${target.name}`,
        passed,
        expectedStatus: 200,
        actualStatus: res.status,
        expectedContentType: "text/plain",
        actualContentType: res.contentType,
        bodyMatch: isExactMatch,
        notes: passed
          ? `Exactitud verbatim verificada (${res.body.length} chars) en ${durationMs.toFixed(1)}ms`
          : `Falló: recibido '${res.body}' vs esperado '${vector.challenge}'`,
        durationMs,
      });

      const sym = passed ? `${colors.green}✓ PASS` : `${colors.red}✗ FAIL`;
      realLog(`  ${sym}${colors.reset} [${target.id}] ${vector.label}`);
    }
  }
}

// ----------------------------------------------------------------------------
// SUITE 3: ATAQUES ADVERSARIALES (INYECCIÓN SQL, NOSQL, XSS, PATH TRAVERSAL)
// ----------------------------------------------------------------------------
async function runAdversarialInjectionTests() {
  realLog(`\n${colors.cyan}${colors.bold}=== [SUITE 3] PRUEBAS DE RESISTENCIA A INYECCIONES (SQLi, NoSQL, XSS, TRAVERSAL) ===${colors.reset}`);

  // 3.1: Inyecciones maliciosas en hub.verify_token (DEBE RETORNAR 403 FORBIDDEN SIN EXCEPCIONES 500)
  const maliciousTokens: Array<{ label: string; token: string }> = [
    { label: "SQLi: ' OR 1=1 --", token: "' OR '1'='1" },
    { label: "SQLi: '; DROP TABLE \"ChannelConfig\"; --", token: "'; DROP TABLE \"ChannelConfig\"; --" },
    { label: "SQLi: ' UNION SELECT * FROM \"User\" --", token: "' UNION SELECT username, password FROM \"User\" --" },
    { label: "SQLi: admin' --", token: "admin' --" },
    { label: "SQLi: Comillas dobles y corchetes", token: "\"; DROP TABLE \"User\"; --" },
    { label: "NoSQL Operator Injection", token: "{\"$gt\": \"\"}" },
    { label: "Path Traversal", token: "../../../../../etc/passwd" },
    { label: "Command Injection", token: "; calc.exe; rm -rf /; $(whoami)" },
    { label: "Null Byte Injection", token: "valid_token\0malicious" },
    { label: "Token gigante de 10KB (Denial of Service buffer)", token: "A".repeat(10240) },
    { label: "Token de solo espacios en blanco", token: "     " },
    { label: "Token con caracteres de control ASCII (0x01-0x1F)", token: "\x01\x02\x03\x1b\x00" },
  ];

  for (const target of TARGETS) {
    for (const vector of maliciousTokens) {
      const start = performance.now();
      const res = await invokeHandler(target.handler, target.path, {
        "hub.mode": "subscribe",
        "hub.verify_token": vector.token,
        "hub.challenge": "PROBE_CHALLENGE_999",
      });
      const durationMs = performance.now() - start;

      // Un token no reconocido debe resultar en 403 Forbidden. Jamás debe retornar 200 ni lanzar 500
      const passed = res.status === 403;

      results.push({
        category: "INJECTION_TOKEN_TAMPERING",
        endpointId: target.id,
        name: `Rechazo de inyección en token: ${vector.label} (${target.name})`,
        passed,
        expectedStatus: 403,
        actualStatus: res.status,
        bodyMatch: true,
        notes: passed
          ? `Bloqueado limpiamente con HTTP 403 (${durationMs.toFixed(1)}ms)`
          : `¡VULNERABILIDAD CRÍTICA! Status: ${res.status}, Body: ${res.body}`,
        durationMs,
      });

      const sym = passed ? `${colors.green}✓ PASS` : `${colors.red}✗ FAIL`;
      realLog(`  ${sym}${colors.reset} [${target.id}] Token Defense: ${vector.label} -> HTTP ${res.status}`);
    }
  }

  // 3.2: Inyecciones de XSS, HTML, y Script en hub.challenge (con Token VÁLIDO)
  // DEBE retornar 200 OK, Content-Type: text/plain (para que el browser jamás lo interprete como HTML ejecutable),
  // y el body debe ser verbatim exactamente la cadena enviada (oráculo de integridad de Meta).
  const xssChallenges: Array<{ label: string; challenge: string }> = [
    { label: "XSS clásico con tag script", challenge: "<script>alert('XSS_ATTACK')</script>" },
    { label: "XSS con img onerror", challenge: `<img src="x" onerror="alert(document.cookie)">` },
    { label: "XSS con iframe y javascript:", challenge: `<iframe src="javascript:alert(1)"></iframe>` },
    { label: "Payload SVG con onload", challenge: `<svg onload=alert(1)>` },
    { label: "Template Injection (${7*7} y {{7*7}})", challenge: "${7*7} {{7*7}} <%= 7*7 %>" },
    { label: "HTML Body & Phishing Anchor", challenge: `<a href="https://evil.com">Click to login</a>` },
    { label: "SQLi en challenge verbatim", challenge: "'; DROP TABLE \"ChatThread\"; --" },
  ];

  for (const target of TARGETS) {
    for (const vector of xssChallenges) {
      const start = performance.now();
      const res = await invokeHandler(target.handler, target.path, {
        "hub.mode": "subscribe",
        "hub.verify_token": DEFAULT_VERIFY_TOKEN,
        "hub.challenge": vector.challenge,
      });
      const durationMs = performance.now() - start;

      const isStatus200 = res.status === 200;
      const isStrictTextPlain = Boolean(res.contentType && res.contentType.toLowerCase().includes("text/plain"));
      const isNotHtml = !Boolean(res.contentType && res.contentType.toLowerCase().includes("text/html"));
      const isExactBody = res.body === vector.challenge;
      const passed = isStatus200 && isStrictTextPlain && isNotHtml && isExactBody;

      results.push({
        category: "XSS_CHALLENGE_ORACLE",
        endpointId: target.id,
        name: `Oráculo XSS en challenge: ${vector.label} (${target.name})`,
        passed,
        expectedStatus: 200,
        actualStatus: res.status,
        expectedContentType: "text/plain",
        actualContentType: res.contentType,
        bodyMatch: isExactBody,
        notes: passed
          ? `Neutralizado con text/plain | Verbatim idéntico (${durationMs.toFixed(1)}ms)`
          : `Falla en oráculo XSS: Content-Type=${res.contentType}, Status=${res.status}`,
        durationMs,
      });

      const sym = passed ? `${colors.green}✓ PASS` : `${colors.red}✗ FAIL`;
      realLog(`  ${sym}${colors.reset} [${target.id}] XSS Oracle: ${vector.label} -> text/plain 200`);
    }
  }
}

// ----------------------------------------------------------------------------
// SUITE 4: CONCURRENCIA MASIVA (RACE CONDITIONS & BURST PROBES)
// ----------------------------------------------------------------------------
async function runConcurrencyTests() {
  realLog(`\n${colors.cyan}${colors.bold}=== [SUITE 4] CONCURRENCIA MASIVA SIMULTÁNEA (120 SOLICITUDES PARALELAS) ===${colors.reset}`);

  interface Task {
    target: EndpointTarget;
    challenge: string;
    token: string;
    shouldSucceed: boolean;
    index: number;
  }

  const tasks: Task[] = [];
  const TOTAL_PER_ENDPOINT = 40;

  for (const target of TARGETS) {
    for (let i = 0; i < TOTAL_PER_ENDPOINT; i++) {
      const isSuccessCase = i % 4 !== 0; // 75% válidos, 25% inválidos
      tasks.push({
        target,
        challenge: `BURST_CHALLENGE_${target.id}_${i}_${crypto.randomBytes(4).toString("hex")}`,
        token: isSuccessCase ? DEFAULT_VERIFY_TOKEN : `wrong_token_${i}`,
        shouldSucceed: isSuccessCase,
        index: i,
      });
    }
  }

  // Barajar aleatoriamente para simular desorden real de llegada
  tasks.sort(() => Math.random() - 0.5);

  const startBurst = performance.now();

  const parallelPromises = tasks.map(async (task) => {
    const reqStart = performance.now();
    const res = await invokeHandler(task.target.handler, task.target.path, {
      "hub.mode": "subscribe",
      "hub.verify_token": task.token,
      "hub.challenge": task.challenge,
    });
    const reqDuration = performance.now() - reqStart;

    let passed = false;
    if (task.shouldSucceed) {
      passed = res.status === 200 && res.body === task.challenge;
    } else {
      passed = res.status === 403;
    }

    return {
      task,
      res,
      reqDuration,
      passed,
    };
  });

  const burstResults = await Promise.all(parallelPromises);
  const totalBurstDurationMs = performance.now() - startBurst;

  const passedCount = burstResults.filter((b) => b.passed).length;
  const failedCount = burstResults.filter((b) => !b.passed).length;
  const durations = burstResults.map((b) => b.reqDuration).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const maxLat = durations[durations.length - 1];

  const suitePassed = failedCount === 0;

  results.push({
    category: "CONCURRENCY_BURST",
    endpointId: "all_endpoints",
    name: `Ráfaga simultánea de ${tasks.length} peticiones concurrentes`,
    passed: suitePassed,
    expectedStatus: 200,
    actualStatus: suitePassed ? 200 : 500,
    bodyMatch: true,
    notes: `${passedCount}/${tasks.length} respondidas correctamente en ${totalBurstDurationMs.toFixed(1)}ms. Latencias: p50=${p50.toFixed(1)}ms, p95=${p95.toFixed(1)}ms, max=${maxLat.toFixed(1)}ms`,
    durationMs: totalBurstDurationMs,
  });

  const sym = suitePassed ? `${colors.green}✓ PASS` : `${colors.red}✗ FAIL`;
  realLog(`  ${sym}${colors.reset} Total de ráfagas ejecutadas: ${tasks.length} en paralelo`);
  realLog(`         ↳ Exitosas: ${colors.green}${passedCount}${colors.reset} | Fallidas: ${failedCount > 0 ? colors.red : colors.green}${failedCount}${colors.reset}`);
  realLog(`         ↳ Tiempo total ráfaga: ${(totalBurstDurationMs / 1000).toFixed(2)}s | p50: ${p50.toFixed(1)}ms | p95: ${p95.toFixed(1)}ms | max: ${maxLat.toFixed(1)}ms`);
}

// ----------------------------------------------------------------------------
// RESUMEN GLOBAL Y VEREDICTO
// ----------------------------------------------------------------------------
function printFinalVerdict(): boolean {
  realLog(`\n${colors.cyan}${colors.bold}======================================================================${colors.reset}`);
  realLog(`${colors.cyan}${colors.bold}      REPORTE DE ESTRÉS ADVERSARIAL Y ORÁCULO DE INTEGRIDAD           ${colors.reset}`);
  realLog(`${colors.cyan}${colors.bold}======================================================================${colors.reset}`);

  const categories = Array.from(new Set(results.map((r) => r.category)));

  for (const cat of categories) {
    const items = results.filter((r) => r.category === cat);
    const passed = items.filter((r) => r.passed).length;
    const failed = items.filter((r) => !r.passed).length;
    const catColor = failed === 0 ? colors.green : colors.red;
    realLog(`${colors.bold}${cat}:${colors.reset} ${catColor}${passed}/${items.length} PASADAS${colors.reset}`);
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  realLog(`${colors.cyan}----------------------------------------------------------------------${colors.reset}`);
  realLog(`Total Aserciones Adversariales: ${total}`);
  realLog(`Aprobadas:                     ${colors.green}${colors.bold}${passed}${colors.reset}`);
  realLog(`Fallidas:                      ${failed > 0 ? colors.red : colors.green}${colors.bold}${failed}${colors.reset}`);

  if (failed === 0) {
    realLog(`\n${colors.green}${colors.bold}VEREDICTO ADVERSARIAL: APPROVE (SISTEMA ALTAMENTE ROBUSTO)${colors.reset}`);
    realLog(`${colors.dim}Los handlers resistieron retos de 64KB, UTF-8/emojis complejos, 120 peticiones concurrentes,${colors.reset}`);
    realLog(`${colors.dim}inyecciones SQL/NoSQL/XSS con sanitización de tipo y respuesta estricta text/plain.${colors.reset}\n`);
    return true;
  } else {
    realLog(`\n${colors.red}${colors.bold}VEREDICTO ADVERSARIAL: REQUEST_CHANGES${colors.reset}`);
    realLog(`${colors.red}Se encontraron vulnerabilidades o divergencias en el comportamiento de los endpoints.${colors.reset}\n`);
    return false;
  }
}

async function main() {
  const overallStart = performance.now();
  const verbose = process.argv.includes("--verbose");

  if (!verbose) {
    // Silenciar console.log y console.warn internos de las rutas para mantener un reporte limpio
    console.log = () => {};
    console.warn = () => {};
  }

  realLog(`\n${colors.magenta}${colors.bold}=== CHALLENGER 2: ADVERSARIAL STRESS TEST HARNESS (META WEBHOOKS) ===${colors.reset}`);

  try {
    await runLargeChallengeTests();
    await runUnicodeAndSpecialCharTests();
    await runAdversarialInjectionTests();
    await runConcurrencyTests();
  } catch (err) {
    realError(`\n${colors.red}${colors.bold}ERROR INESPERADO DURANTE EJECUCIÓN:${colors.reset}`, err);
    process.exit(1);
  } finally {
    console.log = realLog;
    console.warn = realWarn;
  }

  const success = printFinalVerdict();
  const overallDuration = (performance.now() - overallStart) / 1000;
  realLog(`Tiempo total de ejecución de la suite de estrés: ${overallDuration.toFixed(2)}s\n`);

  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  realError("Error fatal:", err);
  process.exit(1);
});
