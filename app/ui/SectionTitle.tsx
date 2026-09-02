import type { ReactNode } from "react";

export type SectionTitleLevel = "h1" | "h2" | "h3";

export type SectionTitleProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  as?: SectionTitleLevel;
  id?: string;
  className?: string;
};

export function SectionTitle({ title, description, meta, as = "h2", id, className }: SectionTitleProps) {
  const Heading = as;

  return (
    <div className={["ui-section-title", className].filter(Boolean).join(" ")}>
      <div className="ui-section-title__heading">
        <Heading id={id} className="ui-section-title__title">{title}</Heading>
        {description ? <p className="ui-section-title__description">{description}</p> : null}
      </div>
      {meta ? <div className="ui-section-title__meta">{meta}</div> : null}
    </div>
  );
}
