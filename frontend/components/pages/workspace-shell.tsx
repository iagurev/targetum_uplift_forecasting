"use client";

import Link from "next/link";
import {
  BotIcon,
  FileTextIcon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SparklesIcon,
  Trash2Icon
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Logo } from "@/components/app/logo";
import { Button, ButtonLoadingContent } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { AgentPicker } from "@/components/ui/agent-picker";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Agent, Idea, User } from "@/lib/types";

import { CreateAgentFields, SafetyDialogLoading } from "./workspace-pieces";
import { NAV_SECTIONS, TAB_META, type TabKey } from "./workspace-state";

type WorkspaceShellProps = {
  activeTab: TabKey;
  agentBio: string;
  agentDisplayName: string;
  agentHandle: string;
  agentName: string;
  agentPersona: string;
  agents: Agent[];
  children: ReactNode;
  composerContent: string;
  composerIdea: Idea | null;
  composerPrompt: string;
  createAgentOpen: boolean;
  createAgentPending: boolean;
  deleteAgentOpen: boolean;
  deleteAgentPending: boolean;
  editorOpen: boolean;
  generatePending: boolean;
  modeOpen: boolean;
  onAgentBioChange: (value: string) => void;
  onAgentDisplayNameChange: (value: string) => void;
  onAgentHandleChange: (value: string) => void;
  onAgentNameChange: (value: string) => void;
  onAgentPersonaChange: (value: string) => void;
  onCloseComposerFlow: () => void;
  onCloseCreateAgent: (open: boolean) => void;
  onCloseDeleteAgent: (open: boolean) => void;
  onCloseSafety: (open: boolean) => void;
  onComposerContentChange: (value: string) => void;
  onComposerPromptChange: (value: string) => void;
  onCreateAgent: () => void;
  onDeleteAgent: () => void;
  onGeneratePost: () => void;
  onLogout: () => void;
  onOpenAiComposer: () => void;
  onOpenBlankComposer: () => void;
  onOpenCreateAgent: () => void;
  onPublishPost: () => void;
  promptOpen: boolean;
  publishPending: boolean;
  safetyOpen: boolean;
  selectedAgent: Agent | null;
  selectedAgentId: string | null;
  setSelectedAgentId: (agentId: string) => void;
  user: User | null;
};

