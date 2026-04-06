"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

export function MultiSelectDropdown({
  name,
  options,
  placeholder = "Choose options",
}: {
  name: string;
  options: Option[];
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const allSelected = selected.length === options.length && options.length > 0;
  const selectedLabel = useMemo(() => {
    if (!selected.length) return placeholder;
    if (selected.length === 1) {
      return options.find((option) => option.value === selected[0])?.label ?? placeholder;
    }
    return `${selected.length} selected`;
  }, [options, placeholder, selected]);

  function toggleValue(value: string) {
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  function toggleAll() {
    setSelected((current) => (current.length === options.length ? [] : options.map((option) => option.value)));
  }

  return (
    <div className={`multi-select ${open ? "is-open" : ""}`} ref={rootRef}>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      <button
        type="button"
        className="multi-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`multi-select__trigger-label ${selected.length ? "has-value" : ""}`}>{selectedLabel}</span>
        <span className="multi-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="multi-select__panel" role="listbox" aria-multiselectable="true">
          <button type="button" className="multi-select__option multi-select__option--select-all" onClick={toggleAll}>
            <span className={`multi-select__check ${allSelected ? "is-active" : ""}`} aria-hidden="true" />
            <span className="multi-select__option-label">Select all</span>
          </button>

          <div className="multi-select__options">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`multi-select__option ${isSelected ? "is-selected" : ""}`}
                  onClick={() => toggleValue(option.value)}
                >
                  <span className={`multi-select__check ${isSelected ? "is-active" : ""}`} aria-hidden="true" />
                  <span className="multi-select__option-label">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
