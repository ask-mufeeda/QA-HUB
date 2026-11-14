import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const navigation = [
  { to: "/app", label: "Workspace" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/manual-testing", label: "Test cases" },
  { to: "/automation-testing", label: "Automation testing" },
  { to: "/bugs", label: "Bug tracker" },
  { to: "/api-testing", label: "API testing" },
  { to: "/sql-practice", label: "SQL practice" },
  { to: "/resources", label: "Resources" },
  { to: "/test-generator-check", label: "Test generator" },
  { to: "/admin", label: "Admin", roles: ["admin"] },
  {
    to: "/developer-dashboard",
    label: "Developer",
    roles: ["developer"],
  },
];

export default function AppShell() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState("");

  async function handleSignOut() {
    setLogoutError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Could not sign out:", error);
      setLogoutError(error instanceof Error ? error.message : "Sign out failed.");
    }
  }

  const visibleNavigation = navigation.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-sm text-white">
              Q
            </span>
            QA<span className="-ml-2 text-indigo-600">Hub</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-52 truncate text-sm font-medium text-slate-800">
                {user?.email}
              </p>
              <p className="text-xs capitalize text-slate-500">{role}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Sign out
            </button>
          </div>

          <nav
            aria-label="Workspace"
            className="order-3 flex w-full gap-1 overflow-x-auto pb-1 text-sm lg:order-2 lg:w-auto lg:flex-1 lg:justify-center"
          >
            {visibleNavigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="shrink-0 rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {logoutError && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {logoutError}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
