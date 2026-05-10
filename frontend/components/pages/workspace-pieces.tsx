"use client";

import type { ReactNode } from "react";

import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  LightbulbIcon,
  SendIcon
} from "lucide-react";
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

import { ButtonLoadingContent } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActivityProposal, Dashboard, Post } from "@/lib/types";

const STATUS_META: Record<string, { className: string; label: string }> = {
  approved: { className: "pilot-status-completed", label: "Одобрен" },
  failed: { className: "pilot-status-danger", label: "Ошибка" },
  pending: { className: "pilot-status-neutral", label: "В ожидании" },
  posted: { className: "pilot-status-completed", label: "Отправлен" },
  published: { className: "pilot-status-completed", label: "Опубликован" },
  rejected: { className: "pilot-status-danger", label: "Отклонён" }
};

export type PostTableSortColumn = "published_at" | "score";
export type PostTableSortDirection = "asc" | "desc";
export const TABLE_PAGE_SIZE = 100;

export function getTablePageCount(totalItems: number, pageSize: number = TABLE_PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampTablePage(
  page: number,
  totalItems: number,
  pageSize: number = TABLE_PAGE_SIZE
) {
  return Math.min(Math.max(1, page), getTablePageCount(totalItems, pageSize));
}

export function paginateTableItems<T>(
  items: T[],
  page: number,
  pageSize: number = TABLE_PAGE_SIZE
) {
  const safePage = clampTablePage(page, items.length, pageSize);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);
  return {
    endIndex,
    items: items.slice(startIndex, endIndex),
    page: safePage,
    pageSize,
    startIndex,
    totalItems: items.length,
    totalPages: getTablePageCount(items.length, pageSize)
  };
}

function formatChartHour(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function formatChartDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(parsed);
}

export function LoadingScreen({
  label,
  variant = "loading"
}: {
  label?: string;
  variant?: "error" | "loading";
}) {
  return (
    <div className="pilot-loading-screen">
      <div
        className={cn(
          "pilot-loading-screen-stack",
          variant === "error" && "pilot-loading-screen-stack-error"
        )}
      >
        {variant === "error" ? (
          <div className="pilot-loading-screen-icon pilot-loading-screen-icon-error">
            <AlertTriangleIcon size={28} />
          </div>
        ) : (
          <div className="pilot-spinner pilot-spinner-lg" />
        )}
        {label ? <p>{label}</p> : null}
      </div>
    </div>
  );
}

