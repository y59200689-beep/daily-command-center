import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!value) throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured.");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return bytes;
}

export function encryptToken(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); const tag = cipher.getAuthTag();
  return `\\x${Buffer.concat([iv, tag, encrypted]).toString("hex")}`;
}

export function decryptToken(value: string) {
  const packed = Buffer.from(value.replace(/^\\x/, ""), "hex"); const iv = packed.subarray(0, 12); const tag = packed.subarray(12, 28); const encrypted = packed.subarray(28); const decipher = createDecipheriv("aes-256-gcm", key(), iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
