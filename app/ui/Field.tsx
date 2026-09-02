"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Field({ id, label, hint, error, className, children }: FieldProps) {
  const classes = ["ui-field", error ? "ui-field--error" : "", className].filter(Boolean).join(" ");

  return (
    <label className={classes} htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      {children}
      {error ? <span className="ui-field__error" role="alert">{error}</span> : null}
      {!error && hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}

export type FieldInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & Omit<FieldProps, "children">;

export function FieldInput({ id, label, hint, error, className, ...props }: FieldInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <input id={id} className="ui-field__control" aria-invalid={Boolean(error) || undefined} {...props} />
    </Field>
  );
}

export type FieldSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & Omit<FieldProps, "children"> & {
  children: ReactNode;
};

export function FieldSelect({ id, label, hint, error, className, children, ...props }: FieldSelectProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <select id={id} className="ui-field__control" aria-invalid={Boolean(error) || undefined} {...props}>
        {children}
      </select>
    </Field>
  );
}

export type FieldTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & Omit<FieldProps, "children">;

export function FieldTextarea({ id, label, hint, error, className, ...props }: FieldTextareaProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} className="ui-field__control ui-field__control--textarea" aria-invalid={Boolean(error) || undefined} {...props} />
    </Field>
  );
}
