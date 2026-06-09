import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const nextStaticDir = path.join(root, ".next", "static");
const standaloneNextDir = path.join(standaloneDir, ".next");
const standaloneStaticDir = path.join(standaloneNextDir, "static");
const publicDir = path.join(root, "public");
const standalonePublicDir = path.join(standaloneDir, "public");

if (!existsSync(standaloneDir)) {
  console.warn("[standalone-assets] .next/standalone not found; skipping asset copy.");
  process.exit(0);
}

if (!existsSync(nextStaticDir)) {
  console.warn("[standalone-assets] .next/static not found; skipping asset copy.");
  process.exit(0);
}

mkdirSync(standaloneNextDir, { recursive: true });
rmSync(standaloneStaticDir, { recursive: true, force: true });
cpSync(nextStaticDir, standaloneStaticDir, { recursive: true });

if (existsSync(publicDir)) {
  rmSync(standalonePublicDir, { recursive: true, force: true });
  cpSync(publicDir, standalonePublicDir, { recursive: true });
}

console.log("[standalone-assets] Copied .next/static and public into .next/standalone.");
