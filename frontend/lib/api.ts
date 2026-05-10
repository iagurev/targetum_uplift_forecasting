import type {
  Agent,
  AgentSettings,
  ActivityOverview,
  ActivityProposal,
  AuthResponse,
  AutonomousDebugTaskResponse,
  AutonomousOverview,
  AutonomousSettings,
  AutonomousTask,
  AutonomousTaskDetail,
  ClearUsedSourcesResponse,
  Dashboard,
  GeneratedPostDraft,
  Idea,
  IdeaHistory,
  IdeaHistoryDetail,
  IdeaUsedToggleResponse,
  LLMModel,
  Post,
  PublishPostResponse,
  ResearchIdeasResponse,
  User
} from "@/lib/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

type RequestOptions = {
  body?: unknown;
  method?: string;
  token?: string | null;
};

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => formatDetail(item))
      .filter(Boolean)
      .join("; ");
  }

  if (detail && typeof detail === "object") {
    const value = detail as Record<string, unknown>;
    const location = Array.isArray(value.loc)
      ? value.loc
          .map((part) => String(part))
          .filter((part) => part !== "body")
          .join(".")
      : "";
    const message =
      (typeof value.msg === "string" && value.msg) ||
      (typeof value.message === "string" && value.message) ||
      (typeof value.error === "string" && value.error) ||
      (typeof value.detail === "string" && value.detail) ||
      "";

    if (message) {
      return location ? `${location}: ${message}` : message;
    }

    return Object.entries(value)
      .map(([key, nested]) => {
        const formatted = formatDetail(nested);
        if (!formatted) {
          return "";
        }
        return key === "detail" ? formatted : `${key}: ${formatted}`;
      })
      .filter(Boolean)
      .join("; ");
  }

  if (detail == null) {
    return "";
  }

  return String(detail);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem("agentary.auth");
      window.localStorage.removeItem("agentary.selectedAgentId");
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    let detail = "Ошибка запроса";
    try {
      const json = await response.json();
      const formatted = formatDetail(json.detail ?? json);
      detail = formatted || detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (payload: { login: string; password: string }) =>
    request<AuthResponse>("/auth/login", { body: payload, method: "POST" }),

  register: (payload: {
    full_name: string;
    login: string;
    password: string;
  }) => request<AuthResponse>("/auth/register", { body: payload, method: "POST" }),

  me: (token: string) => request<User>("/auth/me", { token }),

  listAgents: (token: string) => request<Agent[]>("/agents", { token }),

  createAgent: (
    token: string,
    payload: {
      bio?: string;
      display_name?: string;
      name: string;
      persona: string;
      social_handle: string;
    }
  ) => request<Agent>("/agents", { body: payload, method: "POST", token }),

  deleteAgent: (token: string, agentId: string) =>
    request<void>(`/agents/${agentId}`, { method: "DELETE", token }),

  getDashboard: (token: string, agentId: string) =>
    request<Dashboard>(`/agents/${agentId}/dashboard`, { token }),

  getAutonomousOverview: (token: string, agentId: string) =>
    request<AutonomousOverview>(`/agents/${agentId}/autonomous`, { token }),

  getActivityOverview: (token: string, agentId: string) =>
    request<ActivityOverview>(`/agents/${agentId}/activity`, { token }),

  approveActivityProposal: (token: string, agentId: string, proposalId: string) =>
    request<ActivityProposal>(`/agents/${agentId}/activity/${proposalId}/approve`, {
      method: "POST",
      token
    }),

  rejectActivityProposal: (token: string, agentId: string, proposalId: string) =>
    request<ActivityProposal>(`/agents/${agentId}/activity/${proposalId}/reject`, {
      method: "POST",
      token
    }),

  getAutonomousTaskDetail: (token: string, agentId: string, taskId: string) =>
    request<AutonomousTaskDetail>(`/agents/${agentId}/autonomous/tasks/${taskId}`, { token }),

  updateAutonomousSettings: (
    token: string,
    agentId: string,
    payload: AutonomousSettings
  ) =>
    request<AutonomousSettings>(`/agents/${agentId}/autonomous/settings`, {
      body: payload,
      method: "PUT",
      token
    }),

  createAutonomousDebugTask: (
    token: string,
    agentId: string,
    payload: { prompt?: string | null }
  ) =>
    request<AutonomousDebugTaskResponse>(`/agents/${agentId}/autonomous/tasks/debug`, {
      body: payload,
      method: "POST",
      token
    }),

  cancelAutonomousTask: (token: string, agentId: string, taskId: string) =>
    request<AutonomousTask>(`/agents/${agentId}/autonomous/tasks/${taskId}/cancel`, {
      method: "POST",
      token
    }),

  listIdeas: (token: string, agentId: string) =>
    request<Idea[]>(`/agents/${agentId}/ideas`, { token }),

  listIdeaHistories: (token: string, agentId: string) =>
    request<IdeaHistory[]>(`/agents/${agentId}/ideas/histories`, { token }),

  getIdeaHistory: (token: string, agentId: string, historyId: string) =>
    request<IdeaHistoryDetail>(`/agents/${agentId}/ideas/histories/${historyId}`, { token }),

  researchIdeas: (
    token: string,
    agentId: string,
    payload: { ideas_limit?: number; prompt: string }
  ) =>
    request<ResearchIdeasResponse>(`/agents/${agentId}/ideas/research`, {
      body: payload,
      method: "POST",
      token
    }),

  toggleIdeaUsed: (
    token: string,
    agentId: string,
    ideaId: string,
    payload: { used: boolean }
  ) =>
    request<IdeaUsedToggleResponse>(`/agents/${agentId}/ideas/${ideaId}/used`, {
      body: payload,
      method: "POST",
      token
    }),

  clearUsedIdeaSources: (token: string, agentId: string) =>
    request<ClearUsedSourcesResponse>(`/agents/${agentId}/ideas/used/clear`, {
      method: "POST",
      token
    }),

  listPosts: (token: string, agentId: string) =>
    request<Post[]>(`/agents/${agentId}/posts`, { token }),

  generatePost: (
    token: string,
    agentId: string,
    payload: { idea_id?: string | null; prompt: string }
  ) =>
    request<GeneratedPostDraft>(`/agents/${agentId}/posts/generate`, {
      body: payload,
      method: "POST",
      token
    }),

  publishPost: (
    token: string,
    agentId: string,
    payload: {
      content: string;
      generation_mode: "ai" | "blank";
      idea_id?: string | null;
      prompt?: string | null;
    }
  ) =>
    request<PublishPostResponse>(`/agents/${agentId}/posts/publish`, {
      body: payload,
      method: "POST",
      token
    }),

  getSettings: (token: string, agentId: string) =>
    request<AgentSettings>(`/agents/${agentId}/settings`, { token }),

  listLLMModels: (token: string) =>
    request<LLMModel[]>("/agents/llm/models", { token }),

  listOpenRouterModels: (token: string) =>
    request<LLMModel[]>("/agents/openrouter/models", { token }),

  updateSettings: (
    token: string,
    agentId: string,
    payload: AgentSettings
  ) =>
    request<AgentSettings>(`/agents/${agentId}/settings`, {
      body: payload,
      method: "PUT",
      token
    })
};
