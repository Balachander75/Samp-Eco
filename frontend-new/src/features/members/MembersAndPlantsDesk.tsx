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
import { Check, ShieldCheck, X } from "lucide-react";

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
  plant_code: "",
  plant_codes: [],
  is_active: true,
};

function departmentKey(team?: string): string {
  const value = (team || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["admin", "administration", "management"].includes(value)) return "admin";
  if (["samp", "sampling", "sampling lab"].includes(value)) return "samp";
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
          plant_code: assignedPlant || "",
          plant_codes: assignedPlant ? [assignedPlant] : [],
          is_active: form.is_active,
        };
        if (password) payload.password = password;
        await updateUserApi(editingUser.id, payload);
        showToast(`User ${name} updated`);
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
        showToast(`User ${name} created`);
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
    if (!window.confirm(`Remove member “${name}”? Their database request history will be kept and sign-in access will be disabled.`)) return;
    try {
      await deleteUserApi(userId);
      showToast(`Member ${name} deactivated; request history preserved`);
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Error deactivating member", "error");
    }
  };

  if (!isAdmin) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-sm rounded-xl bg-white dark:bg-[#0e121a] border border-zinc-200 dark:border-zinc-800 p-6 text-center shadow-xs">
          <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Administrator Access Required</h1>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">This section is restricted to administrators.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-white dark:bg-[#080a10] text-zinc-900 dark:text-zinc-100 font-sans select-text overflow-hidden">
      {feedback && <div className={`fixed bottom-5 right-5 z-[70] flex items-center gap-2 px-3.5 py-2.5 rounded-lg shadow-lg text-xs font-medium border animate-smooth-toast ${feedback.type === "success" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200" : "bg-rose-600 text-white border-rose-700"}`}>
        {feedback.type === "success" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5" />}<span>{feedback.text}</span>
      </div>}
      {loadError && !isLoading && <div role="alert" className="mx-5 mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">Database load failed: {loadError}</div>}
      <MembersTeamsPage currentUser={user} users={users} plants={plants} isLoading={isLoading} onRefresh={() => void loadData()} onOpenUserModal={openUserModal} onDeleteUser={(id, name) => void removeUser(id, name)} />

      {isModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-smooth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsModalOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="member-modal-title" className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto bg-white dark:bg-[#0e121a] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl animate-smooth-modal">
          <div className="sticky top-0 z-10 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#0e121a]">
            <h2 id="member-modal-title" className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 font-mono">{editingUser ? `Edit Member: ${editingUser.name}` : "New Team Member"}</h2>
            <button type="button" disabled={isSubmitting} onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer transition-colors disabled:opacity-50"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={(event) => void submitUser(event)} className="p-5 space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Full Name *<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Parin Dedhia" className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition" /></label>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Username / ID *<input required maxLength={100} value={form.userid} onChange={(event) => setForm({ ...form, userid: event.target.value })} placeholder="Parin.d" className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Email *<input type="email" required maxLength={255} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="user@navneet.com" className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition" /></label>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{editingUser ? "Password (optional)" : "Password *"}<input type="password" required={!editingUser} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editingUser ? "Keep unchanged" : "Enter initial password"} className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Department *<select value={form.team || "marketing"} onChange={(event) => { const team = event.target.value; const code = team === "plant" ? (form.plant_code || plants[0]?.code || "") : ""; setForm({ ...form, team, plant_code: code, plant_codes: code ? [code] : [] }); }} className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition">
                <option value="marketing">Marketing</option><option value="creative">Creative Studio</option><option value="studio">Structural CAD Studio</option><option value="samp">SAMP Sampling Lab</option><option value="costing">Commercial Costing</option><option value="plant">Plant Operations</option><option value="admin">Administration</option>
              </select></label>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Role Title<input maxLength={100} value={form.sub_role || ""} onChange={(event) => setForm({ ...form, sub_role: event.target.value })} placeholder="e.g. Sampling Specialist" className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition" /></label>
            </div>
            {form.team === "plant" && <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Assigned Facility *<select required value={form.plant_code || ""} onChange={(event) => { const code = event.target.value; setForm({ ...form, plant_code: code, plant_codes: code ? [code] : [] }); }} className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"><option value="">Select active facility</option>{plants.map((plant) => <option key={plant.id} value={plant.code}>{plant.code} - {plant.name.replace(new RegExp(`^${plant.code}\\s*-\\s*`, "i"), "")}</option>)}</select>{plants.length === 0 && <span className="mt-1 block text-rose-600">No active facilities are available in the database.</span>}</label>}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">System Access<select value={form.role || "user"} onChange={(event) => setForm({ ...form, role: event.target.value, is_team_head: event.target.value === "admin" ? false : form.is_team_head })} className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"><option value="user">Standard User</option><option value="admin">Global Administrator</option></select></label>
              <div className="flex flex-col justify-end">{form.role !== "admin" && <label className="flex items-center gap-2 cursor-pointer pb-2 select-none"><input type="checkbox" checked={Boolean(form.is_team_head)} onChange={(event) => setForm({ ...form, is_team_head: event.target.checked })} className="rounded text-zinc-900 focus:ring-zinc-900 w-3.5 h-3.5 cursor-pointer" /><span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Department Team Head</span></label>}</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="rounded text-zinc-900 focus:ring-zinc-900 w-3.5 h-3.5 cursor-pointer" /><span className="text-[11px] text-zinc-600 dark:text-zinc-400">Active Account Status</span></label>
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2"><button type="button" disabled={isSubmitting} onClick={() => setIsModalOpen(false)} className="h-8 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium cursor-pointer transition-colors">Cancel</button><button type="submit" disabled={isSubmitting || (form.team === "plant" && plants.length === 0)} className="h-8 px-3.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50">{isSubmitting ? "Saving..." : editingUser ? "Save Changes" : "Create Member"}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
}
