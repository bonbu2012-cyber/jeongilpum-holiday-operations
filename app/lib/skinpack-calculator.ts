/**
 * 모바일 독립 스킨팩 계산기 핵심 엔진
 * 
 * 대상 선물세트 4종:
 * 1. 봉황세트: 1,000g (5팩) - 162202 용기 (치마 180g, 갈비 180g, 부채 180g, 제비 180g, 차돌 280g)
 * 2. 팔영세트: 1,260g (7팩) - 162202 용기 (치마 180g, 업진 180g, 부채 180g, 갈비 180g, 살치 180g, 제비 180g, 채끝 180g)
 * 3. 오미트 시그니처: 1,300g (6팩) - 241702 용기 (치마 200g, 부채 200g, 갈비 200g, 제비 200g, 채끝 200g, 차돌 300g)
 * 4. 오미트 프레스티지: 1,380g (6팩) - 241702 용기 (부채 230g, 업진 230g, 갈비 230g, 살치 230g, 채끝 230g, 안창 230g)
 */

export interface SkinPackInput {
  bonghwang: number;
  palyeong: number;
  signature: number;
  prestige: number;
}

export interface SkinPackItem {
  id: string;
  cutName: string;
  weight: string;
  container: "162202" | "241702";
  packs: number;
  note?: string;
  targetSets: string[];
}

export interface SetDetailSummary {
  id: "bonghwang" | "palyeong" | "signature" | "prestige";
  name: string;
  quantity: number;
  container: "162202" | "241702";
  spec: string;
  packCountPerSet: number;
  totalPacks: number;
}

export interface SkinPackCalculationResult {
  inputs: SkinPackInput;
  setSummaries: {
    vacuum: SetDetailSummary[]; // 봉황, 팔영
    omeat: SetDetailSummary[];  // 오미트 시그니처, 프레스티지
  };
  skinPacks162202: SkinPackItem[];
  skinPacks241702: SkinPackItem[];
  total162202Packs: number;
  total241702Packs: number;
  totalPacks: number;
}

export const PREFERRED_CUT_ORDER = [
  "치마살",
  "갈비살",
  "부채살",
  "업진살",
  "살치살",
  "제비추리",
  "채끝",
  "안창살",
  "차돌박이",
];

export function sortCuts(aName: string, bName: string): number {
  const indexA = PREFERRED_CUT_ORDER.indexOf(aName);
  const indexB = PREFERRED_CUT_ORDER.indexOf(bName);
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return aName.localeCompare(bName, "ko");
}

export function sortSkinPackItems(a: SkinPackItem, b: SkinPackItem): number {
  const orderDiff = sortCuts(a.cutName, b.cutName);
  if (orderDiff !== 0) return orderDiff;
  return a.weight.localeCompare(b.weight, "ko");
}

/**
 * 4가지 세트 수량을 입력받아 부위별/용기별 스킨팩 필요 팩수를 정확히 계산
 */
