const crypto = require('crypto');

function simulateSignatureCheck(rawBody, signature, appSecret) {
  if (appSecret && signature) {
    const hmac = crypto.createHmac("sha256", appSecret);
    const digest = "sha256=" + hmac.update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(digest);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      return { ok: false, status: 401, error: "Invalid signature", code: "UNAUTHORIZED" };
    }
  }
  return { ok: true, status: 200, code: "SUCCESS" };
}

const body = JSON.stringify({ test: "data" });
const realSecret = "meta_secret_abcdef123456";
const validSignature = "sha256=" + crypto.createHmac("sha256", realSecret).update(body).digest("hex");
const invalidSignature = "sha256=" + crypto.createHmac("sha256", "wrong_secret").update(body).digest("hex");

console.log("Scenario 1: appSecret is undefined, signature provided:");
console.log(simulateSignatureCheck(body, validSignature, undefined));

console.log("\nScenario 2: appSecret is undefined, no signature:");
console.log(simulateSignatureCheck(body, null, undefined));

console.log("\nScenario 3: appSecret is configured, VALID signature provided:");
console.log(simulateSignatureCheck(body, validSignature, realSecret));

console.log("\nScenario 4: appSecret is configured, INVALID signature provided:");
console.log(simulateSignatureCheck(body, invalidSignature, realSecret));

console.log("\nScenario 5: appSecret is configured, NO signature provided:");
console.log(simulateSignatureCheck(body, null, realSecret));

console.log("\nScenario 6: appSecret configured with wrong secret in .env, Meta sends valid signature with real secret:");
console.log(simulateSignatureCheck(body, validSignature, "wrong_configured_secret"));