export function WorkspaceShell({
  activeTab,
  agentBio,
  agentDisplayName,
  agentHandle,
  agentName,
  agentPersona,
  agents,
  children,
  composerContent,
  composerIdea,
  composerPrompt,
  createAgentOpen,
  createAgentPending,
  deleteAgentOpen,
  deleteAgentPending,
  editorOpen,
  generatePending,
  modeOpen,
  onAgentBioChange,
  onAgentDisplayNameChange,
  onAgentHandleChange,
  onAgentNameChange,
  onAgentPersonaChange,
  onCloseComposerFlow,
  onCloseCreateAgent,
  onCloseDeleteAgent,
  onCloseSafety,
  onComposerContentChange,
  onComposerPromptChange,
  onCreateAgent,
  onDeleteAgent,
  onGeneratePost,
  onLogout,
  onOpenAiComposer,
  onOpenBlankComposer,
  onOpenCreateAgent,
  onPublishPost,
  promptOpen,
  publishPending,
  safetyOpen,
  selectedAgent,
  selectedAgentId,
  setSelectedAgentId,
  user
}: WorkspaceShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isComposerFlowOpen = modeOpen || promptOpen || editorOpen;
  const [composerStage, setComposerStage] = useState<"editor" | "mode" | "prompt">("mode");

  useEffect(() => {
    if (editorOpen) {
      setComposerStage("editor");
      return;
    }

    if (promptOpen) {
      setComposerStage("prompt");
      return;
    }

    if (modeOpen) {
      setComposerStage("mode");
    }
  }, [editorOpen, modeOpen, promptOpen]);

  function handleComposerFlowOpenChange(open: boolean) {
    if (!open) {
      onCloseComposerFlow();
    }
  }

  return (
    <div className={cn("pilot-shell", isSidebarCollapsed && "pilot-shell-collapsed")}>
      <aside className={cn("pilot-sidebar", isSidebarCollapsed && "pilot-sidebar-collapsed")}>
        <div className="pilot-logo-wrap">
          <div className="pilot-logo-head">
            <Logo href="/dashboard" />
            <button
              aria-label="Свернуть меню"
              className="pilot-sidebar-toggle pilot-sidebar-toggle-top"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              type="button"
            >
              <PanelLeftCloseIcon size={16} />
            </button>
          </div>
        </div>

        <div className="pilot-sidebar-scroll">
          <div className="pilot-nav-block">
            <p className="pilot-nav-group">Агенты</p>
            <div className="pilot-agent-switcher">
              <AgentPicker
                agents={agents}
                onCreateAgent={onOpenCreateAgent}
                selectedAgentId={selectedAgentId}
                onSelect={setSelectedAgentId}
              />
            </div>
            <div className="pilot-agent-switcher-collapsed">
              <AgentPicker
                agents={agents}
                compact
                onCreateAgent={onOpenCreateAgent}
                selectedAgentId={selectedAgentId}
                onSelect={setSelectedAgentId}
              />
            </div>
          </div>

          {NAV_SECTIONS.map((section) => (
            <nav className="pilot-nav-block" key={section.label}>
              <p className="pilot-nav-group">{section.label}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    href={item.href}
                    className={cn("pilot-nav-item", activeTab === item.key && "pilot-nav-item-active")}
                    key={item.key}
                  >
                    <Icon className="pilot-nav-icon" size={18} />
                    <span className="pilot-nav-item-label">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>

        <div className="pilot-sidebar-footer">
          <button
            aria-label="Развернуть меню"
            className="pilot-sidebar-toggle pilot-sidebar-toggle-footer"
            onClick={() => setIsSidebarCollapsed(false)}
            type="button"
          >
            <PanelLeftOpenIcon size={16} />
          </button>

          <div className="pilot-user-card">
            <div className="pilot-user-avatar">
              <BotIcon size={18} />
            </div>
            <div className="pilot-user-meta">
              <p className="pilot-user-name">{user?.full_name ?? "Пользователь"}</p>
              <p className="pilot-user-role">{user?.login ?? "agent.owner"}</p>
            </div>
          </div>

          <Button className="pilot-logout-button" onClick={onLogout} variant="soft">
            <LogOutIcon size={16} />
            <span className="pilot-nav-item-label">Выйти</span>
          </Button>
        </div>
      </aside>

      <div className={cn("pilot-main", isSidebarCollapsed && "pilot-main-collapsed")}>
        <main className="pilot-page-wrapper">
          <div className="pilot-breadcrumb pilot-page-stage">
            <h1 className="pilot-breadcrumb-title">{TAB_META[activeTab].title}</h1>
          </div>
          {children}
        </main>
      </div>

      <Dialog open={createAgentOpen} onOpenChange={onCloseCreateAgent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый агент</DialogTitle>
            <DialogDescription>
              Создайте отдельного агента с собственной персоной, настройками и историей постов.
            </DialogDescription>
          </DialogHeader>

          <CreateAgentFields
            agentBio={agentBio}
            agentDisplayName={agentDisplayName}
            agentHandle={agentHandle}
            agentName={agentName}
            agentPersona={agentPersona}
            setAgentBio={onAgentBioChange}
            setAgentDisplayName={onAgentDisplayNameChange}
            setAgentHandle={onAgentHandleChange}
            setAgentName={onAgentNameChange}
            setAgentPersona={onAgentPersonaChange}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => onCloseCreateAgent(false)}>
              Отмена
            </Button>
            <Button
              disabled={
                !agentName.trim() ||
                !agentHandle.trim() ||
                agentHandle.trim().length < 3 ||
                createAgentPending
              }
              onClick={onCreateAgent}
            >
              <ButtonLoadingContent
                idleLabel="Создать"
                isLoading={createAgentPending}
                loadingLabel="Создаём агента..."
              />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isComposerFlowOpen} onOpenChange={handleComposerFlowOpenChange}>
        <DialogContent className={cn("pilot-composer-dialog", editorOpen && "pilot-editor-dialog")}>
          <div className="pilot-dialog-stage" key={composerStage}>
            {composerStage === "editor" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Создание поста</DialogTitle>
                </DialogHeader>

                <div className="pilot-editor-meta">
                  {composerIdea ? <span className="pilot-badge">Идея: {composerIdea.title}</span> : null}
                </div>

                <label className="pilot-field">
                  <span className="pilot-field-label">Содержание</span>
                  <Textarea
                    className="pilot-editor-textarea"
                    rows={18}
                    value={composerContent}
                    onChange={(event) => onComposerContentChange(event.target.value)}
                  />
                </label>

                <DialogFooter>
                  <Button variant="outline" onClick={onCloseComposerFlow}>
                    Отмена
                  </Button>
                  <Button disabled={!composerContent.trim() || publishPending} onClick={onPublishPost}>
                    <ButtonLoadingContent
                      idleLabel="Опубликовать"
                      isLoading={publishPending}
                      loadingLabel="Публикуем пост..."
                    />
                  </Button>
                </DialogFooter>
              </>
            ) : composerStage === "prompt" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Создание поста с AI</DialogTitle>
                </DialogHeader>
                <label className="pilot-field">
                  <span className="pilot-field-label">Идея</span>
                  <Textarea
                    rows={8}
                    value={composerPrompt}
                    onChange={(event) => onComposerPromptChange(event.target.value)}
                  />
                </label>
                <DialogFooter>
                  <Button variant="outline" onClick={onCloseComposerFlow}>
                    Отмена
                  </Button>
                  <Button disabled={!composerPrompt.trim() || generatePending} onClick={onGeneratePost}>
                    <ButtonLoadingContent
                      idleLabel="Сгенерировать"
                      isLoading={generatePending}
                      loadingLabel="Генерируем пост..."
                    />
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Новый пост</DialogTitle>
                  <DialogDescription>Выберите сценарий создания публикации.</DialogDescription>
                </DialogHeader>

                <div className="pilot-choice-grid">
                  <button className="pilot-choice-card" onClick={onOpenAiComposer} type="button">
                    <SparklesIcon size={18} />
                    <div>
                      <strong>AI создание</strong>
                    </div>
                  </button>
                  <button className="pilot-choice-card" onClick={onOpenBlankComposer} type="button">
                    <FileTextIcon size={18} />
                    <div>
                      <strong>Ручное создание</strong>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={safetyOpen} onOpenChange={onCloseSafety}>
        <DialogContent className="pilot-safety-dialog" hideCloseButton>
          <SafetyDialogLoading />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAgentOpen} onOpenChange={onCloseDeleteAgent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить агента?</DialogTitle>
            <DialogDescription>
              {selectedAgent
                ? `Агент ${selectedAgent.name} будет удалён вместе с его постами и идеями.`
                : "Агент будет удалён вместе с его постами и идеями."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pilot-dialog-footer-tight">
            <Button variant="outline" onClick={() => onCloseDeleteAgent(false)}>
              Отмена
            </Button>
            <Button
              className="pilot-danger-outline-button"
              disabled={deleteAgentPending}
              onClick={onDeleteAgent}
              variant="outline"
            >
              <ButtonLoadingContent
                icon={<Trash2Icon size={16} />}
                idleLabel="Удалить"
                isLoading={deleteAgentPending}
                loadingLabel="Удаляем агента..."
              />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
