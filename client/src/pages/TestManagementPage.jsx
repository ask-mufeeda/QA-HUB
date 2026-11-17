import { useMemo, useState } from "react";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { downloadCsv } from "../lib/csv.js";

const defaultPlans = [
  {
    id: "plan-1",
    name: "Checkout regression",
    description: "Validate the checkout flow across supported browsers and states.",
    project: "QA Hub storefront",
    status: "Active",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    assignedTesters: ["qa.tester@example.com"],
    scenarios: [
      {
        id: "scenario-1",
        title: "Guest checkout",
        priority: "High",
        module: "Checkout",
        description: "Guest order validation",
        cases: [
          {
            id: "TC-001",
            title: "Guest can complete checkout",
            scenario: "Guest checkout",
            module: "Checkout",
            preconditions: "Cart has products and user is not logged in.",
            steps: [
              "Open checkout",
              "Enter billing information",
              "Submit payment",
            ],
            expectedResult: "Order is placed and confirmation is shown.",
            actualResult: "Order created successfully.",
            priority: "High",
            testType: "Positive",
            status: "Pass",
          },
        ],
      },
    ],
  },
];

const emptyPlan = {
  name: "",
  description: "",
  project: "",
  status: "Draft",
  startDate: "",
  endDate: "",
  assignedTesters: "",
};

const emptyScenario = {
  title: "",
  module: "",
  priority: "Medium",
  description: "",
};

const emptyCase = {
  title: "",
  scenario: "",
  module: "",
  preconditions: "",
  steps: "",
  expectedResult: "",
  actualResult: "",
  priority: "Medium",
  testType: "Positive",
  status: "Not Run",
};

const planStatusOptions = ["Draft", "Active", "Completed"];
const scenarioPriorities = ["High", "Medium", "Low"];
const caseStatuses = ["Not Run", "Pass", "Fail", "Blocked"];

function generateAiCases(requirement, feature, count = 6) {
  const sample = [
    {
      title: `${feature} happy path`,
      module: feature,
      preconditions: `User has access to ${feature}.`,
      steps: [
        "Open the feature",
        "Perform the primary action",
        "Verify the result",
      ],
      expectedResult: `Feature completes successfully for a valid ${requirement}.`,
      actualResult: "",
      priority: "High",
      testType: "Positive",
      status: "Not Run",
    },
    {
      title: `${feature} validation failure`,
      module: feature,
      preconditions: `User submits invalid ${requirement}.`,
      steps: [
        "Enter invalid input",
        "Submit the form",
        "Review the validation messaging",
      ],
      expectedResult: "Validation explains the issue clearly.",
      actualResult: "",
      priority: "High",
      testType: "Validation",
      status: "Not Run",
    },
    {
      title: `${feature} boundary condition`,
      module: feature,
      preconditions: `User reaches the maximum edge case for ${requirement}.`,
      steps: [
        "Enter boundary value",
        "Submit the action",
        "Review the response",
      ],
      expectedResult: "Boundary handling is consistent and valid.",
      actualResult: "",
      priority: "Medium",
      testType: "Boundary",
      status: "Not Run",
    },
  ];

  return Array.from({ length: count }, (_, index) => ({
    ...sample[index % sample.length],
    id: `AI-${String(index + 1).padStart(3, "0")}`,
    title: `${sample[index % sample.length].title} ${index + 1}`,
  }));
}

