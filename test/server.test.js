const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const { start } = require("../server");

test("serves the health endpoint from an ephemeral port", async () => {
  const server = await start(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
  } finally {
    server.close();
    await once(server, "close");
  }
});
