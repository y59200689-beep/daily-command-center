"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icons } from "@/components/icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}
let openModalCount = 0;

export function Modal({ open, onClose, title, description, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("input, button, textarea, select, a[href]")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>("[role='dialog']");
      if (dialogs.item(dialogs.length - 1) !== dialog) return;
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("input, button, textarea, select, a[href]")].filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    openModalCount += 1;
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", handleKey);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) document.body.classList.remove("modal-open");
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <div className="modal__header">
          <div>
            <p className="eyebrow">Command center</p>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId} className="modal__description">{description}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><Icons.X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
