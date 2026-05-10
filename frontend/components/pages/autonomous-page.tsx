"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3Icon, ExternalLinkIcon, PlayCircleIcon, Settings2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AutonomousTask, AutonomousTaskStatus } from "@/lib/types";

import {
  AutonomousOverviewSkeleton,
  AutonomousTaskDetailSkeleton,
  LoadingScreen,
  TablePagination,
  TABLE_PAGE_SIZE,
  clampTablePage,
  formatDate,
  paginateTableItems,
} from "./workspace-pieces";
import { useWorkspaceState } from "./workspace-state";
import { WorkspaceShell } from "./workspace-shell";

const AUTONOMOUS_STATUS_META: Record<
  AutonomousTaskStatus,
  { className: string; label: string }
> = {
  cancelled: { className: "pilot-status-neutral", label: "Отменена" },
  failed: { className: "pilot-status-danger", label: "Ошибка" },
  running: { className: "pilot-status-checking", label: "Исполняется" },
  scheduled: { className: "pilot-status-neutral", label: "Запланирована" },
  succeeded: { className: "pilot-status-completed", label: "Успешно" }
};

const DETAIL_DIALOG_CLOSE_MS = 180;

function parsePostsPerHour(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, parsed));
}

function getTaskActionMeta(status: AutonomousTaskStatus) {
  if (status === "running") {
    return { label: "Прервать", successMessage: "Задача прервана" };
  }
  if (status === "scheduled") {
    return { label: "Отменить", successMessage: "Задача отменена" };
  }
  return null;
}

function isDistinctSourceExcerpt(title: string | null, excerpt: string | null) {
  const normalizedTitle = (title ?? "").trim().toLowerCase();
  const normalizedExcerpt = (excerpt ?? "").trim().toLowerCase();
  return Boolean(normalizedExcerpt) && normalizedExcerpt !== normalizedTitle;
}

function sortAutonomousTasks(tasks: AutonomousTask[]) {
  return [...tasks].sort((left, right) => right.scheduled_for.localeCompare(left.scheduled_for));
}

