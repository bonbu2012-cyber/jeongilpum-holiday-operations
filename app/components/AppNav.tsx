"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

export type AppSurface = "kiosk" | "sales" | "bulk" | "workshop" | "settings";

const links: Array<{ key: AppSurface; href: string; label: string }> = [
  { key: "bulk", href: "/bulk-orders", label: "대량주문" },
  { key: "kiosk", href: "/kiosk", label: "메인 화면" },
  { key: "sales", href: "/sales", label: "판매장" },
  { key: "workshop", href: "/workshop", label: "작업장" },
  { key: "settings", href: "/settings", label: "설정" },
];

export default function AppNav({ current }: { current: AppSurface }) {
  const [collapsed, setCollapsed] = useState(false);
  const currentItem = links.find((link) => link.key === current);

  if (collapsed) {
    return (
      <nav className="app-nav app-nav--collapsed" aria-label="화면 이동 메뉴 열기">
        <button
          type="button"
          className="app-nav__toggle-btn"
          onClick={() => setCollapsed(false)}
          aria-label="화면 이동 메뉴 펼치기"
          title="화면 이동 메뉴 열기"
        >
          <Menu size={15} aria-hidden="true" />
          <span>{currentItem?.label ?? "메뉴"}</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="app-nav" aria-label="화면 이동">
      <div className="app-nav__links">
        {links.map((link) => (
          <a
            key={link.key}
            href={link.href}
            className={link.key === current ? "current" : undefined}
            aria-current={link.key === current ? "page" : undefined}
          >
            {link.label}
          </a>
        ))}
      </div>
      <button
        type="button"
        className="app-nav__collapse-btn"
        onClick={() => setCollapsed(true)}
        aria-label="메뉴 접기"
        title="시야 확보를 위해 메뉴 접기"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}

