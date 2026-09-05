"use client";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
};

export function Tabs({ items, value, onValueChange, ariaLabel }: TabsProps) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === value ? "ui-tabs__tab ui-tabs__tab--active" : "ui-tabs__tab"}
          role="tab"
          aria-selected={item.id === value}
          disabled={item.disabled}
          onClick={() => onValueChange(item.id)}
        >
          {item.label}
          {item.count !== undefined ? <span className="ui-tabs__count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
