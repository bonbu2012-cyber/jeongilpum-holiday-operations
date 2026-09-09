import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CATALOG_PRODUCT_DETAILS,
  resolveCatalogProductDetails,
} from "../app/lib/catalog-product-details.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const expected = {
  practical: ["부담 없이 즐기는 알찬 한우 구이 모둠", "약 4인분", "600g", ["부채살", "업진살", "제비추리", "채끝"]],
  bonghwang: ["육향과 식감의 조화를 고르게 담은 인기 한우 세트", "약 6~7인분", "1kg", ["치마살", "갈비살", "부채살", "제비추리", "차돌박이"]],
  palyeong: ["일곱 가지 부위로 풍성하게 즐기는 한우 구이 세트", "약 8인분", "1.26kg", ["치마살", "업진살", "부채살", "갈비살", "살치살", "제비추리", "채끝"]],
  jin: ["안창살과 살치살까지 담은 최상급 프리미엄 구성", "약 8~9인분", "1.33kg", ["안창살", "살치살", "치마살", "갈비살", "부채살", "채끝", "제비추리"]],
  seon: ["부드러운 식감과 진한 육향을 균형 있게 담은 구성", "약 7~8인분", "1.15kg", ["치마살", "업진살", "부채살", "갈비살", "살치살", "채끝"]],
  mi: ["선호도 높은 다섯 가지 부위를 알차게 담은 구성", "약 6~7인분", "1kg", ["치마살", "업진살", "부채살", "갈비살", "제비추리"]],
  "omeat-signature": ["여섯 가지 한우 부위와 전용 패키지가 어우러진 품격 있는 선물", "약 8~9인분", "1.3kg", ["치마살", "부채살", "갈비살", "제비추리", "채끝", "차돌박이"]],
  "omeat-prestige": ["안창살과 살치살을 더해 특별함을 높인 최고급 한우 선물", "약 9인분", "1.38kg", ["부채살", "업진살", "갈비살", "살치살", "채끝", "안창살"]],
  "la-1": ["부드러운 육질과 풍부한 육즙을 즐기는 프라임 LA갈비", "약 6인분", "1.8kg(뼈 포함)", ["미국산 USDA 프라임 LA갈비"]],
  "la-2": ["온 가족이 넉넉하게 즐기는 대용량 프라임 LA갈비", "약 9인분", "2.7kg(뼈 포함)", ["미국산 USDA 프라임 LA갈비"]],
  "bone-1": ["깊고 진한 국물 요리에 어울리는 한우 보양 세트", null, "5kg", ["한우 사골", "한우 우족"]],
  "bone-2": ["세 가지 한우 뼈 부위를 풍성하게 담은 종합 국물 세트", null, "6.5kg", ["한우 꼬리", "한우 사골", "한우 잡뼈"]],
};

test("all 12 confirmed catalog details match the customer-approved copy", () => {
  assert.equal(Object.keys(CATALOG_PRODUCT_DETAILS).length, 12);
  for (const [id, [tagline, servings, totalWeight, components]] of Object.entries(expected)) {
    assert.deepEqual(CATALOG_PRODUCT_DETAILS[id], { tagline, servings, totalWeight, components });
  }
});

test("product aliases resolve Hanja, Korean, and English display-name variations", () => {
  assert.equal(resolveCatalogProductDetails({ id: "renamed", name: "진(眞)" }), CATALOG_PRODUCT_DETAILS.jin);
  assert.equal(resolveCatalogProductDetails({ id: "renamed", name: "오미트 프레스티지" }), CATALOG_PRODUCT_DETAILS["omeat-prestige"]);
  assert.equal(resolveCatalogProductDetails({ id: "renamed", name: "사골 잡뼈 꼬리" }), CATALOG_PRODUCT_DETAILS["bone-2"]);
});

test("confirmed display data overrides BOM cuts while price and image remain untouched", () => {
  const source = read("app/api/products/route.ts");
  assert.match(source, /resolveCatalogProductDetails\(product\)/);
  assert.match(source, /cutNames: catalogDetails\.components/);
  assert.match(source, /imageUrl: resolveCatalogProductImageUrl\(product\.id, product\.imageUrl\)/);
  assert.doesNotMatch(source, /price:\s*catalogDetails/);
});

test("cards stay concise and details show full composition plus serving guidance", () => {
  const kiosk = read("app/components/KioskApp.tsx");
  assert.match(kiosk, /<ProductFacts product=\{product\} compact\/>/);
  assert.match(kiosk, /<ProductComposition product=\{product\}\/>/);
  assert.match(kiosk, /한우 구이용은 1인분 150g을 기준으로 계산했습니다/);
  assert.match(kiosk, /LA갈비는 뼈 포함 1인분 300g을 기준으로 계산했습니다/);
  assert.match(kiosk, /뼈 세트는 조리 방식과 물의 양에 따라 차이가 커 인분을 별도로 표기하지 않습니다/);
  assert.match(kiosk, /상품의 중량과 구성은 원물 수급 상황에 따라 일부 달라질 수 있습니다/);
});
