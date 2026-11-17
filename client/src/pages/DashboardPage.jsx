import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";

const dashboardTools = [
  ["Manual Testing", "Create and execute test cases.", "/manual-testing", "🧪"],
  ["Bug Tracking", "Report and follow software defects.", "/bugs", "🐞"],
  ["API Testing", "Learn API methods and response validation.", "/api-testing", "🔌"],
  ["SQL Playground", "Practise queries with sample data.", "/sql-practice", "🗄️"],
  ["Resources", "Browse QA learning material.", "/resources", "📚"],
];

const caseStatuses = ["Not Run", "Pass", "Fail"];
const bugSeverities = ["Critical", "High", "Medium", "Low"];

export default function DashboardPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDashboardData() {
      if (!user?.id) {
        setCases([]);
        setBugs([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [casesResult, bugsResult] = await Promise.all([
        supabase
          .from("test_cases")
          .select("id, title, status, created_at")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("bugs").select("id, title, status, severity, reported_at").order("id", { ascending: false }),
      ]);

      if (!active) return;
      if (casesResult.error) {
        console.error("Could not load test cases for dashboard:", casesResult.error);
        setFeedback({ type: "error", text: casesResult.error.message });
      } else {
        setCases(casesResult.data ?? []);
      }
      if (bugsResult.error) {
        console.error("Could not load bugs for dashboard:", bugsResult.error);
        setFeedback({ type: "error", text: bugsResult.error.message });
      } else {
        setBugs(bugsResult.data ?? []);
      }
      setLoading(false);
    }

    loadDashboardData();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const metrics = useMemo(() => {
    const passed = cases.filter((item) => item.status === "Pass").length;
    const failed = cases.filter((item) => item.status === "Fail").length;
    const total = cases.length;
    const passRate = total ? Math.round((passed / total) * 100) : 0;

    const testStatusCounts = Object.fromEntries(
      caseStatuses.map((status) => [status, cases.filter((item) => (item.status ?? "Not Run") === status).length]),
    );

    const openBugsBySeverity = Object.fromEntries(
      bugSeverities.map((severity) => [
        severity,
        bugs.filter((bug) => bug.status === "Open" && (bug.severity ?? "Medium") === severity).length,
      ]),
    );

    const recentActivity = [
      ...cases.map((item) => ({
        type: "Test case",
        title: item.title || "Untitled test case",
        at: item.created_at,
        detail: item.status ?? "Not Run",
      })),
      ...bugs.map((bug) => ({
        type: "Bug",
        title: bug.title || "Untitled bug",
        at: bug.reported_at,
        detail: `${bug.status || "Open"} · ${bug.severity || "Medium"}`,
      })),
    ]
      .sort((left, right) => new Date(right.at ?? 0) - new Date(left.at ?? 0))
      .slice(0, 6);

    return {
      passed,
      failed,
      total,
      passRate,
      testStatusCounts,
      openBugsBySeverity,
      recentActivity,
    };
  }, [bugs, cases]);

  return (
    <>
      <PageHeader
        eyebrow="Tester dashboard"
        title="Your QA dashboard"
        description={`Welcome back${user?.email ? `, ${user.email}` : ""}. Choose a tool to continue.`}
      />

      <Feedback message={feedback?.text} type={feedback?.type} />

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Loading dashboard metrics...</p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Pass rate</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.passRate}%</p>
              <p className="mt-1 text-xs text-slate-500">{metrics.passed} passed · {metrics.failed} failed</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Open bugs</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {bugs.filter((bug) => bug.status === "Open").length}
              </p>
              <p className="mt-1 text-xs text-slate-500">Across all severities</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Total cases</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.total}</p>
              <p className="mt-1 text-xs text-slate-500">{metrics.testStatusCounts["Not Run"]} not run</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Recent activity</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.recentActivity.length}</p>
              <p className="mt-1 text-xs text-slate-500">Latest updates</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Tests by status</h2>
              <div className="mt-4 space-y-3">
                {caseStatuses.map((status) => (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-600">
                      <span>{status}</span>
                      <span>{metrics.testStatusCounts[status]}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          status === "Pass"
                            ? "bg-emerald-500"
                            : status === "Fail"
                              ? "bg-rose-500"
                              : "bg-slate-300"
                        }`}
                        style={{
                          width: `${metrics.total ? (metrics.testStatusCounts[status] / metrics.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Open bugs by severity</h2>
              <div className="mt-4 space-y-3">
                {bugSeverities.map((severity) => (
                  <div key={severity}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-600">
                      <span>{severity}</span>
                      <span>{metrics.openBugsBySeverity[severity]}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          severity === "Critical"
                            ? "bg-rose-600"
                            : severity === "High"
                              ? "bg-orange-500"
                              : severity === "Medium"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${
                            bugs.filter((bug) => bug.status === "Open").length
                              ? (metrics.openBugsBySeverity[severity] /
                                  bugs.filter((bug) => bug.status === "Open").length) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
              <Link to="/manual-testing" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {metrics.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-500">No activity yet.</p>
              ) : (
                metrics.recentActivity.map((item, index) => (
                  <div key={`${item.type}-${item.title}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{item.type}</p>
                      <p className="mt-1 font-medium text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {item.at ? new Date(item.at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      )}
    </>
  );
}
