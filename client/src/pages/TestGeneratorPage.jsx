import { useState } from "react";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { supabase } from "../lib/supabase.js";

export default function TestGeneratorPage() {
  const [module, setModule] = useState("");
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback({ type: "info", text: "Generating test cases..." });
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("smart-handler", {
        body: { module, prompt, count: 20 },
      });
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "The generator did not return a successful response.");
      }

      setResult(data.result);
      setFeedback({ type: "success", text: "Test cases generated." });
    } catch (error) {
      console.error("Test generation error:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Could not generate test cases.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="QA utility"
        title="Test generator check"
        description="Send a test-generation request to the configured QA Hub function."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form
          onSubmit={handleSubmit}
          className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <div>
            <label htmlFor="module" className="mb-2 block text-sm font-medium text-slate-800">
              Module
            </label>
            <input
              id="module"
              required
              value={module}
              onChange={(event) => setModule(event.target.value)}
              placeholder="For example, authentication"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
          <div>
            <label htmlFor="prompt" className="mb-2 block text-sm font-medium text-slate-800">
              What should the tests cover?
            </label>
            <textarea
              id="prompt"
              required
              rows={5}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the feature and expected behavior..."
              className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
          <Feedback message={feedback?.text} type={feedback?.type} />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "Generating..." : "Generate test cases"}
          </button>
        </form>

        <section className="min-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Function response</h2>
          </div>
          <pre className="max-h-[36rem] overflow-auto p-5 text-xs leading-6 text-slate-200">
            <code>{result ? JSON.stringify(result, null, 2) : "Submit a prompt to inspect the response."}</code>
          </pre>
        </section>
      </div>
    </>
  );
}
