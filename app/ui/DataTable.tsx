"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

export type DataTableSortValue = string | number | Date | null | undefined;

export type DataTableColumn<Row> = {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  sortValue?: (row: Row) => DataTableSortValue;
  width?: string;
  align?: "left" | "center" | "right";
};

export type DataTableProps<Row> = {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  rowBackground?: (row: Row) => string | undefined;
  rowClassName?: (row: Row) => string | undefined;
  onRowClick?: (row: Row) => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  initialSort?: { columnId: string; direction?: "asc" | "desc" };
  emptyMessage?: ReactNode;
  ariaLabel?: string;
};

type SortState = {
  columnId: string;
  direction: "asc" | "desc";
} | null;

function compareValues(left: DataTableSortValue, right: DataTableSortValue) {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "ko-KR", { numeric: true, sensitivity: "base" });
}

export function DataTable<Row>({
  rows,
  columns,
  getRowId,
  rowBackground,
  rowClassName,
  onRowClick,
  selectedIds,
  onSelectedIdsChange,
  initialSort,
  emptyMessage = "표시할 항목이 없습니다.",
  ariaLabel,
}: DataTableProps<Row>) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>(
    initialSort ? { columnId: initialSort.columnId, direction: initialSort.direction ?? "asc" } : null,
  );
  const activeSelectedIds = selectedIds ?? internalSelectedIds;
  const selectedIdSet = useMemo(() => new Set(activeSelectedIds), [activeSelectedIds]);
  const selectedAll = rows.length > 0 && rows.every((row) => selectedIdSet.has(getRowId(row)));

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.columnId);
    if (!column?.sortValue) return rows;
    return [...rows].sort((left, right) => {
      const value = compareValues(column.sortValue?.(left), column.sortValue?.(right));
      return sort.direction === "asc" ? value : -value;
    });
  }, [columns, rows, sort]);

  const updateSelectedIds = (nextIds: string[]) => {
    if (selectedIds === undefined) setInternalSelectedIds(nextIds);
    onSelectedIdsChange?.(nextIds);
  };

  const toggleAll = () => {
    updateSelectedIds(selectedAll ? [] : rows.map(getRowId));
  };

  const toggleRow = (row: Row) => {
    const id = getRowId(row);
    updateSelectedIds(
      selectedIdSet.has(id)
        ? activeSelectedIds.filter((value) => value !== id)
        : [...activeSelectedIds, id],
    );
  };

  const toggleSort = (column: DataTableColumn<Row>) => {
    if (!column.sortValue) return;
    setSort((current) => {
      if (current?.columnId !== column.id) return { columnId: column.id, direction: "asc" };
      return { columnId: column.id, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className="ui-data-table__scroll">
      <table className="ui-data-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th className="ui-data-table__selection">
              <input
                type="checkbox"
                checked={selectedAll}
                onChange={toggleAll}
                aria-label="전체 선택"
              />
            </th>
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const sorted = sort?.columnId === column.id;
              const style = column.width ? { width: column.width } : undefined;
              return (
                <th key={column.id} style={style} aria-sort={sorted ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}>
                  {sortable ? (
                    <button className="ui-data-table__sort" type="button" onClick={() => toggleSort(column)}>
                      <span>{column.header}</span>
                      {sorted ? (
                        sort?.direction === "asc"
                          ? <ChevronUp size={15} aria-hidden="true" />
                          : <ChevronDown size={15} aria-hidden="true" />
                      ) : <ChevronsUpDown size={15} aria-hidden="true" />}
                    </button>
                  ) : column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const id = getRowId(row);
            const clickable = Boolean(onRowClick);
            const style: CSSProperties | undefined = rowBackground?.(row)
              ? { backgroundColor: rowBackground(row) }
              : undefined;
            return (
              <tr
                key={id}
                className={[clickable ? "ui-data-table__row--clickable" : "", rowClassName?.(row) ?? ""].filter(Boolean).join(" ")}
                style={style}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={(event) => onRowKeyDown(event, row)}
              >
                <td className="ui-data-table__selection" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIdSet.has(id)}
                    onChange={() => toggleRow(row)}
                    aria-label={`${id} 선택`}
                  />
                </td>
                {columns.map((column) => (
                  <td key={column.id} style={{ textAlign: column.align ?? "left" }}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {!sortedRows.length ? (
            <tr>
              <td className="ui-data-table__empty" colSpan={columns.length + 1}>{emptyMessage}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
