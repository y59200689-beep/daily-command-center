"use client";

import { forwardRef, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  onClear?: () => void;
  endAdornment?: ReactNode;
  containerClassName?: string;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { label, onClear, endAdornment, containerClassName, className, value, ...props },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasValue = typeof value === "string" || typeof value === "number" ? String(value).length > 0 : false;

  function setInputRef(node: HTMLInputElement | null) {
    inputRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  return (
    <div className={cn("search-control", containerClassName)}>
      <Icons.Search className="search-control__icon" size={17} aria-hidden="true" />
      <input
        {...props}
        ref={setInputRef}
        type="search"
        value={value}
        aria-label={label}
        className={cn("search-control__input", className)}
      />
      {hasValue && onClear ? (
        <button
          type="button"
          className="search-control__clear"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
        >
          <Icons.X size={15} aria-hidden="true" />
        </button>
      ) : endAdornment ? (
        <span className="search-control__adornment">{endAdornment}</span>
      ) : null}
    </div>
  );
});
