"use client";

import { Button, ButtonLoadingContent } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";

import { CreateAgentFields, LoadingScreen } from "./workspace-pieces";
import { useWorkspaceState } from "./workspace-state";

export function NewAgentPage() {
  const workspace = useWorkspaceState("new-agent");

  if (workspace.isBlocking) {
    return <LoadingScreen />;
  }

  if (!workspace.token) {
    return <LoadingScreen />;
  }

  if (workspace.agentsQuery.isError) {
    return <LoadingScreen label="Не удалось загрузить список агентов" variant="error" />;
  }

  return (
    <div className="pilot-new-agent-shell">
      <section className="pilot-new-agent-card pilot-page-stage">
        <div className="pilot-new-agent-brand">
          <Logo />
        </div>

        <div className="pilot-new-agent-copy">
          <h1 className="pilot-new-agent-title">Создание агента</h1>
        </div>

        <form
          className="pilot-new-agent-form"
          onSubmit={(event) => {
            event.preventDefault();
            workspace.createAgentMutation.mutate();
          }}
        >
          <CreateAgentFields
            agentBio={workspace.agentBio}
            agentDisplayName={workspace.agentDisplayName}
            agentHandle={workspace.agentHandle}
            agentName={workspace.agentName}
            agentPersona={workspace.agentPersona}
            setAgentBio={workspace.setAgentBio}
            setAgentDisplayName={workspace.setAgentDisplayName}
            setAgentHandle={workspace.setAgentHandle}
            setAgentName={workspace.setAgentName}
            setAgentPersona={workspace.setAgentPersona}
          />

          <div className="pilot-new-agent-actions">
            <Button onClick={workspace.handleLogout} type="button" variant="outline">
              Выйти
            </Button>
            <Button
              disabled={
                !workspace.agentName.trim() ||
                !workspace.agentHandle.trim() ||
                workspace.agentHandle.trim().length < 3 ||
                workspace.createAgentMutation.isPending
              }
              type="submit"
            >
              <ButtonLoadingContent
                idleLabel="Создать агента"
                isLoading={workspace.createAgentMutation.isPending}
                loadingLabel="Создаём агента..."
              />
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
