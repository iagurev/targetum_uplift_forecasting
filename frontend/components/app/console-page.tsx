"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  BotIcon,
  BrainCircuitIcon,
  ChartColumnIcon,
  FileTextIcon,
  LogOutIcon,
  ExternalLinkIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-provider";
import { Logo } from "@/components/app/logo";
import { AnimatedSelect, type AnimatedSelectOption } from "@/components/ui/animated-select";
import { Button } from "@/components/ui/button";
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
import { DEFAULT_AGENT_PERSONA, GENERATION_LANGUAGE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Agent, AgentSettings, Dashboard, Idea, Post } from "@/lib/types";
import {
  DashboardSkeleton,
  IdeasTableSkeleton,
  SafetyDialogLoading,
} from "@/components/pages/workspace-pieces";

type TabKey = "dashboard" | "ideas" | "posts" | "settings";
type ComposerMode = "ai" | "blank";
type PostSort = "published_desc" | "score_desc";

const NAV_ITEMS: Array<{ icon: typeof ChartColumnIcon; key: TabKey; label: string }> = [
  { icon: ChartColumnIcon, key: "dashboard", label: "Дашборд" },
  { icon: BrainCircuitIcon, key: "ideas", label: "Идеи постов" },
  { icon: FileTextIcon, key: "posts", label: "Мои посты" },
  { icon: SettingsIcon, key: "settings", label: "Настройки" }
];

const STATUS_META: Record<string, { className: string; label: string }> = {
  approved: { className: "pilot-status-completed", label: "Одобрен" },
  published: { className: "pilot-status-completed", label: "Опубликован" },
  rejected: { className: "pilot-status-danger", label: "Отклонён" }
};

const POST_SORT_OPTIONS: Array<AnimatedSelectOption<PostSort>> = [
  { label: "По дате публикации", value: "published_desc" },
  { label: "По score", value: "score_desc" }
];

const TAB_META: Record<TabKey, { subtitle: string; title: string }> = {
  dashboard: {
    subtitle: "Метрики публикаций и динамика активности выбранного агента.",
    title: "Дашборд"
  },
  ideas: {
    subtitle:
      "Топ-посты Moltbook за год, safety-фильтр и адаптация идей под личность агента на русском.",
    title: "Идеи постов"
  },
  posts: {
    subtitle:
      "История публикаций и моментальная проверка безопасности только в момент постинга.",
    title: "Мои посты"
  },
  settings: {
    subtitle: "Язык постов, модель и единая личность агента для идей и генерации.",
    title: "Настройки"
  }
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatChartDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short"
  }).format(parsed);
}

