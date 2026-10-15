import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, CircleHelp, FileCheck2, LockKeyhole, RefreshCw, Workflow } from "lucide-react";
import { DeskWorkspaceLayout } from "@/components/erp";
import type { UserProfile } from "@/features/auth";
import { canAccessWorkspacePath } from "@/features/auth/permissions";

const guideCards = [
  { title: "Create and stage a request", detail: "Marketing selects product scope, fills required quantity and unit fields, then saves or releases the request.", icon: FileCheck2 },
  { title: "Follow a request workflow", detail: "Open an item to see its current owner, status, reviewer notes, and the saved activity history.", icon: Workflow },
  { title: "Business year and plant", detail: "Use the top bar selectors to scope operational queues. Plant work is limited to the plant assigned to your account.", icon: RefreshCw },
  { title: "Access and account", detail: "Role access comes from your team assignment. Update your password and appearance in Settings.", icon: LockKeyhole },
];

const supportLinks = [
  { title: "Marketing workspace", path: "/sample-requests" },
  { title: "Creative workspace", path: "/creative-work" },
  { title: "Sampling reviews", path: "/samp-team-work/sampling" },
  { title: "Costing workspace", path: "/costing-team" },
  { title: "Plant overview", path: "/plant" },
  { title: "Account settings", path: "/settings" },
];

export const HelpSupportPage: React.FC<{ user?: UserProfile | null }> = ({ user }) => {
  const navigate = useNavigate();
  const accessibleLinks = supportLinks.filter((link) => user && canAccessWorkspacePath(user, link.path));

  return (
    <DeskWorkspaceLayout title="Help & Support" subtitle="Quick guidance for the shared SAMP workspace and its request workflows.">
      <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-2xl bg-[var(--surface-lowest)] p-5 sm:p-7">
            <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"><CircleHelp className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent-primary)]">Workspace guide</p><h2 className="mt-1 text-xl font-bold tracking-tight">Find the next step for your team</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--on-surface-muted)]">Requests move between Marketing, Creative, Studio, Costing, and Sampling. Each team queue shows the assigned stage and keeps a record of decisions and handoffs.</p></div></div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {guideCards.map((item) => { const Icon = item.icon; return <article key={item.title} className="rounded-xl bg-[var(--surface-lowest)] p-4 sm:p-5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-low)] text-[var(--accent-primary)]"><Icon className="h-4 w-4" /></span><h3 className="mt-4 text-sm font-bold">{item.title}</h3><p className="mt-1.5 text-xs leading-relaxed text-[var(--on-surface-muted)]">{item.detail}</p></article>; })}
          </section>

          <section className="rounded-2xl bg-[var(--surface-lowest)] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-[var(--accent-primary)]" /><h3 className="text-sm font-bold">Open a team workspace</h3></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{accessibleLinks.map((link) => <button key={link.path} type="button" onClick={() => navigate(link.path)} className="group flex min-h-11 items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 text-left text-xs font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)]"><span>{link.title}</span><ArrowRight className="h-3.5 w-3.5 text-[var(--on-surface-subtle)] transition-transform group-hover:translate-x-0.5" /></button>)}</div>
            <p className="mt-4 text-[11px] leading-relaxed text-[var(--on-surface-subtle)]">If a workspace reports an access error, ask your administrator to confirm your team membership and assigned plant.</p>
          </section>
        </div>
      </main>
    </DeskWorkspaceLayout>
  );
};

export default HelpSupportPage;
