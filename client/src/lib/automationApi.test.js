import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateSuccessRate,
  validateAutomationRunPayload,
} from "./automationApi.js";

test("validateAutomationRunPayload accepts a valid Playwright payload", () => {
  const payload = {
    runName: "Smoke suite",
    source: "ci",
    results: [
      { testName: "loads the dashboard", file: "tests/dashboard.spec.ts", status: "passed", durationMs: 1200 },
      { testName: "handles empty state", file: "tests/dashboard.spec.ts", status: "failed", durationMs: 950, errorMessage: "No items rendered" },
      { testName: "skips mobile smoke", file: "tests/dashboard.spec.ts", status: "skipped", durationMs: 160 },
    ],
  };

  const sanitized = validateAutomationRunPayload(payload);
  assert.equal(sanitized.runName, "Smoke suite");
  assert.equal(sanitized.source, "ci");
  assert.deepEqual(sanitized.totals, { total: 3, passed: 1, failed: 1, skipped: 1 });
});

test("validateAutomationRunPayload rejects malformed payloads", () => {
  assert.throws(
    () =>
      validateAutomationRunPayload({
        runName: "",
        source: "local",
        results: [],
      }),
    /run name is required|at least one test result/i,
  );

  assert.throws(
    () =>
      validateAutomationRunPayload({
        runName: "Nightly",
        source: "qa",
        results: [{ testName: "first", status: "passed" }],
      }),
    /source must be either/i,
  );
});

test("calculateSuccessRate ignores skipped tests", () => {
  assert.equal(calculateSuccessRate(2, 1), 67);
  assert.equal(calculateSuccessRate(0, 0), null);
});
