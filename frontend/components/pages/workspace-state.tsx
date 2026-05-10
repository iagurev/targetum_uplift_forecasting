"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChartColumnIcon,
  Clock3Icon,
  FileTextIcon,
  LightbulbIcon,
  MessageSquareMoreIcon,
  SettingsIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-provider";
import { api } from "@/lib/api";
import { DEFAULT_AGENT_PERSONA } from "@/lib/constants";
import type { Agent, Idea } from "@/lib/types";

export type TabKey = "activity" | "autonomous" | "dashboard" | "ideas" | "posts" | "settings";
type ComposerMode = "ai" | "blank";

type NavItem = {
  href: string;
  icon: typeof ChartColumnIcon;
  key: TabKey;
  label: string;
};

export const NAV_SECTIONS: Array<{
  items: NavItem[];
  label: string;
}> = [
  {
    label: "Рабочее пространство",
    items: [
      { href: "/dashboard", icon: ChartColumnIcon, key: "dashboard", label: "Дашборд" },
      { href: "/ideas", icon: LightbulbIcon, key: "ideas", label: "Идеи постов" },
      { href: "/posts", icon: FileTextIcon, key: "posts", label: "Мои посты" }
    ]
  },
  {
    label: "Автоматизация",
    items: [
      { href: "/activity", icon: MessageSquareMoreIcon, key: "activity", label: "Активность" },
      { href: "/autonomous", icon: Clock3Icon, key: "autonomous", label: "Автономный режим" }
    ]
  },
  {
    label: "Конфигурация",
    items: [{ href: "/settings", icon: SettingsIcon, key: "settings", label: "Настройки" }]
  }
];

export const TAB_META: Record<TabKey, { title: string }> = {
  activity: { title: "Активность" },
  autonomous: { title: "Автономный режим" },
  dashboard: { title: "Дашборд" },
  ideas: { title: "Идеи постов" },
  posts: { title: "Мои посты" },
  settings: { title: "Настройки" }
};

const SELECTED_AGENT_STORAGE_KEY = "agentary.selectedAgentId";
let cachedSelectedAgentId: string | null | undefined;

function restoreSelectedAgentId() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedAgentId = window.localStorage.getItem(SELECTED_AGENT_STORAGE_KEY);
  cachedSelectedAgentId = storedAgentId;
  return storedAgentId;
}

function storeSelectedAgentId(nextAgentId: string | null) {
  cachedSelectedAgentId = nextAgentId;

  if (typeof window === "undefined") {
    return;
  }

  if (nextAgentId) {
    window.localStorage.setItem(SELECTED_AGENT_STORAGE_KEY, nextAgentId);
    return;
  }

  window.localStorage.removeItem(SELECTED_AGENT_STORAGE_KEY);
}

