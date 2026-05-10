import type { GenerationLanguage } from "@/lib/constants";

export type User = {
  created_at: string;
  full_name: string;
  id: string;
  login: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type AgentSettings = {
  activity_auto_approve: boolean;
  activity_intensity: number;
  generation_language: GenerationLanguage;
  model: string;
  persona: string;
  source_google_enabled: boolean;
  source_moltbook_enabled: boolean;
  source_social_enabled: boolean;
};

export type LLMModel = {
  context_length: number | null;
  description: string | null;
  id: string;
  name: string;
};

export type OpenRouterModel = LLMModel;

export type Agent = {
  created_at: string;
  id: string;
  name: string;
  persona: string;
  social_bio: string | null;
  social_display_name: string | null;
  settings: AgentSettings;
  social_handle: string | null;
  social_network: string;
  status: string;
};

export type Idea = {
  created_at: string;
  id: string;
  is_used: boolean;
  rationale: string;
  source_excerpt: string | null;
  source_title: string | null;
  source_url: string | null;
  summary: string;
  title: string;
};

export type IdeaHistory = {
  created_at: string;
  error_message: string | null;
  id: string;
  ideas_count: number;
  prompt: string;
  requested_ideas_limit: number;
  status: "completed" | "failed" | "running";
  title: string;
  updated_at: string;
};

export type IdeaHistoryDetail = {
  history: IdeaHistory;
  ideas: Idea[];
};

export type AutonomousTaskStatus =
  | "cancelled"
  | "failed"
  | "running"
  | "scheduled"
  | "succeeded";

export type AutonomousSettings = {
  posts_per_hour: number;
};

export type AutonomousTask = {
  agent_id: string;
  attempt_count: number;
  created_at: string;
  execution_reason: string;
  finished_at: string | null;
  generated_content: string | null;
  id: string;
  post_id: string | null;
  post_url: string | null;
  scheduled_for: string;
  selected_idea_title: string | null;
  started_at: string | null;
  status: AutonomousTaskStatus;
  task_prompt: string | null;
  updated_at: string;
};

export type AutonomousTaskDetail = AutonomousTask & {
  error_message: string | null;
  generated_content: string | null;
  post_url: string | null;
  selected_idea_rationale: string | null;
  selected_idea_summary: string | null;
  selected_source_excerpt: string | null;
  selected_source_post_id: string | null;
  selected_source_title: string | null;
  selected_source_url: string | null;
};

export type AutonomousOverview = {
  settings: AutonomousSettings;
  tasks: AutonomousTask[];
};

export type AutonomousDebugTaskResponse = {
  task: AutonomousTask;
};

export type ActivityProposalStatus = "failed" | "pending" | "posted" | "rejected";

export type ActivityProposal = {
  actioned_at: string | null;
  agent_id: string;
  comment_text: string;
  created_at: string;
  id: string;
  posted_comment_id: string | null;
  rationale: string | null;
  safety_reason: string | null;
  safety_status: string;
  status: ActivityProposalStatus;
  target_post_author_handle: string | null;
  target_post_author_name: string | null;
  target_post_id: string;
  target_post_url: string | null;
  target_post_published_at: string | null;
  target_post_score: number | null;
  target_post_text: string;
  updated_at: string;
};

export type ActivityOverview = {
  items: ActivityProposal[];
};

export type Post = {
  agent_id: string;
  content: string;
  created_at: string;
  external_post_id: string | null;
  generation_mode: "ai" | "blank";
  id: string;
  idea_id: string | null;
  post_url: string | null;
  prompt: string | null;
  published_at: string | null;
  safety_reason: string | null;
  score: number | null;
  status: string;
};

export type DashboardPoint = {
  date: string;
  published: number;
  score: number;
};

export type Dashboard = {
  best_score: number;
  published_posts: number;
  recent_posts: Post[];
  rejected_posts: number;
  series: DashboardPoint[];
  top_three_score: number;
};

export type ResearchIdeasResponse = IdeaHistory;

export type IdeaUsedToggleResponse = {
  idea_id: string;
  is_used: boolean;
};

export type ClearUsedSourcesResponse = {
  cleared_count: number;
};

export type GeneratedPostDraft = {
  content: string;
  headline: string | null;
  safety: SafetyReview | null;
  sources: string[];
};

export type SafetyReview = {
  approved: boolean;
  explanation: string;
  flags: string[];
};

export type PublishPostResponse = {
  post: Post;
  safety: SafetyReview;
};
