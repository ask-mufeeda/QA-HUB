import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { downloadCsv } from "../lib/csv.js";
import { supabase } from "../lib/supabase.js";

const initialForm = {
  title: "",
  description: "",
  severity: "Medium",
  priority: "Medium",
  team: "",
  developer_email: "",
  tester_email: "",
  test_case_id: null,
};
const defaultStatusHistory = (bug) => [
  {
    id: `${bug.id ?? "new"}-created`,
    label: "Created",
    status: bug.status || "Open",
    at: bug.reported_at || new Date().toISOString(),
  },
];
const fileTypes = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"];
const statuses = ["Open", "In Progress", "Resolved"];
const fileLimit = 20 * 1024 * 1024;

async function uploadAttachment(kind, file) {
  if (!file) return { url: null, path: null };
  if (!fileTypes.includes(file.type)) {
    throw new Error(`${kind} must be a PNG, JPEG, WEBP, MP4, or WEBM file.`);
  }
  if (file.size > fileLimit) {
    throw new Error(`${kind} must be smaller than 20 MB.`);
  }

  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
  const path = `${kind}/${crypto.randomUUID()}.${extension}`;
  const storage = supabase.storage.from("bug-attachments");
  const { error } = await storage.upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = storage.getPublicUrl(path);
  return { url: data.publicUrl, path };
}

function formatTestCaseRef(testCaseId) {
  if (!testCaseId) return "—";
  const value = String(testCaseId).slice(-6);
  return `TC-${value}`;
}

