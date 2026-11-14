# QA Hub client

The React/Vite frontend lives in this folder and uses Tailwind CSS. Legacy
root-level HTML entry points redirect to the matching React routes under
`/client/`.

## Run locally

```powershell
npm install
npm run dev
```

To create a production build:

```powershell
npm run build
```

## Try the API testing page

Sign in to QA Hub and open **API testing** from the workspace navigation.

- For a GET request, enter `https://jsonplaceholder.typicode.com/posts/1` and
  select **Send request**.
- To check JSON request bodies, choose **POST**, enter
  `https://httpbin.org/anything`, and use a body such as
  `{"message":"hello from QA Hub"}`.

The API response appears below the builder. Requests run in the browser, so
the target API must allow cross-origin requests from the site through CORS.
Only send credentials to APIs you are authorized to use. Automated assertions,
saved environments, history, and collections are not part of this initial
request/response implementation.

## Learning Library progress setup

The Library reads and writes per-user completions in the new
`public.learning_progress` table. Before using **Mark as Completed**, run
[`supabase/learning-progress.sql`](./supabase/learning-progress.sql) in the
existing project's Supabase SQL Editor. The migration adds only this new table
and restricts rows to their owner with Row Level Security; it does not alter
the existing `profiles`, `bugs`, or `test_cases` tables.

After applying it, sign in and open **Resources**. Choose a section, open a
lesson, and mark it complete. The overall and per-section percentages are
loaded from Supabase on the next visit or login.

The Library includes Manual Testing, API Testing, SQL, and Automation Testing
lessons with examples, exercises, and interview questions. The SQL Practice
module remains separate and unchanged.

## Automation testing API

The automation dashboard reads from the `public.automation_runs` and
`public.automation_results` tables. Any authenticated QA Hub user or CI job with
a valid bearer token can publish results to the automation endpoint.

POST `/api/automation/runs`

Request body:

```json
{
  "runName": "Smoke suite",
  "source": "ci",
  "results": [
    {
      "testName": "loads the dashboard",
      "file": "tests/dashboard.spec.ts",
      "status": "passed",
      "durationMs": 1200,
      "errorMessage": null
    },
    {
      "testName": "handles empty state",
      "file": "tests/dashboard.spec.ts",
      "status": "failed",
      "durationMs": 980,
      "errorMessage": "No items rendered in the table"
    },
    {
      "testName": "skips the legacy mobile smoke",
      "file": "tests/dashboard.spec.ts",
      "status": "skipped",
      "durationMs": 220,
      "errorMessage": null
    }
  ]
}
```

The service validates the payload, rejects invalid values with 400 responses,
computes totals from the supplied test results, and stores the run and each
result in a single transaction. Client-supplied totals are ignored; only the
actual results are counted.

Authentication:

- Browser session: send `Authorization: Bearer <access_token>` using the
  existing signed-in Supabase session.
- CI jobs: send the same bearer token header from a service account or API token
  that is linked to your QA Hub project.
- If you use a custom proxy or Edge Function in front of the database, keep the
  same JWT validation flow and allow `Authorization` or `X-API-Key` headers for
  the automation routes.

Example Playwright custom reporter (`reporter.ts`):

```ts
import type { FullConfig, Reporter, TestCase, TestResult } from "@playwright/test";

const endpoint = process.env.QA_HUB_AUTOMATION_URL ?? "http://localhost:3000/api/automation/runs";
const apiToken = process.env.QA_HUB_API_TOKEN ?? "";

const reporter: Reporter = {
  onBegin() {
    console.log("Starting Playwright automation run");
  },
  onTestEnd(test: TestCase, result: TestResult) {
    if (!globalThis.__qaHubResults) {
      globalThis.__qaHubResults = [];
    }

    globalThis.__qaHubResults.push({
      testName: test.title,
      file: test.location.file,
      status: result.status === "passed" ? "passed" : result.status === "failed" ? "failed" : "skipped",
      durationMs: result.duration,
      errorMessage:
        result.error && typeof result.error.message === "string" ? result.error.message : null,
    });
  },
  async onEnd() {
    const results = globalThis.__qaHubResults ?? [];
    if (!results.length) return;

    const payload = {
      runName: `${process.env.npm_package_name ?? "playwright"} smoke run`,
      source: "ci",
      results,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Automation upload failed: ${response.status} ${body}`);
    }
  },
};

export default reporter;
```

The repository includes sample run data in `client/supabase/automation-management.sql`
so you can validate the dashboard locally without needing to run a Playwright
script from the browser.

The build is written to `client/dist`. Deploy that output under `/client/`
beside the root-level redirect pages, and configure the static host to serve
`/client/index.html` for unknown `/client/*` routes. The Supabase client uses
the same public project settings as the existing site.
