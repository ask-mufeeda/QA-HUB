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
