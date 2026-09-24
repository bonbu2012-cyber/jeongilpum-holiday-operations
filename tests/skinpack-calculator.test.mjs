import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSkinPackPacks,
  formatSkinPackShareText,
} from "../app/lib/skinpack-calculator.ts";

test("calculateSkinPackPacks reproduces exact screenshot counts (봉황 11, 팔영 6)", () => {
  const result = calculateSkinPackPacks({
    bonghwang: 11,
    palyeong: 6,
    signature: 0,
    prestige: 0,
  });

  // 162202 용기 합계: 11*5 + 6*7 = 55 + 42 = 97팩
  assert.equal(result.total162202Packs, 97);
  assert.equal(result.total241702Packs, 0);
  assert.equal(result.totalPacks, 97);

  // 세트 요약
  assert.equal(result.setSummaries.vacuum.length, 2);
  assert.equal(result.setSummaries.vacuum[0].name, "봉황세트");
  assert.equal(result.setSummaries.vacuum[0].quantity, 11);
  assert.equal(result.setSummaries.vacuum[1].name, "팔영세트");
  assert.equal(result.setSummaries.vacuum[1].quantity, 6);

  // 부위별 팩수 확인
  const findCut = (cutName, weight) =>
    result.skinPacks162202.find((i) => i.cutName === cutName && i.weight === weight);

  assert.equal(findCut("치마살", "180g")?.packs, 17);
  assert.equal(findCut("갈비살", "180g")?.packs, 17);
  assert.equal(findCut("부채살", "180g")?.packs, 17);
  assert.equal(findCut("업진살", "180g")?.packs, 6);
  assert.equal(findCut("살치살", "180g")?.packs, 6);
  assert.equal(findCut("제비추리", "180g")?.packs, 17);
  assert.equal(findCut("채끝", "180g")?.packs, 6);
  assert.equal(findCut("차돌박이", "280g")?.packs, 11);
  assert.equal(findCut("차돌박이", "280g")?.note, "차돌박이 대용량 280g");
});

test("calculateSkinPackPacks accurately calculates O'meat Signature and Prestige (시그니처 4, 프레스티지 2)", () => {
  const result = calculateSkinPackPacks({
    bonghwang: 0,
    palyeong: 0,
    signature: 4,
    prestige: 2,
  });

  // 241702 용기 합계: 4*6 + 2*6 = 36팩
  assert.equal(result.total162202Packs, 0);
  assert.equal(result.total241702Packs, 36);
  assert.equal(result.totalPacks, 36);

  const findOmeat = (cutName, weight) =>
    result.skinPacks241702.find((i) => i.cutName === cutName && i.weight === weight);

  // 시그니처 4개 전용 부위
  assert.equal(findOmeat("치마살", "200g")?.packs, 4);
  assert.equal(findOmeat("제비추리", "200g")?.packs, 4);
  assert.equal(findOmeat("차돌박이", "300g")?.packs, 4);
  assert.equal(findOmeat("차돌박이", "300g")?.note, "오미트 차돌박이 300g");

  // 프레스티지 2개 전용 부위
  assert.equal(findOmeat("업진살", "230g")?.packs, 2);
  assert.equal(findOmeat("살치살", "230g")?.packs, 2);
  assert.equal(findOmeat("안창살", "230g")?.packs, 2);

  // 공통 부위 (중량 구분)
  assert.equal(findOmeat("갈비살", "200g")?.packs, 4);
  assert.equal(findOmeat("갈비살", "230g")?.packs, 2);
  assert.equal(findOmeat("부채살", "200g")?.packs, 4);
  assert.equal(findOmeat("부채살", "230g")?.packs, 2);
  assert.equal(findOmeat("채끝", "200g")?.packs, 4);
  assert.equal(findOmeat("채끝", "230g")?.packs, 2);
});

test("formatSkinPackShareText creates readable summary for messenger sharing", () => {
  const result = calculateSkinPackPacks({
    bonghwang: 2,
    palyeong: 1,
    signature: 1,
    prestige: 1,
  });

  const shareText = formatSkinPackShareText(result);
  assert.ok(shareText.includes("정일품 스킨팩 작업 지시"));
  assert.ok(shareText.includes("봉황 2개"));
  assert.ok(shareText.includes("팔영 1개"));
  assert.ok(shareText.includes("오미트 시그니처 1개"));
  assert.ok(shareText.includes("오미트 프레스티지 1개"));
  assert.ok(shareText.includes("총 스킨팩: 29팩"));
  assert.ok(shareText.includes("[162202 용기 봉황·팔영] 총 17팩"));
  assert.ok(shareText.includes("[241702 용기 오미트] 총 12팩"));
});

test("calculateSkinPackPacks handles zero, negative, and invalid values safely", () => {
  const result = calculateSkinPackPacks({
    bonghwang: -5,
    palyeong: NaN,
    signature: 0,
    prestige: undefined,
  });

  assert.equal(result.total162202Packs, 0);
  assert.equal(result.total241702Packs, 0);
  assert.equal(result.totalPacks, 0);
  assert.equal(result.skinPacks162202.length, 0);
  assert.equal(result.skinPacks241702.length, 0);
});
