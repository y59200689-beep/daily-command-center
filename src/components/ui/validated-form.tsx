"use client";

import { useId, useRef, useState, type FormHTMLAttributes } from "react";

/** Keep native constraints while presenting errors inside the application. */
export function ValidatedForm({ children, onSubmit, onInput, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const errorId = useId();
  const [error, setError] = useState("");
  const invalidField = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const originalDescription = useRef<string | null>(null);
  const originalInvalid = useRef<string | null>(null);

  function clearError() {
    const field = invalidField.current;
    if (field) {
      if (originalDescription.current === null) field.removeAttribute("aria-describedby");
      else field.setAttribute("aria-describedby", originalDescription.current);
      if (originalInvalid.current === null) field.removeAttribute("aria-invalid");
      else field.setAttribute("aria-invalid", originalInvalid.current);
      invalidField.current = null;
    }
    setError("");
  }

  return <form {...props} noValidate onInput={event => { clearError(); onInput?.(event); }} onSubmit={event => {
    clearError();
    const field = event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input:invalid, textarea:invalid, select:invalid");
    if (field) {
      event.preventDefault();
      originalDescription.current = field.getAttribute("aria-describedby");
      originalInvalid.current = field.getAttribute("aria-invalid");
      invalidField.current = field;
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", [originalDescription.current, errorId].filter(Boolean).join(" "));
      setError(field.validationMessage);
      field.focus();
      return;
    }
    onSubmit?.(event);
  }}>
    {error && <p id={errorId} role="alert" className="field-error">{error}</p>}
    {children}
  </form>;
}
