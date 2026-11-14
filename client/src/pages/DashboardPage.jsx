import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const dashboardTools = [
  ["Manual Testing", "Create and execute test cases.", "/manual-testing", "🧪"],
  ["Bug Tracking", "Report and follow software defects.", "/bugs", "🐞"],
  ["API Testing", "Learn API methods and response validation.", "/api-testing", "🔌"],
  ["SQL Playground", "Practise queries with sample data.", "/sql-practice", "🗄️"],
  ["Resources", "Browse QA learning material.", "/resources", "📚"],
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        eyebrow="Tester dashboard"
        title="Your QA dashboard"
        description={`Welcome back${user?.email ? `, ${user.email}` : ""}. Choose a tool to continue.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dashboardTools.map(([title, description, to, icon]) => (
          <Link
            key={to}
            to={to}
            className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-950/5"
          >
            <span className="text-2xl" aria-hidden="true">
              {icon}
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-indigo-600">
              Open tool →
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
