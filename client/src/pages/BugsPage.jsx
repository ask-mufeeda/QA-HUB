import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
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
};
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

export default function BugsPage() {
  const location = useLocation();
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [screenshot, setScreenshot] = useState(null);
  const [recording, setRecording] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const automationBug = location.state?.automationBug;
    if (automationBug) {
      setForm((current) => ({
        ...current,
        title: automationBug.title || current.title,
        description: automationBug.description || current.description,
        severity: automationBug.severity || current.severity,
      }));
    }
  }, [location.state]);

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
        setBugs(data ?? []);
      }
      setLoading(false);
    }

    loadBugs();
    return () => {
      active = false;
    };
  }, [revision]);

  const summary = useMemo(
    () => ({
      open: bugs.filter((bug) => bug.status === "Open").length,
      progress: bugs.filter((bug) => bug.status === "In Progress").length,
      resolved: bugs.filter((bug) => bug.status === "Resolved").length,
    }),
    [bugs],
  );

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setFeedback({ type: "info", text: "Saving bug report..." });
    const uploadedPaths = [];
    let bugSaved = false;

    try {
      const screenshotFile = await uploadAttachment("screenshot", screenshot);
      if (screenshotFile.path) uploadedPaths.push(screenshotFile.path);
      const recordingFile = await uploadAttachment("recording", recording);
      if (recordingFile.path) uploadedPaths.push(recordingFile.path);

      const bug = {
        title: form.title.trim(),
        description: form.description.trim(),
        severity: form.severity,
        priority: form.priority,
        team: form.team || null,
        developer_email: form.developer_email.trim() || null,
        tester_email: form.tester_email.trim() || null,
        screenshot_url: screenshotFile.url,
        recording_url: recordingFile.url,
        reported_at: new Date().toISOString(),
        status: "Open",
      };
      const { error } = await supabase.from("bugs").insert(bug);
      if (error) throw error;
      bugSaved = true;

      setBugs((current) => [...current, { ...bug, id: Date.now() }]);
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
    const { error } = await supabase.from("bugs").update({ status }).eq("id", bug.id);
    if (error) {
      console.error("Could not update bug status:", error);
      setFeedback({ type: "error", text: error.message });
      return;
    }
    setBugs((current) =>
      current.map((item) => (item.id === bug.id ? { ...item, status } : item)),
    );
  }

  async function deleteBug(bug) {
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
                {["Critical", "High", "Medium", "Low"].map((item) => <option key={item}>{item}</option>)}
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
              Developer email
              <input name="developer_email" type="email" value={form.developer_email} onChange={updateForm} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-800 sm:col-span-2">
              Tester email
              <input name="tester_email" type="email" value={form.tester_email} onChange={updateForm} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
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
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading bug reports...</p>
          ) : bugs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No bug reports yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {["ID / title", "Severity", "Priority", "Team", "Developer", "Reported", "Evidence", "Status", "Action"].map((item) => (
                      <th key={item} className="px-3 py-3 font-semibold">{item}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bugs.map((bug) => (
                    <tr key={bug.id} className="align-top">
                      <td className="max-w-48 px-3 py-4">
                        <p className="text-xs text-slate-500">#{bug.id}</p>
                        <p className="mt-1 font-medium text-slate-900">{bug.title}</p>
                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{bug.description}</p>
                      </td>
                      <td className="px-3 py-4 text-xs">{bug.severity}</td>
                      <td className="px-3 py-4 text-xs">{bug.priority}</td>
                      <td className="px-3 py-4 text-xs">{bug.team || "Unassigned"}</td>
                      <td className="px-3 py-4 text-xs">{bug.developer_email || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-500">
                        {bug.reported_at ? new Date(bug.reported_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-4 text-xs">
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
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                        >
                          {statuses.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-4">
                        <button type="button" onClick={() => deleteBug(bug)} className="text-xs font-semibold text-rose-600 hover:text-rose-800">
                          Delete
                        </button>
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
