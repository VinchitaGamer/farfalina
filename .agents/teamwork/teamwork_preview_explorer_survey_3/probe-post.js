const crypto = require('crypto');

async function testPostVariants() {
  const payload = JSON.stringify({
    object: "instagram",
    entry: [{
      id: "29643476368611224",
      time: Date.now(),
      messaging: [{
        sender: { id: "1777116329989423" },
        recipient: { id: "29643476368611224" },
        timestamp: Date.now(),
        message: {
          mid: "test_mid_" + Date.now(),
          text: "Prueba de diagnóstico de firma"
        }
      }]
    }]
  });

  // Test 1: POST without x-hub-signature-256 header
  console.log("--- Test 1: POST sin x-hub-signature-256 ---");
  try {
    const res1 = await fetch("http://localhost:3000/api/webhooks/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    const data1 = await res1.json();
    console.log(`Status: ${res1.status}, Response:`, data1);
  } catch (err) {
    console.error("Test 1 error:", err.message);
  }

  // Test 2: POST con header x-hub-signature-256 arbitrario
  console.log("\n--- Test 2: POST con x-hub-signature-256 arbitrario (sin META_APP_SECRET configurado en servidor) ---");
  try {
    const res2 = await fetch("http://localhost:3000/api/webhooks/instagram", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-hub-signature-256": "sha256=1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff"
      },
      body: payload
    });
    const data2 = await res2.json();
    console.log(`Status: ${res2.status}, Response:`, data2);
  } catch (err) {
    console.error("Test 2 error:", err.message);
  }
}

testPostVariants();