export default function BugsPage() {
  const location = useLocation();
  const { user, role } = useAuth();
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [screenshot, setScreenshot] = useState(null);
  const [recording, setRecording] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [revision, setRevision] = useState(0);
  const [userOptions, setUserOptions] = useState([]);
  const [bugSearch, setBugSearch] = useState("");
  const [bugStatusFilter, setBugStatusFilter] = useState("All statuses");
  const [bugSeverityFilter, setBugSeverityFilter] = useState("All severities");
  const [bugAssigneeFilter, setBugAssigneeFilter] = useState("All assignees");
  const [selectedBugId, setSelectedBugId] = useState(null);
  const [bugDetailMap, setBugDetailMap] = useState({});
  const [commentDraft, setCommentDraft] = useState("");
  const [supportsBugOwnership, setSupportsBugOwnership] = useState(false);

  useEffect(() => {
    const prefill = location.state?.bugPrefill ?? location.state?.automationBug;
    if (prefill) {
      setForm((current) => ({
        ...current,
        title: prefill.title || current.title,
        description: prefill.description || current.description,
        severity: prefill.severity || current.severity,
        test_case_id: prefill.test_case_id ?? current.test_case_id ?? null,
      }));
    }
  }, [location.state]);

  useEffect(() => {
    let active = true;

    async function loadProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email")
        .not("email", "is", null)
        .order("email", { ascending: true });

      if (!active) return;
      if (error) {
        console.error("Could not load users:", error);
        return;
      }
      setUserOptions(data ?? []);
    }

    async function detectBugOwnershipSupport() {
      const { error } = await supabase
        .from("bugs")
        .select("created_by, assigned_to")
        .limit(1);

      if (!active) return;
      if (error && /column .*created_by.* does not exist|column .*assigned_to.* does not exist|42703/i.test(error.message || "")) {
        setSupportsBugOwnership(false);
        return;
      }
      setSupportsBugOwnership(!error);
    }

    loadProfiles();
    detectBugOwnershipSupport();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBugs() {
      setLoading(true);
      const { data, error } = await supabase
        .from("bugs")
        .select("*")
        .order("id", { ascending: true });
      if (!active) return;
      if (error) {
        console.error("Could not load bugs:", error);
        setFeedback({ type: "error", text: error.message });
      } else {
        const normalizedBugs = (data ?? []).filter((bug) => {
          if (role === "admin") return true;
          if (role === "developer") {
            return (
              bug.assigned_to === user?.id ||
              bug.developer_email?.toLowerCase() === user?.email?.toLowerCase()
            );
          }
          if (role === "tester") {
            return (
              bug.created_by === user?.id ||
              bug.tester_email?.toLowerCase() === user?.email?.toLowerCase()
            );
          }
          return false;
        });

        setBugs(normalizedBugs);
        setBugDetailMap((current) => {
          const next = { ...current };
          for (const bug of normalizedBugs) {
            if (!next[bug.id]) {
              next[bug.id] = {
                statusHistory: defaultStatusHistory(bug),
                comments: [],
              };
            }
          }
          return next;
        });
      }
      setLoading(false);
    }

    loadBugs();
    return () => {
      active = false;
    };
  }, [revision, role, user?.email, user?.id]);

  const summary = useMemo(
    () => ({
      open: bugs.filter((bug) => bug.status === "Open").length,
      progress: bugs.filter((bug) => bug.status === "In Progress").length,
      resolved: bugs.filter((bug) => bug.status === "Resolved").length,
    }),
    [bugs],
  );

  const assigneeOptions = useMemo(
    () =>
      [...new Set([...(bugs.map((bug) => bug.developer_email ?? "") ?? []), ...(bugs.map((bug) => bug.tester_email ?? "") ?? [])].filter(Boolean))].sort(),
    [bugs],
  );

  const visibleBugs = useMemo(() => {
    const term = bugSearch.trim().toLowerCase();
    return [...bugs]
      .filter((bug) => {
        const matchesStatus =
          bugStatusFilter === "All statuses" || (bug.status ?? "Open") === bugStatusFilter;
        const matchesSeverity =
          bugSeverityFilter === "All severities" || (bug.severity ?? "Medium") === bugSeverityFilter;
        const assignee = bug.developer_email || bug.tester_email || "";
        const matchesAssignee =
          bugAssigneeFilter === "All assignees" || assignee === bugAssigneeFilter;
        const matchesSearch =
          !term ||
          `${bug.title ?? ""} ${bug.description ?? ""} ${assignee}`
            .toLowerCase()
            .includes(term);
        return matchesStatus && matchesSeverity && matchesAssignee && matchesSearch;
      })
      .sort((left, right) => Number(left.id) - Number(right.id));
  }, [bugs, bugAssigneeFilter, bugSearch, bugSeverityFilter, bugStatusFilter]);

  const selectedBug = bugs.find((bug) => bug.id === selectedBugId) ?? null;
  const selectedBugDetail = selectedBug ? bugDetailMap[selectedBug.id] ?? { statusHistory: [], comments: [] } : null;

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function addHistoryEntry(bugId, status, label = "Updated") {
    setBugDetailMap((current) => {
      const history = current[bugId]?.statusHistory ?? defaultStatusHistory({ id: bugId, status, reported_at: new Date().toISOString() });
      const nextEntry = {
        id: `${bugId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        label,
        status,
        at: new Date().toISOString(),
      };
      return {
        ...current,
        [bugId]: {
          ...(current[bugId] ?? { comments: [] }),
          statusHistory: [...history, nextEntry],
        },
      };
    });
  }

  function addComment(bugId, text) {
    const message = text.trim();
    if (!message) return;

    setBugDetailMap((current) => ({
      ...current,
      [bugId]: {
        ...(current[bugId] ?? { statusHistory: [] }),
        comments: [
          ...(current[bugId]?.comments ?? []),
          {
            id: `${bugId}-comment-${Date.now()}`,
            author: "You",
            text: message,
            at: new Date().toISOString(),
          },
        ],
      },
    }));
    setCommentDraft("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setFeedback({ type: "info", text: "Saving bug report..." });
    const uploadedPaths = [];
    let bugSaved = false;

    try {
      const title = form.title.trim();
      const description = form.description.trim();

      if (title.length < 5) {
        throw new Error("Bug title must be at least 5 characters long.");
      }
      if (!description) {
        throw new Error("Please add a description of the bug and how to reproduce it.");
      }

      const screenshotFile = await uploadAttachment("screenshot", screenshot);
      if (screenshotFile.path) uploadedPaths.push(screenshotFile.path);
      const recordingFile = await uploadAttachment("recording", recording);
      if (recordingFile.path) uploadedPaths.push(recordingFile.path);

      const assignedDeveloper = userOptions.find((option) => option.email === form.developer_email.trim());
      const bug = {
        title,
        description,
        severity: form.severity || "Medium",
        priority: form.priority,
        team: form.team || null,
        developer_email: form.developer_email.trim() || null,
        tester_email: form.tester_email.trim() || null,
        screenshot_url: screenshotFile.url,
        recording_url: recordingFile.url,
        reported_at: new Date().toISOString(),
        status: "Open",
        ...(supportsBugOwnership && user?.id ? { created_by: user.id } : {}),
        ...(supportsBugOwnership && assignedDeveloper?.id ? { assigned_to: assignedDeveloper.id } : {}),
      };
      const { data: insertedBug, error } = await supabase.from("bugs").insert(bug).select().single();
      if (error) throw error;
      bugSaved = true;

      const savedBug = insertedBug ?? { ...bug, id: Date.now() };
      setBugs((current) => [...current, savedBug]);
      setBugDetailMap((current) => ({
        ...current,
        [savedBug.id]: {
          statusHistory: defaultStatusHistory(savedBug),
          comments: [],
        },
      }));
      setSelectedBugId(savedBug.id);
      setForm(initialForm);
      setScreenshot(null);
      setRecording(null);
      formElement.reset();
      setRevision((value) => value + 1);

      if (bug.developer_email) {
        try {
          const { data, error: notificationError } = await supabase.functions.invoke(
            "rapid-worker",
            {
              body: {
                developerEmail: bug.developer_email,
                bugTitle: bug.title,
                description: bug.description,
                severity: bug.severity,
                priority: bug.priority,
              },
            },
          );
          if (notificationError) throw notificationError;
          if (data?.success !== true) {
            throw new Error("Developer notification returned an unsuccessful response.");
          }
        } catch (notificationError) {
          console.error(
            "Bug saved, but developer notification failed:",
            notificationError,
          );
          setFeedback({
            type: "success",
            text: "Bug report saved, but the developer notification could not be sent.",
          });
          return;
        }
      }

      setFeedback({ type: "success", text: "Bug report saved." });
    } catch (error) {
      console.error("Could not save bug report:", error);
      if (!bugSaved && uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage
          .from("bug-attachments")
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error("Could not clean up uploaded bug attachments:", cleanupError);
        }
      }
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save the bug report.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(bug, status) {
    const canUpdate =
      role === "admin" ||
      bug.created_by === user?.id ||
      bug.assigned_to === user?.id ||
      bug.developer_email?.toLowerCase() === user?.email?.toLowerCase() ||
      bug.tester_email?.toLowerCase() === user?.email?.toLowerCase();

    if (!canUpdate) {
      setFeedback({ type: "error", text: "You do not have permission to update this bug." });
      return;
    }

    const { error } = await supabase.from("bugs").update({ status }).eq("id", bug.id);
    if (error) {
      console.error("Could not update bug status:", error);
      setFeedback({ type: "error", text: error.message });
      return;
    }
    setBugs((current) =>
      current.map((item) => (item.id === bug.id ? { ...item, status } : item)),
    );
    addHistoryEntry(bug.id, status, "Status changed");
  }

  async function deleteBug(bug) {
    if (role !== "admin") {
      setFeedback({ type: "error", text: "Only admins can delete bug reports." });
      return;
    }

    if (!window.confirm(`Delete "${bug.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("bugs").delete().eq("id", bug.id);
    if (error) {
      console.error("Could not delete bug:", error);
      setFeedback({ type: "error", text: error.message });
      return;
    }
    setBugs((current) => current.filter((item) => item.id !== bug.id));
    setFeedback({ type: "success", text: "Bug report deleted." });
  }

  function exportBugs() {
    const rows = bugs.map((bug) => ({
      "Bug ID": bug.id,
      "Bug Title": bug.title,
      Description: bug.description,
      Severity: bug.severity,
      Priority: bug.priority,
      "Assigned Team": bug.team,
      "Developer Email": bug.developer_email,
      "Tester Email": bug.tester_email,
      "Reported Date": bug.reported_at,
      "Screenshot URL": bug.screenshot_url,
      "Recording URL": bug.recording_url,
      Status: bug.status,
    }));
    downloadCsv(
      `qa-hub-bugs-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Bug ID",
        "Bug Title",
        "Description",
        "Severity",
        "Priority",
        "Assigned Team",
        "Developer Email",
        "Tester Email",
        "Reported Date",
        "Screenshot URL",
        "Recording URL",
        "Status",
      ],
      rows,
      { protectFormula: true },
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Issue management"
        title="Bug tracker"
        description="Report defects with reproducible details and follow each issue to resolution."
        actions={
          <button
            type="button"
            onClick={exportBugs}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        }
      />
      <Feedback message={feedback?.text} type={feedback?.type} />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Open", summary.open],
          ["In progress", summary.progress],
          ["Resolved", summary.resolved],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Report a bug</h2>
            <p className="mt-1 text-sm text-slate-500">
              Include what happened and how to reproduce it.
            </p>
          </div>
          <div>
            <label htmlFor="bug-title" className="mb-1.5 block text-sm font-medium text-slate-800">
              Bug title
            </label>
            <input
              id="bug-title"
              name="title"
              required
              minLength={5}
              value={form.title}
              onChange={updateForm}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="bug-description" className="mb-1.5 block text-sm font-medium text-slate-800">
              Description and steps to reproduce
            </label>
            <textarea
              id="bug-description"
              name="description"
              required
              rows={5}
              value={form.description}
              onChange={updateForm}
              className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Severity
              <select name="severity" value={form.severity} onChange={updateForm} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                {["Low", "Medium", "High", "Critical"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-800">
              Priority
              <select name="priority" value={form.priority} onChange={updateForm} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                {["High", "Medium", "Low"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-800">
              Team
              <select name="team" value={form.team} onChange={updateForm} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                <option value="">Unassigned</option>
                {["Frontend", "Backend", "Database"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
           <label className="text-sm font-medium text-slate-800">
  Developer
  <input
    type="email"
    name="developer_email"
    list="developer-email-options"
    value={form.developer_email || ""}
    onChange={updateForm}
    placeholder="Enter developer email"
    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
  />
  <datalist id="developer-email-options">
    {userOptions.map((user) => (
      <option key={user.id} value={user.email} />
    ))}
  </datalist>
</label>
            <label className="text-sm font-medium text-slate-800 sm:col-span-2">
              Tester
              <select name="tester_email" value={form.tester_email} onChange={updateForm} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                <option value="">Unassigned</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Screenshot <span className="font-normal text-slate-500">(optional, max 20 MB)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setScreenshot(event.target.files?.[0] ?? null)}
                className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Recording <span className="font-normal text-slate-500">(optional, max 20 MB)</span>
              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={(event) => setRecording(event.target.files?.[0] ?? null)}
                className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Saving report..." : "Submit bug report"}
          </button>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-4">
            <h2 className="font-semibold text-slate-900">Reported bugs</h2>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-3">
            <input
              type="search"
              value={bugSearch}
              onChange={(event) => setBugSearch(event.target.value)}
              placeholder="Search bugs"
              className="w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
            />
            <select
              value={bugStatusFilter}
              onChange={(event) => setBugStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              <option>All statuses</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <select
              value={bugSeverityFilter}
              onChange={(event) => setBugSeverityFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              <option>All severities</option>
              {["Low", "Medium", "High", "Critical"].map((severity) => (
                <option key={severity}>{severity}</option>
              ))}
            </select>
            <select
              value={bugAssigneeFilter}
              onChange={(event) => setBugAssigneeFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              <option>All assignees</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee}>{assignee}</option>
              ))}
            </select>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading bug reports...</p>
          ) : bugs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No bug reports yet.</p>
          ) : visibleBugs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No bug reports match your filters.</p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      {["ID / title", "Severity", "Priority", "Team", "Developer", "Reported", "Evidence", "Status", "Action"].map((item) => (
                        <th key={item} className="px-3 py-3 font-semibold">{item}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleBugs.map((bug) => (
                      <tr key={bug.id} className="align-top">
                        <td className="max-w-[15rem] px-3 py-4">
                          <p className="text-[11px] text-slate-500">#{bug.id}</p>
                          {bug.test_case_id && (
                            <p className="mt-1 text-[11px] font-medium text-indigo-600">
                              From {formatTestCaseRef(bug.test_case_id)}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedBugId(bug.id)}
                            className="mt-1 block break-words text-left font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {bug.title}
                          </button>
                          <p className="mt-1 line-clamp-3 break-words text-[11px] leading-5 text-slate-500">{bug.description}</p>
                        </td>
                        <td className="px-3 py-4 text-[11px]">{bug.severity}</td>
                        <td className="px-3 py-4 text-[11px]">{bug.priority}</td>
                        <td className="px-3 py-4 text-[11px]">{bug.team || "Unassigned"}</td>
                        <td className="px-3 py-4 text-[11px]">{bug.developer_email || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-[11px] text-slate-500">
                          {bug.reported_at ? new Date(bug.reported_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-4 text-[11px]">
                          <div className="flex flex-col gap-1">
                            {bug.screenshot_url && <a className="text-indigo-600 hover:underline" href={bug.screenshot_url} target="_blank" rel="noreferrer">Screenshot</a>}
                            {bug.recording_url && <a className="text-indigo-600 hover:underline" href={bug.recording_url} target="_blank" rel="noreferrer">Recording</a>}
                            {!bug.screenshot_url && !bug.recording_url && "—"}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <select
                            aria-label={`Status for bug ${bug.id}`}
                            value={bug.status || "Open"}
                            onChange={(event) => updateStatus(bug, event.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px]"
                          >
                            {statuses.map((status) => <option key={status}>{status}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-4">
                          {role === "admin" ? (
                            <button type="button" onClick={() => deleteBug(bug)} className="text-[11px] font-semibold text-rose-600 hover:text-rose-800">
                              Delete
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedBug && selectedBugDetail && (
                <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Bug details</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">#{selectedBug.id} · {selectedBug.title}</h3>
                    </div>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                      {selectedBug.status || "Open"}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Severity</dt>
                      <dd className="font-medium text-slate-900">{selectedBug.severity}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Priority</dt>
                      <dd className="font-medium text-slate-900">{selectedBug.priority}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Developer</dt>
                      <dd className="font-medium text-slate-900">{selectedBug.developer_email || "Unassigned"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Tester</dt>
                      <dd className="font-medium text-slate-900">{selectedBug.tester_email || "Unassigned"}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">Description</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedBug.description}</p>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-900">Status history</p>
                    <ul className="mt-2 space-y-2">
                      {(selectedBugDetail.statusHistory ?? []).map((entry) => (
                        <li key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900">{entry.label}</span>
                            <span className="text-[11px] text-slate-500">{new Date(entry.at).toLocaleString()}</span>
                          </div>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-indigo-600">{entry.status}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-900">Comments</p>
                    <div className="mt-2 space-y-2">
                      {(selectedBugDetail.comments ?? []).length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                          No comments yet.
                        </p>
                      ) : (
                        (selectedBugDetail.comments ?? []).map((comment) => (
                          <div key={comment.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-900">{comment.author}</span>
                              <span className="text-[11px] text-slate-500">{new Date(comment.at).toLocaleString()}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap leading-6">{comment.text}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        placeholder="Add a comment"
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => addComment(selectedBug.id, commentDraft)}
                        className="rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
