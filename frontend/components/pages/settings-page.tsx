"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AnimatedSelect } from "@/components/ui/animated-select";
import { Button, ButtonLoadingContent } from "@/components/ui/button";
import { LLMModelPicker } from "@/components/ui/openrouter-model-picker";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { GENERATION_LANGUAGE_OPTIONS } from "@/lib/constants";
import type { AgentSettings, LLMModel } from "@/lib/types";
import { cn } from "@/lib/utils";

import { LoadingScreen, SettingsSkeleton } from "./workspace-pieces";
import { useWorkspaceState } from "./workspace-state";
import { WorkspaceShell } from "./workspace-shell";

export function SettingsPage() {
  const workspace = useWorkspaceState("settings");
  const queryClient = useQueryClient();
  const [settingsForm, setSettingsForm] = useState<AgentSettings | null>(null);
  const settingsQuery = useQuery({
    queryKey: ["settings", workspace.token, workspace.effectiveSelectedAgentId],
    enabled: Boolean(workspace.token && workspace.effectiveSelectedAgentId),
    queryFn: () => api.getSettings(workspace.token!, workspace.effectiveSelectedAgentId!)
  });
  const modelsQuery = useQuery({
    queryKey: ["llm-models", workspace.token],
    enabled: Boolean(workspace.token),
    gcTime: 25 * 60 * 1000,
    refetchOnMount: false,
    staleTime: 25 * 60 * 1000,
    queryFn: () => api.listLLMModels(workspace.token!)
  });
  const updateSettingsMutation = useMutation({
    mutationFn: () =>
      api.updateSettings(workspace.token!, workspace.effectiveSelectedAgentId!, settingsForm!),
    onSuccess: (settings) => {
      setSettingsForm(settings);
      toast.success("Настройки обновлены");
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["settings", workspace.token, workspace.effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({ queryKey: ["agents", workspace.token] }),
        queryClient.invalidateQueries({
          queryKey: ["activity-overview", workspace.token, workspace.effectiveSelectedAgentId]
        })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    }
  });
  const clearUsedSourcesMutation = useMutation({
    mutationFn: () =>
      api.clearUsedIdeaSources(workspace.token!, workspace.effectiveSelectedAgentId!),
    onSuccess: (response) => {
      toast.success(
        response.cleared_count > 0
          ? `Список использованных постов очищен (${response.cleared_count})`
          : "Список использованных постов уже пуст"
      );
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["idea-histories", workspace.token, workspace.effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["idea-history", workspace.token, workspace.effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["ideas", workspace.token, workspace.effectiveSelectedAgentId]
        })
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось очистить список использованных постов"
      );
    }
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettingsForm(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const saveSettings = () => updateSettingsMutation.mutate();

  const modelOptions: LLMModel[] = (() => {
    const fetched = [...(modelsQuery.data ?? [])];
    if (!settingsForm?.model) {
      return fetched;
    }

    if (fetched.some((model) => model.id === settingsForm.model)) {
      return fetched;
    }

    return [
      {
        context_length: null,
        description: "Текущая модель агента",
        id: settingsForm.model,
        name: settingsForm.model
      },
      ...fetched
    ];
  })();

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
      activeTab="settings"
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
      {settingsForm ? (
        <>
          <section className="pilot-panel pilot-page-stage">
            <div className="pilot-panel-heading">
              <h2>Параметры генерации</h2>
            </div>

            <div className="pilot-settings-grid">
              <label className="pilot-field">
                <span className="pilot-field-label">Язык генерации</span>
                <AnimatedSelect
                  ariaLabel="Выбор языка генерации"
                  onSelect={(value) =>
                    setSettingsForm((current) =>
                      current
                        ? {
                            ...current,
                            generation_language: value as AgentSettings["generation_language"],
                          }
                        : current
                    )
                  }
                  options={GENERATION_LANGUAGE_OPTIONS}
                  selectedValue={settingsForm.generation_language}
                />
              </label>

              <label className="pilot-field">
                <span className="pilot-field-label">LLM модель</span>
                <LLMModelPicker
                  errorMessage={
                    modelsQuery.isError ? "Не удалось загрузить список LLM-моделей" : null
                  }
                  isLoading={modelsQuery.isLoading}
                  models={modelOptions}
                  selectedModel={settingsForm.model}
                  onSelect={(modelId) =>
                    setSettingsForm((current) =>
                      current ? { ...current, model: modelId } : current
                    )
                  }
                />
              </label>

              <label className="pilot-field pilot-field-span-2">
                <span className="pilot-field-label">Личность агента</span>
                <Textarea
                  rows={7}
                  value={settingsForm.persona ?? ""}
                  onChange={(event) =>
                    setSettingsForm((current) =>
                      current ? { ...current, persona: event.target.value } : current
                    )
                  }
                />
              </label>

              <div className="pilot-field-span-2 pilot-actions-end">
                <div className="pilot-settings-actions">
                  <Button
                    className="pilot-danger-outline-button"
                    disabled={workspace.deleteAgentMutation.isPending}
                    onClick={() => workspace.setIsDeleteAgentOpen(true)}
                    variant="outline"
                  >
                    Удалить агента
                  </Button>
                  <Button
                    disabled={updateSettingsMutation.isPending}
                    onClick={saveSettings}
                  >
                    <ButtonLoadingContent
                      idleLabel="Сохранить"
                      isLoading={updateSettingsMutation.isPending}
                      loadingLabel="Сохраняем настройки..."
                    />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="pilot-panel pilot-page-stage">
            <div className="pilot-panel-heading">
              <h2>Источники Идей</h2>
            </div>

            <div className="pilot-settings-grid">
              <div className="pilot-field">
                <span className="pilot-field-label">Moltbook</span>
                <button
                  className={cn(
                    "pilot-toggle-card",
                    settingsForm.source_moltbook_enabled && "pilot-toggle-card-active"
                  )}
                  onClick={() =>
                    setSettingsForm((current) =>
                      current
                        ? {
                            ...current,
                            source_moltbook_enabled: !current.source_moltbook_enabled
                          }
                        : current
                    )
                  }
                  type="button"
                >
                  <span className="pilot-toggle-copy">
                    {settingsForm.source_moltbook_enabled
                      ? "Использовать Moltbook как источник идей"
                      : "Исключить Moltbook из поиска идей"}
                  </span>
                  <span
                    className={cn(
                      "pilot-toggle-switch",
                      settingsForm.source_moltbook_enabled && "pilot-toggle-switch-active"
                    )}
                  >
                    <span className="pilot-toggle-thumb" />
                  </span>
                </button>
              </div>

              <div className="pilot-field">
                <span className="pilot-field-label">Cibaa Network</span>
                <button
                  className={cn(
                    "pilot-toggle-card",
                    settingsForm.source_social_enabled && "pilot-toggle-card-active"
                  )}
                  onClick={() =>
                    setSettingsForm((current) =>
                      current
                        ? {
                            ...current,
                            source_social_enabled: !current.source_social_enabled
                          }
                        : current
                    )
                  }
                  type="button"
                >
                  <span className="pilot-toggle-copy">
                    {settingsForm.source_social_enabled
                      ? "Использовать Cibaa Network как источник идей"
                      : "Исключить Cibaa Network из поиска идей"}
                  </span>
                  <span
                    className={cn(
                      "pilot-toggle-switch",
                      settingsForm.source_social_enabled && "pilot-toggle-switch-active"
                    )}
                  >
                    <span className="pilot-toggle-thumb" />
                  </span>
                </button>
              </div>

              <div className="pilot-field pilot-field-span-2">
                <span className="pilot-field-label">Google / веб-поиск</span>
                <button
                  className={cn(
                    "pilot-toggle-card",
                    settingsForm.source_google_enabled && "pilot-toggle-card-active"
                  )}
                  onClick={() =>
                    setSettingsForm((current) =>
                      current
                        ? {
                            ...current,
                            source_google_enabled: !current.source_google_enabled
                          }
                        : current
                    )
                  }
                  type="button"
                >
                  <span className="pilot-toggle-copy">
                    {settingsForm.source_google_enabled
                      ? "Разрешить внешний веб-поиск при поиске идей и генерации постов"
                      : "Запретить внешний веб-поиск и оставаться только на внутренних источниках"}
                  </span>
                  <span
                    className={cn(
                      "pilot-toggle-switch",
                      settingsForm.source_google_enabled && "pilot-toggle-switch-active"
                    )}
                  >
                    <span className="pilot-toggle-thumb" />
                  </span>
                </button>
              </div>

              <div className="pilot-field-span-2 pilot-actions-end">
                <div className="pilot-settings-actions">
                  <Button
                    disabled={clearUsedSourcesMutation.isPending}
                    onClick={() => clearUsedSourcesMutation.mutate()}
                    variant="outline"
                  >
                    <ButtonLoadingContent
                      idleLabel="Сбросить использованные посты"
                      isLoading={clearUsedSourcesMutation.isPending}
                      loadingLabel="Очищаем список..."
                    />
                  </Button>
                  <Button
                    disabled={updateSettingsMutation.isPending}
                    onClick={saveSettings}
                  >
                    <ButtonLoadingContent
                      idleLabel="Сохранить"
                      isLoading={updateSettingsMutation.isPending}
                      loadingLabel="Сохраняем настройки..."
                    />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <SettingsSkeleton />
      )}
    </WorkspaceShell>
  );
}
