import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const tools = [
  {
    title: "Test case management",
    description: "Create, execute, and track test cases.",
    to: "/manual-testing",
    tag: "Testing",
  },
  {
    title: "Bug tracker",
    description: "Report issues and track them through resolution.",
    to: "/bugs",
    tag: "Team workflow",
  },
  {
    title: "API testing",
    description: "Review HTTP methods, status codes, and validation.",
    to: "/api-testing",
    tag: "Learning",
  },
  {
    title: "SQL practice",
    description: "Build query skills in an interactive playground.",
    to: "/sql-practice",
    tag: "Practice",
  },
  {
    title: "Resources",
    description: "Find focused guides for QA topics.",
    to: "/resources",
    tag: "Learning",
  },
  {
    title: "Test generator",
    description: "Try the configured AI test-case generator.",
    to: "/test-generator-check",
    tag: "Utility",
  },
];

export default function WorkspacePage() {
  const { user, role } = useAuth();
  const roleDashboard =
    role === "admin"
      ? "/admin"
      : role === "developer"
        ? "/developer-dashboard"
        : "/dashboard";

  return (
    <>
      <PageHeader
        eyebrow="QA Hub workspace"
        title={`Welcome${user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}`}
        description={`Signed in as ${user?.email ?? "your account"} · ${role ?? "member"}`}
        actions={
          <Link
            to={roleDashboard}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Open your dashboard
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-950/5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {tool.tag}
            </p>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              {tool.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {tool.description}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 group-hover:text-indigo-800">
              Open tool <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
