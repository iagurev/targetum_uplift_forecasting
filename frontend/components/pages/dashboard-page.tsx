"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

import { DashboardSection, DashboardSkeleton, LoadingScreen } from "./workspace-pieces";
import { useWorkspaceState } from "./workspace-state";
import { WorkspaceShell } from "./workspace-shell";

export function DashboardPage() {
  const workspace = useWorkspaceState("dashboard");
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", workspace.token, workspace.effectiveSelectedAgentId],
    enabled: Boolean(workspace.token && workspace.effectiveSelectedAgentId),
    queryFn: () => api.getDashboard(workspace.token!, workspace.effectiveSelectedAgentId!)
  });

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
      activeTab="dashboard"
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
      {dashboardQuery.data ? (
        <DashboardSection
          agentName={workspace.selectedAgent.name}
          dashboard={dashboardQuery.data}
        />
      ) : (
        <DashboardSkeleton />
      )}
    </WorkspaceShell>
  );
}