export function calculateSkinPackPacks(rawInput: Partial<SkinPackInput>): SkinPackCalculationResult {
  const bonghwang = Math.max(0, Math.floor(Number(rawInput.bonghwang) || 0));
  const palyeong = Math.max(0, Math.floor(Number(rawInput.palyeong) || 0));
  const signature = Math.max(0, Math.floor(Number(rawInput.signature) || 0));
  const prestige = Math.max(0, Math.floor(Number(rawInput.prestige) || 0));

  const inputs: SkinPackInput = { bonghwang, palyeong, signature, prestige };

  const vacuumSets: SetDetailSummary[] = [];
  if (bonghwang > 0) {
    vacuumSets.push({
      id: "bonghwang",
      name: "봉황세트",
      quantity: bonghwang,
      container: "162202",
      spec: "1,000g (5팩) · [162202 × 5, 슬리브 × 5]",
      packCountPerSet: 5,
      totalPacks: bonghwang * 5,
    });
  }
  if (palyeong > 0) {
    vacuumSets.push({
      id: "palyeong",
      name: "팔영세트",
      quantity: palyeong,
      container: "162202",
      spec: "1,260g (7팩) · [162202 × 7, 슬리브 × 7]",
      packCountPerSet: 7,
      totalPacks: palyeong * 7,
    });
  }

  const omeatSets: SetDetailSummary[] = [];
  if (signature > 0) {
    omeatSets.push({
      id: "signature",
      name: "오미트 시그니처",
      quantity: signature,
      container: "241702",
      spec: "1,300g (6팩) · [241702 × 6, 슬리브 × 6]",
      packCountPerSet: 6,
      totalPacks: signature * 6,
    });
  }
  if (prestige > 0) {
    omeatSets.push({
      id: "prestige",
      name: "오미트 프레스티지",
      quantity: prestige,
      container: "241702",
      spec: "1,380g (6팩) · [241702 × 6, 슬리브 × 6]",
      packCountPerSet: 6,
      totalPacks: prestige * 6,
    });
  }

  // 162202 집계 맵 (봉황 + 팔영)
  const map162202 = new Map<string, SkinPackItem>();
  const add162202 = (cutName: string, weight: string, packs: number, setName: string, note?: string) => {
    if (packs <= 0) return;
    const key = `${cutName}_${weight}`;
    const existing = map162202.get(key);
    if (existing) {
      existing.packs += packs;
      existing.targetSets.push(`${setName} ${packs}`);
    } else {
      map162202.set(key, {
        id: `162202-${key}`,
        cutName,
        weight,
        container: "162202",
        packs,
        note,
        targetSets: [`${setName} ${packs}`],
      });
    }
  };

  // 봉황: 치마 180, 갈비 180, 부채 180, 제비 180, 차돌 280
  if (bonghwang > 0) {
    add162202("치마살", "180g", bonghwang, "봉황");
    add162202("갈비살", "180g", bonghwang, "봉황");
    add162202("부채살", "180g", bonghwang, "봉황");
    add162202("제비추리", "180g", bonghwang, "봉황");
    add162202("차돌박이", "280g", bonghwang, "봉황", "차돌박이 대용량 280g");
  }

  // 팔영: 치마 180, 업진 180, 부채 180, 갈비 180, 살치 180, 제비 180, 채끝 180
  if (palyeong > 0) {
    add162202("치마살", "180g", palyeong, "팔영");
    add162202("업진살", "180g", palyeong, "팔영");
    add162202("부채살", "180g", palyeong, "팔영");
    add162202("갈비살", "180g", palyeong, "팔영");
    add162202("살치살", "180g", palyeong, "팔영");
    add162202("제비추리", "180g", palyeong, "팔영");
    add162202("채끝", "180g", palyeong, "팔영");
  }

  // 241702 집계 맵 (시그니처 + 프레스티지)
  const map241702 = new Map<string, SkinPackItem>();
  const add241702 = (cutName: string, weight: string, packs: number, setName: string, note?: string) => {
    if (packs <= 0) return;
    const key = `${cutName}_${weight}`;
    const existing = map241702.get(key);
    if (existing) {
      existing.packs += packs;
      existing.targetSets.push(`${setName} ${packs}`);
    } else {
      map241702.set(key, {
        id: `241702-${key}`,
        cutName,
        weight,
        container: "241702",
        packs,
        note,
        targetSets: [`${setName} ${packs}`],
      });
    }
  };

  // 시그니처: 치마 200, 부채 200, 갈비 200, 제비 200, 채끝 200, 차돌 300
  if (signature > 0) {
    add241702("치마살", "200g", signature, "시그니처");
    add241702("갈비살", "200g", signature, "시그니처");
    add241702("부채살", "200g", signature, "시그니처");
    add241702("제비추리", "200g", signature, "시그니처");
    add241702("채끝", "200g", signature, "시그니처");
    add241702("차돌박이", "300g", signature, "시그니처", "오미트 차돌박이 300g");
  }

  // 프레스티지: 부채 230, 업진 230, 갈비 230, 살치 230, 채끝 230, 안창 230
  if (prestige > 0) {
    add241702("갈비살", "230g", prestige, "프레스티지");
    add241702("부채살", "230g", prestige, "프레스티지");
    add241702("업진살", "230g", prestige, "프레스티지");
    add241702("살치살", "230g", prestige, "프레스티지");
    add241702("채끝", "230g", prestige, "프레스티지");
    add241702("안창살", "230g", prestige, "프레스티지");
  }

  const skinPacks162202 = [...map162202.values()].sort(sortSkinPackItems);
  const skinPacks241702 = [...map241702.values()].sort(sortSkinPackItems);

  const total162202Packs = skinPacks162202.reduce((sum, item) => sum + item.packs, 0);
  const total241702Packs = skinPacks241702.reduce((sum, item) => sum + item.packs, 0);
  const totalPacks = total162202Packs + total241702Packs;

  return {
    inputs,
    setSummaries: {
      vacuum: vacuumSets,
      omeat: omeatSets,
    },
    skinPacks162202,
    skinPacks241702,
    total162202Packs,
    total241702Packs,
    totalPacks,
  };
}

/**
 * 계산 결과를 카카오톡이나 메신저로 바로 전송할 수 있는 깔끔한 텍스트로 서식화
 */
export function formatSkinPackShareText(result: SkinPackCalculationResult): string {
  const lines: string[] = [];
  lines.push("📋 [정일품 스킨팩 작업 지시]");
  
  const setDetails: string[] = [];
  if (result.inputs.bonghwang > 0) setDetails.push(`봉황 ${result.inputs.bonghwang}개`);
  if (result.inputs.palyeong > 0) setDetails.push(`팔영 ${result.inputs.palyeong}개`);
  if (result.inputs.signature > 0) setDetails.push(`오미트 시그니처 ${result.inputs.signature}개`);
  if (result.inputs.prestige > 0) setDetails.push(`오미트 프레스티지 ${result.inputs.prestige}개`);

  if (setDetails.length === 0) {
    return "선택된 세트가 없습니다.";
  }

  lines.push(`• 소요 세트: ${setDetails.join(" / ")}`);
  lines.push(`• 총 스킨팩: ${result.totalPacks}팩 (162202: ${result.total162202Packs}팩 / 241702: ${result.total241702Packs}팩)`);
  lines.push("");

  if (result.skinPacks162202.length > 0) {
    lines.push(`[162202 용기 봉황·팔영] 총 ${result.total162202Packs}팩`);
    for (const item of result.skinPacks162202) {
      const noteStr = item.note ? ` (${item.note})` : "";
      lines.push(`- ${item.cutName} ${item.weight}: ${item.packs}팩${noteStr}`);
    }
    lines.push("");
  }

  if (result.skinPacks241702.length > 0) {
    lines.push(`[241702 용기 오미트] 총 ${result.total241702Packs}팩`);
    for (const item of result.skinPacks241702) {
      const noteStr = item.note ? ` (${item.note})` : "";
      lines.push(`- ${item.cutName} ${item.weight}: ${item.packs}팩${noteStr}`);
    }
  }

  return lines.join("\n").trim();
}
