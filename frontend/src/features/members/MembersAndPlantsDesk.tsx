import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import {
  UserItem,
  CreateUserPayload,
  UpdateUserPayload,
  fetchUsersApi,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  fetchPlantsApi,
  createPlantApi,
  updatePlantApi,
  deletePlantApi,
} from "@/infrastructure/api/masterApi";
import { PlantItem } from "@/features/sample-requests/types";
import { MembersTeamsPage } from "./MembersTeamsPage";
import { MembersPlantsPage } from "./MembersPlantsPage";
import { MembersGovernancePage } from "./MembersGovernancePage";
import {
  Users,
  Building2,
  ShieldCheck,
  Plus,
  Crown,
  Check,
  X,
  RefreshCw,
} from "lucide-react";

interface MembersAndPlantsDeskProps {
  user: UserProfile;
}

export default function MembersAndPlantsDesk({ user }: MembersAndPlantsDeskProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active view from URL path
  const activeTab = (() => {
    if (location.pathname.includes("/plants")) return "plants";
    if (location.pathname.includes("/governance")) return "governance";
    return "teams";
  })();

  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [plantsList, setPlantsList] = useState<PlantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [userFormData, setUserFormData] = useState<CreateUserPayload>({
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
  });

  // Plant Modal State
  const [isPlantModalOpen, setIsPlantModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<PlantItem | null>(null);
  const [plantFormData, setPlantFormData] = useState({
    code: "",
    name: "",
    location: "",
    isActive: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const isAdmin = ["admin", "administrator"].includes(user.role.trim().toLowerCase());

  const loadData = useCallback(async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [uData, pData] = await Promise.all([
        fetchUsersApi(),
        fetchPlantsApi(),
      ]);
      setUsersList(uData);
      setPlantsList(pData);
    } catch (err) {
      console.error("Failed to load members or plants:", err);
      showToast("Error loading directory records", "error");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open User Modal
  const handleOpenUserModal = (userToEdit?: UserItem) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setUserFormData({
        name: userToEdit.name,
        userid: userToEdit.userid,
        email: userToEdit.email,
        password: "",
        role: ["head", "team head", "department lead"].includes(userToEdit.role.trim().toLowerCase()) ? "user" : userToEdit.role,
        sub_role: userToEdit.subRole || "",
        team: userToEdit.team || "marketing",
        is_team_head: userToEdit.isTeamHead,
        plant_code: userToEdit.plantCode || "",
        plant_codes: userToEdit.plantCodes || (userToEdit.plantCode ? [userToEdit.plantCode] : []),
        is_active: userToEdit.isActive,
      });
    } else {
      setEditingUser(null);
      setUserFormData({
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
      });
    }
    setIsUserModalOpen(true);
  };

  // Submit User
  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.userid.trim() || !userFormData.email.trim()) {
      showToast("Please fill all required user fields", "error");
      return;
    }
    if (!editingUser && !userFormData.password.trim()) {
      showToast("Password is required for new user", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        const updatePayload: UpdateUserPayload = {
          name: userFormData.name.trim(),
          userid: userFormData.userid.trim(),
          email: userFormData.email.trim(),
          role: userFormData.role,
          sub_role: userFormData.sub_role?.trim() || undefined,
          team: userFormData.team,
          is_team_head: userFormData.is_team_head,
          plant_codes: userFormData.plant_codes || [],
          is_active: userFormData.is_active,
        };
        if (userFormData.password.trim()) {
          updatePayload.password = userFormData.password.trim();
        }
        await updateUserApi(editingUser.id, updatePayload);
        showToast(`User ${userFormData.name} updated successfully`);
      } else {
        await createUserApi({
          ...userFormData,
          name: userFormData.name.trim(),
          userid: userFormData.userid.trim(),
          email: userFormData.email.trim(),
          password: userFormData.password.trim(),
          sub_role: userFormData.sub_role?.trim() || undefined,
          plant_code: userFormData.plant_code?.trim() || undefined,
          plant_codes: userFormData.plant_codes || [],
        });
        showToast(`User ${userFormData.name} created successfully`);
      }
      setIsUserModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("Save user error:", err);
      showToast(err.message || "Failed to save user", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-6 py-12">
        <section className="max-w-lg rounded-2xl bg-white dark:bg-zinc-900 p-7 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-4 h-9 w-9 text-emerald-600" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Admin access required</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Member, role and plant assignments are managed by an Admin.
          </p>
        </section>
      </main>
    );
  }

  // Delete User
  const handleDeleteUser = async (userId: number, name: string) => {
    if (!window.confirm(`Permanently remove member "${name}" from directory?`)) return;
    try {
      const ok = await deleteUserApi(userId);
      if (ok) {
        showToast(`Member ${name} removed`);
        await loadData();
      } else {
        showToast("Failed to remove member", "error");
      }
    } catch {
      showToast("Error deleting member", "error");
    }
  };

  // Open Plant Modal
  const handleOpenPlantModal = (plantToEdit?: PlantItem) => {
    if (plantToEdit) {
      setEditingPlant(plantToEdit);
      setPlantFormData({
        code: plantToEdit.code,
        name: plantToEdit.name,
        location: plantToEdit.location || "",
        isActive: plantToEdit.isActive,
      });
    } else {
      setEditingPlant(null);
      setPlantFormData({
        code: "",
        name: "",
        location: "",
        isActive: true,
      });
    }
    setIsPlantModalOpen(true);
  };

  // Submit Plant
  const handleSubmitPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantFormData.code.trim() || !plantFormData.name.trim()) {
      showToast("Plant Code and Name are required", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPlant) {
        await updatePlantApi(editingPlant.id, {
          code: plantFormData.code.trim(),
          name: plantFormData.name.trim(),
          location: plantFormData.location.trim() || undefined,
          is_active: plantFormData.isActive,
        });
        showToast(`Facility ${plantFormData.code} updated`);
      } else {
        await createPlantApi({
          code: plantFormData.code.trim(),
          name: plantFormData.name.trim(),
          location: plantFormData.location.trim() || undefined,
          isActive: plantFormData.isActive,
        }, user.name || "Admin");
        showToast(`Facility ${plantFormData.code} registered`);
      }
      setIsPlantModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("Save plant error:", err);
      showToast(err.message || "Failed to save plant", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Plant
  const handleDeletePlant = async (plantId: number, code: string) => {
    if (!window.confirm(`Permanently remove plant facility "${code}"?`)) return;
    try {
      const ok = await deletePlantApi(plantId);
      if (ok) {
        showToast(`Facility ${code} removed`);
        await loadData();
      } else {
        showToast("Failed to remove facility", "error");
      }
    } catch {
      showToast("Error deleting facility", "error");
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden select-none">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold transition-all ${
            feedbackMsg.type === "success"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-red-600 text-white"
          }`}
        >
          {feedbackMsg.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* SaaS Top Header */}
      <header className="border-b border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-zinc-900 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Enterprise Directory & Infrastructure
          </div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mt-0.5">
            {activeTab === "teams" && "Teams & Department Members"}
            {activeTab === "plants" && "Manufacturing Plants Directory"}
            {activeTab === "governance" && "Role & Access Governance Matrix"}
          </h1>
        </div>

        {/* Global Summary & Refresh */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{usersList.length}</span> Members
            <span>•</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{plantsList.length}</span> Facilities
          </div>
          <button
            type="button"
            onClick={loadData}
            title="Refresh Directory"
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* SaaS Sub-Navigation Tabs (URL-Synced Routes) */}
      <div className="border-b border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-zinc-900 px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate("/members/teams")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "teams"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Teams & Members</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {usersList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/members/plants")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "plants"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Manufacturing Plants</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {plantsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/members/governance")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "governance"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Access Governance Matrix</span>
          </button>
        </div>
      </div>

      {/* Render Respective Page Component */}
      {activeTab === "teams" && (
        <MembersTeamsPage
          currentUser={user}
          users={usersList}
          plants={plantsList}
          isLoading={isLoading}
          onOpenUserModal={handleOpenUserModal}
          onDeleteUser={handleDeleteUser}
        />
      )}

      {activeTab === "plants" && (
        <MembersPlantsPage
          currentUser={user}
          plants={plantsList}
          users={usersList}
          isLoading={isLoading}
          onOpenPlantModal={handleOpenPlantModal}
          onDeletePlant={handleDeletePlant}
        />
      )}

      {activeTab === "governance" && (
        <MembersGovernancePage
          currentUser={user}
          users={usersList}
        />
      )}

      {/* Modern SaaS User Modal (Add / Edit) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-smooth-backdrop p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-smooth-modal">
            <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  {editingUser ? `Edit Member: ${editingUser.name}` : "Add New Team Member"}
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Configure identity, credentials, department unit, and supervisory access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitUser} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    placeholder="e.g. Rahul Verma"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Username / ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.userid}
                    onChange={(e) => setUserFormData({ ...userFormData, userid: e.target.value })}
                    placeholder="e.g. rahul.mkt"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Corporate Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="rahul.verma@navneet.com"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {editingUser ? "Password (Leave blank to keep)" : "Password *"}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder={editingUser ? "••••••••" : "Min 6 characters"}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Department Team *
                  </label>
                  <select
                    value={userFormData.team}
                    onChange={(e) => setUserFormData({ ...userFormData, team: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="marketing">Marketing Work</option>
                    <option value="creative">Creative Studio</option>
                    <option value="studio">Structural CAD Studio</option>
                    <option value="samp">SAMP Sampling Lab</option>
                    <option value="costing">Commercial Costing</option>
                    <option value="plant">Plant Operations</option>
                    <option value="admin">Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={userFormData.sub_role || ""}
                    onChange={(e) => setUserFormData({ ...userFormData, sub_role: e.target.value })}
                    placeholder="e.g. Marketing Specialist"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Assigned plant facilities
                  </label>
                  <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Select every plant this user is allowed to see. Plant team access is limited to these facilities.
                  </p>
                  <select
                    multiple
                    size={Math.min(Math.max(plantsList.length, 3), 6)}
                    value={userFormData.plant_codes || []}
                    onChange={(e) => {
                      const plant_codes = Array.from(e.currentTarget.selectedOptions, (option) => option.value);
                      setUserFormData({
                        ...userFormData,
                        plant_codes,
                        plant_code: plant_codes[0] || "",
                      });
                    }}
                    aria-label="Assigned plant facilities"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                  >
                    {plantsList.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    System Role
                  </label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({
                      ...userFormData,
                      role: e.target.value,
                      is_team_head: e.target.value === "admin" ? false : userFormData.is_team_head,
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="user">Team Member</option>
                    <option value="admin">Root Admin (Global)</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                <label className={`flex items-center gap-2.5 ${userFormData.role === "admin" ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={userFormData.is_team_head}
                    disabled={userFormData.role === "admin"}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        is_team_head: e.target.checked,
                        role: userFormData.role === "head" ? "user" : userFormData.role,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      Designate as Department Team Head
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Team heads can view their team’s requests and queues but cannot edit workflow data.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={userFormData.is_active}
                    onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    Active Login Status
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingUser ? "Save Changes" : "Create Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern SaaS Plant Modal (Add / Edit) */}
      {isPlantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-smooth-backdrop p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-smooth-modal">
            <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  {editingPlant ? `Edit Facility: ${editingPlant.code}` : "Add Manufacturing Plant"}
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Configure manufacturing unit code, name, and operational status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlantModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPlant} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Plant SAP Code *
                </label>
                <input
                  type="text"
                  required
                  value={plantFormData.code}
                  onChange={(e) => setPlantFormData({ ...plantFormData, code: e.target.value })}
                  placeholder="e.g. 1505"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Facility Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={plantFormData.name}
                  onChange={(e) => setPlantFormData({ ...plantFormData, name: e.target.value })}
                  placeholder="e.g. 1505- Khaniwade Facility"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Location / State
                </label>
                <input
                  type="text"
                  value={plantFormData.location}
                  onChange={(e) => setPlantFormData({ ...plantFormData, location: e.target.value })}
                  placeholder="e.g. Khaniwade, Maharashtra"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={plantFormData.isActive}
                  onChange={(e) => setPlantFormData({ ...plantFormData, isActive: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Operational Manufacturing Facility
                </span>
              </label>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPlantModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingPlant ? "Save Changes" : "Register Facility"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
