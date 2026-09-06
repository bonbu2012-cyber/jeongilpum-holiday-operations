"use client";

import { useState } from "react";
import { Button, Modal } from "../ui";
import "../custom-order-details.css";

type CustomOrderDetailsProps = {
  productName: string;
  amount: number;
  request: string | null;
};

const won = (value: number) => value.toLocaleString("ko-KR") + "원";

export default function CustomOrderDetails({
  productName,
  amount,
  request,
}: CustomOrderDetailsProps) {
  const [open, setOpen] = useState(false);
  const requestText = request?.trim() || "등록된 요청사항이 없습니다.";

  return (
    <div
      className="custom-order-details"
      role="presentation"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="custom-order-details__summary">
        <b>{productName}</b>
        <small>{won(amount)}</small>
      </div>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        요청사항
      </Button>
      <Modal
        open={open}
        title="맞춤주문 요청사항"
        description={productName + " · " + won(amount)}
        onClose={() => setOpen(false)}
        footer={<Button variant="ghost" onClick={() => setOpen(false)}>닫기</Button>}
      >
        <section className="custom-order-details__request">
          <span>요청사항</span>
          <p>{requestText}</p>
        </section>
      </Modal>
    </div>
  );
}
