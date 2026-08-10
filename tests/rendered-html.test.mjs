import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const port = 43123;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/login`);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next.js production server did not start in time.");
}

test("server-renders the Fokusplan application shell", async () => {
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: process.cwd(),
    stdio: "ignore",
  });

  try {
    const response = await waitForServer();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, /<title>Fokusplan<\/title>/i);
    assert.match(html, /Dein Plan wird vorbereitet/i);
    assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  } finally {
    server.kill();
  }
});