export function AutonomousPage() {
  const workspace = useWorkspaceState("autonomous");
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [manualTaskPrompt, setManualTaskPrompt] = useState("");
  const [page, setPage] = useState(1);
  const [postsPerHourInput, setPostsPerHourInput] = useState("0");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const overviewQuery = useQuery({
    queryKey: ["autonomous-overview", workspace.token, workspace.effectiveSelectedAgentId],
    enabled: Boolean(workspace.token && workspace.effectiveSelectedAgentId),
    queryFn: () =>
      api.getAutonomousOverview(workspace.token!, workspace.effectiveSelectedAgentId!),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) {
        return false;
      }
      return data.settings.posts_per_hour > 0 ||
        data.tasks.some((task) => task.status === "scheduled" || task.status === "running")
        ? 5000
        : false;
    }
  });

  useEffect(() => {
    if (overviewQuery.data) {
      setPostsPerHourInput(String(overviewQuery.data.settings.posts_per_hour));
    }
  }, [overviewQuery.data?.settings.posts_per_hour]);

  useEffect(() => {
    setIsCreateTaskOpen(false);
    setIsSettingsOpen(false);
    setIsDetailDialogOpen(false);
    setManualTaskPrompt("");
    setPage(1);
    setSelectedTaskId(null);
  }, [workspace.effectiveSelectedAgentId]);

  useEffect(() => {
    if (isDetailDialogOpen || !selectedTaskId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedTaskId(null);
    }, DETAIL_DIALOG_CLOSE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isDetailDialogOpen, selectedTaskId]);

  const detailQuery = useQuery({
    queryKey: [
      "autonomous-task",
      workspace.token,
      workspace.effectiveSelectedAgentId,
      selectedTaskId
    ],
    enabled: Boolean(workspace.token && workspace.effectiveSelectedAgentId && selectedTaskId),
    queryFn: () =>
      api.getAutonomousTaskDetail(
        workspace.token!,
        workspace.effectiveSelectedAgentId!,
        selectedTaskId!
      ),
    refetchInterval: (query) =>
      query.state.data?.status === "running" || query.state.data?.status === "scheduled"
        ? 3000
        : false
  });

  const updateSettingsMutation = useMutation({
    mutationFn: () =>
      api.updateAutonomousSettings(workspace.token!, workspace.effectiveSelectedAgentId!, {
        posts_per_hour: parsePostsPerHour(postsPerHourInput)
      }),
    onSuccess: async (settings) => {
      setPostsPerHourInput(String(settings.posts_per_hour));
      setIsSettingsOpen(false);
      toast.success("Настройки автономного режима сохранены");
      await queryClient.refetchQueries({
        queryKey: ["autonomous-overview", workspace.token, workspace.effectiveSelectedAgentId]
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    }
  });

  const debugTaskMutation = useMutation({
    mutationFn: () =>
      api.createAutonomousDebugTask(workspace.token!, workspace.effectiveSelectedAgentId!, {
        prompt: manualTaskPrompt.trim() || null
      }),
    onSuccess: async () => {
      setManualTaskPrompt("");
      setIsCreateTaskOpen(false);
      toast.success("Задача создана");
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ["autonomous-overview", workspace.token, workspace.effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["posts", workspace.token, workspace.effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard", workspace.token, workspace.effectiveSelectedAgentId]
        })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось создать debug-задачу");
    }
  });
  const cancelTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      api.cancelAutonomousTask(workspace.token!, workspace.effectiveSelectedAgentId!, taskId),
    onSuccess: async (task, taskId) => {
      const currentTask = tasks.find((item) => item.id === taskId);
      const action = currentTask ? getTaskActionMeta(currentTask.status) : null;
      toast.success(action?.successMessage ?? "Задача обновлена");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["autonomous-overview", workspace.token, workspace.effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["autonomous-task", workspace.token, workspace.effectiveSelectedAgentId, task.id]
        })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить задачу");
    }
  });

  const tasks = useMemo(
    () => sortAutonomousTasks(overviewQuery.data?.tasks ?? []),
    [overviewQuery.data?.tasks]
  );

  const paginatedTasks = useMemo(
    () => paginateTableItems(tasks, page, TABLE_PAGE_SIZE),
    [page, tasks]
  );

  useEffect(() => {
    const nextPage = clampTablePage(page, tasks.length, TABLE_PAGE_SIZE);
    if (nextPage !== page) {
      setPage(nextPage);
    }
  }, [page, tasks.length]);

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
        activeTab="autonomous"
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
          <div className="pilot-toolbar pilot-autonomous-topbar">
            <Button
              className="pilot-autonomous-settings-button"
              onClick={() => setIsSettingsOpen(true)}
              variant="outline"
            >
              <Settings2Icon size={16} />
              Настройки
            </Button>
            <Button
              className="pilot-autonomous-create-button"
              disabled={debugTaskMutation.isPending}
              onClick={() => setIsCreateTaskOpen(true)}
            >
              <ButtonLoadingContent
                icon={<PlayCircleIcon size={16} />}
                idleLabel="Создать задачу"
                isLoading={debugTaskMutation.isPending}
                loadingLabel="Создаём..."
              />
            </Button>
          </div>

          {overviewQuery.isLoading && !overviewQuery.data ? (
            <AutonomousOverviewSkeleton />
          ) : overviewQuery.isError ? (
            <div className="pilot-empty-state-card">
              <div className="pilot-empty-state-icon pilot-empty-state-icon-danger">
                <Clock3Icon size={22} />
              </div>
              <div className="pilot-empty-state-copy">
                <h3>Не удалось загрузить автономный режим</h3>
                <p>
                  {overviewQuery.error instanceof Error
                    ? overviewQuery.error.message
                    : "Попробуйте повторить попытку чуть позже."}
                </p>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="pilot-empty-state-card">
              <div className="pilot-empty-state-icon">
                <Clock3Icon size={22} />
              </div>
              <div className="pilot-empty-state-copy">
                <h3>Задач пока нет</h3>
                <p>
                  {overviewQuery.data?.settings.posts_per_hour
                    ? "Расписание поддерживается на ближайшие 60 минут."
                    : "Можно создать ручную задачу или включить расписание в настройках."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="pilot-table-wrap">
                <table className="pilot-table pilot-autonomous-table">
                  <colgroup>
                    <col className="pilot-autonomous-col-time" />
                    <col className="pilot-autonomous-col-status" />
                    <col className="pilot-autonomous-col-idea" />
                    <col className="pilot-autonomous-col-post" />
                    <col className="pilot-autonomous-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>Статус</th>
                      <th>Идея</th>
                      <th>Пост</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTasks.items.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <div className="pilot-autonomous-time-cell">
                            <strong>{formatDate(task.scheduled_for)}</strong>
                            <span className="pilot-autonomous-secondary">
                              {task.finished_at
                                ? `Завершено ${formatDate(task.finished_at)}`
                                : task.started_at
                                  ? `Старт ${formatDate(task.started_at)}`
                                  : "Ожидает запуска"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={cn(
                              "pilot-status-chip",
                              AUTONOMOUS_STATUS_META[task.status].className
                            )}
                          >
                            {AUTONOMOUS_STATUS_META[task.status].label}
                          </span>
                        </td>
                        <td className="pilot-name-cell">
                          <p className="pilot-table-title">{task.selected_idea_title ?? "—"}</p>
                        </td>
                        <td className="pilot-post-cell">
                          {task.generated_content ? (
                            <p className="pilot-post-snippet">{task.generated_content}</p>
                          ) : (
                            <p className="pilot-post-snippet">—</p>
                          )}
                        </td>
                        <td className="pilot-autonomous-detail-cell">
                          <div className="pilot-autonomous-row-actions">
                            {task.post_url ? (
                              <a
                                className="pilot-outline-button pilot-compact-button pilot-open-post-link"
                                href={task.post_url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <ExternalLinkIcon size={14} />
                                Открыть
                              </a>
                            ) : null}
                            <Button
                              className="pilot-autonomous-detail-button"
                              onClick={() => {
                                setSelectedTaskId(task.id);
                                setIsDetailDialogOpen(true);
                              }}
                              variant="outline"
                            >
                              Детали
                            </Button>
                            {getTaskActionMeta(task.status) ? (
                              <Button
                                className={cn(
                                  "pilot-autonomous-detail-button",
                                  "pilot-autonomous-cancel-button"
                                )}
                                disabled={
                                  cancelTaskMutation.isPending &&
                                  cancelTaskMutation.variables === task.id
                                }
                                onClick={() => cancelTaskMutation.mutate(task.id)}
                                variant="outline"
                              >
                                {getTaskActionMeta(task.status)?.label}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={paginatedTasks.page} totalItems={tasks.length} onPageChange={setPage} />
            </>
          )}
        </section>
      </WorkspaceShell>

      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent className="pilot-autonomous-dialog">
          <DialogHeader>
            <DialogTitle>Создать задачу</DialogTitle>
            <DialogDescription>
              При необходимости опишите задачу конкретнее. Этот запрос будет учтён и при выборе идеи, и при генерации поста.
            </DialogDescription>
          </DialogHeader>

          <label className="pilot-field">
            <span className="pilot-field-label">Описание задачи</span>
            <Textarea
              rows={7}
              value={manualTaskPrompt}
              onChange={(event) => setManualTaskPrompt(event.target.value)}
            />
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>
              Отмена
            </Button>
            <Button disabled={debugTaskMutation.isPending} onClick={() => debugTaskMutation.mutate()}>
              <ButtonLoadingContent
                idleLabel="Создать"
                isLoading={debugTaskMutation.isPending}
                loadingLabel="Создаём..."
              />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="pilot-autonomous-dialog">
          <DialogHeader>
            <DialogTitle>Настройки автономного режима</DialogTitle>
            <DialogDescription>
              Публикации распределяются равномерно внутри часа.
            </DialogDescription>
          </DialogHeader>

          <label className="pilot-field">
            <span className="pilot-field-label">Постов в час</span>
            <Input
              max={100}
              min={0}
              onChange={(event) => setPostsPerHourInput(event.target.value)}
              type="number"
              value={postsPerHourInput}
            />
            <span className="pilot-autonomous-field-help">
              0 выключает автономный режим. Максимум 100 постов в час и не более 4 задач на одну минуту.
            </span>
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Закрыть
            </Button>
            <Button disabled={updateSettingsMutation.isPending} onClick={() => updateSettingsMutation.mutate()}>
              <ButtonLoadingContent
                idleLabel="Сохранить"
                isLoading={updateSettingsMutation.isPending}
                loadingLabel="Сохраняем..."
              />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
      >
        <DialogContent className="pilot-autonomous-detail-dialog">
          <DialogHeader>
            <DialogTitle>Детали задачи</DialogTitle>
          </DialogHeader>

          {detailQuery.isLoading && !detailQuery.data ? (
            <AutonomousTaskDetailSkeleton />
          ) : detailQuery.isError ? (
            <div className="pilot-empty-state-card">
              <div className="pilot-empty-state-icon pilot-empty-state-icon-danger">
                <Clock3Icon size={22} />
              </div>
              <div className="pilot-empty-state-copy">
                <h3>Не удалось загрузить детали</h3>
                <p>
                  {detailQuery.error instanceof Error
                    ? detailQuery.error.message
                    : "Попробуйте повторить попытку чуть позже."}
                </p>
              </div>
            </div>
          ) : detailQuery.data ? (
            <div className="pilot-autonomous-detail-grid">
              <div className="pilot-autonomous-detail-meta">
                <div className="pilot-autonomous-detail-item">
                  <span className="pilot-field-label">Статус</span>
                  <span
                    className={cn(
                      "pilot-status-chip",
                      AUTONOMOUS_STATUS_META[detailQuery.data.status].className
                    )}
                  >
                    {AUTONOMOUS_STATUS_META[detailQuery.data.status].label}
                  </span>
                </div>
                <div className="pilot-autonomous-detail-item">
                  <span className="pilot-field-label">Запрос задачи</span>
                  <p className="pilot-autonomous-detail-note">{detailQuery.data.task_prompt || "—"}</p>
                </div>
                <div className="pilot-autonomous-detail-item">
                  <span className="pilot-field-label">Запланирована</span>
                  <strong>{formatDate(detailQuery.data.scheduled_for)}</strong>
                </div>
                <div className="pilot-autonomous-detail-item">
                  <span className="pilot-field-label">Выполнена</span>
                  <strong>
                    {detailQuery.data.finished_at ? formatDate(detailQuery.data.finished_at) : "—"}
                  </strong>
                </div>
              </div>

              <div className="pilot-autonomous-detail-block">
                <span className="pilot-field-label">Выбранная идея</span>
                {detailQuery.data.selected_idea_title ? (
                  <div className="pilot-autonomous-detail-copy">
                    <h3>{detailQuery.data.selected_idea_title}</h3>
                    <p>{detailQuery.data.selected_idea_summary ?? "—"}</p>
                    <p>{detailQuery.data.selected_idea_rationale ?? "—"}</p>
                  </div>
                ) : (
                  <p className="pilot-autonomous-empty-detail">
                    Идея ещё не выбрана или задача не дошла до этого этапа.
                  </p>
                )}
              </div>

              <div className="pilot-autonomous-detail-block">
                <span className="pilot-field-label">Источник</span>
                {detailQuery.data.selected_source_title || detailQuery.data.selected_source_excerpt ? (
                  <div className="pilot-autonomous-detail-copy">
                    <h3>{detailQuery.data.selected_source_title ?? "Без источника"}</h3>
                    {detailQuery.data.selected_source_url ? (
                      <a
                        className="pilot-autonomous-detail-link"
                        href={detailQuery.data.selected_source_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {detailQuery.data.selected_source_url}
                      </a>
                    ) : null}
                    {isDistinctSourceExcerpt(
                      detailQuery.data.selected_source_title,
                      detailQuery.data.selected_source_excerpt
                    ) ? (
                      <p>{detailQuery.data.selected_source_excerpt}</p>
                    ) : null}
                  </div>
                ) : detailQuery.data.selected_idea_title ? (
                  <p className="pilot-autonomous-empty-detail">
                    Идея была выбрана без внешнего источника.
                  </p>
                ) : (
                  <p className="pilot-autonomous-empty-detail">Источник появится после выбора идеи.</p>
                )}
              </div>

              <div className="pilot-autonomous-detail-block">
                <span className="pilot-field-label">Сгенерированный пост</span>
                {detailQuery.data.generated_content ? (
                  <p className="pilot-autonomous-detail-content">
                    {detailQuery.data.generated_content}
                  </p>
                ) : (
                  <p className="pilot-autonomous-empty-detail">
                    Текст пока не готов или задача завершилась раньше этого шага.
                  </p>
                )}
              </div>

              {detailQuery.data.error_message ? (
                <div className="pilot-autonomous-detail-block pilot-autonomous-detail-error">
                  <span className="pilot-field-label">Ошибка</span>
                  <p className="pilot-autonomous-detail-content">{detailQuery.data.error_message}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
