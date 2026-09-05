import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const journalPath = resolve(root, "drizzle/meta/_journal.json");
const journal = JSON.parse(await readFile(journalPath, "utf8"));

const persistTo = resolve(root, ".wrangler/state");

function executeMigration(tag) {
  const file = `drizzle/${tag}.sql`;

  return new Promise((resolveMigration, rejectMigration) => {
    const child = spawn(
      "wrangler",
      ["d1", "execute", "DB", "--local", "-c", "scripts/wrangler.jsonc", "--persist-to", persistTo, "--file", file],
      {
        cwd: root,
        env: {
          ...process.env,
          WRANGLER_WRITE_LOGS: "false",
          WRANGLER_LOG_PATH: ".wrangler/logs",
          MINIFLARE_REGISTRY_PATH: ".wrangler/registry",
        },
        stdio: "inherit",
      },
    );

    child.once("error", rejectMigration);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveMigration();
        return;
      }
      rejectMigration(new Error(`Migration ${file} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
    });
  });
}

for (const entry of journal.entries) {
  const file = `drizzle/${entry.tag}.sql`;
  console.log(`Applying ${file}`);
  await executeMigration(entry.tag);
}
