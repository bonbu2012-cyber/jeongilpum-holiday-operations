import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".next", ".wrangler", "dist", "node_modules"]);

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await cssFiles(join(directory, entry.name)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".css")) files.push(join(directory, entry.name));
  }

  return files;
}

function rules(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "{") {
      const selector = source.slice(start, index).trim();
      if (selector) found.push({ depth, selector });
      depth += 1;
      start = index + 1;
      continue;
    }
    if (source[index] === "}") {
      depth = Math.max(0, depth - 1);
      start = index + 1;
    }
  }

  return found;
}

function selectorsContainingUi(ruleList) {
  return ruleList.flatMap(({ selector }) => selector
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /\.ui-[\w-]+/.test(item)));
}

async function allCssFiles() {
  return cssFiles(root);
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(join(root, filePath), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

test("shared UI primitives stay inside app/ui", async () => {
  const failures = [];
  const files = await allCssFiles();

  for (const file of files) {
    const filePath = relative(root, file);
    if (filePath.startsWith("app/ui/")) continue;

    const ruleList = rules(await readFile(file, "utf8"));
    for (const selector of selectorsContainingUi(ruleList)) {
      failures.push(`${filePath}: external shared selector ${selector}`);
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
});

test("app navigation has one top-level owner", async () => {
  const navFiles = new Set();
  const files = await allCssFiles();

  for (const file of files) {
    const filePath = relative(root, file);
    const ruleList = rules(await readFile(file, "utf8"));

    if (ruleList.some((rule) => rule.depth === 0 && rule.selector.split(",").map((item) => item.trim()).includes(".app-nav"))) {
      navFiles.add(filePath);
    }
  }

  assert.ok(
    navFiles.size <= 1,
    `.app-nav: top-level selector appears in multiple CSS files: ${[...navFiles].sort().join(", ")}`,
  );
});

test("shared components use radius tokens", async () => {
  const failures = [];
  const filePath = "app/ui/components.css";
  const css = await readFile(join(root, filePath), "utf8");

  for (const [index, line] of css.split("\n").entries()) {
    if (/border-radius\s*:\s*[^;]*\b\d+px/.test(line)) {
      failures.push(`${filePath}:${index + 1}: hardcoded pixel border-radius ${line.trim()}`);
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
});

test("operator CSS uses typography tokens", async () => {
  const failures = [];
  const typographyFiles = [
    "app/ui/components.css",
    "app/ui/navigation.css",
    "app/ui/operations.css",
    "app/ui/settings.css",
    "app/sales/work-table.css",
    "app/workshop-flow.css",
  ];

  for (const filePath of typographyFiles) {
    const css = await readOptionalFile(filePath);
    if (css === null) continue;

    for (const [index, line] of css.split("\n").entries()) {
      if (/font-size\s*:\s*[^;{}]*\b\d+(?:\.\d+)?px\b/.test(line)) {
        failures.push(`${filePath}:${index + 1}: literal pixel font-size ${line.trim()}`);
      }
      if (/\bfont\s*:\s*[^;{}]*\b\d+(?:\.\d+)?px\b/.test(line)) {
        failures.push(`${filePath}:${index + 1}: literal pixel font-size in font shorthand ${line.trim()}`);
      }
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
});
