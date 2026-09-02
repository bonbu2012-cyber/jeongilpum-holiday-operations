"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import AppNav, { type AppSurface } from "./AppNav";

type OpsHeaderProps = {
  surface: AppSurface;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function OpsHeader({ surface, title, subtitle, actions, className }: OpsHeaderProps) {
  const classes = ["ops-header", className].filter(Boolean).join(" ");

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
        {actions ? <div className="ops-alerts">{actions}</div> : null}
      </header>
      <AppNav current={surface} />
    </>
  );
}
