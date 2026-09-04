import test from "node:test";
import assert from "node:assert/strict";
import { decryptToken, encryptToken } from "../src/lib/integrations/crypto";

test("OAuth tokens are encrypted and recoverable only server-side", () => {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptToken("refresh-token-secret");
    assert.notEqual(encrypted.includes("refresh-token-secret"), true);
    assert.equal(decryptToken(encrypted), "refresh-token-secret");
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = previous;
  }
});
