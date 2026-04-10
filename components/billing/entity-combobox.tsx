"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

export type ComboboxOption = { id: string; label: string };

export type EntityComboboxProps = {
  valueId: string;
  options: ComboboxOption[];
  /** Earlier ids sort first among matches (e.g. recent picks). */
  priorityIds?: string[];
  onValueChange: (id: string) => void;
  /** When the list is closed and a value is already chosen. */
  onAdvance?: () => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
};

export type EntityComboboxHandle = { focus: () => void; open: () => void };

function sortMatches(
  list: ComboboxOption[],
  query: string,
  priorityIds: string[]
): ComboboxOption[] {
  const q = query.trim().toLowerCase();
  const filtered = list.filter((o) => !q || o.label.toLowerCase().includes(q));
  return [...filtered].sort((a, b) => {
    const ia = priorityIds.indexOf(a.id);
    const ib = priorityIds.indexOf(b.id);
    const sa = ia === -1 ? 1_000 : ia;
    const sb = ib === -1 ? 1_000 : ib;
    if (sa !== sb) return sa - sb;
    return a.label.localeCompare(b.label);
  });
}

export const EntityCombobox = forwardRef<EntityComboboxHandle, EntityComboboxProps>(
  function EntityCombobox(
    {
      valueId,
      options,
      priorityIds = [],
      onValueChange,
      onAdvance,
      placeholder = "Search…",
      disabled,
      invalid,
      className,
      inputClassName,
      "aria-label": ariaLabel,
    },
    ref
  ) {
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlight, setHighlight] = useState(0);
    const prevValueIdRef = useRef(valueId);

    const selected = useMemo(
      () => options.find((o) => o.id === valueId),
      [options, valueId]
    );

    useEffect(() => {
      if (valueId) {
        const label = options.find((o) => o.id === valueId)?.label ?? "";
        queueMicrotask(() => {
          setQuery(label || "");
          prevValueIdRef.current = valueId;
        });
        return;
      }
      if (prevValueIdRef.current) {
        queueMicrotask(() => setQuery(""));
      }
      prevValueIdRef.current = valueId;
    }, [valueId, options]);

    const matches = useMemo(
      () => sortMatches(options, query, priorityIds),
      [options, query, priorityIds]
    );

    const highlightIdx =
      matches.length > 0
        ? Math.min(Math.max(0, highlight), matches.length - 1)
        : 0;

    useEffect(() => {
      function onDocMouseDown(e: MouseEvent) {
        const el = rootRef.current;
        if (!el || el.contains(e.target as Node)) return;
        setOpen(false);
      }
      document.addEventListener("mousedown", onDocMouseDown);
      return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      open: () => {
        setOpen(true);
        setHighlight(0);
      },
    }));

    function pick(id: string) {
      onValueChange(id);
      setOpen(false);
      requestAnimationFrame(() => onAdvance?.());
    }

    return (
      <div ref={rootRef} className={cn("relative", className)}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onBlur={() => {
            setOpen(false);
            const exact = options.find(
              (o) => o.label.toLowerCase() === query.trim().toLowerCase()
            );
            if (exact) {
              if (exact.id !== valueId) onValueChange(exact.id);
              setQuery(exact.label);
              return;
            }
            if (valueId) setQuery(selected?.label ?? "");
          }}
          className={cn(
            "w-full rounded border border-[#dadce0] bg-white px-3 py-2 text-sm text-[#202124] outline-none transition focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]",
            invalid && "border-[#d93025] bg-[#fce8e6]/40",
            inputClassName
          )}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              if (valueId) setQuery(selected?.label ?? "");
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              if (matches.length === 0) return;
              setHighlight((h) => Math.min(matches.length - 1, h + 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              if (matches.length === 0) return;
              setHighlight((h) => Math.max(0, h - 1));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (open && matches.length > 0) {
                pick(matches[highlightIdx]!.id);
                return;
              }
              if (!open && valueId && onAdvance) onAdvance();
            }
          }}
        />
        {open && matches.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded border border-[#dadce0] bg-white py-1 shadow-md"
          >
            {matches.map((o, i) => (
              <li
                key={o.id}
                role="option"
                aria-selected={i === highlightIdx}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm",
                  i === highlightIdx ? "bg-[#e8f0fe] text-[#202124]" : "text-[#202124]"
                )}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => pick(o.id)}
              >
                {o.label}
              </li>
            ))}
          </ul>
        ) : null}
        {open && matches.length === 0 ? (
          <div className="absolute z-50 mt-1 w-full rounded border border-[#dadce0] bg-white px-3 py-2 text-sm text-[#5f6368] shadow-md">
            No matches
          </div>
        ) : null}
      </div>
    );
  }
);
