import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { calculateSuccessRate } from "../lib/automationApi.js";
import { supabase } from "../lib/supabase.js";

const metricCards = [
  { key: "total", label: "Total tests", color: "text-slate-900" },
  { key: "passed", label: "Passed", color: "text-emerald-700" },
  { key: "failed", label: "Failed", color: "text-rose-700" },
  { key: "skipped", label: "Skipped", color: "text-amber-700" },
];

function getRunName(run) {
  return run?.run_name || run?.name || "Untitled run";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDuration(value) {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function runStatusStyle(status) {
  switch (status) {
    case "passed":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-rose-50 text-rose-700";
    case "running":
      return "bg-indigo-50 text-indigo-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AutomationTestingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const latestRun = runs[0] ?? null;
  const metrics = latestRun
    ? {
        total: latestRun.total ?? 0,
        passed: latestRun.passed ?? 0,
        failed: latestRun.failed ?? 0,
        skipped: latestRun.skipped ?? 0,
      }
    : null;
  const successRate = latestRun
    ? calculateSuccessRate(latestRun.passed ?? 0, latestRun.failed ?? 0)
    : null;

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? latestRun ?? null,
    [latestRun, runs, selectedRunId],
  );

  const visibleResults = failedOnly
    ? results.filter((result) => result.status === "failed")
    : results;

  useEffect(() => {
    let active = true;

    async function loadRuns() {
      if (!user?.id) {
        if (active) {
          setRuns([]);
          setSelectedRunId(null);
          setResults([]);
          setErrorMessage("Sign in to view automation testing data.");
          setLoading(false);
        }
        return;
      }

      if (active) {
        setLoading(true);
        setErrorMessage("");
      }

      try {
        const { data, error } = await supabase
          .from("automation_runs")
          .select("*")
          .eq("created_by", user.id)
          .order("started_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        if (!active) return;

        const nextRuns = data ?? [];
        setRuns(nextRuns);
        setSelectedRunId((current) => {
          if (current && nextRuns.some((run) => run.id === current)) {
            return current;
          }
          return nextRuns[0]?.id ?? null;
        });
      } catch (loadError) {
        console.error("Could not load automation runs:", loadError);
        if (active) {
          setRuns([]);
          setSelectedRunId(null);
          setResults([]);
          setErrorMessage(
            loadError?.message || "Could not load automation testing data.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRuns();
    return () => {
      active = false;
    };
  }, [user?.id, refreshKey]);

  useEffect(() => {
    let active = true;

    async function loadResults() {
      if (!selectedRunId) {
        if (active) setResults([]);
        return;
      }

      if (active) setLoadingResults(true);

      try {
        const { data, error } = await supabase
          .from("automation_results")
          .select("*")
          .eq("run_id", selectedRunId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (active) setResults(data ?? []);
      } catch (loadError) {
        console.error("Could not load automation results:", loadError);
        if (active) {
          setResults([]);
          setErrorMessage(
            loadError?.message || "Could not load the selected automation run.",
          );
        }
      } finally {
        if (active) setLoadingResults(false);
      }
    }

    loadResults();
    return () => {
      active = false;
    };
  }, [selectedRunId]);

  function openBugFromResult(result) {
    const runName = getRunName(selectedRun);
    const title = `[Automation] ${result.test_name || result.testName || "Failed test"} failed`;
    const description = [
      `Run: ${runName}`,
      result.error_message || result.errorMessage || "No error details were provided.",
    ].join("\n\n");

    navigate("/bugs", {
      state: {
        automationBug: {
          title,
          description,
          severity: "Medium",
        },
      },
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Playwright automation"
        title="Automation testing"
        description="Track test results and recent runs from Playwright and CI automation jobs."
        actions={
          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      {errorMessage && (
        <div className="mb-6">
          <Feedback message={errorMessage} type="error" />
        </div>
      )}

      {loading && (
        <p role="status" className="mb-4 text-sm text-slate-600">
          Loading automation dashboard...
        </p>
      )}

      {!loading && !errorMessage && (
        <>
          <section
            aria-label="Automation test metrics"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            {metricCards.map((card) => (
              <article
                key={card.key}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <p className={`mt-3 text-3xl font-semibold ${card.color}`}>
                  {metrics ? (metrics[card.key] ?? 0).toLocaleString() : "—"}
                </p>
              </article>
            ))}
            <article className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
              <p className="text-sm font-medium text-indigo-800">Success rate</p>
              <p className="mt-3 text-3xl font-semibold text-indigo-900">
                {successRate ?? "—"}
              </p>
              <p className="mt-1 text-xs text-indigo-700">
                Skipped tests are excluded
              </p>
            </article>
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Recent executions
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Your latest automation runs.
              </p>
            </div>

            {runs.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-600">
                No executions yet. Recent runs will appear here after you run a test.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed divide-y divide-slate-200 text-left text-sm md:table-auto">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Run name
                      </th>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Date
                      </th>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Total
                      </th>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Passed
                      </th>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Failed
                      </th>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        className={
                          selectedRunId === run.id
                            ? "cursor-pointer bg-indigo-50/60"
                            : "cursor-pointer hover:bg-slate-50"
                        }
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {getRunName(run)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {formatDate(run.started_at)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {run.total ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {run.passed ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {run.failed ?? 0}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${runStatusStyle(run.status)}`}
                          >
                            {run.status || "running"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selectedRun && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {getRunName(selectedRun)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Started {formatDate(selectedRun.started_at)}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={failedOnly}
                    onChange={(event) => setFailedOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Failed only
                </label>
              </div>

              {loadingResults ? (
                <p className="mt-4 text-sm text-slate-600">Loading run details...</p>
              ) : visibleResults.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  No matching results in this run.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full table-auto divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-3 py-3 font-semibold">
                          Test name
                        </th>
                        <th scope="col" className="px-3 py-3 font-semibold">
                          Status
                        </th>
                        <th scope="col" className="px-3 py-3 font-semibold">
                          Duration
                        </th>
                        <th scope="col" className="px-3 py-3 font-semibold">
                          Error
                        </th>
                        <th scope="col" className="px-3 py-3 font-semibold">
                          Link
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleResults.map((result) => (
                        <tr key={result.id}>
                          <td className="px-3 py-3 font-medium text-slate-900">
                            {result.test_name || "Unnamed test"}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${runStatusStyle(result.status)}`}
                            >
                              {result.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                            {formatDuration(result.duration_ms)}
                          </td>
                          <td className="max-w-xs px-3 py-3 text-slate-600">
                            {result.error_message || "—"}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {result.status === "failed" && (
                              <button
                                type="button"
                                onClick={() => openBugFromResult(result)}
                                className="mb-2 inline-flex items-center rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                              >
                                Create bug
                              </button>
                            )}
                            {result.linked_test_case_id ? (
                              <Link
                                to={`/manual-testing?case=${result.linked_test_case_id}`}
                                className="inline-flex items-center text-sm font-medium text-indigo-700 hover:text-indigo-500"
                              >
                                View test case
                              </Link>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