export function formatDate(value: string | null) {
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

export function TablePagination({
  page,
  pageSize = TABLE_PAGE_SIZE,
  totalItems,
  onPageChange
}: {
  page: number;
  pageSize?: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = getTablePageCount(totalItems, pageSize);
  if (totalItems <= pageSize) {
    return null;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="pilot-table-pagination">
      <div className="pilot-table-pagination-meta">
        <span>
          Строки {from}-{to} из {totalItems}
        </span>
        <span>
          Страница {page} из {totalPages}
        </span>
      </div>
      <div className="pilot-table-pagination-actions">
        <button
          className="pilot-table-page-button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          <ChevronLeftIcon size={14} />
          Назад
        </button>
        <button
          className="pilot-table-page-button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Вперёд
          <ChevronRightIcon size={14} />
        </button>
      </div>
    </div>
  );
}

export function CreateAgentFields({
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
        <Input
          placeholder="agent_handle"
          value={agentHandle}
          onChange={(event) => setAgentHandle(event.target.value)}
        />
      </label>
      <label className="pilot-field">
        <span className="pilot-field-label">Отображаемое имя</span>
        <Input
          placeholder="Имя профиля"
          value={agentDisplayName}
          onChange={(event) => setAgentDisplayName(event.target.value)}
        />
      </label>
      <label className="pilot-field pilot-field-span-2">
        <span className="pilot-field-label">Описание профиля</span>
        <Textarea
          rows={3}
          value={agentBio}
          onChange={(event) => setAgentBio(event.target.value)}
        />
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

export function PostTable({
  renderActions,
  onToggleSort,
  posts,
  sortColumn,
  sortDirection,
}: {
  renderActions?: (post: Post) => ReactNode;
  onToggleSort?: (column: PostTableSortColumn) => void;
  posts: Post[];
  sortColumn?: PostTableSortColumn;
  sortDirection?: PostTableSortDirection;
}) {
  const renderSortButton = (label: string, column: PostTableSortColumn) => {
    if (!onToggleSort || !sortColumn || !sortDirection) {
      return label;
    }

    const isActive = sortColumn === column;
    return (
      <span className="pilot-table-header-with-action">
        <span>{label}</span>
        <button
          aria-label={`Сортировать по ${label.toLowerCase()}`}
          className={cn("pilot-table-sort-toggle", isActive && "pilot-table-sort-toggle-active")}
          onClick={() => onToggleSort(column)}
          type="button"
        >
          {isActive ? (
            sortDirection === "desc" ? (
              <ArrowDownIcon size={14} />
            ) : (
              <ArrowUpIcon size={14} />
            )
          ) : (
            <ArrowUpDownIcon size={14} />
          )}
        </button>
      </span>
    );
  };

  return (
    <div className="pilot-table-wrap">
      <table className="pilot-table pilot-posts-table">
        <colgroup>
          <col className="pilot-posts-col-text" />
          <col className="pilot-posts-col-score" />
          <col className="pilot-posts-col-status" />
          <col className="pilot-posts-col-date" />
          <col className="pilot-posts-col-date" />
          {renderActions ? <col className="pilot-posts-col-actions" /> : null}
        </colgroup>
        <thead>
          <tr>
            <th>Текст</th>
            <th>{renderSortButton("Score", "score")}</th>
            <th>Статус</th>
            <th>Создан</th>
            <th>{renderSortButton("Опубликован", "published_at")}</th>
            {renderActions ? <th>Действия</th> : null}
          </tr>
        </thead>
        <tbody>
          {posts.length === 0 ? (
            <tr>
              <td className="pilot-empty-row" colSpan={renderActions ? 6 : 5}>
                Пока нет постов
              </td>
            </tr>
          ) : (
            posts.map((post) => (
              <tr key={post.id}>
                <td className="pilot-post-cell">
                  <p className="pilot-post-snippet">{post.content}</p>
                </td>
                <td className="pilot-post-score-cell">{post.score ?? "—"}</td>
                <td className="pilot-post-status-cell">
                  <span className={cn("pilot-status-chip", STATUS_META[post.status]?.className)}>
                    {STATUS_META[post.status]?.label ?? post.status}
                  </span>
                </td>
                <td className="pilot-post-date-cell">{formatDate(post.created_at)}</td>
                <td className="pilot-post-date-cell">{formatDate(post.published_at)}</td>
                {renderActions ? (
                  <td className="pilot-post-actions-cell">
                    {renderActions(post)}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ActivityTable({
  emptyLabel = "Пока нет предложений по комментариям",
  items,
  renderActions,
}: {
  emptyLabel?: string;
  items: ActivityProposal[];
  renderActions?: (item: ActivityProposal) => ReactNode;
}) {
  return (
    <div className="pilot-table-wrap">
      <table className="pilot-table pilot-activity-table">
        <colgroup>
          <col className="pilot-activity-col-date" />
          <col className="pilot-activity-col-status" />
          <col className="pilot-activity-col-post" />
          <col className="pilot-activity-col-comment" />
          <col className="pilot-activity-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th>Время</th>
            <th>Статус</th>
            <th>Пост</th>
            <th>Предложение</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td className="pilot-empty-row" colSpan={5}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td className="pilot-post-date-cell">{formatDate(item.created_at)}</td>
                <td className="pilot-post-status-cell">
                  <span className={cn("pilot-status-chip", STATUS_META[item.status]?.className)}>
                    {STATUS_META[item.status]?.label ?? item.status}
                  </span>
                </td>
                <td className="pilot-activity-post-cell">
                  <p className="pilot-activity-author">
                    {item.target_post_author_name ||
                      item.target_post_author_handle ||
                      "Неизвестный автор"}
                  </p>
                  <p className="pilot-post-snippet">{item.target_post_text}</p>
                </td>
                <td className="pilot-activity-comment-cell">
                  <p className="pilot-post-snippet">{item.comment_text}</p>
                  {item.rationale ? (
                    <p className="pilot-activity-rationale">{item.rationale}</p>
                  ) : null}
                </td>
                <td className="pilot-activity-actions-cell">
                  {renderActions ? renderActions(item) : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardSection({
  dashboard,
  agentName
}: {
  agentName: string;
  dashboard: Dashboard;
}) {
  return (
    <>
      <div className="pilot-stats-grid pilot-page-stage">
        <div className="pilot-stat-card pilot-stat-total">
          <div className="pilot-stat-icon pilot-stat-icon-total">
            <SendIcon size={18} />
          </div>
          <div>
            <p className="pilot-stat-title">Опубликовано</p>
            <p className="pilot-stat-value">{dashboard.published_posts}</p>
          </div>
        </div>
        <div className="pilot-stat-card pilot-stat-checking">
          <div className="pilot-stat-icon pilot-stat-icon-checking">
            <BotIcon size={18} />
          </div>
          <div>
            <p className="pilot-stat-title">Наибольший score</p>
            <p className="pilot-stat-value">{dashboard.best_score}</p>
          </div>
        </div>
        <div className="pilot-stat-card pilot-stat-completed">
          <div className="pilot-stat-icon pilot-stat-icon-completed">
            <FileTextIcon size={18} />
          </div>
          <div>
            <p className="pilot-stat-title">Топ-3 по score</p>
            <p className="pilot-stat-value">{dashboard.top_three_score}</p>
          </div>
        </div>
      </div>

      <div className="pilot-chart-grid pilot-page-stage">
        <section className="pilot-panel">
          <div className="pilot-panel-heading">
            <h2>Публикации за 24 часа</h2>
          </div>
          <div className="pilot-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboard.series}>
                <CartesianGrid stroke="#e9eef5" strokeDasharray="4 4" />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  minTickGap={18}
                  tickFormatter={(value) => formatChartHour(String(value))}
                  tickLine={false}
                />
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
            <h2>Score по часам</h2>
          </div>
          <div className="pilot-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.series}>
                <CartesianGrid stroke="#e9eef5" strokeDasharray="4 4" />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  minTickGap={18}
                  tickFormatter={(value) => formatChartHour(String(value))}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => [String(value ?? 0), "Score"]}
                  labelFormatter={(label) => formatChartDate(String(label))}
                />
                <Bar dataKey="score" name="Score" radius={[8, 8, 0, 0]} fill="#49beff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="pilot-panel pilot-page-stage">
        <div className="pilot-panel-heading">
          <h2>Топ публикации</h2>
        </div>
        <PostTable posts={dashboard.recent_posts} />
      </section>
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="pilot-page-stage">
      <div className="pilot-stats-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="pilot-panel pilot-skeleton-card" key={index}>
            <div className="pilot-skeleton pilot-skeleton-avatar" />
            <div className="pilot-skeleton-stack">
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="pilot-chart-grid">
        {Array.from({ length: 2 }).map((_, index) => (
          <section className="pilot-panel" key={index}>
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-heading" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
            <div className="pilot-skeleton pilot-skeleton-chart" />
          </section>
        ))}
      </div>

      <section className="pilot-panel">
        <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-heading" />
        <div className="pilot-table-skeleton">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="pilot-table-skeleton-row" key={index}>
              <div className="pilot-skeleton pilot-skeleton-line" />
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-xs" />
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function IdeasSkeleton() {
  return (
    <section className="pilot-panel pilot-page-stage">
      <div className="pilot-toolbar">
        <div className="pilot-skeleton-stack">
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-heading" />
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
        </div>
        <div className="pilot-skeleton pilot-skeleton-button" />
      </div>
      <div className="pilot-table-skeleton">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="pilot-table-skeleton-row pilot-table-skeleton-row-ideas" key={index}>
            <div className="pilot-skeleton pilot-skeleton-line" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
            <div className="pilot-skeleton pilot-skeleton-circle" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function PostsSkeleton() {
  return (
    <section className="pilot-panel pilot-page-stage">
      <div className="pilot-toolbar">
        <div className="pilot-skeleton pilot-skeleton-input" />
        <div className="pilot-skeleton pilot-skeleton-button" />
      </div>
      <div className="pilot-table-skeleton">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="pilot-table-skeleton-row" key={index}>
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-xs" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivitySkeleton() {
  return (
    <section className="pilot-panel pilot-page-stage">
      <div className="pilot-toolbar">
        <div className="pilot-skeleton-stack">
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-heading" />
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
        </div>
        <div className="pilot-skeleton pilot-skeleton-button" />
      </div>
      <div className="pilot-table-skeleton">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="pilot-table-skeleton-row pilot-table-skeleton-row-activity" key={index}>
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-xs" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SettingsSkeleton() {
  return (
    <section className="pilot-panel pilot-page-stage">
      <div className="pilot-panel-heading">
        <h2>Параметры генерации</h2>
      </div>
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
    </section>
  );
}

export function IdeasTableSkeleton() {
  return (
    <div className="pilot-table-skeleton">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="pilot-table-skeleton-row pilot-table-skeleton-row-ideas" key={index}>
          <div className="pilot-skeleton pilot-skeleton-line" />
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
          <div className="pilot-skeleton pilot-skeleton-circle" />
        </div>
      ))}
    </div>
  );
}

export function AutonomousOverviewSkeleton() {
  return (
    <div className="pilot-table-skeleton">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="pilot-table-skeleton-row pilot-table-skeleton-row-autonomous" key={index}>
          <div className="pilot-skeleton-stack">
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-xs" />
          </div>
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-xs" />
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-md" />
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
          <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
        </div>
      ))}
    </div>
  );
}

export function AutonomousTaskDetailSkeleton() {
  return (
    <div className="pilot-autonomous-detail-grid">
      <div className="pilot-autonomous-detail-meta">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="pilot-autonomous-detail-item" key={index}>
            <div className="pilot-skeleton-stack">
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-xs" />
              <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
            </div>
          </div>
        ))}
      </div>

      {Array.from({ length: 3 }).map((_, index) => (
        <div className="pilot-autonomous-detail-block" key={index}>
          <div className="pilot-skeleton-stack">
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-sm" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
            <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-wide" />
            <div className="pilot-skeleton pilot-skeleton-textarea" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DialogSkeleton({
  className,
  rows = 3,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("pilot-dialog-skeleton", className)}>
      <div className="pilot-skeleton pilot-skeleton-line pilot-skeleton-heading" />
      <div className="pilot-skeleton-stack">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            className={cn(
              "pilot-skeleton",
              "pilot-skeleton-line",
              index === rows - 1 ? "pilot-skeleton-sm" : "pilot-skeleton-wide"
            )}
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

export function SafetyDialogLoading() {
  return (
    <div className="pilot-dialog-loading-state">
      <div className="pilot-dialog-header">
        <h2 className="pilot-dialog-title">Проверка безопасности</h2>
        <p className="pilot-dialog-description">Проверяем текст перед публикацией.</p>
      </div>
      <DialogSkeleton className="pilot-dialog-loading-skeleton" rows={2} />
    </div>
  );
}

export function EmptyIdeasState({
  disabled = false,
  description = "Заполните описание выше и запустите поиск по локальному индексу Moltbook, чтобы собрать идеи под личность агента.",
  idleLabel = "Найти идеи",
  isPending,
  loadingLabel = "Ищем идеи...",
  onResearch
}: {
  description?: string;
  disabled?: boolean;
  idleLabel?: string;
  isPending: boolean;
  loadingLabel?: string;
  onResearch: () => void;
}) {
  return (
    <div className="pilot-empty-state-card">
      <div className="pilot-empty-state-icon">
        <LightbulbIcon size={22} />
      </div>
      <div className="pilot-empty-state-copy">
        <h3>Идеи еще не созданы</h3>
        <p>{description}</p>
      </div>
      <button
        className="pilot-primary-button"
        disabled={isPending || disabled}
        onClick={onResearch}
        type="button"
      >
        <ButtonLoadingContent
          icon={<LightbulbIcon size={16} />}
          idleLabel={idleLabel}
          isLoading={isPending}
          loadingLabel={loadingLabel}
        />
      </button>
    </div>
  );
}
