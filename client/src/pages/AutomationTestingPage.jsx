import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  calculateSuccessRate,
  parsePlaywrightJsonReport,
} from "../lib/automationApi.js";
import { supabase } from "../lib/supabase.js";

const metricCards = [
  { key: "total", label: "Total tests", color: "text-slate-900" },
  { key: "passed", label: "Passed", color: "text-emerald-700" },
  { key: "failed", label: "Failed", color: "text-rose-700" },
  { key: "skipped", label: "Skipped", color: "text-amber-700" },
];
const sourceOptions = ["local", "ci"];
const resultStatuses = ["passed", "failed", "skipped"];

function buildManualRow(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    test_name: "",
    file: "",
    status: "failed",
    duration: 0,
    error_message: "",
    ...overrides,
  };
}

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
  switch (String(status ?? "").toLowerCase()) {
    case "passed":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-rose-50 text-rose-700";
    case "running":
      return "bg-indigo-50 text-indigo-700";
    case "skipped":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function sourceBadgeStyle(source) {
  if (String(source ?? "").toLowerCase() === "ci") {
    return "bg-indigo-50 text-indigo-700";
  }
  return "bg-slate-100 text-slate-700";
}

function getDelta(current, previous) {
  const left = Number(current ?? 0);
  const right = Number(previous ?? 0);
  const delta = left - right;
  return delta === 0 ? "0" : `${delta > 0 ? "+" : ""}${delta}`;
}

export default function AutomationTestingPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scope, setScope] = useState("mine");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("started_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [visibleCount, setVisibleCount] = useState(10);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [manualRunName, setManualRunName] = useState("");
  const [manualSource, setManualSource] = useState("local");
  const [manualRows, setManualRows] = useState([buildManualRow()]);
  const [manualSaving, setManualSaving] = useState(false);
  const [resultSearch, setResultSearch] = useState("");
  const [resultStatusFilter, setResultStatusFilter] = useState("all");

  const isAdmin = role === "admin";
  const latestRun = runs[0] ?? null;
  const previousRun = runs[1] ?? null;
  const latestMetrics = latestRun
    ? {
        total: latestRun.total ?? 0,
        passed: latestRun.passed ?? 0,
        failed: latestRun.failed ?? 0,
        skipped: latestRun.skipped ?? 0,
      }
    : null;
  const latestSuccessRate = latestRun
    ? calculateSuccessRate(latestRun.passed ?? 0, latestRun.failed ?? 0)
    : null;

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? latestRun ?? null,
    [latestRun, runs, selectedRunId],
  );

  const filteredRuns = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = runs.filter((run) => {
      const matchesSearch =
        !normalizedSearch ||
        getRunName(run).toLowerCase().includes(normalizedSearch) ||
        String(run.source ?? "").toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "all" ||
        String(run.status ?? "").toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });

    filtered.sort((left, right) => {
      const leftValue = left[sortField] ?? "";
      const rightValue = right[sortField] ?? "";
      const comparison =
        typeof leftValue === "string"
          ? String(leftValue).localeCompare(String(rightValue))
          : Number(leftValue) - Number(rightValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [runs, searchTerm, sortDirection, sortField, statusFilter]);

  const visibleRuns = filteredRuns.slice(0, visibleCount);

  const chartRuns = useMemo(() => [...runs].slice(0, 10).reverse(), [runs]);
  const chartValues = useMemo(
    () =>
      chartRuns.map((run) => ({
        value: calculateSuccessRate(run.passed ?? 0, run.failed ?? 0) ?? 0,
        run,
      })),
    [chartRuns],
  );
  const chartPoints = useMemo(() => {
    if (chartValues.length === 0) return "";
    const maxValue = Math.max(100, ...chartValues.map((point) => point.value), 0);
    return chartValues
      .map((point, index) => {
        const x = chartValues.length === 1 ? 50 : (index / (chartValues.length - 1)) * 100;
        const y = 100 - (point.value / maxValue) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [chartValues]);

  const visibleResults = useMemo(() => {
    const query = (resultSearch || "").trim().toLowerCase();
    return (results || []).filter((result) => {
      const matchesStatus =
        resultStatusFilter === "all" ||
        String(result.status ?? "").toLowerCase() === resultStatusFilter;
      const matchesSearch =
        !query ||
        String(result.test_name ?? "").toLowerCase().includes(query) ||
        String(result.file ?? "").toLowerCase().includes(query) ||
        String(result.error_message ?? "").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [resultSearch, resultStatusFilter, results]);

  const slowestTests = useMemo(
    () =>
      [...visibleResults]
        .sort(
          (left, right) =>
            Number(right.duration_ms ?? 0) - Number(left.duration_ms ?? 0),
        )
        .slice(0, 5),
    [visibleResults],
  );

  const flakyTests = useMemo(() => {
    const recentRunIds = runs.slice(0, 10).map((run) => run.id);
    if (recentRunIds.length === 0) return [];

    const counts = new Map();
    for (const runId of recentRunIds) {
      const runResults = results.filter((result) => result.run_id === runId);
      for (const result of runResults) {
        const key = String(result.test_name ?? "").trim();
        if (!key) continue;
        if (!counts.has(key)) {
          counts.set(key, { passed: 0, failed: 0 });
        }
        const record = counts.get(key);
        if (String(result.status ?? "").toLowerCase() === "passed") record.passed += 1;
        if (String(result.status ?? "").toLowerCase() === "failed") record.failed += 1;
      }
    }

    return [...counts.entries()]
      .filter(([, value]) => value.passed > 0 && value.failed > 0)
      .map(([name, value]) => ({ name, passed: value.passed, failed: value.failed }));
  }, [results, runs]);

  useEffect(() => {
    if (!user?.id) {
      setRuns([]);
      setResults([]);
      setSelectedRunId(null);
      setLoading(false);
      setErrorMessage("Sign in to view automation testing data.");
      return;
    }

    let active = true;

    async function loadRuns() {
      setLoading(true);
      setErrorMessage("");
      setFeedback(null);

      try {
        let query = supabase
          .from("automation_runs")
          .select("*, profiles!created_by(id, email, role)")
          .order("started_at", { ascending: false });

        if (!isAdmin || scope === "mine") {
          query = query.eq("created_by", user.id);
        }

        const { data, error } = await query;

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
        if (active) {
          setRuns([]);
          setResults([]);
          setSelectedRunId(null);
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
  }, [isAdmin, refreshKey, scope, user?.id]);

  useEffect(() => {
    if (!selectedRunId) {
      setResults([]);
      return;
    }

    let active = true;

    async function loadResults() {
      setLoadingResults(true);
      try {
        const { data, error } = await supabase
          .from("automation_results")
          .select("*")
          .eq("run_id", selectedRunId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (active) setResults(data ?? []);
      } catch (loadError) {
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

  async function saveRunRows({ runName, source, rows }) {
    const safeRunName = String(runName ?? "").trim();
    const safeSource = sourceOptions.includes(String(source ?? "local").toLowerCase())
      ? String(source).toLowerCase()
      : "local";

    if (!safeRunName) {
      throw new Error("The run name is required.");
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Add at least one result before saving.");
    }

    const cleanRows = rows.map((row, index) => {
      const testName = String(row.test_name ?? row.testName ?? "").trim();
      if (!testName) {
        throw new Error(`Result ${index + 1} is missing a test name.`);
      }
      const status = String(row.status ?? "").trim().toLowerCase();
      if (!resultStatuses.includes(status)) {
        throw new Error(`Result ${index + 1} has an invalid status.`);
      }
      return {
        test_name: testName,
        file: String(row.file ?? "").trim() || null,
        status,
        duration_ms: Math.max(
          0,
          Number(row.duration ?? row.duration_ms ?? row.durationMs ?? 0) || 0,
        ),
        error_message:
          String(row.error_message ?? row.errorMessage ?? "").trim() || null,
      };
    });

    const { data: runData, error: runError } = await supabase
      .from("automation_runs")
      .insert({ run_name: safeRunName, source: safeSource, created_by: user.id })
      .select()
      .single();

    if (runError) throw runError;

    const batches = [];
    for (let index = 0; index < cleanRows.length; index += 500) {
      batches.push(
        cleanRows.slice(index, index + 500).map((row) => ({
          run_id: runData.id,
          test_name: row.test_name,
          file: row.file,
          status: row.status,
          duration_ms: row.duration_ms,
          error_message: row.error_message,
        })),
      );
    }

    for (const batch of batches) {
      const { error: insertError } = await supabase
        .from("automation_results")
        .insert(batch);
      if (insertError) throw insertError;
    }

    return runData;
  }

  async function handleSaveImport() {
    if (!importPreview) return;

    try {
      setIsImporting(true);
      const createdRun = await saveRunRows({
        runName: importPreview.runName,
        source: importPreview.source,
        rows: importPreview.results,
      });
      setRuns((current) => [createdRun, ...current]);
      setSelectedRunId(createdRun.id);
      setShowImportDialog(false);
      setImportText("");
      setImportFileName("");
      setImportPreview(null);
      setImportError("");
      setFeedback({
        type: "success",
        text: `Imported ${importPreview.results.length} results into “${createdRun.run_name}”.`,
      });
    } catch (saveError) {
      setFeedback({
        type: "error",
        text:
          saveError instanceof Error
            ? saveError.message
            : "Could not save the imported results.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleManualSave() {
    if (!manualRunName.trim()) {
      setFeedback({ type: "error", text: "Add a run name before saving." });
      return;
    }

    const preparedRows = manualRows
      .filter((row) => String(row.test_name ?? "").trim())
      .map((row) => ({
        test_name: String(row.test_name ?? "").trim(),
        file: String(row.file ?? "").trim() || null,
        status: String(row.status ?? "").trim().toLowerCase(),
        duration: Number(row.duration ?? 0) || 0,
        error_message: String(row.error_message ?? "").trim() || null,
      }));

    if (preparedRows.length === 0) {
      setFeedback({ type: "error", text: "Add at least one result row with a test name." });
      return;
    }

    try {
      setManualSaving(true);
      const createdRun = await saveRunRows({
        runName: manualRunName,
        source: manualSource,
        rows: preparedRows,
      });
      setRuns((current) => [createdRun, ...current]);
      setSelectedRunId(createdRun.id);
      setShowManualDialog(false);
      setManualRunName("");
      setManualSource("local");
      setManualRows([buildManualRow()]);
      setFeedback({ type: "success", text: `Saved manual run “${createdRun.run_name}”.` });
    } catch (saveError) {
      setFeedback({
        type: "error",
        text:
          saveError instanceof Error
            ? saveError.message
            : "Could not save the manual run.",
      });
    } finally {
      setManualSaving(false);
    }
  }

  function updateManualRow(rowId, field, value) {
    setManualRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  }

  function addManualRow() {
    setManualRows((current) => [...current, buildManualRow()]);
  }

  function removeManualRow(rowId) {
    setManualRows((current) => {
      if (current.length <= 1) {
        return [buildManualRow()];
      }
      return current.filter((row) => row.id !== rowId);
    });
  }

  async function clearSampleData() {
    try {
      const { error } = await supabase
        .from("automation_runs")
        .delete()
        .eq("created_by", user.id)
        .like("run_name", "Sample run (delete me)");
      if (error) throw error;
      setRuns((current) =>
        current.filter((run) => getRunName(run) !== "Sample run (delete me)"),
      );
      setFeedback({ type: "success", text: "Sample data removed." });
    } catch (removeError) {
      setFeedback({
        type: "error",
        text:
          removeError instanceof Error
            ? removeError.message
            : "Could not remove sample data.",
      });
    }
  }

  async function loadSampleData() {
    const sampleRows = [
      {
        test_name: "loads the dashboard",
        file: "tests/dashboard.spec.ts",
        status: "passed",
        duration: 1200,
        error_message: null,
      },
      {
        test_name: "displays the empty state",
        file: "tests/dashboard.spec.ts",
        status: "failed",
        duration: 2700,
        error_message: "The table was empty after the filters reset.",
      },
      {
        test_name: "handles a skipped test",
        file: "tests/dashboard.spec.ts",
        status: "skipped",
        duration: 250,
        error_message: null,
      },
    ];

    try {
      const createdRun = await saveRunRows({
        runName: "Sample run (delete me)",
        source: "local",
        rows: sampleRows,
      });
      setRuns((current) => [createdRun, ...current]);
      setSelectedRunId(createdRun.id);
      setFeedback({ type: "success", text: "Sample data loaded." });
    } catch (loadError) {
      setFeedback({
        type: "error",
        text:
          loadError instanceof Error
            ? loadError.message
            : "Could not load the sample data.",
      });
    }
  }

  async function deleteRun(runId) {
    if (!window.confirm("Delete this automation run and all of its results?")) {
      return;
    }

    try {
      let query = supabase.from("automation_runs").delete().eq("id", runId);
      const { error } = isAdmin ? await query : await query.eq("created_by", user.id);
      if (error) throw error;
      setRuns((current) => current.filter((run) => run.id !== runId));
      if (selectedRunId === runId) {
        setSelectedRunId(null);
      }
      setFeedback({ type: "success", text: "The run was deleted." });
    } catch (deleteError) {
      setFeedback({
        type: "error",
        text:
          deleteError instanceof Error
            ? deleteError.message
            : "Could not delete the run.",
      });
    }
  }

  function openBugFromResult(result) {
    const runName = getRunName(selectedRun);
    const title = `[Automation] ${result.test_name || "Failed test"} failed`;
    const description = [
      `Run: ${runName}`,
      `File: ${result.file || "n/a"}`,
      result.error_message || "No error details were provided.",
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

  function parseImportText(nextText, nextFileName) {
    try {
      const parsed = JSON.parse(nextText);
      const parsedResults = parsePlaywrightJsonReport(parsed);
      const baseName = String(nextFileName || "playwright-run")
        .replace(/\.[^.]+$/, "")
        .trim();
      setImportFileName(nextFileName || "");
      setImportPreview({
        runName: `${baseName || "Playwright run"} ${new Date().toISOString().slice(0, 10)}`,
        source: "ci",
        results: parsedResults,
      });
      setImportError("");
    } catch (parseError) {
      setImportPreview(null);
      setImportError(
        parseError instanceof Error
          ? parseError.message
          : "The file is not valid Playwright JSON.",
      );
    }
  }

  async function handleImportFileChange(event) {
    const [file] = Array.from(event.target.files || []);
    if (!file) return;
    const text = await file.text();
    parseImportText(text, file.name);
    event.target.value = "";
  }

  async function copyToClipboard(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ type: "success", text: `${label} copied to the clipboard.` });
    } catch (copyError) {
      setFeedback({
        type: "error",
        text:
          copyError instanceof Error
            ? copyError.message
            : `Could not copy ${label}.`,
      });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Playwright automation"
        title="Automation testing"
        description="Import Playwright reports, track runs, and triage failures without leaving QA Hub."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowImportDialog(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Import results
            </button>
            <button
              type="button"
              onClick={() => setShowManualDialog(true)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Add run manually
            </button>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </>
        }
      />

      {feedback && (
        <div className="mb-6">
          <Feedback message={feedback.text} type={feedback.type} />
        </div>
      )}

      {isAdmin && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScope("mine")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${scope === "mine" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            My runs
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${scope === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            All runs
          </button>
        </div>
      )}

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
          {runs.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Getting started</h2>
                  <ol className="mt-4 space-y-3 text-sm text-slate-600">
                    <li><span className="font-semibold text-slate-900">1.</span> Run Playwright with the JSON reporter.</li>
                    <li><span className="font-semibold text-slate-900">2.</span> Click Import results and select the JSON file or paste it.</li>
                    <li><span className="font-semibold text-slate-900">3.</span> Review failures, create bugs, and share the run results.</li>
                  </ol>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <code className="text-xs text-slate-700">npx playwright test --reporter=json &gt; report.json</code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("npx playwright test --reporter=json > report.json", "Command")}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setShowImportDialog(true)}
                    className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    Import results
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualDialog(true)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Add run manually
                  </button>
                  <button
                    type="button"
                    onClick={loadSampleData}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Load sample data
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <section aria-label="Automation metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {metricCards.map((card) => {
                  const value = latestMetrics ? latestMetrics[card.key] ?? 0 : 0;
                  const previousValue = previousRun ? previousRun[card.key] ?? 0 : null;
                  const delta = previousValue === null ? "—" : getDelta(value, previousValue);
                  return (
                    <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-medium text-slate-600">{card.label}</p>
                      <p className={`mt-3 text-3xl font-semibold ${card.color}`}>
                        {latestRun ? value.toLocaleString() : "—"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {previousValue === null ? "No previous run" : `${delta} vs previous run`}
                      </p>
                    </article>
                  );
                })}
                <article className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
                  <p className="text-sm font-medium text-indigo-800">Success rate</p>
                  <p className="mt-3 text-3xl font-semibold text-indigo-900">
                    {latestSuccessRate !== null ? `${latestSuccessRate}%` : "—"}
                  </p>
                  <p className="mt-2 text-xs text-indigo-700">
                    {previousRun && latestRun
                      ? `${getDelta(latestSuccessRate ?? 0, calculateSuccessRate(previousRun.passed ?? 0, previousRun.failed ?? 0) ?? 0)}% vs previous run`
                      : "Skipped tests excluded"}
                  </p>
                </article>
              </section>

              <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Pass-rate trend</h2>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Last 10 runs</span>
                </div>
                {chartValues.length > 0 ? (
                  <svg viewBox="0 0 100 100" className="h-36 w-full overflow-visible rounded-xl bg-slate-50 p-2">
                    <polyline
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2.5"
                      points={chartPoints}
                    />
                    {chartValues.map((point, index) => {
                      const x = chartValues.length === 1 ? 50 : (index / (chartValues.length - 1)) * 100;
                      const maxValue = Math.max(100, ...chartValues.map((item) => item.value), 0);
                      const y = 100 - (point.value / maxValue) * 100;
                      return (
                        <g key={point.run.id}>
                          <circle cx={x} cy={y} r="2.4" fill="#4f46e5" />
                          <text x={x} y="97" textAnchor="middle" fontSize="4" fill="#64748b">
                            {new Date(point.run.started_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <p className="text-sm text-slate-500">No trend data yet.</p>
                )}
              </section>

              <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Recent executions</h2>
                    <p className="mt-1 text-sm text-slate-600">Latest run history and filters.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search run name"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500"
                    />
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="all">All statuses</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="running">Running</option>
                    </select>
                    <select
                      value={sortField}
                      onChange={(event) => setSortField(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="started_at">Sort by date</option>
                      <option value="total">Sort by total</option>
                      <option value="passed">Sort by passed</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      {sortDirection === "desc" ? "Newest" : "Oldest"}
                    </button>
                  </div>
                </div>

                {filteredRuns.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-slate-600">
                    No runs match the current filters.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full table-auto divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Run name</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Total</th>
                            <th className="px-4 py-3">Passed</th>
                            <th className="px-4 py-3">Failed</th>
                            <th className="px-4 py-3">Skipped</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Duration</th>
                            {isAdmin && <th className="px-4 py-3">Created by</th>}
                            <th className="px-4 py-3">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {visibleRuns.map((run) => (
                            <tr
                              key={run.id}
                              className={selectedRunId === run.id ? "cursor-pointer bg-indigo-50/40" : "cursor-pointer hover:bg-slate-50"}
                              onClick={() => setSelectedRunId(run.id)}
                            >
                              <td className="px-4 py-3 font-medium text-slate-900">{getRunName(run)}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase ${sourceBadgeStyle(run.source)}`}>
                                  {run.source || "local"}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(run.started_at)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{run.total ?? 0}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{run.passed ?? 0}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{run.failed ?? 0}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{run.skipped ?? 0}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${runStatusStyle(run.status)}`}>
                                  {run.status || "running"}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDuration(run.finished_at ? (new Date(run.finished_at) - new Date(run.started_at)) : null)}</td>
                              {isAdmin ? (
                                <td className="px-4 py-3 text-slate-600">
                                  {run.profiles?.email || run.created_by || "—"}
                                </td>
                              ) : null}
                              <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => deleteRun(run.id)}
                                  className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {visibleCount < filteredRuns.length && (
                      <div className="flex justify-center border-t border-slate-200 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((current) => current + 10)}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Load more
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>

              {selectedRun && (
                <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{getRunName(selectedRun)}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDate(selectedRun.started_at)} · {selectedRun.source || "local"}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${runStatusStyle(selectedRun.status)}`}>
                        {selectedRun.status || "running"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                        <p className="mt-1 text-xl font-semibold text-slate-900">{selectedRun.total ?? 0}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-emerald-700">Passed</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-700">{selectedRun.passed ?? 0}</p>
                      </div>
                      <div className="rounded-xl bg-rose-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-rose-700">Failed</p>
                        <p className="mt-1 text-xl font-semibold text-rose-700">{selectedRun.failed ?? 0}</p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <select
                          value={resultStatusFilter}
                          onChange={(event) => setResultStatusFilter(event.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          <option value="all">All</option>
                          <option value="failed">Failed</option>
                          <option value="passed">Passed</option>
                          <option value="skipped">Skipped</option>
                        </select>
                        <input
                          value={resultSearch}
                          onChange={(event) => setResultSearch(event.target.value)}
                          placeholder="Search tests or errors"
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500"
                        />
                      </div>

                      {loadingResults ? (
                        <p className="py-4 text-sm text-slate-600">Loading run details...</p>
                      ) : visibleResults.length === 0 ? (
                        <p className="py-4 text-sm text-slate-600">No results match the current filters.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full table-auto divide-y divide-slate-200 text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-3">Test</th>
                                <th className="px-3 py-3">Status</th>
                                <th className="px-3 py-3">Duration</th>
                                <th className="px-3 py-3">Error</th>
                                <th className="px-3 py-3">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {visibleResults.map((result) => (
                                <tr key={result.id}>
                                  <td className="px-3 py-3 font-medium text-slate-900">{result.test_name || "Unnamed test"}</td>
                                  <td className="px-3 py-3">
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${runStatusStyle(result.status)}`}>
                                      {result.status || "passed"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">{formatDuration(result.duration_ms)}</td>
                                  <td className="px-3 py-3 text-slate-600">
                                    {result.error_message ? (
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(result.error_message, "Error message")}
                                        className="text-left underline decoration-dotted underline-offset-2"
                                      >
                                        {result.error_message}
                                      </button>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    {String(result.status ?? "").toLowerCase() === "failed" && (
                                      <button
                                        type="button"
                                        onClick={() => openBugFromResult(result)}
                                        className="mb-2 block rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
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
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-lg font-semibold text-slate-900">Slowest tests</h3>
                      <ul className="mt-4 space-y-3">
                        {slowestTests.length === 0 ? (
                          <li className="text-sm text-slate-500">No tests with timing data.</li>
                        ) : (
                          slowestTests.map((result) => (
                            <li key={result.id} className="rounded-xl bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium text-slate-800">{result.test_name}</p>
                                <span className="text-xs text-slate-500">{formatDuration(result.duration_ms)}</span>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-lg font-semibold text-slate-900">Flaky tests</h3>
                      <ul className="mt-4 space-y-3">
                        {flakyTests.length === 0 ? (
                          <li className="text-sm text-slate-500">No flaky tests in the last 10 runs.</li>
                        ) : (
                          flakyTests.map((item) => (
                            <li key={item.name} className="rounded-xl bg-amber-50 p-3">
                              <p className="font-medium text-slate-800">{item.name}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                Passed {item.passed} · Failed {item.failed}
                              </p>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {showImportDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Import Playwright results</h2>
                <p className="mt-1 text-sm text-slate-600">Upload the JSON report or paste it below.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportPreview(null);
                  setImportError("");
                  setImportText("");
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  JSON file
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportFileChange}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <textarea
                  value={importText}
                  onChange={(event) => {
                    setImportText(event.target.value);
                    if (event.target.value.trim()) {
                      parseImportText(event.target.value, importFileName || "playwright-report");
                    } else {
                      setImportPreview(null);
                    }
                  }}
                  rows={16}
                  placeholder="Paste Playwright report JSON here"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
                />
                {importError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <p>{importError}</p>
                    <p className="mt-2">Use: <code className="rounded bg-white px-1 py-0.5">npx playwright test --reporter=json &gt; report.json</code></p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">Preview</h3>
                {importPreview ? (
                  <>
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        Run name
                        <input
                          value={importPreview.runName}
                          onChange={(event) =>
                            setImportPreview((current) => ({
                              ...current,
                              runName: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Source
                        <select
                          value={importPreview.source}
                          onChange={(event) =>
                            setImportPreview((current) => ({
                              ...current,
                              source: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                        >
                          {sourceOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl bg-white p-2">
                        <p className="text-slate-500">Total</p>
                        <p className="mt-1 font-semibold text-slate-900">{importPreview.results.length}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-2">
                        <p className="text-emerald-700">Passed</p>
                        <p className="mt-1 font-semibold text-emerald-700">
                          {importPreview.results.filter((row) => row.status === "passed").length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-rose-50 p-2">
                        <p className="text-rose-700">Failed</p>
                        <p className="mt-1 font-semibold text-rose-700">
                          {importPreview.results.filter((row) => row.status === "failed").length}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">First 10 tests</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {importPreview.results.slice(0, 10).map((row, index) => (
                          <li key={`${row.test_name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-slate-900">{row.test_name}</span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${runStatusStyle(row.status)}`}>
                                {row.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{row.file || "No file"} · {formatDuration(row.duration_ms)}</p>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-5 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowImportDialog(false);
                          setImportPreview(null);
                          setImportError("");
                          setImportText("");
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isImporting}
                        onClick={handleSaveImport}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isImporting ? "Saving..." : "Save run"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">No valid Playwright report preview yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showManualDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Add run manually</h2>
                <p className="mt-1 text-sm text-slate-600">Add records without a Playwright JSON export.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManualDialog(false);
                  setManualRows([buildManualRow()]);
                  setManualRunName("");
                  setManualSource("local");
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Run name
                <input
                  value={manualRunName}
                  onChange={(event) => setManualRunName(event.target.value)}
                  placeholder="Regression smoke"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Source
                <select
                  value={manualSource}
                  onChange={(event) => setManualSource(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  {sourceOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full table-auto border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-slate-600">Test name</th>
                    <th className="px-2 py-2 text-slate-600">File</th>
                    <th className="px-2 py-2 text-slate-600">Status</th>
                    <th className="px-2 py-2 text-slate-600">Duration</th>
                    <th className="px-2 py-2 text-slate-600">Error message</th>
                    <th className="px-2 py-2 text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-2 py-1"><input value={row.test_name} onChange={(event) => updateManualRow(row.id, "test_name", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2" /></td>
                      <td className="px-2 py-1"><input value={row.file} onChange={(event) => updateManualRow(row.id, "file", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2" /></td>
                      <td className="px-2 py-1"><select value={row.status} onChange={(event) => updateManualRow(row.id, "status", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"><option value="passed">passed</option><option value="failed">failed</option><option value="skipped">skipped</option></select></td>
                      <td className="px-2 py-1"><input type="number" min="0" value={row.duration} onChange={(event) => updateManualRow(row.id, "duration", Number(event.target.value) || 0)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2" /></td>
                      <td className="px-2 py-1"><input value={row.error_message} onChange={(event) => updateManualRow(row.id, "error_message", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2" /></td>
                      <td className="px-2 py-1"><button type="button" onClick={() => removeManualRow(row.id)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={addManualRow} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Add row</button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualDialog(false);
                    setManualRows([buildManualRow()]);
                    setManualRunName("");
                    setManualSource("local");
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={manualSaving}
                  onClick={handleManualSave}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {manualSaving ? "Saving..." : "Save run"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
