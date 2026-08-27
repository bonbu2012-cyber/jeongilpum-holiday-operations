type AppSurface = "kiosk" | "admin" | "workshop" | "settings";

const links: Array<{ key: AppSurface; href: string; label: string }> = [
  { key: "kiosk", href: "/kiosk", label: "메인 화면" },
  { key: "admin", href: "/sales", label: "판매장" },
  { key: "workshop", href: "/workshop", label: "작업장" },
  { key: "settings", href: "/settings", label: "설정" },
];

export default function AppNav({ current }: { current: AppSurface }) {
  return (
    <nav className="app-nav" aria-label="화면 이동">
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
    </nav>
  );
}