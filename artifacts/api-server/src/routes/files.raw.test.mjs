/**
 * Integration tests for GET /files/raw
 * Run against a live api-server: node src/routes/files.raw.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

const BASE = "http://localhost:8080";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : await res.text();
  return { status: res.status, body, headers: res.headers };
}

describe("GET /api/files/raw", () => {
  test("valid absolute path returns 200 with file bytes", async () => {
    const { status, headers } = await get("/api/files/raw?path=/etc/hostname");
    assert.equal(status, 200);
    assert.ok(headers.get("content-length"), "Content-Length header should be set");
    assert.ok(headers.get("accept-ranges"), "Accept-Ranges header should be set");
  });

  test("missing path returns 400", async () => {
    const { status, body } = await get("/api/files/raw");
    assert.equal(status, 400);
    assert.ok(body.error, "Response should include error field");
  });

  test("relative path returns 400 Path must be absolute", async () => {
    const { status, body } = await get("/api/files/raw?path=../../etc/passwd");
    assert.equal(status, 400);
    assert.equal(body.error, "Path must be absolute");
  });

  test("traversal segment in absolute path returns 400", async () => {
    const { status, body } = await get(
      "/api/files/raw?path=/tmp/../../etc/shadow"
    );
    assert.equal(status, 400);
    assert.equal(body.error, "Path may not contain traversal segments");
  });

  test("URL-encoded traversal segment returns 400", async () => {
    const { status, body } = await get(
      "/api/files/raw?path=/tmp%2F..%2F..%2Fetc%2Fpasswd"
    );
    assert.equal(status, 400);
    assert.equal(body.error, "Path may not contain traversal segments");
  });

  test("directory path returns 400 Not a file", async () => {
    const { status, body } = await get("/api/files/raw?path=/etc");
    assert.equal(status, 400);
    assert.equal(body.error, "Not a file");
  });

  test("non-existent file returns 404", async () => {
    const { status } = await get(
      "/api/files/raw?path=/tmp/this-file-does-not-exist-xyz.txt"
    );
    assert.equal(status, 404);
  });
});
