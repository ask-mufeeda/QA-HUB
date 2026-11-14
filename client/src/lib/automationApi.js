export const AUTOMATION_SOURCES = ["local", "ci"];
export const AUTOMATION_RESULT_STATUSES = ["passed", "failed", "skipped"];

export function calculateTotals(results = []) {
  return results.reduce(
    (totals, result) => {
      const status = String(result?.status ?? "").toLowerCase();
      totals.total += 1;
      if (status === "passed") totals.passed += 1;
      if (status === "failed") totals.failed += 1;
      if (status === "skipped") totals.skipped += 1;
      return totals;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0 },
  );
}

export function calculateSuccessRate(passed = 0, failed = 0) {
  const completed = Number(passed ?? 0) + Number(failed ?? 0);
  if (!Number.isFinite(completed) || completed <= 0) return null;
  return Math.round((Number(passed ?? 0) / completed) * 100);
}

function normalizePlaywrightStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  if (["passed", "pass", "expected", "succeeded\n", "succeeded"].includes(status)) {
    return "passed";
  }
  if (["failed", "fail", "timedout", "timed_out", "interrupted"].includes(status)) {
    return "failed";
  }
  if (["skipped", "skip", "pending", "disabled"].includes(status)) {
    return "skipped";
  }
  return status || "failed";
}

function getErrorMessage(errorLike) {
  if (!errorLike) return null;
  if (typeof errorLike === "string") {
    return errorLike.split(/\r?\n/)[0].trim() || null;
  }
  if (typeof errorLike === "object") {
    const errorMessage =
      typeof errorLike.message === "string"
        ? errorLike.message
        : typeof errorLike.value === "string"
          ? errorLike.value
          : JSON.stringify(errorLike);
    return String(errorMessage).split(/\r?\n/)[0].trim() || null;
  }
  return null;
}

export function parsePlaywrightJsonReport(report) {
  if (!report || typeof report !== "object") {
    throw new Error("The Playwright report must be a JSON object.");
  }

  const suites = Array.isArray(report.suites) ? report.suites : [];
  const parsedResults = [];

  function walkSuite(suite, ancestors = []) {
    const suitePath = [...ancestors, suite?.title].filter(Boolean);
    const specGroups = Array.isArray(suite?.specs) ? suite.specs : [];

    for (const spec of specGroups) {
      const specPath = [...suitePath, spec?.title].filter(Boolean);
      const tests = Array.isArray(spec?.tests) ? spec.tests : [];

      for (const test of tests) {
        const results = Array.isArray(test?.results) ? test.results : [];
        const lastResult = results.at(-1) ?? null;
        const status = normalizePlaywrightStatus(
          lastResult?.status ?? test?.status ?? test?.outcome ?? "failed",
        );
        const testTitle = [...specPath, test?.title].filter(Boolean).join(" > ");
        const file =
          spec?.file ||
          suite?.file ||
          test?.location?.file ||
          lastResult?.attachments?.[0]?.path ||
          "";

        parsedResults.push({
          test_name: testTitle || test?.title || "Unnamed test",
          file: file || null,
          status,
          duration_ms: Math.round(Number(lastResult?.duration ?? test?.duration ?? 0) || 0),
          error_message: getErrorMessage(lastResult?.error ?? test?.error ?? null),
        });
      }
    }

    const childSuites = Array.isArray(suite?.suites) ? suite.suites : [];
    for (const childSuite of childSuites) {
      walkSuite(childSuite, suitePath);
    }
  }

  for (const suite of suites) {
    walkSuite(suite, []);
  }

  if (parsedResults.length === 0) {
    throw new Error(
      "No Playwright tests were found in that JSON. Use `npx playwright test --reporter=json > report.json` and make sure the file includes suites and tests.",
    );
  }

  return parsedResults;
}

export function validateAutomationRunPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Automation run payload must be a JSON object.");
  }

  const runName = String(payload.runName ?? payload.name ?? "").trim();
  if (!runName) {
    throw new Error("The run name is required.");
  }

  const source = String(payload.source ?? "local").trim().toLowerCase();
  if (!AUTOMATION_SOURCES.includes(source)) {
    throw new Error('The source must be either "local" or "ci".');
  }

  const rawResults = Array.isArray(payload.results) ? payload.results : [];
  if (rawResults.length === 0) {
    throw new Error("At least one test result is required.");
  }

  const results = rawResults.map((result, index) => {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error(`Result ${index + 1} is not a valid object.`);
    }

    const testName = String(result.testName ?? result.name ?? "").trim();
    if (!testName) {
      throw new Error(`Result ${index + 1} is missing a test name.`);
    }

    const status = String(result.status ?? "").trim().toLowerCase();
    if (!AUTOMATION_RESULT_STATUSES.includes(status)) {
      throw new Error(
        `Result ${index + 1} has an invalid status. Allowed values are passed, failed, and skipped.`,
      );
    }

    const durationMs = Number(result.durationMs ?? result.duration_ms ?? 0);
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(`Result ${index + 1} has an invalid duration.`);
    }

    const file = typeof result.file === "string" ? result.file.trim() : "";
    const errorMessage =
      typeof result.errorMessage === "string" && result.errorMessage.trim()
        ? result.errorMessage.trim()
        : null;

    return {
      testName,
      file: file || null,
      status,
      durationMs: Math.round(durationMs),
      errorMessage,
    };
  });

  const totals = calculateTotals(results);

  return {
    runName,
    source,
    results,
    totals,
  };
}

export function buildAutomationApiHeaders(accessToken) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (typeof window !== "undefined") {
    const scriptToken = window.localStorage?.getItem("qa-hub-api-token");
    if (scriptToken) {
      headers["X-API-Key"] = scriptToken;
    }
  }

  return headers;
}

export async function createAutomationRun(payload, accessToken) {
  const normalized = validateAutomationRunPayload(payload);
  const response = await fetch("/api/automation/runs", {
    method: "POST",
    headers: buildAutomationApiHeaders(accessToken),
    body: JSON.stringify(normalized),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed with status ${response.status}.`);
  }

  return response.json();
}

export async function listAutomationRuns(accessToken, { signal } = {}) {
  const response = await fetch("/api/automation/runs", {
    method: "GET",
    headers: buildAutomationApiHeaders(accessToken),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed with status ${response.status}.`);
  }

  return response.json();
}

export async function getAutomationRun(runId, accessToken, { signal } = {}) {
  const response = await fetch(`/api/automation/runs/${runId}`, {
    method: "GET",
    headers: buildAutomationApiHeaders(accessToken),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed with status ${response.status}.`);
  }

  return response.json();
}
