import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";

export default function ToolbarSearch({
  value,
  onChange,
  placeholder,
  inlineOnMobile = false,
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    onChange({ target: { value: "" } });
    setOpen(false);
  };

  const inputClass =
    "h-10 w-full rounded-full bg-canvas pl-10 pr-4 text-sm outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-primary/20 sm:h-11";
  const icon = (
    <FontAwesomeIcon
      icon={faMagnifyingGlass}
      className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35"
    />
  );

  return (
    <>
      {/* sm+ (or always, when inlineOnMobile): the regular input */}
      <div
        className={`relative min-w-0 flex-1 sm:min-w-[200px] ${inlineOnMobile ? "" : "hidden sm:block"}`}
      >
        {icon}
        <input
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={inputClass}
        />
      </div>

      {!inlineOnMobile && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink/60 hover:bg-line sm:hidden"
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3.5 w-3.5" />
          {value && (
            <span
              className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary"
              aria-hidden="true"
            />
          )}
        </button>
      )}

      {!inlineOnMobile && open && (
        <div className="absolute inset-0 z-20 flex items-center gap-2 bg-surface sm:hidden">
          <div className="relative min-w-0 flex-1">
            {icon}
            <input
              ref={inputRef}
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              onKeyDown={(e) => e.key === "Escape" && close()}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink/60 hover:bg-line"
          >
            <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
