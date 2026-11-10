import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronDown } from "@fortawesome/free-solid-svg-icons";

// A compact "current selection + chevron" trigger that opens a menu of
// options on click. Used where a full tab strip or pill row would take up
// a whole line of its own - condensing it into a dropdown lets it share a
// row with other controls (filters should read as one coherent line, not
// multiple stacked rows that look like duplicate UI).
// `grow` (optional): on phones the trigger stretches to fill the free space in the toolbar row.
// `icon` (optional, bar size): on phones the trigger shrinks to just this icon + chevron so the
// toolbar fits on one line; a dot shows when the selection isn't the first ("all") option.
export default function FilterDropdown({
  value,
  options,
  renderOption,
  renderTrigger,
  onChange,
  size = "default",
  icon,
  grow = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target))
        setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative ${grow ? "min-w-0 flex-1 sm:flex-none" : ""}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          size === "bar"
            ? `relative flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink transition-colors sm:h-11 sm:px-4 ${grow ? "w-full min-w-0 justify-between sm:w-auto sm:justify-start" : "shrink-0"} ${
                open
                  ? "bg-surface ring-2 ring-primary/30"
                  : "bg-canvas hover:bg-line"
              }`
            : "flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark hover:bg-line"
        }
      >
        {icon && size === "bar" ? (
          <>
            <FontAwesomeIcon
              icon={icon}
              className="h-3.5 w-3.5 text-ink/70 sm:hidden"
            />
            {value !== options[0] && (
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary sm:hidden"
                aria-hidden="true"
              />
            )}
            <span className="hidden sm:inline">{renderTrigger(value)}</span>
          </>
        ) : (
          renderTrigger(value)
        )}
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-[10px] text-ink/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-max min-w-full max-w-[18rem] sm:left-0 sm:right-auto rounded-xl border border-line bg-surface p-1.5 shadow-xl"
        >
          {options.map((opt) => {
            const selected = opt === value;
            return (
              <button
                key={opt}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-6 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-canvas ${
                  selected ? "font-semibold text-ink" : "text-ink/70"
                }`}
              >
                <span>{renderOption(opt)}</span>
                {selected && (
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="h-3 w-3 shrink-0 text-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
