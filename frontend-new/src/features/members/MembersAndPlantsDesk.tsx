import { FormEvent, useCallback, useEffect, useState } from "react";
import { UserProfile } from "@/features/auth";
import { PlantItem } from "@/features/sample-requests/types";
import {
  CreateUserPayload,
  UserItem,
  UpdateUserPayload,
  createUserApi,
  deleteUserApi,
  fetchPlantsApi,
  fetchUsersApi,
  updateUserApi,
} from "@/infrastructure/api/masterApi";
import { MembersTeamsPage } from "./MembersTeamsPage";
import { Building2, Check, Loader2, ShieldCheck, UserRoundPlus, X } from "lucide-react";

interface MembersAndPlantsDeskProps {
  user: UserProfile;
}

const EMPTY_FORM: CreateUserPayload = {
  name: "",
  userid: "",
  email: "",
  password: "",
  role: "user",
  sub_role: "",
  team: "marketing",
  is_team_head: false,
  is_costing_admin: false,
  plant_code: "",
  plant_codes: [],
  is_active: true,
};

const FIELD_CLASS =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]";
const LABEL_CLASS = "block text-xs font-medium text-[var(--on-surface-muted)]";

function departmentKey(team?: string): string {
  const value = (team || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["admin", "administration", "management"].includes(value)) return "admin";
  if (["samp", "sampling", "sampling team"].includes(value)) return "samp";
  if (["plant", "plant operations"].includes(value)) return "plant";
  if (["studio", "studio cad", "structural cad studio"].includes(value)) return "studio";
  if (["costing", "commercial costing"].includes(value)) return "costing";
  if (["creative", "creative studio"].includes(value)) return "creative";
  return value || "marketing";
}