function PostTable({ posts }: { posts: Post[] }) {
  return (
    <div className="pilot-table-wrap">
      <table className="pilot-table">
        <thead>
          <tr>
            <th>Статус</th>
            <th>Текст</th>
            <th>Создан</th>
            <th>Опубликован</th>
          </tr>
        </thead>
        <tbody>
          {posts.length === 0 ? (
            <tr>
              <td className="pilot-empty-row" colSpan={4}>
                Пока нет постов
              </td>
            </tr>
          ) : (
            posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <span className={cn("pilot-status-chip", STATUS_META[post.status]?.className)}>
                    {STATUS_META[post.status]?.label ?? post.status}
                  </span>
                  {post.safety_reason ? (
                    <p className="pilot-inline-note">{post.safety_reason}</p>
                  ) : null}
                </td>
                <td className="pilot-post-cell">
                  <p className="pilot-post-snippet">{post.content}</p>
                  {post.generation_mode === "ai" ? (
                    <span className="pilot-post-mode">AI</span>
                  ) : null}
                </td>
                <td>{formatDate(post.created_at)}</td>
                <td>{formatDate(post.published_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSection({
  dashboard,
  agentName
}: {
  agentName: string;
  dashboard: Dashboard;
}) {
  return (
    <>
      <div className="pilot-stats-grid">
        <div className="pilot-stat-card pilot-stat-total">
          <div className="pilot-stat-icon pilot-stat-icon-total">
            <SparklesIcon size={18} />
          </div>
          <div>
            <p className="pilot-stat-title">Опубликовано</p>
            <p className="pilot-stat-value">{dashboard.published_posts} постов</p>
          </div>
        </div>
        <div className="pilot-stat-card pilot-stat-progress">
          <div className="pilot-stat-icon pilot-stat-icon-checking">
            <ShieldCheckIcon size={18} />
          </div>
          <div>
            <p className="pilot-stat-title">Safety-проверки</p>
            <p className="pilot-stat-value">
              {dashboard.published_posts + dashboard.rejected_posts} запусков
            </p>
          </div>
        </div>
        <div className="pilot-stat-card pilot-stat-progress">
          <div className="pilot-stat-icon pilot-stat-icon-progress">
            <FileTextIcon size={18} />
          </div>
          <div>
            <p className="pilot-stat-title">В истории</p>
            <p className="pilot-stat-value">{dashboard.recent_posts.length} последних записей</p>
          </div>
        </div>
        <div className="pilot-stat-card pilot-stat-completed">
          <div className="pilot-stat-icon pilot-stat-icon-completed">
            <BotIcon size={18} />
          </div>
          <div>
            <p className="pilot-stat-title">Отклонено</p>
            <p className="pilot-stat-value">{dashboard.rejected_posts} постов</p>
          </div>
        </div>
      </div>

      <div className="pilot-chart-grid">
        <section className="pilot-panel">
          <div className="pilot-panel-heading">
            <h2>Публикации за 14 дней</h2>
            <p>{agentName}</p>
          </div>
          <div className="pilot-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboard.series}>
                <CartesianGrid stroke="#e9eef5" strokeDasharray="4 4" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => [String(value ?? 0), "Опубликовано"]}
                  labelFormatter={(label) => formatChartDate(String(label))}
                />
                <Line
                  type="monotone"
                  dataKey="published"
                  name="Опубликовано"
                  stroke="#5d87ff"
                  strokeWidth={3}
                  dot={{ fill: "#5d87ff", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="pilot-panel">
          <div className="pilot-panel-heading">
            <h2>Распределение активности</h2>
            <p>Публикации и отклонения</p>
          </div>
          <div className="pilot-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Опубликовано", value: dashboard.published_posts },
                  { name: "Отклонено", value: dashboard.rejected_posts }
                ]}
              >
                <CartesianGrid stroke="#e9eef5" strokeDasharray="4 4" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [String(value ?? 0), "Количество"]} />
                <Bar dataKey="value" name="Количество" radius={[8, 8, 0, 0]} fill="#49beff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="pilot-panel">
        <div className="pilot-panel-heading">
          <h2>Топ публикации</h2>
        </div>
        <PostTable posts={dashboard.recent_posts} />
      </section>
    </>
  );
}

function CreateAgentFields({
  agentBio,
  agentDisplayName,
  agentHandle,
  agentName,
  agentPersona,
  setAgentBio,
  setAgentDisplayName,
  setAgentHandle,
  setAgentName,
  setAgentPersona
}: {
  agentBio: string;
  agentDisplayName: string;
  agentHandle: string;
  agentName: string;
  agentPersona: string;
  setAgentBio: (value: string) => void;
  setAgentDisplayName: (value: string) => void;
  setAgentHandle: (value: string) => void;
  setAgentName: (value: string) => void;
  setAgentPersona: (value: string) => void;
}) {
  return (
    <div className="pilot-modal-grid">
      <label className="pilot-field pilot-field-span-2">
        <span className="pilot-field-label">Название агента</span>
        <Input value={agentName} onChange={(event) => setAgentName(event.target.value)} />
      </label>
      <label className="pilot-field">
        <span className="pilot-field-label">Хэндл в соцсети</span>
        <Input value={agentHandle} onChange={(event) => setAgentHandle(event.target.value)} />
      </label>
      <label className="pilot-field">
        <span className="pilot-field-label">Отображаемое имя</span>
        <Input
          value={agentDisplayName}
          onChange={(event) => setAgentDisplayName(event.target.value)}
        />
      </label>
      <label className="pilot-field pilot-field-span-2">
        <span className="pilot-field-label">Описание профиля</span>
        <Textarea rows={3} value={agentBio} onChange={(event) => setAgentBio(event.target.value)} />
      </label>
      <label className="pilot-field pilot-field-span-2">
        <span className="pilot-field-label">Личность агента</span>
        <Textarea
          rows={5}
          value={agentPersona}
          onChange={(event) => setAgentPersona(event.target.value)}
        />
      </label>
    </div>
  );
}

export function ConsolePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isReady, logout, token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [postSearch, setPostSearch] = useState("");
  const [postSort, setPostSort] = useState<PostSort>("published_desc");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentPersona, setAgentPersona] = useState(DEFAULT_AGENT_PERSONA);
  const [agentHandle, setAgentHandle] = useState("");
  const [agentDisplayName, setAgentDisplayName] = useState("");
  const [agentBio, setAgentBio] = useState("");
  const [isModeDialogOpen, setIsModeDialogOpen] = useState(false);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isEditorDialogOpen, setIsEditorDialogOpen] = useState(false);
  const [isSafetyDialogOpen, setIsSafetyDialogOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("ai");
  const [composerPrompt, setComposerPrompt] = useState("");
  const [composerContent, setComposerContent] = useState("");
  const [composerIdea, setComposerIdea] = useState<Idea | null>(null);
  const [settingsForm, setSettingsForm] = useState<AgentSettings | null>(null);
  const [autoResearchedAgents, setAutoResearchedAgents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isReady && !token) {
      router.replace("/login");
    }
  }, [isReady, router, token]);

  const agentsQuery = useQuery({
    queryKey: ["agents", token],
    enabled: Boolean(token),
    queryFn: () => api.listAgents(token!)
  });

  useEffect(() => {
    if (!selectedAgentId && agentsQuery.data?.length) {
      setSelectedAgentId(agentsQuery.data[0].id);
    }
  }, [agentsQuery.data, selectedAgentId]);

  const selectedAgent =
    agentsQuery.data?.find((agent) => agent.id === selectedAgentId) ?? null;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", token, selectedAgentId],
    enabled: Boolean(token && selectedAgentId),
    queryFn: () => api.getDashboard(token!, selectedAgentId!)
  });

  const ideasQuery = useQuery({
    queryKey: ["ideas", token, selectedAgentId],
    enabled: Boolean(token && selectedAgentId),
    queryFn: () => api.listIdeas(token!, selectedAgentId!)
  });

  const postsQuery = useQuery({
    queryKey: ["posts", token, selectedAgentId],
    enabled: Boolean(token && selectedAgentId),
    queryFn: () => api.listPosts(token!, selectedAgentId!)
  });

  const settingsQuery = useQuery({
    queryKey: ["settings", token, selectedAgentId],
    enabled: Boolean(token && selectedAgentId),
    queryFn: () => api.getSettings(token!, selectedAgentId!)
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettingsForm(settingsQuery.data);
    }
  }, [settingsQuery.data]);

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
      setActiveTab("dashboard");
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
      void queryClient.invalidateQueries({ queryKey: ["agents", token] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось создать агента");
    }
  });

  const researchMutation = useMutation({
    mutationFn: () =>
      api.researchIdeas(token!, selectedAgentId!, {
        ideas_limit: 30,
        prompt: "Найди лучшие идеи для новых постов агента"
      }),
    onSuccess: async () => {
      toast.success("Исследование идей запущено");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["idea-histories", token, selectedAgentId] }),
        queryClient.invalidateQueries({ queryKey: ["ideas", token, selectedAgentId] })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось провести исследование");
    }
  });

  useEffect(() => {
    if (
      activeTab === "ideas" &&
      selectedAgentId &&
      !autoResearchedAgents[selectedAgentId] &&
      !ideasQuery.isLoading &&
      !researchMutation.isPending &&
      (ideasQuery.data?.length ?? 0) === 0
    ) {
      setAutoResearchedAgents((current) => ({ ...current, [selectedAgentId]: true }));
      researchMutation.mutate();
    }
  }, [
    activeTab,
    autoResearchedAgents,
    ideasQuery.data?.length,
    ideasQuery.isLoading,
    researchMutation.isPending,
    selectedAgentId
  ]);

  const generateMutation = useMutation({
    mutationFn: () =>
      api.generatePost(token!, selectedAgentId!, {
        idea_id: composerIdea?.id,
        prompt: composerPrompt
      }),
    onSuccess: (draft) => {
      setComposerContent(draft.content);
      setIsPromptDialogOpen(false);
      setIsEditorDialogOpen(true);
      toast.success("Текст подготовлен и прошёл проверку");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось сгенерировать пост");
    }
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      api.publishPost(token!, selectedAgentId!, {
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
        queryClient.invalidateQueries({ queryKey: ["posts", token, selectedAgentId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", token, selectedAgentId] }),
        queryClient.invalidateQueries({ queryKey: ["idea-history", token, selectedAgentId] }),
        queryClient.invalidateQueries({ queryKey: ["idea-histories", token, selectedAgentId] }),
        queryClient.invalidateQueries({ queryKey: ["ideas", token, selectedAgentId] })
      ]);
    },
    onError: (error) => {
      setIsSafetyDialogOpen(false);
      toast.error(error instanceof Error ? error.message : "Не удалось опубликовать пост");
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: () => api.updateSettings(token!, selectedAgentId!, settingsForm!),
    onSuccess: (settings) => {
      setSettingsForm(settings);
      toast.success("Настройки обновлены");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", token, selectedAgentId] }),
        queryClient.invalidateQueries({ queryKey: ["agents", token] })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    }
  });

  const filteredPosts = useMemo(() => {
    const posts = postsQuery.data ?? [];
    const search = postSearch.trim().toLowerCase();
    const filtered = search
      ? posts.filter((post) => post.content.toLowerCase().includes(search))
      : posts;

    return [...filtered].sort((left, right) => {
      if (postSort === "score_desc") {
        const leftScore = left.score ?? -1;
        const rightScore = right.score ?? -1;
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
      }

      const leftDate = Date.parse(left.published_at ?? left.created_at);
      const rightDate = Date.parse(right.published_at ?? right.created_at);
      return rightDate - leftDate;
    });
  }, [postSearch, postSort, postsQuery.data]);

  const openBlankComposer = () => {
    setComposerMode("blank");
    setComposerPrompt("");
    setComposerContent("");
    setComposerIdea(null);
    setIsModeDialogOpen(false);
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
    logout();
    router.replace("/login");
  };

  if (!isReady || (token && agentsQuery.isLoading && !agentsQuery.data)) {
    return <div className="pilot-loading-screen">Загрузка...</div>;
  }

  if (!token) {
    return <div className="pilot-loading-screen">Переадресация…</div>;
  }

  if (agentsQuery.isError) {
    return <div className="pilot-loading-screen">Не удалось загрузить список агентов.</div>;
  }

  if ((agentsQuery.data?.length ?? 0) === 0) {
    return (
      <div className="pilot-onboarding-shell">
        <div className="pilot-onboarding-topbar">
          <Logo />
          <Button onClick={handleLogout} variant="soft">
            <LogOutIcon size={16} />
            Выйти
          </Button>
        </div>

        <div className="pilot-onboarding-grid">
          <section className="pilot-onboarding-copy">
            <p className="pilot-onboarding-kicker">Старт</p>
            <h1 className="pilot-onboarding-title">Создай первого агента</h1>
            <p className="pilot-onboarding-text">
              После создания откроются дашборд, исследование идей из Moltbook, редактор постов и
              отдельные настройки генерации.
            </p>
            <div className="pilot-onboarding-points">
              <div className="pilot-onboarding-point">
                <strong>Дашборд</strong>
                <span>Статистика публикаций, история постов и динамика активности.</span>
              </div>
              <div className="pilot-onboarding-point">
                <strong>Идеи постов</strong>
                <span>Топ-посты Moltbook за год и русские идеи, адаптированные под личность.</span>
              </div>
              <div className="pilot-onboarding-point">
                <strong>Мои посты</strong>
                <span>AI или blank-редактирование и публикация сразу после safety-проверки.</span>
              </div>
            </div>
          </section>

          <section className="pilot-onboarding-form-card">
            <p className="pilot-onboarding-form-kicker">
              {user?.full_name ?? user?.login ?? "Новый пользователь"}
            </p>
            <h2 className="pilot-onboarding-form-title">Настрой агента для рабочей ленты</h2>
            <p className="pilot-onboarding-form-text">
              У агента будет собственная личность, история публикаций и отдельная модель генерации.
            </p>

            <form
              className="pilot-onboarding-form"
              onSubmit={(event) => {
                event.preventDefault();
                createAgentMutation.mutate();
              }}
            >
              <CreateAgentFields
                agentBio={agentBio}
                agentDisplayName={agentDisplayName}
                agentHandle={agentHandle}
                agentName={agentName}
                agentPersona={agentPersona}
                setAgentBio={setAgentBio}
                setAgentDisplayName={setAgentDisplayName}
                setAgentHandle={setAgentHandle}
                setAgentName={setAgentName}
                setAgentPersona={setAgentPersona}
              />
              <div className="pilot-onboarding-actions">
                <Button
                  disabled={
                    !agentName.trim() ||
                    !agentHandle.trim() ||
                    agentHandle.trim().length < 3 ||
                    createAgentMutation.isPending
                  }
                  type="submit"
                >
                  {createAgentMutation.isPending ? "Создаём..." : "Создать первого агента"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("pilot-shell", isSidebarCollapsed && "pilot-shell-collapsed")}
    >
      <aside
        className={cn("pilot-sidebar", isSidebarCollapsed && "pilot-sidebar-collapsed")}
      >
        <div className="pilot-logo-wrap">
          <div className="pilot-logo-head">
            <Logo />
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
              <AnimatedSelect
                ariaLabel="Выбор агента"
                onSelect={setSelectedAgentId}
                options={(agentsQuery.data ?? []).map((agent) => ({
                  label: agent.name,
                  value: agent.id,
                }))}
                selectedValue={selectedAgentId ?? (agentsQuery.data?.[0]?.id ?? "")}
              />
              <Button
                className="pilot-choice-add-button"
                onClick={() => {
                  if (!agentPersona.trim()) {
                    setAgentPersona(DEFAULT_AGENT_PERSONA);
                  }
                  setIsCreateAgentOpen(true);
                }}
                variant="outline"
              >
                <PlusIcon size={16} />
                Новый агент
              </Button>
            </div>
          </div>

          <nav className="pilot-nav-block">
            <p className="pilot-nav-group">Рабочее пространство</p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={cn(
                    "pilot-nav-item",
                    activeTab === item.key && "pilot-nav-item-active"
                  )}
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  type="button"
                >
                  <Icon className="pilot-nav-icon" size={18} />
                  <span className="pilot-nav-item-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
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

          <Button className="pilot-logout-button" onClick={handleLogout} variant="soft">
            <LogOutIcon size={16} />
            <span className="pilot-nav-item-label">Выйти</span>
          </Button>
        </div>
      </aside>

      <div className={cn("pilot-main", isSidebarCollapsed && "pilot-main-collapsed")}>
        <main className="pilot-page-wrapper">
          <div className="pilot-breadcrumb">
            <h1 className="pilot-breadcrumb-title">{TAB_META[activeTab].title}</h1>
          </div>

          {selectedAgent && activeTab === "dashboard" ? (
            dashboardQuery.data ? (
              <DashboardSection dashboard={dashboardQuery.data} agentName={selectedAgent.name} />
            ) : (
              <DashboardSkeleton />
            )
          ) : null}

          {selectedAgent && activeTab === "ideas" ? (
            <section className="pilot-panel">
              <div className="pilot-toolbar">
                <div>
                  <h2 className="pilot-section-title">Исследование идей</h2>
                  <p className="pilot-section-subtitle">
                    Топ-100 постов Moltbook за год, фильтрация и русские идеи под личность агента.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    if (selectedAgentId) {
                      setAutoResearchedAgents((current) => ({
                        ...current,
                        [selectedAgentId]: true
                      }));
                    }
                    researchMutation.mutate();
                  }}
                >
                  <SparklesIcon size={16} />
                  Запустить исследование
                </Button>
              </div>

              {researchMutation.isPending ? (
                <IdeasTableSkeleton />
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
                      {(ideasQuery.data ?? []).length === 0 ? (
                        <tr>
                          <td className="pilot-empty-row" colSpan={4}>
                            Запустите исследование, чтобы получить идеи.
                          </td>
                        </tr>
                      ) : (
                        (ideasQuery.data ?? []).map((idea) => (
                          <tr key={idea.id}>
                            <td className="pilot-name-cell">
                              <div>
                                <p className="pilot-table-title">{idea.title}</p>
                              </div>
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
                                  onClick={() => openAiComposer(idea)}
                                  type="button"
                                >
                                  <SparklesIcon size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {selectedAgent && activeTab === "posts" ? (
            <section className="pilot-panel">
              <div className="pilot-toolbar">
                <div className="pilot-search">
                  <SearchIcon className="pilot-search-icon" size={16} />
                  <Input
                    className="pilot-search-input"
                    onChange={(event) => setPostSearch(event.target.value)}
                    placeholder="Поиск по тексту поста"
                    value={postSearch}
                  />
                </div>
                <AnimatedSelect
                  ariaLabel="Сортировка постов"
                  className="pilot-post-sort-select"
                  onSelect={setPostSort}
                  options={POST_SORT_OPTIONS}
                  selectedValue={postSort}
                />
                <Button onClick={() => setIsModeDialogOpen(true)}>
                  <PlusIcon size={16} />
                  Новый пост
                </Button>
              </div>

              <PostTable posts={filteredPosts} />
            </section>
          ) : null}

          {selectedAgent && activeTab === "settings" ? (
            <section className="pilot-panel">
              <div className="pilot-panel-heading">
                <h2>Параметры генерации</h2>
              </div>

              {settingsForm ? (
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
                                generation_language: value as AgentSettings["generation_language"]
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
                    <div className="pilot-field-static">
                      <strong>{settingsForm.model}</strong>
                      <span>Задаётся только через `LLM_DEFAULT_MODEL` в env.</span>
                    </div>
                  </label>

                  <label className="pilot-field pilot-field-span-2">
                    <span className="pilot-field-label">Личность агента</span>
                    <Textarea
                      rows={7}
                      value={settingsForm.persona ?? ""}
                      onChange={(event) =>
                        setSettingsForm((current) =>
                          current
                            ? { ...current, persona: event.target.value }
                            : current
                        )
                      }
                    />
                  </label>

                  <div className="pilot-field-span-2 pilot-actions-end">
                    <Button
                      disabled={updateSettingsMutation.isPending}
                      onClick={() => updateSettingsMutation.mutate()}
                    >
                      {updateSettingsMutation.isPending ? "Сохраняем..." : "Сохранить"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pilot-settings-grid">
                  <div className="pilot-skeleton-stack">
                    <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
                    <div className="pilot-skeleton pilot-skeleton-input" />
                  </div>
                  <div className="pilot-skeleton-stack">
                    <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
                    <div className="pilot-skeleton pilot-skeleton-input" />
                  </div>
                  <div className="pilot-skeleton-stack pilot-field-span-2">
                    <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
                    <div className="pilot-skeleton pilot-skeleton-textarea" />
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </main>
      </div>

      <Dialog
        open={isCreateAgentOpen}
        onOpenChange={(open) => {
          if (open && !agentPersona.trim()) {
            setAgentPersona(DEFAULT_AGENT_PERSONA);
          }
          setIsCreateAgentOpen(open);
        }}
      >
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
            setAgentBio={setAgentBio}
            setAgentDisplayName={setAgentDisplayName}
            setAgentHandle={setAgentHandle}
            setAgentName={setAgentName}
            setAgentPersona={setAgentPersona}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateAgentOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={
                !agentName.trim() ||
                !agentHandle.trim() ||
                agentHandle.trim().length < 3 ||
                createAgentMutation.isPending
              }
              onClick={() => createAgentMutation.mutate()}
            >
              {createAgentMutation.isPending ? "Создаём..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isModeDialogOpen} onOpenChange={setIsModeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый пост</DialogTitle>
            <DialogDescription>Выберите сценарий создания публикации.</DialogDescription>
          </DialogHeader>

          <div className="pilot-choice-grid">
            <button className="pilot-choice-card" onClick={() => openAiComposer()} type="button">
              <SparklesIcon size={18} />
              <div>
                <strong>AI создание</strong>
              </div>
            </button>
            <button className="pilot-choice-card" onClick={openBlankComposer} type="button">
              <FileTextIcon size={18} />
              <div>
                <strong>Ручное создание</strong>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создание поста с AI</DialogTitle>
          </DialogHeader>
          <label className="pilot-field">
            <span className="pilot-field-label">Идея</span>
            <Textarea
              rows={8}
              value={composerPrompt}
              onChange={(event) => setComposerPrompt(event.target.value)}
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPromptDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={!composerPrompt.trim() || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? "Генерируем..." : "Сгенерировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditorDialogOpen} onOpenChange={setIsEditorDialogOpen}>
        <DialogContent className="pilot-editor-dialog">
          <DialogHeader>
            <DialogTitle>Создание поста</DialogTitle>
          </DialogHeader>

          <div className="pilot-editor-meta">
            {composerIdea ? <span className="pilot-badge">Идея: {composerIdea.title}</span> : null}
          </div>

          <Textarea
            className="pilot-editor-textarea"
            rows={16}
            value={composerContent}
            onChange={(event) => setComposerContent(event.target.value)}
          />

          <DialogFooter>
            <Button
              disabled={!composerContent.trim() || publishMutation.isPending}
              onClick={() => {
                setIsSafetyDialogOpen(true);
                publishMutation.mutate();
              }}
            >
              Опубликовать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSafetyDialogOpen} onOpenChange={setIsSafetyDialogOpen}>
        <DialogContent className="pilot-safety-dialog" hideCloseButton>
          <SafetyDialogLoading />
        </DialogContent>
      </Dialog>
    </div>
  );
}
