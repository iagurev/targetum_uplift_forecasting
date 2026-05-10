"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ExternalLinkIcon,
  HistoryIcon,
  SearchIcon,
  SparklesIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, ButtonLoadingContent } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { IdeaHistory } from "@/lib/types";
import { cn } from "@/lib/utils";

import { IdeasTableSkeleton, LoadingScreen } from "./workspace-pieces";
import { useWorkspaceState } from "./workspace-state";
import { WorkspaceShell } from "./workspace-shell";

export function IdeasPage() {
  const workspace = useWorkspaceState("ideas");
  const queryClient = useQueryClient();
  const [ideaPrompt, setIdeaPrompt] = useState("");
  const [isResearchDialogOpen, setIsResearchDialogOpen] = useState(false);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [optimisticHistory, setOptimisticHistory] = useState<IdeaHistory | null>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);

  const historiesQuery = useQuery({
    queryKey: ["idea-histories", workspace.token, workspace.effectiveSelectedAgentId],
    enabled: Boolean(workspace.token && workspace.effectiveSelectedAgentId),
    queryFn: () =>
      api.listIdeaHistories(workspace.token!, workspace.effectiveSelectedAgentId!),
    refetchInterval: (query) =>
      query.state.data?.some((history) => history.status === "running") ? 2000 : false
  });

  useEffect(() => {
    const histories = historiesQuery.data ?? [];
    if (optimisticHistory && histories.some((history) => history.id === optimisticHistory.id)) {
      setOptimisticHistory(null);
    }

    const selectedExists =
      Boolean(selectedHistoryId) &&
      (histories.some((history) => history.id === selectedHistoryId) ||
        optimisticHistory?.id === selectedHistoryId);

    if (histories.length === 0 && !optimisticHistory) {
      setSelectedHistoryId(null);
      return;
    }

    if (!selectedExists) {
      setSelectedHistoryId(optimisticHistory?.id ?? histories[0]?.id ?? null);
    }
  }, [historiesQuery.data, optimisticHistory, selectedHistoryId]);

  useEffect(() => {
    setOptimisticHistory(null);
    setSelectedHistoryId(null);
  }, [workspace.effectiveSelectedAgentId]);

  useEffect(() => {
    if (!isHistoryMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!historyMenuRef.current?.contains(target)) {
        setIsHistoryMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsHistoryMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isHistoryMenuOpen]);

  const selectedHistory =
    (historiesQuery.data ?? []).find((history) => history.id === selectedHistoryId) ??
    (optimisticHistory?.id === selectedHistoryId ? optimisticHistory : null);

  const historyDetailQuery = useQuery({
    queryKey: ["idea-history", workspace.token, workspace.effectiveSelectedAgentId, selectedHistoryId],
    enabled: Boolean(workspace.token && workspace.effectiveSelectedAgentId && selectedHistoryId),
    queryFn: () =>
      api.getIdeaHistory(
        workspace.token!,
        workspace.effectiveSelectedAgentId!,
        selectedHistoryId!
      ),
    refetchInterval: (query) =>
      query.state.data?.history.status === "running" ? 2000 : false
  });

  const startResearchMutation = useMutation({
    mutationFn: () =>
      api.researchIdeas(workspace.token!, workspace.effectiveSelectedAgentId!, {
        ideas_limit: 30,
        prompt: ideaPrompt.trim()
      }),
    onSuccess: (history) => {
      setOptimisticHistory(history);
      setSelectedHistoryId(history.id);
      setIsHistoryMenuOpen(false);
      setIdeaPrompt("");
      setIsResearchDialogOpen(false);
      queryClient.setQueryData(
        ["idea-history", workspace.token, workspace.effectiveSelectedAgentId, history.id],
        { history, ideas: [] }
      );
      queryClient.setQueryData(
        ["idea-histories", workspace.token, workspace.effectiveSelectedAgentId],
        (current: typeof historiesQuery.data) => {
          const existing = current ?? [];
          return [history, ...existing.filter((item) => item.id !== history.id)];
        }
      );
      toast.success("Исследование запущено");
      void queryClient.invalidateQueries({
        queryKey: ["idea-histories", workspace.token, workspace.effectiveSelectedAgentId]
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось запустить исследование");
    }
  });

  const toggleUsedMutation = useMutation({
    mutationFn: ({ ideaId, used }: { ideaId: string; used: boolean }) =>
      api.toggleIdeaUsed(workspace.token!, workspace.effectiveSelectedAgentId!, ideaId, { used }),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["idea-history", workspace.token, workspace.effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["ideas", workspace.token, workspace.effectiveSelectedAgentId]
        })
      ]);
      toast.success(response.is_used ? "Идея помечена использованной" : "Идея снова доступна");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус идеи");
    }
  });

  const selectedHistoryDetail = historyDetailQuery.data;
  const selectedIdeas = selectedHistoryDetail?.ideas ?? [];
  const displayHistory = selectedHistoryDetail?.history ?? selectedHistory;
  const historyOptions = useMemo(() => {
    const histories = historiesQuery.data ?? [];
    if (!optimisticHistory) {
      return histories.slice(0, 10);
    }
    return [optimisticHistory, ...histories.filter((history) => history.id !== optimisticHistory.id)].slice(0, 10);
  }, [historiesQuery.data, optimisticHistory]);
  const historyContentKey = [
    selectedHistoryId ?? "empty",
    displayHistory?.updated_at ?? "initial",
    historyDetailQuery.isLoading ? "loading" : "ready",
    displayHistory?.status ?? "none"
  ].join(":");

  function formatHistoryDate(value: string) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function formatHistoryStatus(status: "completed" | "failed" | "running") {
    if (status === "running") {
      return "Ищем";
    }
    if (status === "failed") {
      return "Ошибка";
    }
    return "Готово";
  }

  if (workspace.isBlocking) {
    return <LoadingScreen />;
  }

  if (!workspace.token) {
    return <LoadingScreen />;
  }

  if (workspace.agentsQuery.isError) {
    return <LoadingScreen label="Не удалось загрузить список агентов" variant="error" />;
  }

  if (!workspace.selectedAgent) {
    return <LoadingScreen />;
  }

  return (
    <>
      <WorkspaceShell
        activeTab="ideas"
        agentBio={workspace.agentBio}
        agentDisplayName={workspace.agentDisplayName}
        agentHandle={workspace.agentHandle}
        agentName={workspace.agentName}
        agentPersona={workspace.agentPersona}
        agents={workspace.agents}
        composerContent={workspace.composerContent}
        composerIdea={workspace.composerIdea}
        composerPrompt={workspace.composerPrompt}
        createAgentOpen={workspace.isCreateAgentOpen}
        createAgentPending={workspace.createAgentMutation.isPending}
        deleteAgentOpen={workspace.isDeleteAgentOpen}
        deleteAgentPending={workspace.deleteAgentMutation.isPending}
        editorOpen={workspace.isEditorDialogOpen}
        generatePending={workspace.generateMutation.isPending}
        modeOpen={workspace.isModeDialogOpen}
        onAgentBioChange={workspace.setAgentBio}
        onAgentDisplayNameChange={workspace.setAgentDisplayName}
        onAgentHandleChange={workspace.setAgentHandle}
        onAgentNameChange={workspace.setAgentName}
        onAgentPersonaChange={workspace.setAgentPersona}
        onCloseComposerFlow={workspace.closeComposerFlow}
        onCloseCreateAgent={workspace.setIsCreateAgentOpen}
        onCloseDeleteAgent={workspace.setIsDeleteAgentOpen}
        onCloseSafety={workspace.setIsSafetyDialogOpen}
        onComposerContentChange={workspace.setComposerContent}
        onComposerPromptChange={workspace.setComposerPrompt}
        onCreateAgent={() => workspace.createAgentMutation.mutate()}
        onDeleteAgent={() => workspace.deleteAgentMutation.mutate()}
        onGeneratePost={() => workspace.generateMutation.mutate()}
        onLogout={workspace.handleLogout}
        onOpenAiComposer={() => workspace.openAiComposer()}
        onOpenBlankComposer={workspace.openBlankComposer}
        onOpenCreateAgent={() => workspace.setIsCreateAgentOpen(true)}
        onPublishPost={() => {
          workspace.setIsSafetyDialogOpen(true);
          workspace.publishMutation.mutate();
        }}
        promptOpen={workspace.isPromptDialogOpen}
        publishPending={workspace.publishMutation.isPending}
        safetyOpen={workspace.isSafetyDialogOpen}
        selectedAgent={workspace.selectedAgent}
        selectedAgentId={workspace.effectiveSelectedAgentId}
        setSelectedAgentId={workspace.selectAgent}
        user={workspace.user}
      >
        <section className="pilot-page-stage pilot-content-stack">
          <div className="pilot-toolbar-actions pilot-ideas-actions">
            {historyOptions.length > 0 ? (
              <div className="pilot-history-picker" ref={historyMenuRef}>
                <button
                  aria-expanded={isHistoryMenuOpen}
                  aria-haspopup="listbox"
                  className="pilot-history-picker-trigger"
                  onClick={() => setIsHistoryMenuOpen((current) => !current)}
                  type="button"
                >
                  <HistoryIcon size={16} />
                  <span className="pilot-history-picker-label">
                    {displayHistory?.title ?? historyOptions[0].title}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "pilot-history-picker-chevron",
                      isHistoryMenuOpen && "pilot-history-picker-chevron-open"
                    )}
                    size={16}
                  />
                </button>

                {isHistoryMenuOpen ? (
                  <div
                    aria-label="Последние истории поиска идей"
                    className="pilot-history-picker-popover"
                    role="listbox"
                  >
                    {historyOptions.map((history) => (
                      <button
                        aria-selected={history.id === displayHistory?.id}
                        className={cn(
                          "pilot-history-picker-option",
                          history.id === displayHistory?.id && "pilot-history-picker-option-active"
                        )}
                        key={history.id}
                        onClick={() => {
                          setSelectedHistoryId(history.id);
                          setIsHistoryMenuOpen(false);
                        }}
                        role="option"
                        type="button"
                      >
                        <span className="pilot-history-picker-option-copy">
                          <span className="pilot-history-picker-option-title">{history.title}</span>
                          <span className="pilot-history-picker-option-meta">
                            {formatHistoryStatus(history.status)} · {formatHistoryDate(history.created_at)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button className="pilot-ideas-action-button" onClick={() => setIsResearchDialogOpen(true)}>
              <SearchIcon size={16} />
              Найти идеи
            </Button>
          </div>

          <div className="pilot-history-content" key={historyContentKey}>
            {historiesQuery.isLoading && historyOptions.length === 0 ? (
              <IdeasTableSkeleton />
            ) : historiesQuery.isError ? (
              <div className="pilot-empty-state-card">
                <div className="pilot-empty-state-icon pilot-empty-state-icon-danger">
                  <HistoryIcon size={22} />
                </div>
                <div className="pilot-empty-state-copy">
                  <h3>Не удалось загрузить истории</h3>
                  <p>
                    {historiesQuery.error instanceof Error
                      ? historiesQuery.error.message
                      : "Попробуйте повторить попытку чуть позже."}
                  </p>
                </div>
              </div>
            ) : !displayHistory ? (
              <div className="pilot-empty-state-card">
                <div className="pilot-empty-state-icon">
                  <SearchIcon size={22} />
                </div>
                <div className="pilot-empty-state-copy">
                  <h3>Идей пока нет</h3>
                  <p>Нажмите «Найти идеи», введите промпт и создайте исследование</p>
                </div>
              </div>
            ) : historyDetailQuery.isLoading && !selectedHistoryDetail ? (
              <IdeasTableSkeleton />
            ) : displayHistory.status === "running" && selectedIdeas.length === 0 ? (
              <div className="pilot-idea-searching-state">
                <div className="pilot-idea-searching-icon">
                  <SearchIcon size={28} />
                </div>
                <div className="pilot-empty-state-copy">
                  <h3>Ищем идеи...</h3>
                  <p>{displayHistory.title}</p>
                </div>
              </div>
            ) : displayHistory.status === "failed" ? (
              <div className="pilot-empty-state-card">
                <div className="pilot-empty-state-icon pilot-empty-state-icon-danger">
                  <HistoryIcon size={22} />
                </div>
                <div className="pilot-empty-state-copy">
                  <h3>Поиск завершился ошибкой</h3>
                  <p>{displayHistory.error_message ?? "Не удалось завершить исследование идей."}</p>
                </div>
              </div>
            ) : (
              <div className="pilot-table-wrap">
                <table className="pilot-table">
                  <thead>
                    <tr>
                      <th>Идея</th>
                      <th>Кратко</th>
                      <th>Источник</th>
                      <th>Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIdeas.length === 0 ? (
                      <tr>
                        <td className="pilot-empty-row" colSpan={4}>
                          Ничего релевантного не найдено для этой истории.
                        </td>
                      </tr>
                    ) : (
                      selectedIdeas.map((idea) => (
                        <tr key={idea.id}>
                          <td className="pilot-name-cell">
                            <p className="pilot-table-title">{idea.title}</p>
                          </td>
                          <td>{idea.summary}</td>
                          <td>
                            <div className="pilot-source-cell">
                              <strong>{idea.source_title ?? "Без источника"}</strong>
                              {idea.source_url ? (
                                <a
                                  className="pilot-source-link"
                                  href={idea.source_url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {idea.source_url}
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="pilot-actions">
                              {idea.source_url ? (
                                <a
                                  className="pilot-action-btn pilot-action-link"
                                  href={idea.source_url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <ExternalLinkIcon size={16} />
                                </a>
                              ) : null}
                              <button
                                className="pilot-action-btn pilot-action-add"
                                onClick={() => workspace.openAiComposer(idea)}
                                type="button"
                              >
                                <SparklesIcon size={16} />
                              </button>
                              {idea.source_title || idea.source_url || idea.source_excerpt ? (
                                <button
                                  className={
                                    idea.is_used
                                      ? "pilot-action-btn pilot-action-used"
                                      : "pilot-action-btn pilot-action-unused"
                                  }
                                  disabled={toggleUsedMutation.isPending}
                                  onClick={() =>
                                    toggleUsedMutation.mutate({
                                      ideaId: idea.id,
                                      used: !idea.is_used
                                    })
                                  }
                                  type="button"
                                >
                                  <CheckCircle2Icon size={16} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </WorkspaceShell>

      <Dialog open={isResearchDialogOpen} onOpenChange={setIsResearchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Найти идеи</DialogTitle>
            <DialogDescription>
              Опишите тему или направление.
            </DialogDescription>
          </DialogHeader>

          <label className="pilot-field">
            <span className="pilot-field-label">Промпт</span>
            <Textarea
              rows={8}
              value={ideaPrompt}
              onChange={(event) => setIdeaPrompt(event.target.value)}
            />
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResearchDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={ideaPrompt.trim().length < 5 || startResearchMutation.isPending}
              onClick={() => startResearchMutation.mutate()}
            >
              <ButtonLoadingContent
                idleLabel="Исследовать"
                isLoading={startResearchMutation.isPending}
                loadingLabel="Запускаем поиск..."
              />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
