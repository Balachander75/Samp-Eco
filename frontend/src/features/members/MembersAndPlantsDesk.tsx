import React, { useState, useEffect, useCallback } from "react";
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
} from "@/infrastructure/api/masterApi";
import { PlantItem } from "@/features/sample-requests/types";
import { MembersTeamsPage } from "./MembersTeamsPage";
import {
  ShieldCheck,
  Check,
  X,
} from "lucide-react";

interface MembersAndPlantsDeskProps {
  user: UserProfile;
}

export default function MembersAndPlantsDesk({ user }: MembersAndPlantsDeskProps) {
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
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
      console.error("Failed to load members or reference plants:", err);
      showToast("Error loading records", "error");
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
        plant_codes: userToEdit.plantCode ? [userToEdit.plantCode] : [],
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
      showToast("Please fill all required fields", "error");
      return;
    }
    if (!editingUser && !userFormData.password.trim()) {
      showToast("Password is required for new user", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const targetPlantCode = userFormData.team === "plant" ? (userFormData.plant_code?.trim() || "1505") : undefined;

      if (editingUser) {
        const updatePayload: UpdateUserPayload = {
          name: userFormData.name.trim(),
          userid: userFormData.userid.trim(),
          email: userFormData.email.trim(),
          role: userFormData.role,
          sub_role: userFormData.sub_role?.trim() || undefined,
          team: userFormData.team,
          is_team_head: userFormData.is_team_head,
          plant_code: targetPlantCode,
          plant_codes: targetPlantCode ? [targetPlantCode] : [],
          is_active: userFormData.is_active,
        };
        if (userFormData.password.trim()) {
          updatePayload.password = userFormData.password.trim();
        }
        await updateUserApi(editingUser.id, updatePayload);
        showToast(`User ${userFormData.name} updated`);
      } else {
        await createUserApi({
          ...userFormData,
          name: userFormData.name.trim(),
          userid: userFormData.userid.trim(),
          email: userFormData.email.trim(),
          password: userFormData.password.trim(),
          sub_role: userFormData.sub_role?.trim() || undefined,
          plant_code: targetPlantCode,
          plant_codes: targetPlantCode ? [targetPlantCode] : [],
        });
        showToast(`User ${userFormData.name} created`);
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

  // Delete User
  const handleDeleteUser = async (userId: number, name: string) => {
    if (!window.confirm(`Remove member "${name}"?`)) return;
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

  if (!isAdmin) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-sm rounded-xl bg-white dark:bg-[#0e121a] border border-zinc-200 dark:border-zinc-800 p-6 text-center shadow-xs">
          <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Administrator Access Required
          </h1>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            This section is restricted to Root Administrators.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-white dark:bg-[#080a10] text-zinc-900 dark:text-zinc-100 font-sans select-text overflow-hidden">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-lg shadow-lg text-xs font-medium border animate-smooth-toast ${
            feedbackMsg.type === "success"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200"
              : "bg-rose-600 text-white border-rose-700"
          }`}
        >
          {feedbackMsg.type === "success" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Full-Page Unified Member Directory Table */}
      <MembersTeamsPage
        currentUser={user}
        users={usersList}
        plants={plantsList}
        isLoading={isLoading}
        onRefresh={loadData}
        onOpenUserModal={handleOpenUserModal}
        onDeleteUser={handleDeleteUser}
      />

      {/* Clean User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-smooth-backdrop">
          <div className="w-full max-w-md bg-white dark:bg-[#0e121a] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-smooth-modal">
            <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 font-mono">
                {editingUser ? `Edit Member: ${editingUser.name}` : "New Team Member"}
              </h2>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitUser} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    placeholder="Parin Dedhia"
                    className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Username / ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.userid}
                    onChange={(e) => setUserFormData({ ...userFormData, userid: e.target.value })}
                    placeholder="Parin.d"
                    className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="user@navneet.com"
                    className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {editingUser ? "Password (optional)" : "Password *"}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder={editingUser ? "Keep unchanged" : "••••••••"}
                    className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Department *
                  </label>
                  <select
                    value={userFormData.team}
                    onChange={(e) => {
                      const newTeam = e.target.value;
                      setUserFormData({
                        ...userFormData,
                        team: newTeam,
                        plant_code: newTeam === "plant" ? (userFormData.plant_code || "1505") : "",
                        plant_codes: newTeam === "plant" ? [(userFormData.plant_code || "1505")] : [],
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"
                  >
                    <option value="marketing">Marketing</option>
                    <option value="creative">Creative Studio</option>
                    <option value="studio">Structural CAD Studio</option>
                    <option value="samp">SAMP Sampling Lab</option>
                    <option value="costing">Commercial Costing</option>
                    <option value="plant">Plant Operations</option>
                    <option value="admin">Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Role Title
                  </label>
                  <input
                    type="text"
                    value={userFormData.sub_role || ""}
                    onChange={(e) => setUserFormData({ ...userFormData, sub_role: e.target.value })}
                    placeholder="e.g. Sampling Specialist"
                    className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"
                  />
                </div>
              </div>

              {/* Plant selection (Only for Plant Team) */}
              {userFormData.team === "plant" && (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Assigned Facility
                  </label>
                  <select
                    value={userFormData.plant_code || "1505"}
                    onChange={(e) => {
                      const code = e.target.value;
                      setUserFormData({
                        ...userFormData,
                        plant_code: code,
                        plant_codes: [code],
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"
                  >
                    {plantsList.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    System Access
                  </label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({
                      ...userFormData,
                      role: e.target.value,
                      is_team_head: e.target.value === "admin" ? false : userFormData.is_team_head,
                    })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Global Administrator</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  {userFormData.role !== "admin" && (
                    <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
                      <input
                        type="checkbox"
                        checked={userFormData.is_team_head}
                        onChange={(e) => setUserFormData({ ...userFormData, is_team_head: e.target.checked })}
                        className="rounded text-zinc-900 focus:ring-zinc-900 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                        Department Team Head
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={userFormData.is_active}
                    onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                    className="rounded text-zinc-900 focus:ring-zinc-900 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Active Account Status
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="h-8 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8 px-3.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingUser ? "Save Changes" : "Create Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
