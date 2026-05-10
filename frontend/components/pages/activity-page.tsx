"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ExternalLinkIcon, FilterIcon, SettingsIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { toast } from "sonner";

import { Button, ButtonLoadingContent } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
  ActivitySkeleton,
  ActivityTable,
  LoadingScreen,
  TablePagination,
  TABLE_PAGE_SIZE,
  clampTablePage,
  paginateTableItems,
} from "./workspace-pieces";
import { useWorkspaceState } from "./workspace-state";
import { WorkspaceShell } from "./workspace-shell";

export function ActivityPage() {
  const workspace = useWorkspaceState("activity");
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activityIntensity, setActivityIntensity] = useState(0);
  const [activityAutoApprove, setActivityAutoApprove] = useState(false);
  const [page, setPage] = useState(1);
  const [pendingOnly, setPendingOnly] = useState(false);
  const overviewQuery = useQuery({
    queryKey: ["activity-overview", workspace.token, workspace.effectiveSelectedAgentId],
    enabled: Boolean(workspace.token && workspace.effectiveSelectedAgentId),
    queryFn: () => api.getActivityOverview(workspace.token!, workspace.effectiveSelectedAgentId!),
    refetchInterval: (query) => {
      const intensity = activityIntensity;
      const hasPending = (query.state.data?.items ?? []).some((item) => item.status === "pending");
      return intensity > 0 || hasPending ? 5000 : false;
    }
  });

  useEffect(() => {
    if (!workspace.selectedAgent) {
      return;
    }
    setActivityIntensity(workspace.selectedAgent.settings.activity_intensity ?? 0);
    setActivityAutoApprove(Boolean(workspace.selectedAgent.settings.activity_auto_approve));
  }, [
    workspace.selectedAgent?.id,
    workspace.selectedAgent?.settings.activity_auto_approve,
    workspace.selectedAgent?.settings.activity_intensity
  ]);

  const approveMutation = useMutation({
    mutationFn: (proposalId: string) =>
      api.approveActivityProposal(
        workspace.token!,
        workspace.effectiveSelectedAgentId!,
        proposalId
      ),
    onSuccess: async () => {
      toast.success("Комментарий отправлен");
      await queryClient.invalidateQueries({
        queryKey: ["activity-overview", workspace.token, workspace.effectiveSelectedAgentId]
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить комментарий");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (proposalId: string) =>
      api.rejectActivityProposal(
        workspace.token!,
        workspace.effectiveSelectedAgentId!,
        proposalId
      ),
    onSuccess: async () => {
      toast.success("Предложение отклонено");
      await queryClient.invalidateQueries({
        queryKey: ["activity-overview", workspace.token, workspace.effectiveSelectedAgentId]
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось отклонить предложение");
    }
  });

  const updateActivitySettingsMutation = useMutation({
    mutationFn: () =>
      api.updateSettings(workspace.token!, workspace.effectiveSelectedAgentId!, {
        activity_auto_approve: activityAutoApprove,
        activity_intensity: activityIntensity,
        generation_language: workspace.selectedAgent!.settings.generation_language,
        model: workspace.selectedAgent!.settings.model,
        persona: workspace.selectedAgent!.persona,
        source_google_enabled: workspace.selectedAgent!.settings.source_google_enabled,
        source_moltbook_enabled: workspace.selectedAgent!.settings.source_moltbook_enabled,
        source_social_enabled: workspace.selectedAgent!.settings.source_social_enabled
      }),
    onSuccess: async (settings) => {
      toast.success("Настройки активности обновлены");
      setIsSettingsOpen(false);
      queryClient.setQueryData(
        ["settings", workspace.token, workspace.effectiveSelectedAgentId],
        settings
      );
      queryClient.setQueryData(
        ["agents", workspace.token],
        (current: typeof workspace.agentsQuery.data) =>
          (current ?? []).map((agent) =>
            agent.id === workspace.effectiveSelectedAgentId
              ? {
                  ...agent,
                  persona: settings.persona,
                  settings: {
                    ...agent.settings,
                    ...settings,
                  },
                }
              : agent
          )
      );
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ["settings", workspace.token, workspace.effectiveSelectedAgentId]
        }),
        queryClient.refetchQueries({ queryKey: ["agents", workspace.token] }),
        queryClient.refetchQueries({
          queryKey: ["activity-overview", workspace.token, workspace.effectiveSelectedAgentId]
        })
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить настройки активности"
      );
    }
  });

  const items = useMemo(() => {
    const data = overviewQuery.data?.items ?? [];
    return pendingOnly ? data.filter((item) => item.status === "pending") : data;
  }, [overviewQuery.data?.items, pendingOnly]);

  useEffect(() => {
    setPage(1);
  }, [pendingOnly, workspace.effectiveSelectedAgentId]);

  const paginatedItems = useMemo(
    () => paginateTableItems(items, page, TABLE_PAGE_SIZE),
    [items, page]
  );

  useEffect(() => {
    const nextPage = clampTablePage(page, items.length, TABLE_PAGE_SIZE);
    if (nextPage !== page) {
      setPage(nextPage);
    }
  }, [items.length, page]);

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
    <WorkspaceShell
      activeTab="activity"
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
      {overviewQuery.isLoading && !overviewQuery.data ? (
        <ActivitySkeleton />
      ) : (
        <section className="pilot-page-stage pilot-content-stack">
          <div className="pilot-toolbar">
            <Button onClick={() => setIsSettingsOpen(true)} variant="outline">
              <SettingsIcon size={15} />
              Настройки
            </Button>
            <button
              className={cn("pilot-filter-toggle", pendingOnly && "pilot-filter-toggle-active")}
              onClick={() => setPendingOnly((current) => !current)}
              type="button"
            >
              <FilterIcon size={15} />
              Только в ожидании
            </button>
          </div>

          <ActivityTable
            emptyLabel={
              pendingOnly
                ? "Сейчас нет предложений в ожидании"
                : "Пока нет предложений по комментариям"
            }
            items={paginatedItems.items}
            renderActions={(item) =>
              item.status === "pending" ? (
                <div className="pilot-inline-actions">
                  <Button
                    className="pilot-compact-button"
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    onClick={() => approveMutation.mutate(item.id)}
                    variant="outline"
                  >
                    <CheckIcon size={14} />
                    Подтвердить
                  </Button>
                  <Button
                    className="pilot-danger-outline-button pilot-compact-button"
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate(item.id)}
                    variant="outline"
                    >
                      <XIcon size={14} />
                      Отклонить
                    </Button>
                  {item.target_post_url ? (
                    <a
                      className="pilot-outline-button pilot-compact-button pilot-open-post-link"
                      href={item.target_post_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLinkIcon size={14} />
                      Открыть
                    </a>
                  ) : null}
                </div>
              ) : (
                item.target_post_url ? (
                  <a
                    className="pilot-outline-button pilot-compact-button pilot-open-post-link"
                    href={item.target_post_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLinkIcon size={14} />
                    Открыть
                  </a>
                ) : (
                  <span className="pilot-activity-action-placeholder">—</span>
                )
              )
            }
          />
          <TablePagination page={paginatedItems.page} totalItems={items.length} onPageChange={setPage} />
        </section>
      )}

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Настройки активности</DialogTitle>
          </DialogHeader>

          <div className="pilot-settings-grid">
            <div className="pilot-field pilot-field-span-2">
              <span className="pilot-field-label">Интенсивность активности</span>
              <div className="pilot-range-card">
                <div className="pilot-range-head">
                  <span>{activityIntensity}%</span>
                  <span className="pilot-field-hint">
                    {activityIntensity === 0
                      ? "0% выключает предложения комментариев"
                      : `${activityIntensity}% постов из ленты будут рассматриваться`}
                  </span>
                </div>
                <input
                  className="pilot-range-input"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    setActivityIntensity(Number.parseInt(event.target.value, 10) || 0)
                  }
                  step={1}
                  style={
                    {
                      "--pilot-range-progress": `${activityIntensity}%`
                    } as CSSProperties
                  }
                  type="range"
                  value={activityIntensity}
                />
              </div>
            </div>

            <div className="pilot-field pilot-field-span-2">
              <span className="pilot-field-label">Автоподтверждение действий</span>
              <button
                className={cn(
                  "pilot-toggle-card",
                  activityAutoApprove && "pilot-toggle-card-active"
                )}
                onClick={() => setActivityAutoApprove((current) => !current)}
                type="button"
              >
                <span className="pilot-toggle-copy">
                  {activityAutoApprove
                    ? "Комментарии будут отправляться сразу"
                    : "Каждое предложение нужно будет подтвердить"}
                </span>
                <span
                  className={cn(
                    "pilot-toggle-switch",
                    activityAutoApprove && "pilot-toggle-switch-active"
                  )}
                >
                  <span className="pilot-toggle-thumb" />
                </span>
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={updateActivitySettingsMutation.isPending}
              onClick={() => setIsSettingsOpen(false)}
              variant="outline"
            >
              Закрыть
            </Button>
            <Button
              disabled={updateActivitySettingsMutation.isPending}
              onClick={() => updateActivitySettingsMutation.mutate()}
            >
              <ButtonLoadingContent
                idleLabel="Сохранить"
                isLoading={updateActivitySettingsMutation.isPending}
                loadingLabel="Сохраняем..."
              />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
