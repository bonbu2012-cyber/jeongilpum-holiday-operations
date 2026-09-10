import assert from "node:assert/strict";
import test from "node:test";
import {
  TRACKED_SET_PRODUCTS,
  aggregateDailySkinPackRequirements,
} from "../app/lib/daily-skin-pack-requirements.ts";

test("tracked set compositions include Bonghwang, Palyeong, and both O'meat sets", () => {
  assert.deepEqual(
    TRACKED_SET_PRODUCTS.map((product) => [product.id, product.components.length]),
    [["bonghwang", 5], ["palyeong", 7], ["omeat-signature", 6], ["omeat-prestige", 6]],
  );
});

test("daily requirements aggregate one skin pack per cut for every ordered set", () => {
  const result = aggregateDailySkinPackRequirements([
    { productId: "bonghwang", productName: "봉황세트", quantity: 9 },
    { productId: "palyeong", productName: "팔영세트", quantity: 4 },
  ]);
  const quantities = Object.fromEntries(result.requirements.map((item) => [item.componentName, item.requiredQuantity]));

  assert.equal(result.totalSetQuantity, 13);
  assert.equal(result.totalPackQuantity, 73);
  assert.deepEqual(quantities, {
    치마살: 13,
    갈비살: 13,
    부채살: 13,
    제비추리: 13,
    차돌박이: 9,
    업진살: 4,
    살치살: 4,
    채끝: 4,
  });
});

test("invalid, cancelled-equivalent, and untracked demand does not inflate the board", () => {
  const result = aggregateDailySkinPackRequirements([
    { productId: "omeat-signature", productName: "오미트 시그니처", quantity: 2 },
    { productId: "omeat-prestige", productName: "오미트 프레스티지", quantity: 1 },
    { productId: "unknown", productName: "기타", quantity: 20 },
    { productId: "bonghwang", productName: "봉황세트", quantity: 0 },
    { productId: "palyeong", productName: "팔영세트", quantity: Number.NaN },
  ]);

  assert.equal(result.totalSetQuantity, 3);
  assert.equal(result.totalPackQuantity, 18);
  assert.equal(result.requirements.find((item) => item.componentName === "안창살")?.requiredQuantity, 1);
});
