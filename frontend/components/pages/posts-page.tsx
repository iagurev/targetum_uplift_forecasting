"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

import {
  clampTablePage,
  LoadingScreen,
  PostTable,
  TablePagination,
  TABLE_PAGE_SIZE,
  paginateTableItems,
  type PostTableSortColumn,
  type PostTableSortDirection,
  PostsSkeleton,
} from "./workspace-pieces";
import { useWorkspaceState } from "./workspace-state";
import { WorkspaceShell } from "./workspace-shell";

export function PostsPage() {
  const workspace = useWorkspaceState("posts");
  const [page, setPage] = useState(1);
  const [postSearch, setPostSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<PostTableSortColumn>("published_at");
  const [sortDirection, setSortDirection] = useState<PostTableSortDirection>("desc");
  const postsQuery = useQuery({
    queryKey: ["posts", workspace.token, workspace.effectiveSelectedAgentId],
    enabled: Boolean(workspace.token && workspace.effectiveSelectedAgentId),
    queryFn: () => api.listPosts(workspace.token!, workspace.effectiveSelectedAgentId!),
    refetchInterval: 5000,
    refetchOnMount: "always"
  });

  const filteredPosts = useMemo(() => {
    const posts = postsQuery.data ?? [];
    const search = postSearch.trim().toLowerCase();
    const filtered = search
      ? posts.filter((post) => post.content.toLowerCase().includes(search))
      : posts;

    return [...filtered].sort((left, right) => {
      if (sortColumn === "score") {
        if (left.score == null && right.score != null) {
          return 1;
        }
        if (left.score != null && right.score == null) {
          return -1;
        }
        if (left.score != null && right.score != null && left.score !== right.score) {
          return sortDirection === "desc"
            ? right.score - left.score
            : left.score - right.score;
        }
      }

      const leftDate = Date.parse(left.published_at ?? left.created_at);
      const rightDate = Date.parse(right.published_at ?? right.created_at);
      if (leftDate !== rightDate) {
        return sortDirection === "desc" ? rightDate - leftDate : leftDate - rightDate;
      }

      return rightDate - leftDate;
    });
  }, [postSearch, postsQuery.data, sortColumn, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [postSearch, sortColumn, sortDirection, workspace.effectiveSelectedAgentId]);

  const paginatedPosts = useMemo(
    () => paginateTableItems(filteredPosts, page, TABLE_PAGE_SIZE),
    [filteredPosts, page]
  );

  useEffect(() => {
    const nextPage = clampTablePage(page, filteredPosts.length, TABLE_PAGE_SIZE);
    if (nextPage !== page) {
      setPage(nextPage);
    }
  }, [filteredPosts.length, page]);

  const toggleSort = (column: PostTableSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      setPage(1);
      return;
    }
    setSortColumn(column);
    setSortDirection("desc");
    setPage(1);
  };

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
      activeTab="posts"
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
      {postsQuery.isLoading && !postsQuery.data ? (
        <PostsSkeleton />
      ) : (
        <section className="pilot-page-stage pilot-content-stack">
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
            <Button onClick={() => workspace.setIsModeDialogOpen(true)}>
              <PlusIcon size={16} />
              Новый пост
            </Button>
          </div>

          <PostTable
            onToggleSort={toggleSort}
            posts={paginatedPosts.items}
            renderActions={(post) =>
              post.post_url ? (
                <a
                  className="pilot-outline-button pilot-compact-button pilot-open-post-link"
                  href={post.post_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLinkIcon size={14} />
                  Открыть
                </a>
              ) : (
                <span className="pilot-activity-action-placeholder">—</span>
              )
            }
            sortColumn={sortColumn}
            sortDirection={sortDirection}
          />
          <TablePagination page={paginatedPosts.page} totalItems={filteredPosts.length} onPageChange={setPage} />
        </section>
      )}
    </WorkspaceShell>
  );
}
