"use client";

import { Search } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";

export type ToolbarSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
};

export type ToolbarProps = {
  search?: ToolbarSearch;
  filters?: ReactNode;
  actions?: ReactNode;
  selectionCount?: number;
  children?: ReactNode;
};

export function Toolbar({ search, filters, actions, selectionCount, children }: ToolbarProps) {
  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => search?.onChange(event.target.value);

  return (
    <div className="ui-toolbar">
      {search ? (
        <label className="ui-toolbar__search">
          <Search size={17} strokeWidth={2.25} aria-hidden="true" />
          <span className="sr-only">{search.label ?? "검색"}</span>
          <input
            value={search.value}
            onChange={onSearchChange}
            placeholder={search.placeholder}
            aria-label={search.label ?? "검색"}
          />
        </label>
      ) : null}
      {filters ? <div className="ui-toolbar__filters">{filters}</div> : null}
      {selectionCount ? <strong className="ui-toolbar__selection">{selectionCount}개 선택</strong> : null}
      {children ? <div className="ui-toolbar__content">{children}</div> : null}
      {actions ? <div className="ui-toolbar__actions">{actions}</div> : null}
    </div>
  );
}
