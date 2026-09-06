"use client";

import { useState } from "react";
import "../custom-order-details.css";

export default function CustomOrderDetails({ productName, amount, request }: {
  productName: string;
  amount: number;
  request: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const won = amount.toLocaleString("ko-KR") + "원";

  return (
    <div className="custom-order-details">
      <span className="custom-order-details__summary"><b>{productName}</b><small>{won}</small></span>
      <button type="button" onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setOpen(true); }}>요청사항</button>
      {open ? (
        <div className="custom-order-details__backdrop">
          <button className="custom-order-details__dismiss" type="button" aria-label="맞춤주문 요청사항 닫기" onClick={(event) => { event.stopPropagation(); setOpen(false); }} />
          <section className="custom-order-details__dialog" role="dialog" aria-modal="true" aria-label="맞춤주문 요청사항">
            <header><div><small>맞춤주문 요청사항</small><b>{productName} · {won}</b></div><button type="button" aria-label="닫기" onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setOpen(false); }}>×</button></header>
            <section><span>요청사항</span><p>{request?.trim() || "등록된 요청사항이 없습니다."}</p></section>
          </section>
        </div>
      ) : null}
    </div>
  );
}
