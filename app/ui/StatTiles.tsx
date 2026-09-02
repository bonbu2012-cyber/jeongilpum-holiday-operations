import type { ReactNode } from "react";

export type StatTileSubtotal = {
  label: ReactNode;
  value: ReactNode;
};

export type StatTile = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  subtotals?: StatTileSubtotal[];
  tone?: "default" | "attention" | "success";
};

export type StatTilesProps = {
  tiles: StatTile[];
  ariaLabel?: string;
};

export function StatTiles({ tiles, ariaLabel }: StatTilesProps) {
  return (
    <section className="ui-stat-tiles" aria-label={ariaLabel}>
      {tiles.map((tile) => (
        <article key={tile.id} className={["ui-stat-tile", tile.tone ? `ui-stat-tile--${tile.tone}` : ""].filter(Boolean).join(" ")}>
          <span className="ui-stat-tile__label">{tile.label}</span>
          <strong className="ui-stat-tile__value">{tile.value}</strong>
          {tile.detail ? <span className="ui-stat-tile__detail">{tile.detail}</span> : null}
          {tile.subtotals?.length ? (
            <dl className="ui-stat-tile__subtotals">
              {tile.subtotals.map((subtotal) => (
                <div key={String(subtotal.label)}>
                  <dt>{subtotal.label}</dt>
                  <dd>{subtotal.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </article>
      ))}
    </section>
  );
}
