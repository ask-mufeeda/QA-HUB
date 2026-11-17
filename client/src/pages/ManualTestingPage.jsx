import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { downloadCsv } from "../lib/csv.js";
import { supabase } from "../lib/supabase.js";

const emptyCase = {
  title: "",
  module: "",
  preconditions: "",
  steps: "",
  expected_result: "",
  actual_result: "",
  status: "Not Run",
};
const statuses = ["Not Run", "Pass", "Fail"];

function toStepsText(steps) {
  if (Array.isArray(steps)) {
    return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  }
  return String(steps ?? "");
}

function formatTestCaseRef(testCaseId) {
  if (!testCaseId) return "—";
  const value = String(testCaseId).slice(-6);
  return `TC-${value}`;
}

export default function ManualTestingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyCase);
  const [editingId, setEditingId] = useState(null);
  const [filterModule, setFilterModule] = useState("All modules");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("Not Run");
  const [feedback, setFeedback] = useState(null);
  const [revision, setRevision] = useState(0);
  const [aiModule, setAiModule] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCases, setGeneratedCases] = useState([]);
  const [savingGenerated, setSavingGenerated] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCases() {
      setLoading(true);
      const [casesResult, bugsResult] = await Promise.all([
        supabase
          .from("test_cases")
          .select("*")
          .eq("created_by", user.id)
          .order("id", { ascending: true }),
        supabase.from("bugs").select("id, test_case_id"),
      ]);

      if (!active) return;
      if (casesResult.error) {
        console.error("Could not load test cases:", casesResult.error);
        setFeedback({ type: "error", text: casesResult.error.message });
      } else {
        setCases(casesResult.data ?? []);
      }
      if (bugsResult.error) {
        console.error("Could not load linked bugs:", bugsResult.error);
      } else {
        setBugs(bugsResult.data ?? []);
      }
      setLoading(false);
    }

    loadCases();
    return () => {
      active = false;
    };
  }, [user.id, revision]);

  const linkedBugsByCaseId = useMemo(
    () =>
      bugs.reduce((result, bug) => {
        if (bug.test_case_id) {
          result.set(bug.test_case_id, bug);
        }
        return result;
      }, new Map()),
    [bugs],
  );

  const modules = useMemo(
    () => [...new Set(cases.map((testCase) => testCase.module).filter(Boolean))].sort(),
    [cases],
  );
  const visibleCases = useMemo(() => {
    const normalizedValue = searchTerm.trim().toLowerCase();
    const filtered = cases.filter((testCase) => {
      const matchesModule =
        filterModule === "All modules" || testCase.module === filterModule;
      const matchesStatus =
        statusFilter === "All statuses" || (testCase.status ?? "Not Run") === statusFilter;
      const haystack = [testCase.title, testCase.module, testCase.steps, testCase.expected_result]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !normalizedValue || haystack.includes(normalizedValue);
      return matchesModule && matchesStatus && matchesSearch;
    });

    const sorted = [...filtered].sort((left, right) => {
      const leftValue = left[sortField] ?? "";
      const rightValue = right[sortField] ?? "";
      const a = typeof leftValue === "string" ? leftValue.toLowerCase() : leftValue;
      const b = typeof rightValue === "string" ? rightValue.toLowerCase() : rightValue;

      if (typeof a === "number" && typeof b === "number") {
        return sortDirection === "asc" ? a - b : b - a;
      }

      if (a < b) return sortDirection === "asc" ? -1 : 1;
      if (a > b) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [cases, filterModule, searchTerm, sortDirection, sortField, statusFilter]);
  const passCount = cases.filter((testCase) => testCase.status === "Pass").length;
  const failCount = cases.filter((testCase) => testCase.status === "Fail").length;
  const notRunCount = cases.filter((testCase) => testCase.status === "Not Run").length;
  const passRate = cases.length
    ? Math.round((passCount / cases.length) * 100)
    : 0;

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function resetForm() {
    setForm(emptyCase);
    setEditingId(null);
  }

  function toggleSelectedCase(testCaseId) {
    setSelectedIds((current) =>
      current.includes(testCaseId)
        ? current.filter((id) => id !== testCaseId)
        : [...current, testCaseId],
    );
  }

  function toggleAllVisibleCases() {
    const allVisibleIds = visibleCases.map((testCase) => testCase.id);
    setSelectedIds((current) =>
      allVisibleIds.every((id) => current.includes(id))
        ? current.filter((id) => !allVisibleIds.includes(id))
        : [...new Set([...current, ...allVisibleIds])],
    );
  }

  async function bulkUpdateStatus() {
    if (!selectedIds.length) return;
    const { error } = await supabase
      .from("test_cases")
      .update({ status: bulkStatus })
      .in("id", selectedIds)
      .eq("created_by", user.id);

    if (error) {
      console.error("Could not bulk update test cases:", error);
      setFeedback({ type: "error", text: error.message });
      return;
    }

    setCases((current) =>
      current.map((testCase) =>
        selectedIds.includes(testCase.id) ? { ...testCase, status: bulkStatus } : testCase,
      ),
    );
    setSelectedIds([]);
    setFeedback({ type: "success", text: `Updated ${selectedIds.length} test cases.` });
  }

  function handleSort(field) {
    setSortDirection((current) => {
      if (sortField === field) {
        return current === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortField(field);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback({ type: "info", text: editingId ? "Saving test case..." : "Creating test case..." });

    const payload = {
      title: form.title.trim(),
      module: form.module.trim(),
      preconditions: form.preconditions.trim(),
      steps: form.steps.trim(),
      expected_result: form.expected_result.trim(),
      actual_result: form.actual_result.trim(),
      status: form.status,
    };

    try {
      const result = editingId
        ? await supabase
            .from("test_cases")
            .update(payload)
            .eq("id", editingId)
            .eq("created_by", user.id)
        : await supabase
            .from("test_cases")
            .insert({ ...payload, created_by: user.id });

      if (result.error) throw result.error;
      setFeedback({ type: "success", text: editingId ? "Test case updated." : "Test case created." });
      resetForm();
      setRevision((value) => value + 1);
    } catch (error) {
      console.error("Could not save test case:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save the test case.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(testCase, status) {
    setFeedback(null);
    const { error } = await supabase
      .from("test_cases")
      .update({ status })
      .eq("id", testCase.id)
      .eq("created_by", user.id);
    if (error) {
      console.error("Could not update test case status:", error);
      setFeedback({ type: "error", text: error.message });
      return;
    }
    setCases((current) =>
      current.map((item) => (item.id === testCase.id ? { ...item, status } : item)),
    );
  }

  function openCreateBugForCase(testCase) {
    const caseId = formatTestCaseRef(testCase.test_case_id ?? testCase.id);
    const title = `[${caseId}] ${testCase.title || "Test case"} failed`;
    const description = [
      `Steps:\n${testCase.steps || "No steps were recorded."}`,
      `Expected result:\n${testCase.expected_result || "No expected result was recorded."}`,
      `Actual result:\n${testCase.actual_result || "No actual result was recorded."}`,
    ].join("\n\n");

    navigate("/bugs", {
      state: {
        bugPrefill: {
          title,
          description,
          severity: "Medium",
          test_case_id: testCase.id,
        },
      },
    });
  }

  function beginEdit(testCase) {
    setEditingId(testCase.id);
    setForm({
      title: testCase.title ?? "",
      module: testCase.module ?? "",
      preconditions: testCase.preconditions ?? "",
      steps: toStepsText(testCase.steps),
      expected_result: testCase.expected_result ?? "",
      actual_result: testCase.actual_result ?? "",
      status: testCase.status ?? "Not Run",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteCase(testCase) {
    if (!window.confirm(`Delete "${testCase.title}"? This cannot be undone.`)) return;
    const { error } = await supabase
      .from("test_cases")
      .delete()
      .eq("id", testCase.id)
      .eq("created_by", user.id);

    if (error) {
      console.error("Could not delete test case:", error);
      setFeedback({ type: "error", text: error.message });
      return;
    }
    setCases((current) => current.filter((item) => item.id !== testCase.id));
    setFeedback({ type: "success", text: "Test case deleted." });
  }

  async function generateCases(event) {
    event.preventDefault();
    setGenerating(true);
    setGeneratedCases([]);
    setFeedback({ type: "info", text: "Generating test cases..." });
    try {
      const { data, error } = await supabase.functions.invoke("smart-handler", {
        body: { module: aiModule, prompt: aiPrompt, count: 10 },
      });
      if (error) throw error;
      const generated = data?.result?.test_cases;
      if (!data?.success || !Array.isArray(generated) || generated.length === 0) {
        throw new Error(data?.error || "No test cases were returned.");
      }
      setGeneratedCases(generated);
      setFeedback({ type: "success", text: `${generated.length} test cases generated.` });
    } catch (error) {
      console.error("Could not generate test cases:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Could not generate test cases.",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function saveGeneratedCases() {
    setSavingGenerated(true);
    try {
      const rows = generatedCases.map((item) => ({
        title: String(item.title ?? "Generated test case"),
        module: aiModule.trim(),
        preconditions: String(item.preconditions ?? ""),
        steps: toStepsText(item.steps),
        expected_result: String(item.expected_result ?? ""),
        actual_result: "",
        status: "Not Run",
        created_by: user.id,
      }));
      const { error } = await supabase.from("test_cases").insert(rows);
      if (error) throw error;
      setGeneratedCases([]);
      setFeedback({ type: "success", text: `${rows.length} generated cases saved.` });
      setRevision((value) => value + 1);
    } catch (error) {
      console.error("Could not save generated cases:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save generated cases.",
      });
    } finally {
      setSavingGenerated(false);
    }
  }

  function exportCases() {
    const rows = visibleCases.map((item) => ({
      "Test Case ID": item.test_case_id ?? item.id,
      Title: item.title,
      Module: item.module,
      Preconditions: item.preconditions,
      Steps: item.steps,
      "Expected Result": item.expected_result,
      "Actual Result": item.actual_result,
      Status: item.status,
    }));
    const suffix =
      filterModule === "All modules"
        ? "all-modules"
        : filterModule.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadCsv(`test-cases-${suffix}.csv`, Object.keys(rows[0] ?? {
      "Test Case ID": "",
      Title: "",
      Module: "",
      Preconditions: "",
      Steps: "",
      "Expected Result": "",
      "Actual Result": "",
      Status: "",
    }), rows);
  }

  return (
    <>
      <PageHeader
        eyebrow="Testing"
        title="Manual test cases"
        description="Create and execute test cases, track outcomes, and generate starter cases with AI."
        actions={
          <button
            type="button"
            onClick={exportCases}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        }
      />

      <Feedback message={feedback?.text} type={feedback?.type} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total cases", cases.length],
          ["Passed", passCount],
          ["Failed", failCount],
          ["Not run", notRunCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">Pass rate: {passRate}%</p>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit test case" : "Create a test case"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Keep each case focused and easy to reproduce.
              </p>
            </div>
            {[
              ["title", "Title", "text", true],
              ["module", "Module", "text", true],
            ].map(([name, label, type, required]) => (
              <div key={name}>
                <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-800">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  required={required}
                  value={form[name]}
                  onChange={updateForm}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            ))}
            {[
              ["preconditions", "Preconditions", 2],
              ["steps", "Steps", 4],
              ["expected_result", "Expected result", 2],
              ["actual_result", "Actual result", 2],
            ].map(([name, label, rows]) => (
              <div key={name}>
                <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-800">
                  {label}
                  {["steps", "expected_result"].includes(name) && " *"}
                </label>
                <textarea
                  id={name}
                  name={name}
                  rows={rows}
                  required={["steps", "expected_result"].includes(name)}
                  value={form[name]}
                  onChange={updateForm}
                  className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            ))}
            <div>
              <label htmlFor="case-status" className="mb-1.5 block text-sm font-medium text-slate-800">
                Status
              </label>
              <select
                id="case-status"
                name="status"
                value={form.status}
                onChange={updateForm}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Add test case"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <form
            onSubmit={generateCases}
            className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Generate with AI</h2>
              <p className="mt-1 text-sm text-slate-600">
                Generated cases can be reviewed before saving.
              </p>
            </div>
            <div>
              <label htmlFor="ai-module" className="mb-1.5 block text-sm font-medium text-slate-800">
                Module
              </label>
              <input
                id="ai-module"
                required
                value={aiModule}
                onChange={(event) => setAiModule(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ai-prompt" className="mb-1.5 block text-sm font-medium text-slate-800">
                Feature or scenario
              </label>
              <textarea
                id="ai-prompt"
                required
                rows={3}
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={generating}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {generating ? "Generating..." : "Generate test cases"}
            </button>
            {generatedCases.length > 0 && (
              <div className="space-y-3">
                <div className="max-h-64 space-y-3 overflow-auto">
                  {generatedCases.map((item, index) => (
                    <article key={`${item.title}-${index}`} className="rounded-xl bg-white p-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {item.title || `Generated case ${index + 1}`}
                      </h3>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">
                        {toStepsText(item.steps)}
                      </p>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={saveGeneratedCases}
                  disabled={savingGenerated}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {savingGenerated ? "Saving..." : `Save ${generatedCases.length} cases`}
                </button>
              </div>
            )}
          </form>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <h2 className="font-semibold text-slate-900">Your test cases</h2>
              <p className="mt-1 text-xs text-slate-500">{visibleCases.length} shown</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search cases"
                className="w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
              />
              <select
                value={filterModule}
                onChange={(event) => setFilterModule(event.target.value)}
                className="max-w-44 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
              >
                <option>All modules</option>
                {modules.map((module) => (
                  <option key={module}>{module}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="max-w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
              >
                <option>All statuses</option>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {selectedIds.length} selected
              </span>
              <select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={bulkUpdateStatus}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Update selected
              </button>
            </div>
          )}
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading test cases...</p>
          ) : visibleCases.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No test cases found for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={
                          visibleCases.length > 0 &&
                          visibleCases.every((testCase) => selectedIds.includes(testCase.id))
                        }
                        onChange={toggleAllVisibleCases}
                        aria-label="Select all visible test cases"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                    </th>
                    {[
                      { label: "ID", field: "id" },
                      { label: "Title / Module", field: "title" },
                      { label: "Steps", field: "steps" },
                      { label: "Expected", field: "expected_result" },
                      { label: "Status", field: "status" },
                      { label: "Actions", field: "actions" },
                    ].map(({ label, field }) => (
                      <th
                        key={label}
                        className="px-3 py-3 font-semibold"
                        style={field !== "actions" ? { cursor: "pointer" } : undefined}
                        onClick={field !== "actions" ? () => handleSort(field) : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {field !== "actions" && sortField === field && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleCases.map((testCase) => (
                    <tr key={testCase.id} className="align-top">
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(testCase.id)}
                          onChange={() => toggleSelectedCase(testCase.id)}
                          aria-label={`Select ${testCase.title}`}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-[11px] text-slate-500">
                        {testCase.test_case_id ?? testCase.id}
                      </td>
                      <td className="max-w-[15rem] px-3 py-4">
                        <p className="break-words font-medium text-slate-900">{testCase.title}</p>
                        <p className="mt-1 break-words text-[11px] text-slate-500">{testCase.module}</p>
                      </td>
                      <td className="max-w-[14rem] whitespace-pre-wrap px-3 py-4 text-[11px] leading-5 text-slate-600">
                        {testCase.steps}
                      </td>
                      <td className="max-w-[12rem] px-3 py-4 text-[11px] leading-5 text-slate-600">
                        {testCase.expected_result}
                      </td>
                      <td className="px-3 py-4">
                        <select
                          aria-label={`Status for ${testCase.title}`}
                          value={testCase.status ?? "Not Run"}
                          onChange={(event) => changeStatus(testCase, event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px]"
                        >
                          {statuses.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          {testCase.status === "Fail" ? (
                            linkedBugsByCaseId.has(testCase.id) ? (
                              <Link
                                to="/bugs"
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                              >
                                Bug #{linkedBugsByCaseId.get(testCase.id)?.id}
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCreateBugForCase(testCase)}
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800"
                              >
                                Create bug
                              </button>
                            )
                          ) : null}
                          <button
                            type="button"
                            onClick={() => beginEdit(testCase)}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCase(testCase)}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-800"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
