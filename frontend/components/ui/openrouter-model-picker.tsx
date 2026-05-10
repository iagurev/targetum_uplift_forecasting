"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import type { LLMModel } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Input } from "./input";

type LLMModelPickerProps = {
  disabled?: boolean;
  errorMessage?: string | null;
  isLoading?: boolean;
  models: LLMModel[];
  onSelect: (modelId: string) => void;
  selectedModel: string;
};

export function LLMModelPicker({
  disabled = false,
  errorMessage,
  isLoading = false,
  models,
  onSelect,
  selectedModel
}: LLMModelPickerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selectedOption = models.find((model) => model.id === selectedModel) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const shouldShowLoadingState = isOpen && isLoading && models.length === 0;
  const filteredModels = normalizedQuery
    ? models.filter((model) =>
        [model.id, model.name]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : models;

  function shouldShowModelId(model: LLMModel) {
    return model.name.trim().toLowerCase() !== model.id.trim().toLowerCase();
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

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

      const width = Math.max(rect.width, 360);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
      setPopoverStyle({
        left,
        position: "fixed",
        top: rect.bottom + 8,
        width
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

  function handleSelect(modelId: string) {
    onSelect(modelId);
    setIsOpen(false);
    setQuery("");
  }

  const popover = isOpen && isMounted && popoverStyle ? (
    <div className="pilot-model-picker-popover" ref={popoverRef} style={popoverStyle}>
      <div className="pilot-model-picker-search">
        <SearchIcon className="pilot-model-picker-search-icon" size={16} />
        <Input
          ref={inputRef}
          aria-label="Поиск LLM-модели"
          className="pilot-model-picker-input"
          placeholder="Поиск модели"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div
        aria-label="Список LLM-моделей"
        className="pilot-model-picker-list"
        id={listId}
        role="listbox"
      >
        {shouldShowLoadingState ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="pilot-model-picker-option pilot-model-picker-option-skeleton" key={index}>
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-md" />
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
            </div>
          ))
        ) : filteredModels.length > 0 ? (
          filteredModels.map((model) => {
            const isActive = model.id === selectedModel;

            return (
              <button
                aria-selected={isActive}
                className={cn(
                  "pilot-model-picker-option",
                  isActive && "pilot-model-picker-option-active"
                )}
                key={model.id}
                role="option"
                type="button"
                onClick={() => handleSelect(model.id)}
              >
                <span className="pilot-model-picker-option-head">
                  <span className="pilot-model-picker-option-title">{model.name}</span>
                  {isActive ? <CheckIcon size={16} /> : null}
                </span>
                {shouldShowModelId(model) ? (
                  <span className="pilot-model-picker-option-meta">{model.id}</span>
                ) : null}
                {model.description ? (
                  <span className="pilot-model-picker-option-description">
                    {model.description}
                  </span>
                ) : null}
              </button>
            );
          })
        ) : (
          <div className="pilot-model-picker-empty">
            {errorMessage || "Подходящие модели не найдены"}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="pilot-model-picker" ref={containerRef}>
      <button
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn("pilot-model-picker-trigger", isOpen && "pilot-model-picker-trigger-open")}
        disabled={disabled}
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="pilot-model-picker-copy">
          <span className="pilot-model-picker-title">{selectedOption?.name ?? selectedModel}</span>
        </span>
        <ChevronDownIcon
          className={cn("pilot-model-picker-chevron", isOpen && "pilot-model-picker-chevron-open")}
          size={16}
        />
      </button>

      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}

export const OpenRouterModelPicker = LLMModelPicker;
