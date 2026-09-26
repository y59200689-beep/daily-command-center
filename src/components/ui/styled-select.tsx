"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import "./styled-select.css";

export type SelectOption = { value: string; label: string; disabled?: boolean };
type Props = { value: string; onChange: (value: string) => void; options: SelectOption[]; label: string; id?: string; placeholder?: string; disabled?: boolean; searchable?: boolean; className?: string };

export function StyledSelect({ value, onChange, options, label, id, placeholder = "Select an option", disabled, searchable, className = "" }: Props) {
  const generatedId = useId();
  const listId = `${generatedId}-list`;
  const menuId = `${generatedId}-menu`;
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0, maxHeight: 320 });
  const selected = options.find(option => option.value === value);
  const filtered = options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const hasSearch = searchable ?? options.length > 8;

  useEffect(() => {
    if (!open) return;
    const position = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const below = window.innerHeight - box.bottom;
      const above = box.top;
      const height = Math.min(320, Math.max(160, Math.max(below, above) - 12));
      setRect({ left: Math.max(8, Math.min(box.left, window.innerWidth - box.width - 8)), top: below >= Math.min(240, height) || below >= above ? box.bottom + 6 : Math.max(8, box.top - height - 6), width: box.width, maxHeight: height });
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => { window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex(option => option.value === value && !option.disabled);
    requestAnimationFrame(() => { setActive(Math.max(0, selectedIndex)); (hasSearch ? search.current : optionRefs.current[Math.max(0, selectedIndex)])?.focus(); });
  // Set the initial active option only when opening, not while typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !document.getElementById(menuId)?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, menuId]);

  function close() { setOpen(false); setQuery(""); trigger.current?.focus(); }
  function choose(option: SelectOption) { if (option.disabled) return; onChange(option.value); close(); }
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const available = filtered.map((option, index) => !option.disabled ? index : -1).filter(index => index >= 0);
      if (!available.length) return;
      const place = available.indexOf(active);
      const next = event.key === "Home" ? available[0] : event.key === "End" ? available.at(-1)! : available[(place + (event.key === "ArrowDown" ? 1 : -1) + available.length) % available.length];
      setActive(next);
      if (!hasSearch) optionRefs.current[next]?.focus();
      else optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && open && hasSearch) { event.preventDefault(); if (filtered[active]) choose(filtered[active]); }
  }

  return <div className={`styled-select ${className}`}>
    <button ref={trigger} id={id} type="button" className="styled-select__trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} disabled={disabled} onClick={() => { setQuery(""); setOpen(current => !current); }} onKeyDown={onKeyDown}>
      <span className={!selected ? "styled-select__placeholder" : ""}>{selected?.label ?? placeholder}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open && createPortal(<div id={menuId} className="styled-select__menu" style={{ left: rect.left, top: rect.top, width: rect.width, maxHeight: rect.maxHeight }} onKeyDown={onKeyDown} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) setOpen(false); }}>
      {hasSearch && <label className="styled-select__search"><Search size={15} aria-hidden="true"/><input ref={search} aria-label={`Search ${label.toLowerCase()} options`} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} placeholder="Search options…"/></label>}
      <div id={listId} className="styled-select__options" role="listbox" aria-label={label}>{filtered.length ? filtered.map((option, index) => <button key={option.value} ref={node => { optionRefs.current[index] = node; }} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} tabIndex={hasSearch ? -1 : index === active ? 0 : -1} className={`styled-select__option ${index === active ? "is-active" : ""}`} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>{option.label}{option.value === value && <Check size={16} aria-hidden="true"/>}</button>) : <p className="styled-select__empty">No matching options</p>}</div>
    </div>, document.body)}
  </div>;
}
