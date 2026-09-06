"use client";

import { useLayoutEffect, useRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { formatNumberInput, koreanWonText, rawInputValue } from "../lib/input-format";
import styles from "./MoneyInput.module.css";

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> & {
  className?: string;
  label: ReactNode;
  onValueChange: (value: string) => void;
  value: string | number;
};

export default function MoneyInput({ className, label, onValueChange, value, ...props }: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const formattedValue = formatNumberInput(value);
  const readout = koreanWonText(value);

  useLayoutEffect(() => {
    if (pendingCaret.current === null || document.activeElement !== inputRef.current) return;
    inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [formattedValue]);

  return (
    <label className={className}>
      <span>{label}</span>
      <input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={formattedValue}
        onChange={(event) => {
          const beforeCaret = event.currentTarget.value.slice(0, event.currentTarget.selectionStart ?? 0);
          const rawBeforeCaret = rawInputValue(beforeCaret).length;
          const rawValue = rawInputValue(event.currentTarget.value);
          const nextFormatted = formatNumberInput(rawValue);
          let digits = 0;
          pendingCaret.current = nextFormatted.length;
          for (let index = 0; index < nextFormatted.length; index += 1) {
            if (/\d/.test(nextFormatted[index])) digits += 1;
            if (digits === rawBeforeCaret) {
              pendingCaret.current = index + 1;
              break;
            }
          }
          onValueChange(rawValue);
        }}
      />
      {readout ? <small className={styles.readout} aria-live="polite">{readout}</small> : null}
    </label>
  );
}
