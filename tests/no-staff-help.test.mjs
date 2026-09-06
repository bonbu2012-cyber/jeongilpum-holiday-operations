import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [target] : [];
  }));
  return files.flat();
}

test("all application pages omit the staff help control", async () => {
  const files = await sourceFiles("app");

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /직원\s*도움|staff-help|help-toast/, file);
  }
});
