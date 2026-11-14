import { useCallback, useEffect, useState } from "react";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";

const statuses = ["Open", "In Progress", "Resolved"];

export default function DeveloperDashboardPage() {
  const { user } = useAuth();
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const loadBugs = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bugs")
      .select("*")
      .ilike("developer_email", user.email)
      .order("id", { ascending: false });
    if (error) {
      console.error("Could not load assigned bugs:", error);
      setFeedback({ type: "error", text: error.message });
    } else {
      setBugs(data ?? []);
    }
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    loadBugs();
  }, [loadBugs]);

  async function updateStatus(bug, status) {
    const { error } = await supabase
      .from("bugs")
      .update({ status })
      .eq("id", bug.id)
      .ilike("developer_email", user.email);
    if (error) {
      console.error("Could not update assigned bug:", error);
      setFeedback({ type: "error", text: error.message });
      return;
    }
    setBugs((current) =>
      current.map((item) => (item.id === bug.id ? { ...item, status } : item)),
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Developer workspace"
        title="Assigned bugs"
        description={`Issues assigned to ${user?.email ?? "your account"}.`}
        actions={
          <button
            type="button"
            onClick={loadBugs}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        }
      />
      <Feedback message={feedback?.text} type={feedback?.type} />

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading assigned bugs...</p>
        ) : bugs.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No bugs are assigned to your account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Bug", "Description", "Severity", "Priority", "Team", "Evidence", "Status"].map((item) => (
                    <th key={item} className="px-4 py-3 font-semibold">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bugs.map((bug) => (
                  <tr key={bug.id} className="align-top">
                    <td className="max-w-48 px-4 py-4">
                      <p className="text-xs text-slate-500">#{bug.id}</p>
                      <p className="mt-1 font-medium text-slate-900">{bug.title}</p>
                    </td>
                    <td className="max-w-64 whitespace-pre-wrap px-4 py-4 text-xs leading-5 text-slate-600">{bug.description}</td>
                    <td className="px-4 py-4 text-xs">{bug.severity}</td>
                    <td className="px-4 py-4 text-xs">{bug.priority}</td>
                    <td className="px-4 py-4 text-xs">{bug.team || "Unassigned"}</td>
                    <td className="px-4 py-4 text-xs">
                      <div className="flex flex-col gap-1">
                        {bug.screenshot_url && <a href={bug.screenshot_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Screenshot</a>}
                        {bug.recording_url && <a href={bug.recording_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Recording</a>}
                        {!bug.screenshot_url && !bug.recording_url && "—"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        aria-label={`Status for bug ${bug.id}`}
                        value={bug.status || "Open"}
                        onChange={(event) => updateStatus(bug, event.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                      >
                        {statuses.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
