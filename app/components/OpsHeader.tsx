"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import AppNav, { type AppSurface } from "./AppNav";

const seoulDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
});

type OpsHeaderProps = {
  surface: AppSurface;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function OpsHeader({ surface, title, subtitle, actions, className }: OpsHeaderProps) {
  const classes = ["ops-header", className].filter(Boolean).join(" ");
  const today = seoulDateFormatter.format(new Date());

  return (
    <>
      <header className={classes}>
        <a href={`/${surface}`} className="ops-brand">
          <Image
            className="operations-brand-logo"
            src="/jeongilpum-logo.png"
            alt="정일품 정육식당 로고"
            width={46}
            height={46}
          />
          <span>
            {title}
            {subtitle ? <small>{subtitle}</small> : null}
          </span>
        </a>
        <div className="ops-header__utility">
          <time className="ops-header__date">{today}</time>
          {actions ? <div className="ops-alerts">{actions}</div> : null}
        </div>
      </header>
      <AppNav current={surface} />
    </>
  );
}