export function useWorkspaceState(activeTab: TabKey | "new-agent") {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isReady, logout, token, user } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    cachedSelectedAgentId ?? null
  );
  const [hasRestoredSelectedAgentId, setHasRestoredSelectedAgentId] = useState(
    cachedSelectedAgentId !== undefined
  );
  const [agentName, setAgentName] = useState("");
  const [agentPersona, setAgentPersona] = useState(DEFAULT_AGENT_PERSONA);
  const [agentHandle, setAgentHandle] = useState("");
  const [agentDisplayName, setAgentDisplayName] = useState("");
  const [agentBio, setAgentBio] = useState("");
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [isDeleteAgentOpen, setIsDeleteAgentOpen] = useState(false);
  const [isModeDialogOpen, setIsModeDialogOpen] = useState(false);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isEditorDialogOpen, setIsEditorDialogOpen] = useState(false);
  const [isSafetyDialogOpen, setIsSafetyDialogOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("ai");
  const [composerPrompt, setComposerPrompt] = useState("");
  const [composerContent, setComposerContent] = useState("");
  const [composerIdea, setComposerIdea] = useState<Idea | null>(null);

  useEffect(() => {
    if (isReady && !token) {
      router.replace("/login");
    }
  }, [isReady, router, token]);

  useEffect(() => {
    if (hasRestoredSelectedAgentId) {
      return;
    }

    setSelectedAgentId(restoreSelectedAgentId());
    setHasRestoredSelectedAgentId(true);
  }, [hasRestoredSelectedAgentId]);

  const agentsQuery = useQuery({
    queryKey: ["agents", token],
    enabled: Boolean(token),
    queryFn: () => api.listAgents(token!)
  });

  const agents = agentsQuery.data ?? [];

  const effectiveSelectedAgentId = useMemo(() => {
    if (!hasRestoredSelectedAgentId) {
      return null;
    }
    if (selectedAgentId && agents.some((agent) => agent.id === selectedAgentId)) {
      return selectedAgentId;
    }
    return agents[0]?.id ?? null;
  }, [agents, hasRestoredSelectedAgentId, selectedAgentId]);

  useEffect(() => {
    if (agentsQuery.isLoading || !hasRestoredSelectedAgentId) {
      return;
    }

    if (!effectiveSelectedAgentId) {
      setSelectedAgentId(null);
      storeSelectedAgentId(null);
      return;
    }

    if (effectiveSelectedAgentId !== selectedAgentId) {
      setSelectedAgentId(effectiveSelectedAgentId);
      storeSelectedAgentId(effectiveSelectedAgentId);
    }
  }, [agentsQuery.isLoading, effectiveSelectedAgentId, hasRestoredSelectedAgentId, selectedAgentId]);

  const selectedAgent =
    agents.find((agent) => agent.id === effectiveSelectedAgentId) ?? null;

  const shouldRedirectToNewAgent =
    activeTab !== "new-agent" &&
    isReady &&
    Boolean(token) &&
    !agentsQuery.isLoading &&
    agents.length === 0;

  const shouldRedirectToDashboard =
    activeTab === "new-agent" &&
    isReady &&
    Boolean(token) &&
    !agentsQuery.isLoading &&
    agents.length > 0;

  useEffect(() => {
    if (shouldRedirectToNewAgent) {
      router.replace("/new-agent");
    }
  }, [router, shouldRedirectToNewAgent]);

  useEffect(() => {
    if (shouldRedirectToDashboard) {
      router.replace("/dashboard");
    }
  }, [router, shouldRedirectToDashboard]);

  const createAgentMutation = useMutation({
    mutationFn: () =>
      api.createAgent(token!, {
        bio: agentBio,
        display_name: agentDisplayName,
        name: agentName,
        persona: agentPersona,
        social_handle: agentHandle
      }),
    onSuccess: (agent) => {
      toast.success("Агент создан");
      storeSelectedAgentId(agent.id);
      setSelectedAgentId(agent.id);
      queryClient.setQueryData<Agent[]>(["agents", token], (current) => {
        const existing = current ?? [];
        return [agent, ...existing.filter((item) => item.id !== agent.id)];
      });
      setIsCreateAgentOpen(false);
      setAgentName("");
      setAgentPersona(DEFAULT_AGENT_PERSONA);
      setAgentHandle("");
      setAgentDisplayName("");
      setAgentBio("");
      router.replace("/dashboard");
      void queryClient.invalidateQueries({ queryKey: ["agents", token] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось создать агента");
    }
  });

  const deleteAgentMutation = useMutation({
    mutationFn: () => api.deleteAgent(token!, effectiveSelectedAgentId!),
    onSuccess: () => {
      let nextAgentId: string | null = null;

      queryClient.setQueryData<Agent[]>(["agents", token], (current) => {
        const remaining = (current ?? []).filter((agent) => agent.id !== effectiveSelectedAgentId);
        nextAgentId = remaining[0]?.id ?? null;
        return remaining;
      });

      storeSelectedAgentId(nextAgentId);
      setSelectedAgentId(nextAgentId);
      setIsDeleteAgentOpen(false);
      toast.success("Агент удалён");

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agents", token] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", token] }),
        queryClient.invalidateQueries({ queryKey: ["activity-overview", token] }),
        queryClient.invalidateQueries({ queryKey: ["autonomous-overview", token] }),
        queryClient.invalidateQueries({ queryKey: ["ideas", token] }),
        queryClient.invalidateQueries({ queryKey: ["posts", token] }),
        queryClient.invalidateQueries({ queryKey: ["settings", token] })
      ]);

      router.replace(nextAgentId ? "/dashboard" : "/new-agent");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить агента");
    }
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.generatePost(token!, effectiveSelectedAgentId!, {
        idea_id: composerIdea?.id,
        prompt: composerPrompt
      }),
    onSuccess: (draft) => {
      setComposerContent(draft.content);
      setIsPromptDialogOpen(false);
      setIsEditorDialogOpen(true);
      toast.success("Текст подготовлен");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось сгенерировать пост");
    }
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      api.publishPost(token!, effectiveSelectedAgentId!, {
        content: composerContent,
        generation_mode: composerMode,
        idea_id: composerIdea?.id ?? null,
        prompt: composerMode === "ai" ? composerPrompt : null
      }),
    onSuccess: (response) => {
      setIsSafetyDialogOpen(false);
      if (response.safety.approved) {
        toast.success("Пост опубликован");
        setIsEditorDialogOpen(false);
      } else {
        toast.error(response.safety.explanation);
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts", token, effectiveSelectedAgentId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", token, effectiveSelectedAgentId] }),
        queryClient.invalidateQueries({
          queryKey: ["idea-history", token, effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["idea-histories", token, effectiveSelectedAgentId]
        }),
        queryClient.invalidateQueries({ queryKey: ["ideas", token, effectiveSelectedAgentId] })
      ]);
    },
    onError: (error) => {
      setIsSafetyDialogOpen(false);
      toast.error(error instanceof Error ? error.message : "Не удалось опубликовать пост");
    }
  });

  const closeComposerFlow = () => {
    setIsModeDialogOpen(false);
    setIsPromptDialogOpen(false);
    setIsEditorDialogOpen(false);
  };

  const openBlankComposer = () => {
    setComposerMode("blank");
    setComposerPrompt("");
    setComposerContent("");
    setComposerIdea(null);
    closeComposerFlow();
    setIsEditorDialogOpen(true);
  };

  const openAiComposer = (idea?: Idea) => {
    setComposerMode("ai");
    setComposerIdea(idea ?? null);
    setComposerPrompt(idea ? `${idea.title}\n${idea.summary}` : "");
    setComposerContent("");
    setIsModeDialogOpen(false);
    setIsPromptDialogOpen(true);
  };

  const handleLogout = () => {
    storeSelectedAgentId(null);
    logout();
    router.replace("/login");
  };

  return {
    agentHandle,
    agentBio,
    agentDisplayName,
    agentName,
    agentPersona,
    agents,
    agentsQuery,
    closeComposerFlow,
    composerContent,
    composerIdea,
    composerPrompt,
    createAgentMutation,
    deleteAgentMutation,
    effectiveSelectedAgentId,
    generateMutation,
    handleLogout,
    isBlocking:
      !isReady ||
      !hasRestoredSelectedAgentId ||
      (Boolean(token) && agentsQuery.isLoading && !agentsQuery.data) ||
      shouldRedirectToDashboard ||
      shouldRedirectToNewAgent,
    isCreateAgentOpen,
    isDeleteAgentOpen,
    isEditorDialogOpen,
    isModeDialogOpen,
    isPromptDialogOpen,
    isSafetyDialogOpen,
    openAiComposer,
    openBlankComposer,
    publishMutation,
    selectedAgent,
    selectAgent: (nextAgentId: string) => {
      setSelectedAgentId(nextAgentId);
      storeSelectedAgentId(nextAgentId);
    },
    setAgentHandle,
    setAgentBio,
    setAgentDisplayName,
    setAgentName,
    setAgentPersona,
    setComposerContent,
    setComposerPrompt,
    setIsCreateAgentOpen,
    setIsDeleteAgentOpen,
    setIsEditorDialogOpen,
    setIsModeDialogOpen,
    setIsPromptDialogOpen,
    setIsSafetyDialogOpen,
    token,
    user
  };
}