export default function MembersAndPlantsDesk({ user }: MembersAndPlantsDeskProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [plants, setPlants] = useState<PlantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<CreateUserPayload>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const isAdmin = ["admin", "administrator"].includes(user.role.trim().toLowerCase());

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedback({ text, type });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const [userRows, plantRows] = await Promise.all([fetchUsersApi(), fetchPlantsApi()]);
      setUsers(userRows);
      setPlants(plantRows.filter((plant) => plant.isActive));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load team members from the database.";
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openUserModal = (member?: UserItem) => {
    if (member) {
      const team = departmentKey(member.team);
      const plantCode = member.plantCode || member.plantCodes?.[0] || "";
      setEditingUser(member);
      setForm({
        name: member.name,
        userid: member.userid,
        email: member.email,
        password: "",
        role: ["admin", "administrator"].includes(member.role.trim().toLowerCase()) ? "admin" : "user",
        sub_role: member.subRole || "",
        team,
        is_team_head: member.isTeamHead,
        is_costing_admin: member.isCostingAdmin,
        plant_code: plantCode,
        plant_codes: plantCode ? [plantCode] : [],
        is_active: member.isActive,
      });
    } else {
      setEditingUser(null);
      setForm({ ...EMPTY_FORM });
    }
    setIsModalOpen(true);
  };

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const userid = form.userid.trim();
    const email = form.email.trim();
    const password = form.password.trim();
    if (!name || !userid || !email) {
      showToast("Please fill all required fields", "error");
      return;
    }
    if (!editingUser && !password) {
      showToast("Password is required for new user", "error");
      return;
    }
    if (form.team === "plant" && !form.plant_code) {
      showToast("Select an active facility for Plant Operations", "error");
      return;
    }

    const assignedPlant = form.team === "plant" ? form.plant_code?.trim() : undefined;
    setIsSubmitting(true);
    try {
      if (editingUser) {
        const payload: UpdateUserPayload = {
          name,
          userid,
          email,
          role: form.role,
          sub_role: form.sub_role?.trim() || "",
          team: form.team,
          is_team_head: form.is_team_head,
          is_costing_admin: form.team === "costing" && Boolean(form.is_costing_admin),
          plant_code: assignedPlant || "",
          plant_codes: assignedPlant ? [assignedPlant] : [],
          is_active: form.is_active,
        };
        if (password) payload.password = password;
        await updateUserApi(editingUser.id, payload);
        showToast("User " + name + " updated");
      } else {
        await createUserApi({
          ...form,
          name,
          userid,
          email,
          password,
          sub_role: form.sub_role?.trim() || undefined,
          plant_code: assignedPlant,
          plant_codes: assignedPlant ? [assignedPlant] : [],
        });
        showToast("User " + name + " created");
      }
      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save user", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeUser = async (userId: number, name: string) => {
    if (deletingUserId !== null) return;
    if (!window.confirm("Permanently delete " + name + "'s account? Their requests and audit history will remain, but this account cannot be restored.")) return;
    setDeletingUserId(userId);
    try {
      await deleteUserApi(userId);
      showToast("Member " + name + " deleted; request history preserved");
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete member", "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  const closeModal = () => {
    if (!isSubmitting) setIsModalOpen(false);
  };

  if (!isAdmin) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-6">
        <section className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-primary-subtle)]">
            <ShieldCheck className="h-5 w-5 text-[var(--accent-primary)]" />
          </div>
          <h1 className="text-sm font-semibold text-[var(--on-surface)]">Administrator access required</h1>
          <p className="mt-1.5 text-sm text-[var(--on-surface-muted)]">This section is restricted to administrators.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--surface-base)] font-sans text-[var(--on-surface)]">
      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={"fixed bottom-4 left-4 right-4 z-[70] flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg sm:left-auto sm:right-5 sm:w-auto sm:max-w-md " +
            (feedback.type === "success"
              ? "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface)]"
              : "border-rose-500/30 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200")}
        >
          {feedback.type === "success" ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <X className="h-4 w-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}
      {loadError && !isLoading && (
        <div role="alert" className="mx-4 mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 sm:mx-6">
          Could not load team members: {loadError}
        </div>
      )}
      <MembersTeamsPage
        currentUser={user}
        users={users}
        plants={plants}
        isLoading={isLoading}
        deletingUserId={deletingUserId}
        onRefresh={() => void loadData()}
        onOpenUserModal={openUserModal}
        onDeleteUser={(id: number, name: string) => void removeUser(id, name)}
      />

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-modal-title"
            className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] shadow-2xl sm:max-h-[min(90dvh,800px)] sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
                  <UserRoundPlus className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="member-modal-title" className="truncate text-base font-semibold text-[var(--on-surface)]">
                    {editingUser ? "Edit team member" : "Add team member"}
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--on-surface-muted)]">
                    {editingUser ? "Update access and profile details." : "Create an account and assign team access."}
                  </p>
                </div>
              </div>
              <button type="button" disabled={isSubmitting} onClick={closeModal} aria-label="Close dialog" className="rounded-lg p-2 text-[var(--on-surface-subtle)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={(event) => void submitUser(event)} className="flex min-h-0 flex-1 flex-col">
              <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-4 overflow-y-auto px-4 py-5 sm:grid-cols-2 sm:px-6">
                <label className={LABEL_CLASS}>
                  Full name <span className="text-rose-600">*</span>
                  <input required maxLength={255} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" className={FIELD_CLASS} />
                </label>
                <label className={LABEL_CLASS}>
                  Username / ID <span className="text-rose-600">*</span>
                  <input required maxLength={100} autoComplete="username" value={form.userid} onChange={(event) => setForm({ ...form, userid: event.target.value })} placeholder="Username" className={FIELD_CLASS} />
                </label>
                <label className={LABEL_CLASS}>
                  Email <span className="text-rose-600">*</span>
                  <input type="email" required maxLength={255} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@company.com" className={FIELD_CLASS} />
                </label>
                <label className={LABEL_CLASS}>
                  Password {editingUser ? <span className="font-normal text-[var(--on-surface-subtle)]">(optional)</span> : <span className="text-rose-600">*</span>}
                  <input type="password" required={!editingUser} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editingUser ? "Leave blank to keep current" : "Initial password"} className={FIELD_CLASS} />
                </label>
                <label className={LABEL_CLASS}>
                  Department <span className="text-rose-600">*</span>
                  <select
                    value={form.team || "marketing"}
                    onChange={(event) => {
                      const team = event.target.value;
                      const code = team === "plant" ? (form.plant_code || plants[0]?.code || "") : "";
                      setForm({ ...form, team, is_costing_admin: team === "costing" && Boolean(form.is_costing_admin), plant_code: code, plant_codes: code ? [code] : [] });
                    }}
                    className={FIELD_CLASS}
                  >
                    <option value="marketing">Marketing</option>
                    <option value="creative">Creative</option>
                    <option value="studio">Studio</option>
                    <option value="samp">Sampling Team</option>
                    <option value="costing">Commercial Costing</option>
                    <option value="plant">Plant Operations</option>
                    <option value="admin">Administration</option>
                  </select>
                </label>
                <label className={LABEL_CLASS}>
                  Role title
                  <input maxLength={100} value={form.sub_role || ""} onChange={(event) => setForm({ ...form, sub_role: event.target.value })} placeholder="e.g. Sampling Specialist" className={FIELD_CLASS} />
                </label>

                {form.team === "plant" && (
                  <label className={LABEL_CLASS + " sm:col-span-2"}>
                    Assigned facility <span className="text-rose-600">*</span>
                    <span className="relative mt-1.5 block">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-subtle)]" />
                      <select
                        required
                        value={form.plant_code || ""}
                        onChange={(event) => {
                          const code = event.target.value;
                          setForm({ ...form, plant_code: code, plant_codes: code ? [code] : [] });
                        }}
                        className={FIELD_CLASS + " mt-0 pl-9"}
                      >
                        <option value="">Select an active facility</option>
                        {plants.map((plant) => {
                          const prefix = plant.code + " -";
                          const facilityName = plant.name.trim().toLowerCase().startsWith(prefix.toLowerCase())
                            ? plant.name.trim()
                            : plant.code + " - " + plant.name.trim();
                          return <option key={plant.id} value={plant.code}>{facilityName}</option>;
                        })}
                      </select>
                    </span>
                    {plants.length === 0 && <span className="mt-1.5 block text-xs text-rose-600">No active facilities are available.</span>}
                  </label>
                )}

                <label className={LABEL_CLASS}>
                  System access
                  <select value={form.role || "user"} onChange={(event) => setForm({ ...form, role: event.target.value, is_team_head: event.target.value === "admin" ? false : form.is_team_head })} className={FIELD_CLASS}>
                    <option value="user">Standard member</option>
                    <option value="admin">Global administrator</option>
                  </select>
                </label>

                <div className="flex flex-col justify-end gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)]/60 p-3 sm:min-h-[72px]">
                  {form.role !== "admin" ? (
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--on-surface-muted)]">
                      <input type="checkbox" checked={Boolean(form.is_team_head)} onChange={(event) => setForm({ ...form, is_team_head: event.target.checked })} className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent-primary)] focus:ring-[var(--border-focus)]" />
                      Department team head
                    </label>
                  ) : (
                    <p className="text-xs text-[var(--on-surface-subtle)]">Administrators have workspace-wide access.</p>
                  )}
                  {form.team === "costing" && (
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--on-surface-muted)]">
                      <input type="checkbox" checked={Boolean(form.is_costing_admin)} onChange={(event) => setForm({ ...form, is_costing_admin: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent-primary)] focus:ring-[var(--border-focus)]" />
                      <span>
                        Costing administrator
                        <span className="mt-0.5 block text-xs text-[var(--on-surface-subtle)]">Can view claimant names in the Costing queue.</span>
                      </span>
                    </label>
                  )}
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--on-surface-muted)]">
                    <input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent-primary)] focus:ring-[var(--border-focus)]" />
                    Active account
                  </label>
                </div>
              </div>

              <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
                <button type="button" disabled={isSubmitting} onClick={closeModal} className="h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-low)] disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || (form.team === "plant" && plants.length === 0)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-accent-primary)] transition-colors hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Saving…" : editingUser ? "Save changes" : "Create member"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
