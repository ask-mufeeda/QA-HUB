import { useRef, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function KeyValueEditor({
  title,
  keyLabel,
  rows,
  onChange,
  onAdd,
  onRemove,
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Add {title === "Headers" ? "header" : "parameter"}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No {title.toLowerCase()} added.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <input
                aria-label={`${keyLabel} ${index + 1}`}
                value={row.key}
                onChange={(event) => onChange(row.id, "key", event.target.value)}
                placeholder={keyLabel}
                className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
              <input
                aria-label={`${title === "Headers" ? "Header value" : "Parameter value"} ${index + 1}`}
                value={row.value}
                onChange={(event) => onChange(row.id, "value", event.target.value)}
                placeholder="Value"
                className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
              <button
                type="button"
                aria-label={`Remove ${title.toLowerCase()} row ${index + 1}`}
                onClick={() => onRemove(row.id)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatResponseBody(text) {
  if (!text) return "(empty response body)";

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export default function ApiTestingPage() {
  const nextRowId = useRef(2);
  const [method, setMethod] = useState("GET");
  const [requestUrl, setRequestUrl] = useState("");
  const [headers, setHeaders] = useState([
    { id: 1, key: "Accept", value: "application/json" },
  ]);
  const [queryParams, setQueryParams] = useState([]);
  const [requestBody, setRequestBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [response, setResponse] = useState(null);

  function addRow(setRows) {
    const id = nextRowId.current;
    nextRowId.current += 1;
    setRows((current) => [...current, { id, key: "", value: "" }]);
  }

  function updateRow(setRows, id, field, value) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function removeRow(setRows, id) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setRequestError("");
    setResponse(null);
    setLoading(true);

    let waitingForResponse = false;

    try {
      if (!requestUrl.trim()) {
        throw new Error("Enter a request URL.");
      }

      let url;
      try {
        url = new URL(requestUrl.trim());
      } catch {
        throw new Error("Enter a valid absolute URL, including https:// or http://.");
      }

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Only HTTP and HTTPS request URLs are supported.");
      }
      if (url.username || url.password) {
        throw new Error("Do not include credentials in the request URL.");
      }

      queryParams
        .filter((parameter) => parameter.key.trim())
        .forEach((parameter) => {
          url.searchParams.append(parameter.key.trim(), parameter.value);
        });

      const requestHeaders = new Headers();
      headers
        .filter((header) => header.key.trim())
        .forEach((header) => {
          requestHeaders.append(header.key.trim(), header.value);
        });

      let body;
      if (method !== "GET" && requestBody.trim()) {
        let parsedBody;
        try {
          parsedBody = JSON.parse(requestBody);
        } catch {
          throw new Error("The request body must be valid JSON.");
        }

        body = JSON.stringify(parsedBody);
        if (!requestHeaders.has("Content-Type")) {
          requestHeaders.set("Content-Type", "application/json");
        }
      }

      const startedAt = performance.now();
      waitingForResponse = true;
      const result = await fetch(url, {
        method,
        headers: requestHeaders,
        ...(body === undefined ? {} : { body }),
      });
      waitingForResponse = false;

      const responseText = await result.text();
      const responseHeaders = [...result.headers.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      );

      setResponse({
        status: result.status,
        statusText: result.statusText,
        ok: result.ok,
        time: Math.round(performance.now() - startedAt),
        size: new TextEncoder().encode(responseText).byteLength,
        body: formatResponseBody(responseText),
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("API request failed:", error);
      setRequestError(
        waitingForResponse && error instanceof TypeError
          ? "No response was received. Check the URL, network connection, and whether the API allows browser requests from this origin (CORS)."
          : error instanceof Error
            ? error.message
            : "The request could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace tool"
        title="API testing"
        description="Build an HTTP request, send it from your browser, and inspect the real response."
      />

      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <form onSubmit={handleSubmit}>
            <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)_auto]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Method
                </span>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                >
                  {methods.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Request URL
                </span>
                <input
                  type="url"
                  inputMode="url"
                  value={requestUrl}
                  onChange={(event) => setRequestUrl(event.target.value)}
                  placeholder="https://api.example.com/v1/items"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60 md:w-auto"
                >
                  {loading ? "Sending..." : "Send request"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <KeyValueEditor
                title="Headers"
                keyLabel="Header name"
                rows={headers}
                onChange={(id, field, value) =>
                  updateRow(setHeaders, id, field, value)
                }
                onAdd={() => addRow(setHeaders)}
                onRemove={(id) => removeRow(setHeaders, id)}
              />
              <KeyValueEditor
                title="Query parameters"
                keyLabel="Parameter name"
                rows={queryParams}
                onChange={(id, field, value) =>
                  updateRow(setQueryParams, id, field, value)
                }
                onAdd={() => addRow(setQueryParams)}
                onRemove={(id) => removeRow(setQueryParams, id)}
              />
            </div>

            <section className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label
                  htmlFor="api-request-body"
                  className="text-sm font-semibold text-slate-900"
                >
                  JSON request body
                </label>
                <span className="text-xs text-slate-500">
                  {method === "GET"
                    ? "GET requests do not send a body."
                    : "A JSON Content-Type header is added when needed."}
                </span>
              </div>
              <textarea
                id="api-request-body"
                value={requestBody}
                onChange={(event) => setRequestBody(event.target.value)}
                disabled={method === "GET"}
                spellCheck="false"
                rows={8}
                placeholder={'{\n  "name": "Example"\n}'}
                className="mt-3 block w-full resize-y rounded-xl border border-slate-300 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </section>
          </form>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Requests are sent directly from this browser. Cross-origin APIs must
            allow this site through CORS. Only use credentials you are
            authorized to send, and avoid entering production secrets on shared
            devices.
          </p>
        </section>

        {requestError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800"
          >
            {requestError}
          </div>
        )}

        {loading && (
          <p role="status" className="text-sm text-slate-600">
            Sending request and waiting for the API response...
          </p>
        )}

        {response && (
          <section
            aria-live="polite"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Response
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Request completed
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  response.ok
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {response.status}
                {response.statusText ? ` ${response.statusText}` : ""}
              </span>
            </div>

            <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-3 sm:px-6">
              {[
                ["Status", String(response.status)],
                ["Response time", `${response.time} ms`],
                ["Response size", formatBytes(response.size)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
              <section className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  Response body
                </h3>
                <pre className="mt-3 max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
                  {response.body}
                </pre>
              </section>

              <section className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  Response headers
                </h3>
                {response.headers.length ? (
                  <dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {response.headers.map(([name, value]) => (
                      <div key={name} className="space-y-1 px-3 py-2.5">
                        <dt className="break-all font-mono text-xs font-semibold text-slate-700">
                          {name}
                        </dt>
                        <dd className="break-all text-xs leading-5 text-slate-600">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    No response headers are available to this browser. For
                    cross-origin requests, the API may need to expose headers
                    through its CORS policy.
                  </p>
                )}
              </section>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
