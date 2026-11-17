export const requirementPriorityOptions = ["High", "Medium", "Low"];
export const requirementStatusOptions = ["Draft", "Approved", "Implemented"];
export const rtmStatusOptions = [
  "Not covered",
  "Not run",
  "Passed",
  "Failed",
  "In progress",
];

export function computeRequirementStatus(linkedCases = [], openBugCount = 0) {
  const entries = (linkedCases ?? []).filter(Boolean);

  if (entries.length === 0) {
    return "Not covered";
  }

  const statuses = entries.map((testCase) => String(testCase.status ?? "Not Run"));
  const hasAnyRun = statuses.some((status) => status !== "Not Run");

  if (!hasAnyRun) {
    return "Not run";
  }

  if (statuses.includes("Fail") || openBugCount > 0) {
    return "Failed";
  }

  if (statuses.every((status) => status === "Pass")) {
    return "Passed";
  }

  return "In progress";
}

export function summarizeRequirementMatrix(requirements = [], requirementCasesById = {}, bugsByTestCaseId = {}) {
  const total = requirements.length;

  const rows = requirements.map((requirement) => {
    const linkedCases = requirementCasesById[requirement.id] ?? [];
    const openBugCount = linkedCases.filter((testCase) => {
      const relatedBugs = bugsByTestCaseId[testCase.id] ?? [];
      return relatedBugs.some((bug) => !["Closed", "Resolved", "Done"].includes(bug.status));
    }).length;

    const executionStatus = computeRequirementStatus(linkedCases, openBugCount);

    return {
      ...requirement,
      linkedCases,
      openBugCount,
      executionStatus,
    };
  });

  const coveredCount = rows.filter((row) => row.linkedCases.length > 0).length;
  const untestedCount = rows.filter((row) => row.linkedCases.length === 0).length;
  const passedCount = rows.filter((row) => row.executionStatus === "Passed").length;
  const failedCount = rows.filter((row) => row.executionStatus === "Failed").length;
  const coveragePercent = total === 0 ? 0 : Math.round((coveredCount / total) * 100);

  return {
    total,
    coveredCount,
    coveragePercent,
    untestedCount,
    failedCount,
    passedCount,
    rows,
  };
}
