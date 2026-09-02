"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

type ButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type LabelButtonProps = ButtonBaseProps & {
  iconOnly?: false;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children?: ReactNode;
};

type IconOnlyButtonProps = ButtonBaseProps & {
  iconOnly: true;
  "aria-label": string;
  leadingIcon: ReactNode;
  trailingIcon?: never;
  children?: never;
};

export type ButtonProps = LabelButtonProps | IconOnlyButtonProps;

export function Button({
  variant = "primary",
  size = "md",
  iconOnly = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    iconOnly ? "ui-button--icon-only" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {leadingIcon ? <span className="ui-button__icon" aria-hidden="true">{leadingIcon}</span> : null}
      {iconOnly ? null : <span className="ui-button__label">{children}</span>}
      {trailingIcon ? <span className="ui-button__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
}