function exportCsv(name, rows) {
  const headers = Object.keys(rows[0] ?? {});
  const csv = [headers, ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`))]
    .map((row) => row.join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function TestManagementPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(defaultPlans);
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlans[0]?.id ?? null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [scenarioForm, setScenarioForm] = useState(emptyScenario);
  const [caseForm, setCaseForm] = useState(emptyCase);
  const [feedback, setFeedback] = useState(null);
  const [aiRequirement, setAiRequirement] = useState("");
  const [aiFeature, setAiFeature] = useState("");
  const [generatedCases, setGeneratedCases] = useState([]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null,
    [plans, selectedPlanId],
  );

  const summary = useMemo(() => {
    const allCases = (selectedPlan?.scenarios ?? []).flatMap((scenario) => scenario.cases ?? []);
    const totals = {
      total: allCases.length,
      passed: allCases.filter((testCase) => testCase.status === "Pass").length,
      failed: allCases.filter((testCase) => testCase.status === "Fail").length,
      blocked: allCases.filter((testCase) => testCase.status === "Blocked").length,
      notRun: allCases.filter((testCase) => testCase.status === "Not Run").length,
    };
    totals.passRate = totals.total ? Math.round((totals.passed / totals.total) * 100) : 0;
    totals.failRate = totals.total ? Math.round((totals.failed / totals.total) * 100) : 0;
    totals.progress = totals.total ? Math.round(((totals.passed + totals.failed + totals.blocked) / totals.total) * 100) : 0;
    return totals;
  }, [selectedPlan]);

  function handlePlanChange(event) {
    setPlanForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function handleScenarioChange(event) {
    setScenarioForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function handleCaseChange(event) {
    setCaseForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function addPlan(event) {
    event.preventDefault();
    if (!planForm.name.trim() || !planForm.project.trim()) {
      setFeedback({ type: "error", text: "Plan name and project are required." });
      return;
    }

    const nextPlan = {
      id: `plan-${Date.now()}`,
      name: planForm.name.trim(),
      description: planForm.description.trim(),
      project: planForm.project.trim(),
      status: planForm.status,
      startDate: planForm.startDate,
      endDate: planForm.endDate,
      assignedTesters: planForm.assignedTesters
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      scenarios: [],
    };

    setPlans((current) => [nextPlan, ...current]);
    setSelectedPlanId(nextPlan.id);
    setPlanForm(emptyPlan);
    setFeedback({ type: "success", text: "Test plan created." });
  }

  function addScenario(event) {
    event.preventDefault();
    if (!selectedPlan || !scenarioForm.title.trim()) {
      setFeedback({ type: "error", text: "Select a plan and enter a scenario title." });
      return;
    }

    const nextScenario = {
      id: `scenario-${Date.now()}`,
      title: scenarioForm.title.trim(),
      module: scenarioForm.module.trim() || "General",
      priority: scenarioForm.priority,
      description: scenarioForm.description.trim(),
      cases: [],
    };

    setPlans((current) =>
      current.map((plan) =>
        plan.id === selectedPlan.id
          ? { ...plan, scenarios: [...(plan.scenarios ?? []), nextScenario] }
          : plan,
      ),
    );
    setScenarioForm(emptyScenario);
    setFeedback({ type: "success", text: "Scenario added." });
  }

  function addCase(event) {
    event.preventDefault();
    if (!selectedPlan) {
      setFeedback({ type: "error", text: "Select a plan first." });
      return;
    }

    const scenarioName = caseForm.scenario || selectedPlan.scenarios?.[0]?.title || "General";
    const scenario = selectedPlan.scenarios.find((item) => item.title === scenarioName) ?? selectedPlan.scenarios[0];
    if (!scenario) {
      setFeedback({ type: "error", text: "Create a scenario before adding a test case." });
      return;
    }

    const nextCase = {
      id: `TC-${String(Date.now()).slice(-6)}`,
      title: caseForm.title.trim(),
      scenario: scenarioName,
      module: caseForm.module.trim() || scenario.module || "General",
      preconditions: caseForm.preconditions.trim(),
      steps: caseForm.steps
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      expectedResult: caseForm.expectedResult.trim(),
      actualResult: caseForm.actualResult.trim(),
      priority: caseForm.priority,
      testType: caseForm.testType,
      status: caseForm.status,
    };

    setPlans((current) =>
      current.map((plan) => {
        if (plan.id !== selectedPlan.id) return plan;
        return {
          ...plan,
          scenarios: plan.scenarios.map((item) =>
            item.id === scenario.id ? { ...item, cases: [...(item.cases ?? []), nextCase] } : item,
          ),
        };
      }),
    );
    setCaseForm(emptyCase);
    setFeedback({ type: "success", text: "Test case saved." });
  }

  function generateCases(event) {
    event.preventDefault();
    if (!aiRequirement.trim() || !aiFeature.trim()) {
      setFeedback({ type: "error", text: "Requirement and feature are required to generate cases." });
      return;
    }

    const generated = generateAiCases(aiRequirement.trim(), aiFeature.trim());
    setGeneratedCases(generated);
    setFeedback({ type: "success", text: "AI-generated cases are ready for review." });
  }

  function addGeneratedCases() {
    if (!selectedPlan || !generatedCases.length) {
      setFeedback({ type: "error", text: "Generate at least one test case first." });
      return;
    }

    const scenarioName = caseForm.scenario || selectedPlan.scenarios?.[0]?.title || "General";
    const scenario = selectedPlan.scenarios.find((item) => item.title === scenarioName) ?? selectedPlan.scenarios[0];
    if (!scenario) {
      setFeedback({ type: "error", text: "Create a scenario before attaching generated cases." });
      return;
    }

    setPlans((current) =>
      current.map((plan) => {
        if (plan.id !== selectedPlan.id) return plan;
        return {
          ...plan,
          scenarios: plan.scenarios.map((item) =>
            item.id === scenario.id
              ? { ...item, cases: [...(item.cases ?? []), ...generatedCases.map((generatedCase) => ({
                    ...generatedCase,
                    id: `${generatedCase.id}-${Date.now()}`,
                    scenario: scenarioName,
                    module: generatedCase.module || scenario.module || "General",
                    actualResult: "",
                  }))] }
              : item,
          ),
        };
      }),
    );
    setGeneratedCases([]);
    setAiRequirement("");
    setAiFeature("");
    setFeedback({ type: "success", text: "Generated cases saved to the selected scenario." });
  }

  function updateExecutionStatus(testCaseId, status) {
    if (!selectedPlan) return;
    setPlans((current) =>
      current.map((plan) => {
        if (plan.id !== selectedPlan.id) return plan;
        return {
          ...plan,
          scenarios: plan.scenarios.map((scenario) => ({
            ...scenario,
            cases: (scenario.cases ?? []).map((testCase) =>
              testCase.id === testCaseId ? { ...testCase, status } : testCase,
            ),
          })),
        };
      }),
    );
  }

  function exportSummary() {
    if (!selectedPlan) return;
    const rows = (selectedPlan.scenarios ?? []).flatMap((scenario) =>
      (scenario.cases ?? []).map((testCase) => ({
        Plan: selectedPlan.name,
        Scenario: scenario.title,
        Module: testCase.module,
        "Test ID": testCase.id,
        Title: testCase.title,
        Status: testCase.status,
        Priority: testCase.priority,
      })),
    );
    exportCsv(`${selectedPlan.name}-report`, rows);
  }

  const totalCases = summary.total;

  return (
    <>
      <PageHeader
        eyebrow="QA workflow"
        title="Test management"
        description="Plan coverage, review scenarios, execute cases, and monitor execution quality."
        actions={
          <button
            type="button"
            onClick={exportSummary}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        }
      />

      <Feedback message={feedback?.text} type={feedback?.type} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[ 
          ["Total", summary.total],
          ["Passed", summary.passed],
          ["Failed", summary.failed],
          ["Blocked", summary.blocked],
          ["Not run", summary.notRun],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Test plans</h2>
            <div className="mt-3 space-y-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full rounded-xl border p-3 text-left ${selectedPlan?.id === plan.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{plan.name}</span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">{plan.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{plan.project}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={addPlan} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-semibold text-slate-900">Create test plan</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700">Plan name</label>
              <input name="name" value={planForm.name} onChange={handlePlanChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Project</label>
              <input name="project" value={planForm.project} onChange={handlePlanChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea name="description" value={planForm.description} onChange={handlePlanChange} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Status
                <select name="status" value={planForm.status} onChange={handlePlanChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                  {planStatusOptions.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Assigned testers
                <input name="assignedTesters" value={planForm.assignedTesters} onChange={handlePlanChange} placeholder="email@example.com, qa2@example.com" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Start date
                <input type="date" name="startDate" value={planForm.startDate} onChange={handlePlanChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                End date
                <input type="date" name="endDate" value={planForm.endDate} onChange={handlePlanChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
              </label>
            </div>
            <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Create plan</button>
          </form>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          {selectedPlan ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Selected plan</p>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedPlan.name}</h2>
                </div>
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">{selectedPlan.status}</span>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Pass rate</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.passRate}%</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Failure rate</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.failRate}%</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Execution progress</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.progress}%</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-900">Scenarios</h3>
                {selectedPlan.scenarios?.length ? (
                  selectedPlan.scenarios.map((scenario) => (
                    <div key={scenario.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{scenario.title}</p>
                          <p className="text-xs text-slate-500">{scenario.module} · {scenario.priority}</p>
                        </div>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">{scenario.priority}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{scenario.description || "No description provided."}</p>

                      {(scenario.cases ?? []).length ? (
                        <div className="mt-3 space-y-2">
                          {(scenario.cases ?? []).map((testCase) => (
                            <div key={testCase.id} className="rounded-lg border border-slate-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-800">{testCase.id}: {testCase.title}</p>
                                  <p className="text-[11px] text-slate-500">{testCase.module} · {testCase.testType}</p>
                                </div>
                                <select
                                  value={testCase.status}
                                  onChange={(event) => updateExecutionStatus(testCase.id, event.target.value)}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px]"
                                >
                                  {caseStatuses.map((status) => <option key={status}>{status}</option>)}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No test cases saved for this scenario yet.</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No scenarios yet for this plan.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">No plan selected.</p>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <form onSubmit={addScenario} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Add scenario</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input name="title" value={scenarioForm.title} onChange={handleScenarioChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Module</label>
              <input name="module" value={scenarioForm.module} onChange={handleScenarioChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Priority</label>
              <select name="priority" value={scenarioForm.priority} onChange={handleScenarioChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                {scenarioPriorities.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea name="description" value={scenarioForm.description} onChange={handleScenarioChange} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Add scenario</button>
        </form>

        <form onSubmit={addCase} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Add test case</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input name="title" value={caseForm.title} onChange={handleCaseChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Scenario</label>
              <select name="scenario" value={caseForm.scenario} onChange={handleCaseChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                {(selectedPlan?.scenarios ?? []).map((scenario) => (
                  <option key={scenario.id} value={scenario.title}>{scenario.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Module</label>
              <input name="module" value={caseForm.module} onChange={handleCaseChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Priority</label>
              <select name="priority" value={caseForm.priority} onChange={handleCaseChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                {scenarioPriorities.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Test type</label>
              <select name="testType" value={caseForm.testType} onChange={handleCaseChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                {['Positive', 'Negative', 'Boundary', 'Validation', 'Edge case'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Preconditions</label>
            <textarea name="preconditions" value={caseForm.preconditions} onChange={handleCaseChange} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Test steps</label>
            <textarea name="steps" value={caseForm.steps} onChange={handleCaseChange} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Expected result</label>
            <textarea name="expectedResult" value={caseForm.expectedResult} onChange={handleCaseChange} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Actual result</label>
            <textarea name="actualResult" value={caseForm.actualResult} onChange={handleCaseChange} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Status</label>
            <select name="status" value={caseForm.status} onChange={handleCaseChange} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              {caseStatuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Save test case</button>
        </form>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={generateCases} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">AI test case generation</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700">Requirement</label>
            <textarea name="requirement" value={aiRequirement} onChange={(event) => setAiRequirement(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Feature or user story</label>
            <textarea name="feature" value={aiFeature} onChange={(event) => setAiFeature(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Generate cases</button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Generated cases preview</h3>
            {generatedCases.length > 0 && (
              <button type="button" onClick={addGeneratedCases} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Save to scenario</button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {generatedCases.length ? (
              generatedCases.map((caseItem, index) => (
                <div key={`${caseItem.id}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">{caseItem.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{caseItem.testType} · {caseItem.priority}</p>
                  <p className="mt-2 text-sm text-slate-600">{caseItem.expectedResult}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No AI-generated cases yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Execution summary</h3>
          <span className="text-sm text-slate-500">{user?.email ?? "Current user"}</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-500">Total</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totalCases}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-500">Passed</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.passed}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-500">Failed</p>
            <p className="mt-2 text-2xl font-semibold text-rose-600">{summary.failed}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-500">Blocked</p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.blocked}</p>
          </div>
        </div>
      </div>
    </>
  );
}
