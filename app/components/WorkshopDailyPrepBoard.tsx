"use client";

import { RefreshCw } from "lucide-react";
import { Button, useResource } from "../ui";
import "../workshop-daily-prep.css";

type ProductDemand = {
  productId: string;
  productName: string;
  setQuantity: number;
  packQuantity: number;
};

type Requirement = {
  componentCode: string;
  componentName: string;
  requiredQuantity: number;
  byProduct: Record<string, number>;
};

type DailyPackResponse = {
  date: string;
  products: ProductDemand[];
  requirements: Requirement[];
  totalSetQuantity: number;
  totalPackQuantity: number;
};

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function WorkshopDailyPrepBoard() {
  const today = todayInSeoul();
  const { data, error, reload } = useResource<DailyPackResponse>(
    `/api/workshop/daily-skin-packs?date=${encodeURIComponent(today)}`,
    5_000,
  );
  const activeProducts = data?.products.filter((product) => product.setQuantity > 0) ?? [];

  return (
    <section className="workshop-daily-prep" aria-labelledby="workshop-daily-prep-title">
      <header className="workshop-daily-prep__header">
        <div>
          <p>오늘 스킨팩 작업표</p>
          <h2 id="workshop-daily-prep-title">부위별 필요 수량</h2>
          <time dateTime={today}>{today}</time>
        </div>
        <Button size="sm" variant="ghost" leadingIcon={<RefreshCw size={15} />} onClick={() => void reload()}>
          새로고침
        </Button>
      </header>

      {error ? <p className="workshop-daily-prep__message is-error" role="alert">{error.message}</p> : null}
      {!error && !data ? <p className="workshop-daily-prep__message" role="status">오늘 세트 주문을 계산하는 중입니다.</p> : null}
      {data ? (
        <>
          <div className="workshop-daily-prep__sets" aria-label="오늘 세트 주문량">
            {data.products.map((product) => (
              <article key={product.productId} className={product.setQuantity ? "is-active" : undefined}>
                <span>{product.productName}</span>
                <strong>{product.setQuantity}세트</strong>
                <small>스킨팩 {product.packQuantity}개</small>
              </article>
            ))}
          </div>

          {data.requirements.length ? (
            <div className="workshop-daily-prep__table-wrap">
              <table className="workshop-daily-prep__table">
                <thead>
                  <tr>
                    <th scope="col">부위</th>
                    <th scope="col">총 필요</th>
                    {activeProducts.map((product) => <th scope="col" key={product.productId}>{product.productName}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.requirements.map((requirement) => (
                    <tr key={requirement.componentCode}>
                      <th scope="row">{requirement.componentName}</th>
                      <td><strong>{requirement.requiredQuantity}개</strong></td>
                      {activeProducts.map((product) => (
                        <td key={product.productId}>{requirement.byProduct[product.productId] ? `${requirement.byProduct[product.productId]}개` : "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">합계</th>
                    <td>{data.totalPackQuantity}개</td>
                    {activeProducts.map((product) => <td key={product.productId}>{product.packQuantity}개</td>)}
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : <p className="workshop-daily-prep__empty">오늘 봉황·팔영·오미트 주문이 없습니다.</p>}
          <p className="workshop-daily-prep__note">세트 1개당 구성 부위별 스킨팩 1개 기준입니다. 취소 주문은 제외합니다.</p>
        </>
      ) : null}
    </section>
  );
}
