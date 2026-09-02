import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(resolve(root, "data/catalog.json"), "utf8"));
const textFields = [
  "id",
  "category",
  "code",
  "name",
  "subtitle",
  "description",
  "displayWeight",
  "imageUrl",
  "badge",
];

for (const product of catalog) {
  for (const field of textFields) {
    if (typeof product[field] === "string" && product[field].includes(";")) {
      throw new Error(`Catalog value contains a semicolon: ${product.id}.${field}`);
    }
  }
}

function sqlValue(value) {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${value.replaceAll("'", "''")}'`;
}

const columns = [
  "id",
  "category",
  "code",
  "name",
  "subtitle",
  "description",
  "price",
  "display_weight",
  "image_url",
  "badge",
  "daily_limit",
  "sort_order",
  "active",
  "created_at",
  "updated_at",
];

const values = catalog.map((product) => [
  product.id,
  product.category,
  product.code,
  product.name,
  product.subtitle,
  product.description,
  product.price,
  product.displayWeight,
  product.imageUrl,
  product.badge,
  product.dailyLimit,
  product.sortOrder,
  product.active,
  "CURRENT_TIMESTAMP",
  "CURRENT_TIMESTAMP",
].map((value) => value === "CURRENT_TIMESTAMP" ? value : sqlValue(value)).join(","));

process.stdout.write(
  `INSERT OR REPLACE INTO products(${columns.join(",")}) VALUES\n${values.map((value) => `(${value})`).join(",\n")};\n`,
);
