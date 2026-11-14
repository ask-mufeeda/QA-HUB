import { useCallback, useEffect, useState } from "react";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { supabase } from "../lib/supabase.js";

const priorities = ["Critical", "High", "Medium", "Low"];
const statuses = ["Open", "In Progress", "Resolved"];
const teams = ["Frontend", "Backend", "Database"];

export default function AdminPage() {
  const [bugs, setBugs] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [revision, setRevision] = useState(0);

  const loadBugs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bugs")
      .select("*")
      .order("id", { ascending: false });
    if (error) {
      console.error("Could not load admin bug list:", error);
      setFeedback({ type: "error", text: error.message });
    } else {
      const items = data ?? [];
      setBugs(items);
      setDrafts(
        Object.fromEntries(
          items.map((bug) => [
            bug.id,
            {
              developer_email: bug.developer_email ?? "",
              team: bug.team ?? "",
              priority: bug.priority ?? "Medium",
              status: bug.status ?? "Open",
            },
          ]),
        ),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBugs();
  }, [loadBugs, revision]);

  function updateDraft(id, field, value) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  async function saveBug(bug) {
    const draft = drafts[bug.id];
    if (draft.developer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.developer_email)) {
      setFeedback({ type: "error", text: `Enter a valid developer email for bug #${bug.id}.` });
      return;
    }
    setSavingId(bug.id);
    setFeedback(null);
    const { error } = await supabase
      .from("bugs")
      .update({
        developer_email: draft.developer_email.trim() || null,
        team: draft.team || null,
        priority: draft.priority,
        status: draft.status,
      })
      .eq("id", bug.id);

    if (error) {
      console.error("Could not update bug assignment:", error);
      setFeedback({ type: "error", text: error.message });
    } else {
      setBugs((current) =>
        current.map((item) =>
          item.id === bug.id
            ? {
                ...item,
                developer_email: draft.developer_email.trim() || null,
                team: draft.team || null,
                priority: draft.priority,
                status: draft.status,
              }
            : item,
        ),
      );
      setFeedback({ type: "success", text: `Bug #${bug.id} updated.` });
    }
    setSavingId(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Bug assignments"
        description="Review all reported bugs and assign a developer, team, priority, and status."
        actions={
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        }
      />
      <Feedback message={feedback?.text} type={feedback?.type} />

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading bug assignments...</p>
        ) : bugs.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No bugs have been reported.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Bug", "Severity", "Priority", "Developer email", "Team", "Status", "Action"].map((item) => (
                    <th key={item} className="px-4 py-3 font-semibold">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bugs.map((bug) => {
                  const draft = drafts[bug.id] ?? {};
                  return (
                    <tr key={bug.id} className="align-top">
                      <td className="max-w-64 px-4 py-4">
                        <p className="text-xs text-slate-500">#{bug.id}</p>
                        <p className="mt-1 font-medium text-slate-900">{bug.title}</p>
                      </td>
                      <td className="px-4 py-4 text-xs">{bug.severity}</td>
                      <td className="px-4 py-4">
                        <select aria-label={`Priority for bug ${bug.id}`} value={draft.priority ?? "Medium"} onChange={(event) => updateDraft(bug.id, "priority", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                          {priorities.map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <input aria-label={`Developer email for bug ${bug.id}`} type="email" value={draft.developer_email ?? ""} onChange={(event) => updateDraft(bug.id, "developer_email", event.target.value)} className="w-52 rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
                      </td>
                      <td className="px-4 py-4">
                        <select aria-label={`Team for bug ${bug.id}`} value={draft.team ?? ""} onChange={(event) => updateDraft(bug.id, "team", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                          <option value="">Unassigned</option>
                          {teams.map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <select aria-label={`Status for bug ${bug.id}`} value={draft.status ?? "Open"} onChange={(event) => updateDraft(bug.id, "status", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                          {statuses.map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          disabled={savingId === bug.id}
                          onClick={() => saveBug(bug)}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {savingId === bug.id ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
