async function probe() {
  console.log("1. Probing localhost:3000 GET webhook verification...");
  try {
    const res1 = await fetch("http://localhost:3000/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=farfalina_carissma_webhook_verify_token_2026&hub.challenge=test_challenge_123");
    const text1 = await res1.text();
    console.log(`Localhost GET: status=${res1.status}, body="${text1}"`);
  } catch (err) {
    console.log("Localhost GET error:", err.message);
  }

  console.log("\n2. Probing tunnel https://omnichannel.farfalina.tech GET webhook verification...");
  try {
    const res2 = await fetch("https://omnichannel.farfalina.tech/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=farfalina_carissma_webhook_verify_token_2026&hub.challenge=tunnel_challenge_456");
    const text2 = await res2.text();
    console.log(`Tunnel GET: status=${res2.status}, body="${text2}"`);
  } catch (err) {
    console.log("Tunnel GET error:", err.message);
  }
}

probe();
