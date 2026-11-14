import type { Reporter, TestCase, TestResult } from "@playwright/test";

type AutomationResult = {
  testName: string;
  file: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  errorMessage?: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __qaHubResults: AutomationResult[] | undefined;
}

const endpoint = process.env.QA_HUB_AUTOMATION_URL ?? "http://localhost:3000/api/automation/runs";
const apiToken = process.env.QA_HUB_API_TOKEN ?? "";

const reporter: Reporter = {
  onBegin() {
    globalThis.__qaHubResults = [];
  },
  onTestEnd(test: TestCase, result: TestResult) {
    const status =
      result.status === "passed"
        ? "passed"
        : result.status === "failed"
          ? "failed"
          : "skipped";

    globalThis.__qaHubResults?.push({
      testName: test.title,
      file: test.location.file,
      status,
      durationMs: result.duration,
      errorMessage:
        result.error && typeof result.error.message === "string"
          ? result.error.message
          : null,
    });
  },
  async onEnd() {
    const results = globalThis.__qaHubResults ?? [];
    if (!results.length) {
      return;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify({
        runName: `${process.env.npm_package_name ?? "Playwright"} automation run`,
        source: "ci",
        results,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Automation upload failed: ${response.status} ${body}`);
    }
  },
};

export default reporter;
