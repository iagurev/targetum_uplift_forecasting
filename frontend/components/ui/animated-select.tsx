"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type AnimatedSelectOption<T extends string> = {
  description?: string;
  label: string;
  value: T;
};

type AnimatedSelectProps<T extends string> = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onSelect: (value: T) => void;
  options: readonly AnimatedSelectOption<T>[];
  selectedValue: T;
};

export function AnimatedSelect<T extends string>({
  ariaLabel,
  className,
  disabled = false,
  onSelect,
  options,
  selectedValue,
}: AnimatedSelectProps<T>) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selectedOption = options.find((option) => option.value === selectedValue) ?? null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !triggerRef.current || typeof window === "undefined") {
      return;
    }

    function updatePopoverPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const width = Math.max(rect.width, 220);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);

      setPopoverStyle({
        left,
        position: "fixed",
        top: rect.bottom + 8,
        width,
      });
    }

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen]);

  function handleSelect(value: T) {
    onSelect(value);
    setIsOpen(false);
  }

  const popover = isOpen && isMounted && popoverStyle ? (
    <div className="pilot-animated-select-popover" ref={popoverRef} style={popoverStyle}>
      <div aria-label={ariaLabel} className="pilot-animated-select-list" id={listId} role="listbox">
        {options.map((option) => {
          const isActive = option.value === selectedValue;

          return (
            <button
              aria-selected={isActive}
              className={cn(
                "pilot-animated-select-option",
                isActive && "pilot-animated-select-option-active"
              )}
              key={option.value}
              role="option"
              type="button"
              onClick={() => handleSelect(option.value)}
            >
              <span className="pilot-animated-select-option-head">
                <span className="pilot-animated-select-option-title">{option.label}</span>
                {isActive ? <CheckIcon size={16} /> : null}
              </span>
              {option.description ? (
                <span className="pilot-animated-select-option-description">
                  {option.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("pilot-animated-select", className)} ref={containerRef}>
      <button
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "pilot-animated-select-trigger",
          isOpen && "pilot-animated-select-trigger-open"
        )}
        disabled={disabled}
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="pilot-animated-select-copy">
          <span className="pilot-animated-select-title">
            {selectedOption?.label ?? "Выберите вариант"}
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            "pilot-animated-select-chevron",
            isOpen && "pilot-animated-select-chevron-open"
          )}
          size={16}
        />
      </button>

      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
