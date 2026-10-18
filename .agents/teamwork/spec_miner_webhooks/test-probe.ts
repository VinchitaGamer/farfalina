import { GET as getWhatsApp } from "../../../app/api/webhooks/whatsapp/route";
import { GET as getFacebook } from "../../../app/api/webhooks/facebook/route";
import { GET as getInstagram } from "../../../app/api/webhooks/instagram/route";

async function probe() {
  console.log("=== PROBING WEBHOOK GET HANDLERS ===");
  const DEFAULT_TOKEN = "farfalina_carissma_webhook_verify_token_2026";
  const TEST_CHALLENGE = "1158201444";

  const routes = [
    { name: "whatsapp", handler: getWhatsApp, path: "/api/webhooks/whatsapp" },
    { name: "facebook", handler: getFacebook, path: "/api/webhooks/facebook" },
    { name: "instagram", handler: getInstagram, path: "/api/webhooks/instagram" },
  ];

  for (const r of routes) {
    console.log(`\n--- Testing ${r.name} ---`);

    // Case 1: Default token valid handshake
    {
      const url = `http://localhost:3000${r.path}?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=${DEFAULT_TOKEN}`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Default Token] status=${res.status}, body="${text}", contentType="${res.headers.get("content-type")}"`);
    }

    // Case 2: Configured META_VERIFY_TOKEN in env
    {
      process.env.META_VERIFY_TOKEN = "custom_meta_token_xyz_999";
      const url = `http://localhost:3000${r.path}?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=custom_meta_token_xyz_999`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Env Token] status=${res.status}, body="${text}", contentType="${res.headers.get("content-type")}"`);
      delete process.env.META_VERIFY_TOKEN;
    }

    // Case 3: Wrong token
    {
      const url = `http://localhost:3000${r.path}?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=wrong_token_abc`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Wrong Token] status=${res.status}, body="${text}"`);
    }

    // Case 4: Invalid hub.mode
    {
      const url = `http://localhost:3000${r.path}?hub.mode=unsubscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=${DEFAULT_TOKEN}`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Invalid Mode] status=${res.status}, body="${text}"`);
    }

    // Case 5: Missing hub.mode
    {
      const url = `http://localhost:3000${r.path}?hub.challenge=${TEST_CHALLENGE}&hub.verify_token=${DEFAULT_TOKEN}`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Missing Mode] status=${res.status}, body="${text}"`);
    }

    // Case 6: Missing hub.verify_token
    {
      const url = `http://localhost:3000${r.path}?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Missing Token] status=${res.status}, body="${text}"`);
    }

    // Case 7: Missing hub.challenge (empty challenge)
    {
      const url = `http://localhost:3000${r.path}?hub.mode=subscribe&hub.verify_token=${DEFAULT_TOKEN}`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Missing Challenge] status=${res.status}, body="${text}"`);
    }

    // Case 8: Challenge with special characters & spaces
    {
      const specialChallenge = "challenge_12345$@!-alpha";
      const url = `http://localhost:3000${r.path}?hub.mode=subscribe&hub.challenge=${encodeURIComponent(specialChallenge)}&hub.verify_token=${DEFAULT_TOKEN}`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Special Chars Challenge] status=${res.status}, body="${text}", matches=${text === specialChallenge}`);
    }

    // Case 9: Extra query parameters (e.g. ?env=carissma)
    {
      const url = `http://localhost:3000${r.path}?hub.mode=subscribe&hub.challenge=${TEST_CHALLENGE}&hub.verify_token=${DEFAULT_TOKEN}&env=carissma`;
      const req = new Request(url, { method: "GET" });
      const res = await r.handler(req);
      const text = await res.text();
      console.log(`[Extra Params] status=${res.status}, body="${text}"`);
    }
  }

  process.exit(0);
}

probe().catch((e) => {
  console.error("Probe error:", e);
  process.exit(1);
});
