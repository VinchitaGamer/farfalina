import { GET as getWhatsApp } from "../../../app/api/webhooks/whatsapp/route";
import { GET as getFacebook } from "../../../app/api/webhooks/facebook/route";
import { GET as getInstagram } from "../../../app/api/webhooks/instagram/route";

async function edgeProbe() {
  console.log("=== EDGE CASE PROBE ===");
  const DEFAULT_TOKEN = "farfalina_carissma_webhook_verify_token_2026";
  const TEST_CHALLENGE = "9876543210_edge_challenge";

  const routes = [
    { name: "whatsapp", handler: getWhatsApp },
    { name: "facebook", handler: getFacebook },
    { name: "instagram", handler: getInstagram },
  ];

  for (const r of routes) {
    console.log(`\n================== ${r.name.toUpperCase()} ==================`);

    // Edge 1: Case sensitivity of hub.mode ('SUBSCRIBE' vs 'subscribe')
    {
      const url = `http://localhost:3000/api/webhooks/${r.name}?hub.mode=SUBSCRIBE&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=${DEFAULT_TOKEN}`;
      const res = await r.handler(new Request(url));
      console.log(`[Edge 1 - Uppercase hub.mode] status=${res.status}, body=${await res.text()}`);
    }

    // Edge 2: Whitespace in token ('  token  ')
    {
      const url = `http://localhost:3000/api/webhooks/${r.name}?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=%20${DEFAULT_TOKEN}%20`;
      const res = await r.handler(new Request(url));
      console.log(`[Edge 2 - Whitespace in token] status=${res.status}, body=${await res.text()}`);
    }

    // Edge 3: Trailing slash in URL path
    {
      const url = `http://localhost:3000/api/webhooks/${r.name}/?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=${DEFAULT_TOKEN}`;
      const res = await r.handler(new Request(url));
      console.log(`[Edge 3 - Trailing slash] status=${res.status}, body=${await res.text()}`);
    }

    // Edge 4: Empty string challenge ('hub.challenge=')
    {
      const url = `http://localhost:3000/api/webhooks/${r.name}?hub.mode=subscribe&hub.challenge=&hub.verify_token=${DEFAULT_TOKEN}`;
      const res = await r.handler(new Request(url));
      console.log(`[Edge 4 - Empty challenge] status=${res.status}, body=${await res.text()}`);
    }

    // Edge 5: Challenge with special characters and symbols
    {
      const challengeRaw = "challenge#value?test=1&foo=bar+baz%2F";
      const url = `http://localhost:3000/api/webhooks/${r.name}?hub.mode=subscribe&hub.challenge=${encodeURIComponent(challengeRaw)}&hub.verify_token=${DEFAULT_TOKEN}`;
      const res = await r.handler(new Request(url));
      const body = await res.text();
      console.log(`[Edge 5 - Encoded symbols] status=${res.status}, body=${body}, match=${body === challengeRaw}`);
    }

    // Edge 6: Challenge with integer vs string representation (Meta sends numeric strings e.g. "1158201444")
    {
      const numChallenge = "1158201444";
      const url = `http://localhost:3000/api/webhooks/${r.name}?hub.mode=subscribe&hub.challenge=${numChallenge}&hub.verify_token=${DEFAULT_TOKEN}`;
      const res = await r.handler(new Request(url));
      const body = await res.text();
      console.log(`[Edge 6 - Numeric Meta Challenge] status=${res.status}, body=${body}, match=${body === numChallenge}`);
    }

    // Edge 7: Very long challenge (1024 characters)
    {
      const longChallenge = "a".repeat(1024);
      const url = `http://localhost:3000/api/webhooks/${r.name}?hub.mode=subscribe&hub.challenge=${longChallenge}&hub.verify_token=${DEFAULT_TOKEN}`;
      const res = await r.handler(new Request(url));
      const body = await res.text();
      console.log(`[Edge 7 - Long Challenge 1KB] status=${res.status}, len=${body.length}, match=${body === longChallenge}`);
    }

    // Edge 8: Additional Meta headers (User-Agent: FacebookPlatform, etc.)
    {
      const url = `http://localhost:3000/api/webhooks/${r.name}?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=${DEFAULT_TOKEN}`;
      const res = await r.handler(new Request(url, {
        headers: {
          "user-agent": "facebookexternalua",
          "accept": "*/*",
        }
      }));
      console.log(`[Edge 8 - Meta User Agent] status=${res.status}, body=${await res.text()}`);
    }

    // Edge 9: Content-Type header on response
    {
      const url = `http://localhost:3000/api/webhooks/${r.name}?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=${DEFAULT_TOKEN}`;
      const res = await r.handler(new Request(url));
      console.log(`[Edge 9 - Response Headers] Content-Type=${res.headers.get("content-type")}`);
    }
  }

  process.exit(0);
}

edgeProbe().catch((err) => {
  console.error("Edge probe failed:", err);
  process.exit(1);
});
