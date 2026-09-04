import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const modalSource = readFileSync(path.join(process.cwd(), "src/components/ui/modal.tsx"), "utf8");

test("modal focus lifecycle remains stable when the close callback changes identity", () => {
  assert.match(modalSource, /const onCloseRef = useRef\(onClose\);/);
  assert.match(modalSource, /onCloseRef\.current = onClose;/);
  assert.match(modalSource, /if \(event\.key === "Escape"\) onCloseRef\.current\(\);/);
  assert.doesNotMatch(modalSource, /\[open,\s*onClose\]/);
});
