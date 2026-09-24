"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  SkinPackInput,
  calculateSkinPackPacks,
  formatSkinPackShareText,
} from "../lib/skinpack-calculator";
import "./skinpack-calc.css";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}

export default function SkinPackCalculatorPage() {
  const [quantities, setQuantities] = useState<SkinPackInput>({
    bonghwang: 0,
    palyeong: 0,
    signature: 0,
    prestige: 0,
  });

  // 부위별 체크 상태 (key: itemId)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // 화면 꺼짐 방지(Wake Lock) 상태
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<WakeLockSentinelLike | null>(null);

  // 알림 토스트 메시지
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  // 수량 변경 함수
  const updateQuantity = (key: keyof SkinPackInput, delta: number) => {
    setQuantities((prev) => {
      const nextVal = Math.max(0, (prev[key] || 0) + delta);
      return { ...prev, [key]: nextVal };
    });
  };

  const setDirectQuantity = (key: keyof SkinPackInput, val: string) => {
    const num = parseInt(val, 10);
    setQuantities((prev) => ({
      ...prev,
      [key]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  // 초기화
  const handleResetAll = () => {
    if (
      quantities.bonghwang === 0 &&
      quantities.palyeong === 0 &&
      quantities.signature === 0 &&
      quantities.prestige === 0
    ) {
      setCheckedItems({});
      showToast("이미 모든 수량이 0입니다.");
      return;
    }
    if (window.confirm("모든 세트 수량과 체크 표시를 초기화하시겠습니까?")) {
      setQuantities({
        bonghwang: 0,
        palyeong: 0,
        signature: 0,
        prestige: 0,
      });
      setCheckedItems({});
      showToast("모든 수량이 초기화되었습니다.");
    }
  };

  // 체크박스 토글
  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 계산 결과 산출
  const result = useMemo(() => {
    return calculateSkinPackPacks(quantities);
  }, [quantities]);

  // 카카오톡 / 클립보드 복사
  const handleCopyShareText = async () => {
    if (result.totalPacks === 0) {
      showToast("수량을 1개 이상 입력해주세요.");
      return;
    }
    const text = formatSkinPackShareText(result);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast("작업 지시 텍스트가 복사되었습니다!");
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        showToast("작업 지시 텍스트가 복사되었습니다!");
      }
    } catch {
      showToast("복사에 실패했습니다. 직접 복사해주세요.");
    }
  };

  // 화면 꺼짐 방지 (Wake Lock API) 토글
  const toggleWakeLock = useCallback(async () => {
    const nav = navigator as unknown as {
      wakeLock?: {
        request: (type: string) => Promise<WakeLockSentinelLike>;
      };
    };

    if (!nav.wakeLock) {
      showToast("이 브라우저는 화면 켜짐 유지 기능을 지원하지 않습니다.");
      return;
    }

    try {
      if (isWakeLockActive && wakeLockSentinel) {
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setIsWakeLockActive(false);
        showToast("화면 켜짐 유지가 해제되었습니다.");
      } else {
        const sentinel = await nav.wakeLock.request("screen");
        sentinel.addEventListener("release", () => {
          setIsWakeLockActive(false);
          setWakeLockSentinel(null);
        });
        setWakeLockSentinel(sentinel);
        setIsWakeLockActive(true);
        showToast("화면 켜짐 유지가 활성화되었습니다 (작업 중 꺼지지 않음).");
      }
    } catch {
      setIsWakeLockActive(false);
      showToast("화면 켜짐 유지 요청에 실패했습니다.");
    }
  }, [isWakeLockActive, wakeLockSentinel]);

  // 컴포넌트 언마운트 시 wakeLock 해제
  useEffect(() => {
    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [wakeLockSentinel]);

  // 체크 진행률 계산
  const checked162202Count = result.skinPacks162202.filter(
    (i) => checkedItems[i.id]
  ).length;
  const checked241702Count = result.skinPacks241702.filter(
    (i) => checkedItems[i.id]
  ).length;

  return (
    <div className="spc-container">
      {/* 상단 네비게이션 & 브랜드 헤더 */}
      <header className="spc-header no-print">
        <div className="spc-header-top">
          <div className="spc-brand">
            <span className="spc-brand-badge">작업장 모바일 전용</span>
            <h1 className="spc-title">정일품 스킨팩 생산 계산기</h1>
          </div>
          <div className="spc-header-actions">
            <button
              type="button"
              className={`spc-btn-icon ${isWakeLockActive ? "active" : ""}`}
              onClick={toggleWakeLock}
              title={
                isWakeLockActive
                  ? "화면 켜짐 유지 중 (터치 시 해제)"
                  : "작업 중 화면 꺼짐 방지 켜기"
              }
            >
              <span className="spc-icon">{isWakeLockActive ? "💡" : "🌙"}</span>
              <span className="spc-btn-text">
                {isWakeLockActive ? "화면유지 ON" : "화면유지 OFF"}
              </span>
            </button>
            <button
              type="button"
              className="spc-btn-icon reset"
              onClick={handleResetAll}
              title="수량 전체 초기화"
            >
              <span className="spc-icon">🔄</span>
              <span className="spc-btn-text">초기화</span>
            </button>
          </div>
        </div>
        <p className="spc-subtitle">
          세트 수량을 입력하면 162202 / 241702 부위별 필요 팩수가 즉시 실시간 계산됩니다.
        </p>
      </header>

      {/* 인쇄 전용 헤더 */}
      <div className="spc-print-header print-only">
        <h2>정일품 스킨팩 부위별 생산 작업 지시서</h2>
        <p className="spc-print-meta">
          생산 규격: 봉황·팔영 (162202 용기) / 오미트 시그니처·프레스티지 (241702 용기)
        </p>
      </div>

      {/* 4가지 세트 수량 입력 컨트롤 섹션 */}
      <section className="spc-inputs-section no-print">
        <div className="spc-section-header">
          <h3>세트 수량 입력</h3>
          <span className="spc-hint">터치 버튼 또는 숫자를 직접 입력하세요</span>
        </div>

        <div className="spc-inputs-grid">
          {/* 1. 봉황세트 */}
          <div className="spc-input-card card-bonghwang">
            <div className="spc-card-title-row">
              <div className="spc-card-meta">
                <span className="spc-badge b-162202">162202 용기</span>
                <h4>봉황세트</h4>
              </div>
              <span className="spc-set-spec-tag">1,000g (5팩)</span>
            </div>
            <div className="spc-card-details">
              치마·갈비·부채·제비 180g / 차돌박이 280g
            </div>

            <div className="spc-stepper">
              <button
                type="button"
                className="spc-step-btn minus"
                onClick={() => updateQuantity("bonghwang", -1)}
                disabled={quantities.bonghwang <= 0}
                aria-label="봉황 1개 감소"
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                className="spc-step-input"
                value={quantities.bonghwang || ""}
                placeholder="0"
                onChange={(e) => setDirectQuantity("bonghwang", e.target.value)}
              />
              <button
                type="button"
                className="spc-step-btn plus"
                onClick={() => updateQuantity("bonghwang", 1)}
                aria-label="봉황 1개 증가"
              >
                +
              </button>
            </div>

            <div className="spc-quick-chips">
              <button
                type="button"
                onClick={() => updateQuantity("bonghwang", 1)}
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => updateQuantity("bonghwang", 5)}
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => updateQuantity("bonghwang", 10)}
              >
                +10
              </button>
              <button
                type="button"
                className="chip-zero"
                onClick={() => setDirectQuantity("bonghwang", "0")}
              >
                0개
              </button>
            </div>
          </div>

          {/* 2. 팔영세트 */}
          <div className="spc-input-card card-palyeong">
            <div className="spc-card-title-row">
              <div className="spc-card-meta">
                <span className="spc-badge b-162202">162202 용기</span>
                <h4>팔영세트</h4>
              </div>
              <span className="spc-set-spec-tag">1,260g (7팩)</span>
            </div>
            <div className="spc-card-details">
              치마·업진·부채·갈비·살치·제비·채끝 180g (7부위)
            </div>

            <div className="spc-stepper">
              <button
                type="button"
                className="spc-step-btn minus"
                onClick={() => updateQuantity("palyeong", -1)}
                disabled={quantities.palyeong <= 0}
                aria-label="팔영 1개 감소"
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                className="spc-step-input"
                value={quantities.palyeong || ""}
                placeholder="0"
                onChange={(e) => setDirectQuantity("palyeong", e.target.value)}
              />
              <button
                type="button"
                className="spc-step-btn plus"
                onClick={() => updateQuantity("palyeong", 1)}
                aria-label="팔영 1개 증가"
              >
                +
              </button>
            </div>

            <div className="spc-quick-chips">
              <button
                type="button"
                onClick={() => updateQuantity("palyeong", 1)}
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => updateQuantity("palyeong", 5)}
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => updateQuantity("palyeong", 10)}
              >
                +10
              </button>
              <button
                type="button"
                className="chip-zero"
                onClick={() => setDirectQuantity("palyeong", "0")}
              >
                0개
              </button>
            </div>
          </div>

          {/* 3. 오미트 시그니처 */}
          <div className="spc-input-card card-signature">
            <div className="spc-card-title-row">
              <div className="spc-card-meta">
                <span className="spc-badge b-241702">241702 용기</span>
                <h4>오미트 시그니처</h4>
              </div>
              <span className="spc-set-spec-tag purple">1,300g (6팩)</span>
            </div>
            <div className="spc-card-details">
              치마·부채·갈비·제비·채끝 200g / 차돌박이 300g
            </div>

            <div className="spc-stepper">
              <button
                type="button"
                className="spc-step-btn minus"
                onClick={() => updateQuantity("signature", -1)}
                disabled={quantities.signature <= 0}
                aria-label="시그니처 1개 감소"
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                className="spc-step-input"
                value={quantities.signature || ""}
                placeholder="0"
                onChange={(e) => setDirectQuantity("signature", e.target.value)}
              />
              <button
                type="button"
                className="spc-step-btn plus"
                onClick={() => updateQuantity("signature", 1)}
                aria-label="시그니처 1개 증가"
              >
                +
              </button>
            </div>

            <div className="spc-quick-chips purple">
              <button
                type="button"
                onClick={() => updateQuantity("signature", 1)}
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => updateQuantity("signature", 5)}
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => updateQuantity("signature", 10)}
              >
                +10
              </button>
              <button
                type="button"
                className="chip-zero"
                onClick={() => setDirectQuantity("signature", "0")}
              >
                0개
              </button>
            </div>
          </div>

          {/* 4. 오미트 프레스티지 */}
          <div className="spc-input-card card-prestige">
            <div className="spc-card-title-row">
              <div className="spc-card-meta">
                <span className="spc-badge b-241702">241702 용기</span>
                <h4>오미트 프레스티지</h4>
              </div>
              <span className="spc-set-spec-tag purple">1,380g (6팩)</span>
            </div>
            <div className="spc-card-details">
              부채·업진·갈비·살치·채끝·안창 230g (6부위)
            </div>

            <div className="spc-stepper">
              <button
                type="button"
                className="spc-step-btn minus"
                onClick={() => updateQuantity("prestige", -1)}
                disabled={quantities.prestige <= 0}
                aria-label="프레스티지 1개 감소"
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                className="spc-step-input"
                value={quantities.prestige || ""}
                placeholder="0"
                onChange={(e) => setDirectQuantity("prestige", e.target.value)}
              />
              <button
                type="button"
                className="spc-step-btn plus"
                onClick={() => updateQuantity("prestige", 1)}
                aria-label="프레스티지 1개 증가"
              >
                +
              </button>
            </div>

            <div className="spc-quick-chips purple">
              <button
                type="button"
                onClick={() => updateQuantity("prestige", 1)}
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => updateQuantity("prestige", 5)}
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => updateQuantity("prestige", 10)}
              >
                +10
              </button>
              <button
                type="button"
                className="chip-zero"
                onClick={() => setDirectQuantity("prestige", "0")}
              >
                0개
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 실시간 합계 배지 그룹 (Sticky Bar) */}
      <section className="spc-totals-banner">
        <div className="spc-totals-wrapper">
          <div className="spc-total-pill pill-162202">
            <span className="pill-label">162202 (봉황·팔영)</span>
            <span className="pill-value">{result.total162202Packs}팩</span>
          </div>
          <div className="spc-total-pill pill-241702">
            <span className="pill-label">241702 (오미트)</span>
            <span className="pill-value">{result.total241702Packs}팩</span>
          </div>
          <div className="spc-total-pill pill-grand">
            <span className="pill-label">총 스킨팩 합계</span>
            <span className="pill-value">{result.totalPacks}팩</span>
          </div>
        </div>
      </section>

      {/* 부위별 생산 지시서 결과 카드 그리드 */}
      <main className="spc-results-grid">
        {/* [카드 1] 162202 용기 스킨팩 준비 (봉황·팔영 세트) */}
        <div className="spc-plan-card vacuum-card">
          <div className="spc-plan-card-header">
            <div className="spc-plan-title-box">
              <span className="spc-badge b-162202">162202 용기</span>
              <h4>봉황·팔영 진공 스킨팩</h4>
            </div>
            <span className="spc-weight-guide highlight-blue">
              일반 180g / 차돌 280g
            </span>
          </div>

          {/* 소요 세트 표시 */}
          <div className="spc-plan-sets">
            <span className="spc-sets-label">소요 세트:</span>
            {result.setSummaries.vacuum.length > 0 ? (
              result.setSummaries.vacuum.map((s) => (
                <span key={s.id} className="spc-prod-badge vacuum">
                  <strong>{s.name} {s.quantity}개</strong>
                  <em className="spc-prod-spec">({s.spec})</em>
                </span>
              ))
            ) : (
              <span className="spc-muted-text">봉황/팔영 세트 입력 없음</span>
            )}
          </div>

          {/* 162202 테이블 */}
          <div className="spc-table-wrapper">
            <table className="spc-table vacuum-table">
              <thead>
                <tr>
                  <th scope="col">부위명</th>
                  <th scope="col" className="weight-th">실측 중량</th>
                  <th scope="col" className="container-th">용기</th>
                  <th scope="col" className="highlight-col vacuum">필요 팩수</th>
                  <th scope="col" className="check-th">
                    확인
                    {result.skinPacks162202.length > 0 && (
                      <span className="spc-check-ratio">
                        ({checked162202Count}/{result.skinPacks162202.length})
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.skinPacks162202.map((item) => {
                  const isChecked = !!checkedItems[item.id];
                  return (
                    <tr
                      key={item.id}
                      className={isChecked ? "row-checked" : ""}
                      onClick={() => toggleCheck(item.id)}
                    >
                      <td className="cut-name-cell">
                        <strong>{item.cutName}</strong>
                        {item.note && (
                          <span className="cut-item-note">({item.note})</span>
                        )}
                      </td>
                      <td
                        className={`weight-cell ${
                          item.weight === "280g" ? "special-weight" : ""
                        }`}
                      >
                        <strong>{item.weight}</strong>
                      </td>
                      <td className="container-cell">
                        <span className="tiny-container-tag">{item.container}</span>
                      </td>
                      <td className="highlight-col vacuum">
                        <strong>{item.packs}팩</strong>
                      </td>
                      <td className="check-col">
                        <span
                          className={`spc-check-box ${
                            isChecked ? "checked" : ""
                          }`}
                        >
                          {isChecked ? "✓" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {result.skinPacks162202.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      162202 용기 스킨팩 대상 세트(봉황·팔영) 수량이 0개입니다.
                    </td>
                  </tr>
                )}
              </tbody>
              {result.skinPacks162202.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <strong>162202 용기 합계</strong>
                    </td>
                    <td className="highlight-col vacuum">
                      <strong>{result.total162202Packs}팩</strong>
                    </td>
                    <td className="check-col">
                      {checked162202Count === result.skinPacks162202.length &&
                      result.skinPacks162202.length > 0 ? (
                        <span className="all-done-badge">완료</span>
                      ) : (
                        "✓"
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* [카드 2] 241702 용기 오미트팩 준비 (시그니처·프레스티지) */}
        <div className="spc-plan-card omeat-card">
          <div className="spc-plan-card-header">
            <div className="spc-plan-title-box">
              <span className="spc-badge b-241702">241702 용기</span>
              <h4>오미트(O&apos;meat) 전용팩</h4>
            </div>
            <span className="spc-weight-guide highlight-purple">
              시그니처 200g(차돌300g) / 프레스티지 230g
            </span>
          </div>

          {/* 소요 세트 표시 */}
          <div className="spc-plan-sets">
            <span className="spc-sets-label">소요 세트:</span>
            {result.setSummaries.omeat.length > 0 ? (
              result.setSummaries.omeat.map((s) => (
                <span key={s.id} className="spc-prod-badge omeat">
                  <strong>{s.name} {s.quantity}개</strong>
                  <em className="spc-prod-spec">({s.spec})</em>
                </span>
              ))
            ) : (
              <span className="spc-muted-text">오미트 예약/수량 없음</span>
            )}
          </div>

          {/* 241702 테이블 */}
          <div className="spc-table-wrapper">
            <table className="spc-table omeat-table">
              <thead>
                <tr>
                  <th scope="col">부위명</th>
                  <th scope="col" className="weight-th">실측 중량</th>
                  <th scope="col" className="container-th">용기</th>
                  <th scope="col" className="highlight-col omeat">필요 팩수</th>
                  <th scope="col" className="check-th">
                    확인
                    {result.skinPacks241702.length > 0 && (
                      <span className="spc-check-ratio">
                        ({checked241702Count}/{result.skinPacks241702.length})
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.skinPacks241702.map((item) => {
                  const isChecked = !!checkedItems[item.id];
                  return (
                    <tr
                      key={item.id}
                      className={isChecked ? "row-checked" : ""}
                      onClick={() => toggleCheck(item.id)}
                    >
                      <td className="cut-name-cell">
                        <strong>{item.cutName}</strong>
                        {item.note && (
                          <span className="cut-item-note">({item.note})</span>
                        )}
                      </td>
                      <td
                        className={`weight-cell ${
                          item.weight === "300g"
                            ? "special-weight"
                            : item.weight === "230g"
                            ? "weight-230"
                            : "weight-200"
                        }`}
                      >
                        <strong>{item.weight}</strong>
                      </td>
                      <td className="container-cell">
                        <span className="tiny-container-tag">{item.container}</span>
                      </td>
                      <td className="highlight-col omeat">
                        <strong>{item.packs}팩</strong>
                      </td>
                      <td className="check-col">
                        <span
                          className={`spc-check-box ${
                            isChecked ? "checked" : ""
                          }`}
                        >
                          {isChecked ? "✓" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {result.skinPacks241702.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      241702 용기 오미트 세트(시그니처·프레스티지) 수량이 0개입니다.
                    </td>
                  </tr>
                )}
              </tbody>
              {result.skinPacks241702.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <strong>241702 용기 합계</strong>
                    </td>
                    <td className="highlight-col omeat">
                      <strong>{result.total241702Packs}팩</strong>
                    </td>
                    <td className="check-col">
                      {checked241702Count === result.skinPacks241702.length &&
                      result.skinPacks241702.length > 0 ? (
                        <span className="all-done-badge purple">완료</span>
                      ) : (
                        "✓"
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </main>

      {/* 하단 고정 액션 툴바 */}
      <footer className="spc-footer no-print">
        <div className="spc-footer-actions">
          <button
            type="button"
            className="spc-action-btn primary"
            onClick={handleCopyShareText}
          >
            📋 작업 지시 복사
          </button>
          <button
            type="button"
            className="spc-action-btn secondary"
            onClick={() => window.print()}
          >
            🖨️ 인쇄 / PDF
          </button>
          <Link href="/sales" className="spc-action-btn ghost">
            🏠 메인 장부
          </Link>
        </div>
        <div className="spc-footer-tip">
          Tip: 모바일 홈 화면에 바로가기를 추가하면 앱처럼 전체 화면으로 사용할 수 있습니다.
        </div>
      </footer>

      {/* 토스트 알림창 */}
      {toastMessage && (
        <div className="spc-toast-popup">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
