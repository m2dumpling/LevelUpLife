import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();

test("production build does not depend on Google Fonts network access", () => {
  const layout = readFileSync(join(projectRoot, "src", "app", "layout.tsx"), "utf8");
  const globals = readFileSync(join(projectRoot, "src", "app", "globals.css"), "utf8");

  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(globals, /--font-sans:\s*system-ui/);
  assert.match(globals, /--font-mono:\s*"SFMono-Regular"/);
});

test("standalone asset script copies Next static assets and public files", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "leveluplife-assets-"));
  try {
    mkdirSync(join(tempDir, ".next", "static", "chunks"), { recursive: true });
    mkdirSync(join(tempDir, ".next", "standalone"), { recursive: true });
    mkdirSync(join(tempDir, "public"), { recursive: true });
    writeFileSync(join(tempDir, ".next", "static", "chunks", "app.js"), "console.log('ok');");
    writeFileSync(join(tempDir, "public", "manifest.json"), "{}");

    const result = spawnSync(
      process.execPath,
      [join(projectRoot, "scripts", "copy-standalone-assets.mjs")],
      { cwd: tempDir, encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(existsSync(join(tempDir, ".next", "standalone", ".next", "static", "chunks", "app.js")));
    assert.ok(existsSync(join(tempDir, ".next", "standalone", "public", "manifest.json")));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
