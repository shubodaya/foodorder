import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser
} from "../services/authService";
import { getPublicSettings, updateCustomerPortalTheme } from "../services/settingsService";

function normalizeTheme(value) {
  return String(value || "").trim().toLowerCase() === "light" ? "light" : "dark";
}

export default function AdminDashboardPage() {
  const { user: currentUser } = useAuth();
  const [customerTheme, setCustomerTheme] = useState("dark");
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");
  const [themeError, setThemeError] = useState("");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [usersMessage, setUsersMessage] = useState("");
  const [userSaving, setUserSaving] = useState(false);
  const [userForm, setUserForm] = useState({
    id: null,
    name: "",
    email: "",
    password: "",
    role: "kitchen"
  });

  const loadUsers = async () => {
    const list = await getUsers();
    setUsers(list || []);
  };

  useEffect(() => {
    let mounted = true;
    getPublicSettings()
      .then((settings) => {
        if (mounted) {
          setCustomerTheme(normalizeTheme(settings?.customerPortalTheme));
        }
      })
      .catch(() => {
        if (mounted) {
          setThemeError("Unable to load customer portal theme.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    loadUsers()
      .catch(() => {
        if (mounted) {
          setUsersError("Unable to load users.");
        }
      })
      .finally(() => {
        if (mounted) {
          setUsersLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const saveTheme = async (theme) => {
    setSavingTheme(true);
    setThemeError("");
    setThemeMessage("");

    try {
      const updated = await updateCustomerPortalTheme(theme);
      setCustomerTheme(normalizeTheme(updated?.customerPortalTheme));
      setThemeMessage(`Customer portal switched to ${normalizeTheme(updated?.customerPortalTheme)} mode.`);
    } catch (_error) {
      setThemeError("Unable to update customer portal theme.");
    } finally {
      setSavingTheme(false);
    }
  };

  const resetUserForm = () => {
    setUserForm({
      id: null,
      name: "",
      email: "",
      password: "",
      role: "kitchen"
    });
  };

  const submitUser = async (event) => {
    event.preventDefault();
    setUsersError("");
    setUsersMessage("");

    const name = userForm.name.trim();
    const email = userForm.email.trim().toLowerCase();
    const password = userForm.password;

    if (!name || !email) {
      setUsersError("Name and email are required.");
      return;
    }

    if (!userForm.id && password.length < 6) {
      setUsersError("Password must be at least 6 characters.");
      return;
    }

    if (userForm.id && password && password.length < 6) {
      setUsersError("Password must be at least 6 characters.");
      return;
    }

    setUserSaving(true);

    try {
      const payload = {
        name,
        email,
        role: userForm.role
      };

      if (password) {
        payload.password = password;
      }

      if (userForm.id) {
        await updateUser(userForm.id, payload);
        setUsersMessage("User updated.");
      } else {
        await createUser(payload);
        setUsersMessage("User created.");
      }

      await loadUsers();
      resetUserForm();
    } catch (error) {
      setUsersError(error?.response?.data?.message || "Unable to save user.");
    } finally {
      setUserSaving(false);
    }
  };

  const startEditUser = (managedUser) => {
    setUsersError("");
    setUsersMessage("");
    setUserForm({
      id: managedUser.id,
      name: managedUser.name || "",
      email: managedUser.email || "",
      password: "",
      role: managedUser.role || "kitchen"
    });
  };

  const removeManagedUser = async (managedUser) => {
    if (!window.confirm(`Delete user ${managedUser.email}?`)) {
      return;
    }

    setUsersError("");
    setUsersMessage("");

    try {
      await deleteUser(managedUser.id);
      setUsersMessage("User deleted.");
      await loadUsers();
      if (userForm.id === managedUser.id) {
        resetUserForm();
      }
    } catch (error) {
      setUsersError(error?.response?.data?.message || "Unable to delete user.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="premium-hero rounded-[2rem] p-7 text-white shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">Admin Portal</p>
        <h1 className="mt-2 text-3xl font-black uppercase md:text-4xl">Staff Dashboard</h1>
        <p className="mt-2 text-sm text-white/90">Manage menu and monitor new customer orders in real time.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/staff-menu-management" className="premium-surface rounded-3xl p-6 text-xl font-black uppercase shadow-panel transition hover:-translate-y-1">
          Manage Menu
        </Link>
        <Link to="/new-orders" className="premium-surface rounded-3xl p-6 text-xl font-black uppercase shadow-panel transition hover:-translate-y-1">
          New Orders
        </Link>
      </div>

      <div className="premium-surface rounded-3xl p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Customer Portal Theme</p>
        <h2 className="mt-2 text-2xl font-black uppercase">Display Mode Control</h2>
        <p className="mt-2 text-sm opacity-75">
          Change menu and cart screens for customers globally.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => saveTheme("dark")}
            disabled={savingTheme}
            className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${customerTheme === "dark" ? "bg-diner-teal text-white" : "bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"}`}
          >
            Dark Mode
          </button>
          <button
            type="button"
            onClick={() => saveTheme("light")}
            disabled={savingTheme}
            className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${customerTheme === "light" ? "bg-diner-red text-white" : "bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"}`}
          >
            Light Mode
          </button>
        </div>

        {themeMessage && <p className="mt-3 text-sm text-emerald-500">{themeMessage}</p>}
        {themeError && <p className="mt-3 text-sm text-red-500">{themeError}</p>}
      </div>

      <div className="premium-surface space-y-4 rounded-3xl p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Staff Users</p>
        <h2 className="text-2xl font-black uppercase">Kitchen/Admin Accounts</h2>
        <p className="text-sm opacity-75">
          Create, edit, and delete staff login users for kitchen and admin access.
        </p>

        <form onSubmit={submitUser} className="grid gap-3 lg:grid-cols-[1.2fr,1.2fr,1fr,1fr,auto]">
          <input
            type="text"
            value={userForm.name}
            onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Name"
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
            required
          />
          <input
            type="email"
            value={userForm.email}
            onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email"
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
            required
          />
          <select
            value={userForm.role}
            onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          >
            <option value="kitchen">Kitchen</option>
            <option value="admin">Admin</option>
          </select>
          <input
            type="password"
            value={userForm.password}
            onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
            placeholder={userForm.id ? "New password (optional)" : "Password"}
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          />
          <button
            type="submit"
            disabled={userSaving}
            className="shimmer-btn rounded-2xl bg-diner-teal px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {userSaving ? "Saving..." : userForm.id ? "Update User" : "Create User"}
          </button>
        </form>

        {userForm.id && (
          <button
            type="button"
            onClick={resetUserForm}
            className="rounded-2xl bg-black px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
          >
            Cancel Edit
          </button>
        )}

        {usersError && <p className="text-sm text-red-500">{usersError}</p>}
        {usersMessage && <p className="text-sm text-emerald-500">{usersMessage}</p>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/10">
                <th className="px-2 py-2 font-semibold uppercase tracking-wide">Name</th>
                <th className="px-2 py-2 font-semibold uppercase tracking-wide">Email</th>
                <th className="px-2 py-2 font-semibold uppercase tracking-wide">Role</th>
                <th className="px-2 py-2 font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 opacity-75">Loading users...</td>
                </tr>
              )}

              {!usersLoading && !users.length && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 opacity-75">No users found.</td>
                </tr>
              )}

              {!usersLoading && users.map((managedUser) => {
                const isCurrentUser = Number(currentUser?.id) === Number(managedUser.id);

                return (
                  <tr key={managedUser.id} className="border-b border-black/10 dark:border-white/10">
                    <td className="px-2 py-3 font-semibold">{managedUser.name}</td>
                    <td className="px-2 py-3">{managedUser.email}</td>
                    <td className="px-2 py-3 uppercase">{managedUser.role}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditUser(managedUser)}
                          className="rounded-xl bg-diner-teal px-3 py-1 text-xs font-bold text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeManagedUser(managedUser)}
                          disabled={isCurrentUser}
                          className="rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {isCurrentUser ? "Current User" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
