"use client";

import {
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  SearchIcon
} from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Input } from "./input";

type AgentPickerProps = {
  agents: Agent[];
  compact?: boolean;
  onCreateAgent: () => void;
  onSelect: (agentId: string) => void;
  selectedAgentId: string | null;
};

export function AgentPicker({
  agents,
  compact = false,
  onCreateAgent,
  onSelect,
  selectedAgentId
}: AgentPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAgents = normalizedQuery
    ? agents.filter((agent) => {
        const searchable = [agent.name, agent.social_handle ?? ""].join(" ").toLowerCase();
        return searchable.includes(normalizedQuery);
      })
    : agents;

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
      if (
        !containerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
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

      const width = compact
        ? 280
        : window.innerWidth <= 768
          ? Math.min(Math.max(rect.width, 280), window.innerWidth - 24)
          : rect.width;
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
  }, [compact, isOpen]);

  function handleSelect(agentId: string) {
    onSelect(agentId);
    setIsOpen(false);
    setQuery("");
  }

  function handleCreateAgent() {
    setIsOpen(false);
    setQuery("");
    onCreateAgent();
  }

  const popover = isOpen && isMounted && popoverStyle ? (
    <div
      className={cn("pilot-agent-picker-popover", compact && "pilot-agent-picker-popover-compact")}
      ref={popoverRef}
      style={popoverStyle}
    >
      <div className="pilot-agent-picker-search">
        <SearchIcon className="pilot-agent-picker-search-icon" size={16} />
        <Input
          ref={inputRef}
          aria-label="Поиск агента"
          className="pilot-agent-picker-input"
          placeholder="Поиск агента"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div aria-label="Список агентов" className="pilot-agent-picker-list" id={listId} role="listbox">
        {filteredAgents.length > 0 ? (
          filteredAgents.map((agent) => {
            const isActive = agent.id === selectedAgent?.id;

            return (
              <button
                aria-selected={isActive}
                className={cn("pilot-agent-picker-option", isActive && "pilot-agent-picker-option-active")}
                key={agent.id}
                role="option"
                type="button"
                onClick={() => handleSelect(agent.id)}
              >
                <span className="pilot-agent-picker-option-icon">
                  {isActive ? <CheckIcon size={15} /> : <BotIcon size={15} />}
                </span>
                <span className="pilot-agent-picker-option-copy">
                  <span className="pilot-agent-picker-option-title">{agent.name}</span>
                  <span className="pilot-agent-picker-option-meta">
                    {agent.social_handle ? `@${agent.social_handle}` : "Без хендла"}
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <div className="pilot-agent-picker-empty">Ничего не найдено</div>
        )}
      </div>

      <div className="pilot-agent-picker-footer">
        <Button className="pilot-agent-picker-create-button" variant="outline" onClick={handleCreateAgent}>
          Создать агента
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div
      className={cn("pilot-agent-picker", compact && "pilot-agent-picker-compact")}
      ref={containerRef}
    >
      <button
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn("pilot-agent-picker-trigger", isOpen && "pilot-agent-picker-trigger-open")}
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        {compact ? (
          <span className="pilot-agent-picker-compact-mark">
            {selectedAgent?.name?.trim().charAt(0).toUpperCase() ?? "A"}
          </span>
        ) : (
          <>
            <span className="pilot-agent-picker-copy">
              <span className="pilot-agent-picker-title">
                {selectedAgent?.name ?? "Выберите агента"}
              </span>
              <span className="pilot-agent-picker-meta">
                {selectedAgent?.social_handle
                  ? `@${selectedAgent.social_handle}`
                  : "Поиск и переключение"}
              </span>
            </span>
            <ChevronDownIcon
              className={cn(
                "pilot-agent-picker-chevron",
                isOpen && "pilot-agent-picker-chevron-open"
              )}
              size={16}
            />
          </>
        )}
      </button>

      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
