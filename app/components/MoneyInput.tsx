"use client";

import type { ReactNode } from "react";
import { Field, FormattedInput, type FormattedInputProps } from "../ui";
import { koreanWonText } from "../lib/input-format";
import styles from "./MoneyInput.module.css";

export function MoneyReadout({ value }: { value: string | number }) {
  const text = koreanWonText(value);
  if (!text) return null;

  return <span className={styles.readout} aria-live="polite">{text}</span>;
}

type MoneyFieldInputProps = Omit<FormattedInputProps, "className" | "format"> & {
  className?: string;
  error?: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
};

export function MoneyFieldInput({
  id,
  label,
  hint,
  error,
  className,
  value,
  onValueChange,
  ...props
}: MoneyFieldInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <FormattedInput
        {...props}
        id={id}
        className="ui-field__control"
        aria-invalid={Boolean(error) || undefined}
        format="number"
        value={value}
        onValueChange={onValueChange}
      />
      <MoneyReadout value={value} />
    </Field>
  );
}
