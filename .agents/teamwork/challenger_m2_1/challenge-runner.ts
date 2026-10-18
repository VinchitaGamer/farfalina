import http from "http";
import path from "path";
import fs from "fs";
import { AddressInfo } from "net";
import {
  cacheAvatarLocally,
  ensureAvatarsDirectory,
  getInstagramUserProfile,
  InstagramUserProfileSchema,
} from "../../../lib/instagram-profile";

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  details: string;
  error?: string;
}

const results: TestResult[] = [];

// Sample 1x1 valid JPEG image buffer
const SAMPLE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

// Larger realistic image buffer (10 KB)
const REALISTIC_IMAGE = Buffer.concat([SAMPLE_JPEG, Buffer.alloc(10000, 0xab)]);

const AVATARS_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

function cleanupTestFiles(prefixPattern: string) {
  if (!fs.existsSync(AVATARS_DIR)) return;
  const files = fs.readdirSync(AVATARS_DIR);
  for (const f of files) {
    if (f.startsWith(prefixPattern)) {
      try {
        fs.unlinkSync(path.join(AVATARS_DIR, f));
      } catch {}
    }
  }
}

async function runTest(
  name: string,
  category: string,
  fn: () => Promise<string>
) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({ name, category, passed: true, durationMs, details });
    console.log(`  [PASS] ${name} (${durationMs}ms) - ${details}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const msg = err?.message || String(err);
    results.push({ name, category, passed: false, durationMs, details: msg, error: msg });
    console.error(`  [FAIL] ${name} (${durationMs}ms) - ${msg}`);
  }
}

async function startMockServer(): Promise<{
  server: http.Server;
  baseUrl: string;
  requestCounts: Record<string, number>;
}> {
  const requestCounts: Record<string, number> = {};

  const server = http.createServer((req, res) => {
    const urlPath = req.url?.split("?")[0] || "/";
    requestCounts[urlPath] = (requestCounts[urlPath] || 0) + 1;

    // Route: 404 Not Found
    if (urlPath === "/avatar/404.jpg") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    // Route: 500 Server Error
    if (urlPath === "/avatar/500.jpg") {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      return;
    }

    // Route: 0-byte empty response
    if (urlPath === "/avatar/empty.jpg") {
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(Buffer.alloc(0));
      return;
    }

    // Route: Non-image HTML payload with 200 OK
    if (urlPath === "/avatar/non-image.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!DOCTYPE html><html><body>Error Access Denied CDN</body></html>");
      return;
    }

    // Route: Normal valid JPEG
    if (urlPath === "/avatar/valid.jpg") {
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(REALISTIC_IMAGE);
      return;
    }

    // Route: Valid JPEG with artificial delay for concurrency testing
    if (urlPath === "/avatar/delayed.jpg") {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(REALISTIC_IMAGE);
      }, 50);
      return;
    }

    // Route: Mock Meta Graph API responses
    if (urlPath.startsWith("/v22.0/")) {
      const match = urlPath.match(/\/v22\.0\/([^\/?]+)/);
      const customerId = match ? match[1] : "";

      if (customerId === "mock_oauth_error") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: {
            message: "Invalid OAuth access token.",
            type: "OAuthException",
            code: 190,
          },
        }));
        return;
      }

      if (customerId === "mock_empty_user") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({}));
        return;
      }

      if (customerId === "mock_no_avatar_user") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          id: "mock_no_avatar_user",
          username: "sour_dev",
          name: "Sour Dev",
          profile_pic: null,
        }));
        return;
      }

      if (customerId === "mock_valid_user") {
        const address = server.address() as AddressInfo;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          id: "mock_valid_user",
          username: "sour_valid",
          name: "Sour Valid User",
          profile_pic: `http://127.0.0.1:${address.port}/avatar/valid.jpg`,
        }));
        return;
      }
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${addr.port}`,
    requestCounts,
  };
}

async function main() {
  console.log("================================================================================");
  console.log("  CHALLENGER 1: EMPIRICAL STRESS & RESILIENCE TEST SUITE (MILESTONE M2)");
  console.log("================================================================================\n");

  const mock = await startMockServer();
  console.log(`Mock server listening at ${mock.baseUrl}\n`);

  try {
    ensureAvatarsDirectory();
    cleanupTestFiles("ig_test_");
    cleanupTestFiles("fb_test_");
    cleanupTestFiles("ig_conc_");

    // =========================================================================
    // GROUP A: CDN Resilience & Edge Cases
    // =========================================================================
    console.log(">>> GROUP A: CDN Resilience, Malformed Inputs & Non-Image Data");

    await runTest("CDN 404 Response Graceful Fallback", "Group A", async () => {
      const targetId = "test_404_user";
      const remote404 = `${mock.baseUrl}/avatar/404.jpg`;
      const result = await cacheAvatarLocally(remote404, "ig", targetId);
      if (result !== remote404) {
        throw new Error(`Expected fallback to original URL '${remote404}', got '${result}'`);
      }
      const filePath = path.join(AVATARS_DIR, `ig_${targetId}.jpg`);
      if (fs.existsSync(filePath)) {
        throw new Error("File should NOT have been created on disk for 404 response");
      }
      return `Correctly avoided file creation and returned fallback remoteUrl: ${result}`;
    });

    await runTest("CDN 500 Server Error Graceful Fallback", "Group A", async () => {
      const targetId = "test_500_user";
      const remote500 = `${mock.baseUrl}/avatar/500.jpg`;
      const result = await cacheAvatarLocally(remote500, "ig", targetId);
      if (result !== remote500) {
        throw new Error(`Expected fallback to remote URL, got '${result}'`);
      }
      return `Handled HTTP 500 cleanly without crashing: ${result}`;
    });

    await runTest("Invalid & Malformed URL Inputs", "Group A", async () => {
      const resNull = await cacheAvatarLocally(null, "ig", "test_null");
      const resUndef = await cacheAvatarLocally(undefined, "ig", "test_undef");
      const resEmpty = await cacheAvatarLocally("", "ig", "test_empty");
      const resFtp = await cacheAvatarLocally("ftp://invalid-protocol.com/img.jpg", "ig", "test_ftp");
      const resGarbage = await cacheAvatarLocally("not-a-valid-url-at-all", "ig", "test_garbage");

      if (resNull !== null || resUndef !== null || resEmpty !== null) {
        throw new Error(`Null/undefined/empty returned unexpected values: null=${resNull}, undef=${resUndef}, empty=${resEmpty}`);
      }
      if (resFtp !== "ftp://invalid-protocol.com/img.jpg") {
        throw new Error(`FTP protocol URL did not pass through as fallback: got ${resFtp}`);
      }
      if (resGarbage !== "not-a-valid-url-at-all") {
        throw new Error(`Garbage string did not pass through as fallback: got ${resGarbage}`);
      }
      return "All non-http / invalid inputs returned safe fallbacks without throwing";
    });

    await runTest("Network Connection Refused (Unreachable Host)", "Group A", async () => {
      const unreachableUrl = "http://127.0.0.1:59999/avatar/offline.jpg";
      const result = await cacheAvatarLocally(unreachableUrl, "ig", "test_offline");
      if (result !== unreachableUrl) {
        throw new Error(`Expected fallback to original URL on network error, got '${result}'`);
      }
      return "Gracefully caught fetch ECONNREFUSED and returned original remoteUrl";
    });

    await runTest("0-Byte Empty Body from CDN", "Group A", async () => {
      const targetId = "test_empty_body_user";
      const emptyUrl = `${mock.baseUrl}/avatar/empty.jpg`;
      const result = await cacheAvatarLocally(emptyUrl, "ig", targetId);
      if (result !== emptyUrl) {
        throw new Error(`Expected fallback to remote URL on 0-byte body, got '${result}'`);
      }
      const filePath = path.join(AVATARS_DIR, `ig_${targetId}.jpg`);
      if (fs.existsSync(filePath)) {
        throw new Error("File should NOT have been created for 0-byte body");
      }
      return "Detected 0 bytes body, avoided writing empty file, returned fallback";
    });

    await runTest("Non-Image HTML Response Analysis", "Group A", async () => {
      const targetId = "test_html_user";
      const htmlUrl = `${mock.baseUrl}/avatar/non-image.html`;
      const result = await cacheAvatarLocally(htmlUrl, "ig", targetId);
      const filePath = path.join(AVATARS_DIR, `ig_${targetId}.jpg`);

      // We check what happens when CDN sends 200 OK with HTML content
      const exists = fs.existsSync(filePath);
      const size = exists ? fs.statSync(filePath).size : 0;
      return `Behavior observation: Saved HTML payload (${size} bytes) to disk under /uploads/avatars/ig_${targetId}.jpg. Result: ${result}`;
    });

    // =========================================================================
    // GROUP B: Cache TTL Logic & Stale Fallback
    // =========================================================================
    console.log("\n>>> GROUP B: Local Cache TTL Logic & Stale File Fallback");

    await runTest("Fresh Cache Hit Avoids Redundant Downloads", "Group B", async () => {
      const targetId = "test_ttl_user_1";
      const validUrl = `${mock.baseUrl}/avatar/valid.jpg`;

      const initialCount = mock.requestCounts["/avatar/valid.jpg"] || 0;

      // 1st call: Cold cache miss -> must download
      const res1 = await cacheAvatarLocally(validUrl, "ig", targetId);
      const countAfterFirst = mock.requestCounts["/avatar/valid.jpg"] || 0;
      if (countAfterFirst !== initialCount + 1) {
        throw new Error(`Expected 1 download request, but count is ${countAfterFirst}`);
      }

      // 2nd call: Fresh cache hit -> must NOT download
      const res2 = await cacheAvatarLocally(validUrl, "ig", targetId);
      const countAfterSecond = mock.requestCounts["/avatar/valid.jpg"] || 0;
      if (countAfterSecond !== countAfterFirst) {
        throw new Error(`Expected NO download request on fresh hit, but count increased to ${countAfterSecond}`);
      }
      if (res1 !== res2 || res2 !== `/uploads/avatars/ig_${targetId}.jpg`) {
        throw new Error(`Unexpected path returned: res1=${res1}, res2=${res2}`);
      }

      return `Cold fetch downloaded 1x; warm fetch reused disk cache without HTTP request (total requests: ${countAfterSecond})`;
    });

    await runTest("Expired Cache Triggers Fresh Download & Updates mtime", "Group B", async () => {
      const targetId = "test_ttl_user_2";
      const validUrl = `${mock.baseUrl}/avatar/valid.jpg`;
      const filePath = path.join(AVATARS_DIR, `ig_${targetId}.jpg`);

      // Create initial cached file
      await cacheAvatarLocally(validUrl, "ig", targetId);
      const initialMtime = fs.statSync(filePath).mtimeMs;

      // Artificially age the file to 25 hours ago (past 24h TTL)
      const pastTime = (Date.now() - 25 * 60 * 60 * 1000) / 1000;
      fs.utimesSync(filePath, pastTime, pastTime);
      const agedMtime = fs.statSync(filePath).mtimeMs;

      const countBefore = mock.requestCounts["/avatar/valid.jpg"] || 0;

      // Call cacheAvatarLocally again: should detect expiry and re-fetch
      const res = await cacheAvatarLocally(validUrl, "ig", targetId);
      const countAfter = mock.requestCounts["/avatar/valid.jpg"] || 0;
      const refreshedMtime = fs.statSync(filePath).mtimeMs;

      if (countAfter !== countBefore + 1) {
        throw new Error(`Expired file did not trigger re-fetch! Count before: ${countBefore}, after: ${countAfter}`);
      }
      if (refreshedMtime <= agedMtime) {
        throw new Error(`File mtime was not updated after re-fetch. Aged: ${agedMtime}, Refreshed: ${refreshedMtime}`);
      }

      return `Expired file (>24h) successfully re-fetched from CDN and updated mtime from ${new Date(agedMtime).toISOString()} to ${new Date(refreshedMtime).toISOString()}`;
    });

    await runTest("Expired Cache with CDN Failure Falls Back to Stale Disk Copy", "Group B", async () => {
      const targetId = "test_ttl_stale_fallback";
      const validUrl = `${mock.baseUrl}/avatar/valid.jpg`;
      const brokenUrl = `${mock.baseUrl}/avatar/500.jpg`;
      const filePath = path.join(AVATARS_DIR, `ig_${targetId}.jpg`);

      // Create initial valid file
      await cacheAvatarLocally(validUrl, "ig", targetId);

      // Artificially age file to 26 hours ago
      const pastTime = (Date.now() - 26 * 60 * 60 * 1000) / 1000;
      fs.utimesSync(filePath, pastTime, pastTime);

      // Attempt refresh with a failing remote URL (500)
      const res = await cacheAvatarLocally(brokenUrl, "ig", targetId);

      // It must NOT fail or return broken remote URL; it must fallback to existing local copy!
      const expectedLocal = `/uploads/avatars/ig_${targetId}.jpg`;
      if (res !== expectedLocal) {
        throw new Error(`Expected fallback to stale local file '${expectedLocal}', but got '${res}'`);
      }

      return `Resilience confirmed: When remote refresh fails, system safely preserves and returns stale local file: ${res}`;
    });

    // =========================================================================
    // GROUP C: High Concurrency Stress & Integrity Testing
    // =========================================================================
    console.log("\n>>> GROUP C: High-Concurrency Stress & Windows File Lock Integrity");

    await runTest("30 Concurrent Requests for the Same Profile (Cold Cache Miss)", "Group C", async () => {
      const targetId = "conc_same_cold";
      const delayedUrl = `${mock.baseUrl}/avatar/delayed.jpg`;
      const filePath = path.join(AVATARS_DIR, `ig_${targetId}.jpg`);

      // Ensure file does not exist
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      const CONCURRENCY = 30;
      const promises = Array.from({ length: CONCURRENCY }, () =>
        cacheAvatarLocally(delayedUrl, "ig", targetId)
      );

      const start = Date.now();
      const resultsArray = await Promise.all(promises);
      const duration = Date.now() - start;

      // Validate all returned the correct local path
      const expected = `/uploads/avatars/ig_${targetId}.jpg`;
      for (let i = 0; i < resultsArray.length; i++) {
        if (resultsArray[i] !== expected) {
          throw new Error(`Worker ${i} returned unexpected path: ${resultsArray[i]}`);
        }
      }

      // Check file on disk
      if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filePath} was not found on disk after concurrent execution`);
      }

      const fileStat = fs.statSync(filePath);
      if (fileStat.size !== REALISTIC_IMAGE.byteLength) {
        throw new Error(`File size mismatch: expected ${REALISTIC_IMAGE.byteLength} bytes, got ${fileStat.size} bytes`);
      }

      const diskBytes = fs.readFileSync(filePath);
      if (!diskBytes.equals(REALISTIC_IMAGE)) {
        throw new Error("File content corrupted during concurrent write!");
      }

      return `Executed ${CONCURRENCY} concurrent requests in ${duration}ms without Windows file lock errors. Disk file verified: ${fileStat.size} bytes intact`;
    });

    await runTest("30 Concurrent Requests for Expired Cache Re-fetch", "Group C", async () => {
      const targetId = "conc_same_expired";
      const delayedUrl = `${mock.baseUrl}/avatar/delayed.jpg`;
      const filePath = path.join(AVATARS_DIR, `ig_${targetId}.jpg`);

      // Create initial file and expire it
      await cacheAvatarLocally(delayedUrl, "ig", targetId);
      const pastTime = (Date.now() - 30 * 60 * 60 * 1000) / 1000;
      fs.utimesSync(filePath, pastTime, pastTime);

      const CONCURRENCY = 30;
      const promises = Array.from({ length: CONCURRENCY }, () =>
        cacheAvatarLocally(delayedUrl, "ig", targetId)
      );

      const resultsArray = await Promise.all(promises);
      const expected = `/uploads/avatars/ig_${targetId}.jpg`;
      for (const res of resultsArray) {
        if (res !== expected) throw new Error(`Unexpected return: ${res}`);
      }

      const fileStat = fs.statSync(filePath);
      if (fileStat.size !== REALISTIC_IMAGE.byteLength) {
        throw new Error(`Corrupted file size on re-fetch: ${fileStat.size}`);
      }

      return `30 concurrent workers re-fetched expired avatar smoothly. Final size: ${fileStat.size} bytes`;
    });

    await runTest("50 Concurrent Requests Across 50 Distinct Contact IDs", "Group C", async () => {
      const CONCURRENCY = 50;
      const promises = Array.from({ length: CONCURRENCY }, (_, i) => {
        const id = `conc_multi_${i}`;
        const url = `${mock.baseUrl}/avatar/valid.jpg`;
        return cacheAvatarLocally(url, "ig", id);
      });

      const start = Date.now();
      const resultsArray = await Promise.all(promises);
      const duration = Date.now() - start;

      if (resultsArray.length !== CONCURRENCY) {
        throw new Error(`Expected ${CONCURRENCY} results, got ${resultsArray.length}`);
      }

      // Check all 50 files
      let verifiedCount = 0;
      for (let i = 0; i < CONCURRENCY; i++) {
        const filePath = path.join(AVATARS_DIR, `ig_conc_multi_${i}.jpg`);
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          if (stat.size === REALISTIC_IMAGE.byteLength) {
            verifiedCount++;
          }
        }
      }

      if (verifiedCount !== CONCURRENCY) {
        throw new Error(`Only ${verifiedCount}/${CONCURRENCY} files verified intact`);
      }

      return `Successfully handled ${CONCURRENCY} parallel downloads in ${duration}ms. All 50 avatars created and validated`;
    });

    // =========================================================================
    // GROUP D: Profile Fetching Schema & Graph API Resiliency
    // =========================================================================
    console.log("\n>>> GROUP D: Graph API Error Resiliency & Schema Handling");

    await runTest("OAuth Token Rejection (HTTP 400 OAuthException)", "Group D", async () => {
      // We pass our mock URL prefix via secondaryToken or custom mock test
      // Test getInstagramUserProfile directly
      const result = await getInstagramUserProfile("mock_oauth_error", "EAAG_invalid_token_12345");
      // Since EAAG_invalid_token_12345 will try graph.instagram.com and graph.facebook.com and fail
      if (result !== null) {
        throw new Error(`Expected null on rejected token, got ${JSON.stringify(result)}`);
      }
      return "OAuth rejection caught cleanly, returns null without throwing";
    });

    await runTest("Zod Validation Schema Integrity", "Group D", async () => {
      // Verify schema accepts both profilePicUrl and profilePic
      const parsedWithBoth = InstagramUserProfileSchema.parse({
        id: "1304358138230682",
        name: "no juan",
        username: "acido_juan",
        profilePicUrl: "/uploads/avatars/ig_1304358138230682.jpg",
        profilePic: "/uploads/avatars/ig_1304358138230682.jpg",
      });

      // Verify schema allows null profilePicUrl
      const parsedWithNullPic = InstagramUserProfileSchema.parse({
        id: "9999",
        name: "Sin Foto",
        username: "sin_foto",
        profilePicUrl: null,
      });

      // Verify schema rejects missing required fields
      let threwOnMissing = false;
      try {
        InstagramUserProfileSchema.parse({ id: "123" });
      } catch {
        threwOnMissing = true;
      }

      if (!threwOnMissing) {
        throw new Error("Schema should reject missing name/username");
      }

      return "Zod schema enforces strict contract and backward compatibility with profilePic";
    });

  } finally {
    // Stop mock server
    mock.server.close();
    // Clean up test files created during challenge
    cleanupTestFiles("ig_test_");
    cleanupTestFiles("fb_test_");
    cleanupTestFiles("ig_conc_");
  }

  // =========================================================================
  // Summary & Report Generation
  // =========================================================================
  console.log("\n================================================================================");
  console.log("  CHALLENGE RUNNER EXECUTION SUMMARY");
  console.log("================================================================================");

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Scenarios Tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("================================================================================\n");

  if (failed > 0) {
    console.error(`❌ CHALLENGE FAILED: ${failed} scenarios failed.`);
    process.exit(1);
  } else {
    console.log("✅ ALL ADVERSARIAL CHALLENGES COMPLETED SUCCESSFULLY!");
  }
}

main().catch((err) => {
  console.error("FATAL ERROR IN CHALLENGE RUNNER:", err);
  process.exit(1);
});
