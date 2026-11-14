import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { useEffect, useRef, useState } from "react";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";

const progressKey = "qahub_sql_solved_v2";
const exercises = [
  {
    id: "active-users",
    title: "Find active users",
    prompt: "Select the names of all active users.",
    answer: "SELECT name FROM users WHERE active = 1 ORDER BY id;",
  },
  {
    id: "open-bugs",
    title: "Count open bugs",
    prompt: "Return one column named open_bugs with the number of open bugs.",
    answer: "SELECT COUNT(*) AS open_bugs FROM bugs WHERE status = 'Open';",
  },
  {
    id: "tester-join",
    title: "Join test cases to users",
    prompt: "List each test case title and the tester name responsible for it.",
    answer:
      "SELECT test_cases.title, users.name FROM test_cases JOIN users ON test_cases.tester_id = users.id ORDER BY test_cases.id;",
  },
  {
    id: "resolve-bug",
    title: "Update a bug",
    prompt: "Change bug 2 to Resolved. Then verify its new status.",
    answer: "UPDATE bugs SET status = 'Resolved' WHERE id = 2;",
    verify: "SELECT status FROM bugs WHERE id = 2;",
    expected: [["Resolved"]],
  },
];

const lessons = [
  {
    title: "SELECT and WHERE",
    body: "SELECT chooses the columns to return. WHERE filters rows before they are returned.",
    example: "SELECT title, status FROM bugs WHERE status = 'Open';",
  },
  {
    title: "Sorting and limiting",
    body: "ORDER BY sorts the result set. Use LIMIT when you only need a sample of rows.",
    example: "SELECT * FROM bugs ORDER BY id DESC LIMIT 5;",
  },
  {
    title: "Aggregates",
    body: "COUNT, SUM, AVG, MIN, and MAX summarize rows. GROUP BY produces one result per group.",
    example: "SELECT status, COUNT(*) FROM bugs GROUP BY status;",
  },
  {
    title: "JOIN",
    body: "A JOIN combines related rows from multiple tables using a matching key.",
    example: "SELECT test_cases.title, users.name FROM test_cases JOIN users ON test_cases.tester_id = users.id;",
  },
];

function seedDatabase(SQL) {
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT, active INTEGER);
    INSERT INTO users VALUES
      (1, 'Asha', 'asha@example.test', 'tester', 1),
      (2, 'Noah', 'noah@example.test', 'developer', 1),
      (3, 'Mina', 'mina@example.test', 'tester', 0);

    CREATE TABLE bugs (id INTEGER PRIMARY KEY, title TEXT, severity TEXT, status TEXT);
    INSERT INTO bugs VALUES
      (1, 'Login button stays disabled', 'High', 'Open'),
      (2, 'Profile image is stretched', 'Low', 'In Progress'),
      (3, 'Search returns duplicate rows', 'Medium', 'Open');

    CREATE TABLE test_cases (id INTEGER PRIMARY KEY, title TEXT, module TEXT, status TEXT, tester_id INTEGER);
    INSERT INTO test_cases VALUES
      (1, 'Valid login succeeds', 'Authentication', 'Pass', 1),
      (2, 'Inactive account is blocked', 'Authentication', 'Not Run', 3),
      (3, 'Search result is unique', 'Search', 'Fail', 1);

    CREATE TABLE signups (id INTEGER PRIMARY KEY, email TEXT, confirmed INTEGER);
    INSERT INTO signups VALUES
      (1, 'asha@example.test', 1),
      (2, 'lee@example.test', 0);
  `);
  return db;
}

function finalStatement(sql) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .at(-1) ?? "";
}

function runSql(db, sql) {
  const result = db.exec(sql);
  const statement = finalStatement(sql);
  const readOnly = /^(SELECT|WITH|PRAGMA)\b/i.test(statement);

  if (!readOnly) {
    return {
      columns: ["Rows changed"],
      values: [[db.getRowsModified()]],
      changedRows: db.getRowsModified(),
    };
  }

  const lastResult = result.at(-1);
  return {
    columns: lastResult?.columns ?? [],
    values: lastResult?.values ?? [],
    changedRows: null,
  };
}

function normalizeRows(rows) {
  return [...rows]
    .map((row) => JSON.stringify(row))
    .sort();
}

function explainSqlError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/no such table/i.test(message)) return `${message}. Check the table name.`;
  if (/no such column/i.test(message)) return `${message}. Check the column name.`;
  if (/syntax error/i.test(message)) return `${message}. Check your SQL syntax and commas.`;
  if (/unique constraint/i.test(message)) return `${message}. A value must be unique.`;
  return message;
}

export default function SqlPracticePage() {
  const database = useRef(null);
  const sqlModule = useRef(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [activeTab, setActiveTab] = useState("Playground");
  const [query, setQuery] = useState("SELECT * FROM bugs;");
  const [result, setResult] = useState(null);
  const [queryError, setQueryError] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]);
  const [solved, setSolved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(progressKey) ?? "[]");
    } catch (error) {
      console.error("Could not read SQL practice progress:", error);
      return [];
    }
  });
  const [checkMessage, setCheckMessage] = useState(null);

  useEffect(() => {
    let active = true;
    let loadedDatabase;

    async function initialize() {
      try {
        const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
        loadedDatabase = seedDatabase(SQL);
        if (!active) {
          loadedDatabase.close();
          return;
        }
        sqlModule.current = SQL;
        database.current = loadedDatabase;
        setEngineReady(true);
      } catch (error) {
        console.error("Could not initialize the SQL practice engine:", error);
        if (active) {
          setEngineError(
            error instanceof Error
              ? error.message
              : "Could not load the SQL engine. Please refresh and try again.",
          );
        }
      }
    }

    initialize();
    return () => {
      active = false;
      if (database.current) {
        database.current.close();
        database.current = null;
      }
      sqlModule.current = null;
    };
  }, []);

  function runQuery() {
    if (!database.current) return;
    setQueryError("");
    setResult(null);
    try {
      setResult(runSql(database.current, query));
    } catch (error) {
      setQueryError(explainSqlError(error));
    }
  }

  function checkAnswer() {
    if (!database.current) return;
    setCheckMessage(null);

    let learnerDb;
    let expectedDb;
    try {
      learnerDb = seedDatabase(sqlModule.current);
      expectedDb = seedDatabase(sqlModule.current);

      const learnerResult = runSql(learnerDb, query);
      runSql(expectedDb, selectedExercise.answer);
      const expectedQuery = selectedExercise.verify ?? selectedExercise.answer;
      const expectedResult = runSql(expectedDb, expectedQuery);

      const learnerComparison = selectedExercise.verify
        ? runSql(learnerDb, selectedExercise.verify)
        : learnerResult;
      const expectedComparison = selectedExercise.verify
        ? runSql(expectedDb, selectedExercise.verify)
        : expectedResult;
      const sameColumns =
        learnerComparison.columns.length === expectedComparison.columns.length;
      const sameRows =
        normalizeRows(learnerComparison.values).join("|") ===
        normalizeRows(expectedComparison.values).join("|");

      if (!sameColumns || !sameRows) {
        setCheckMessage({
          type: "error",
          text: "Not quite. Check your query and try again.",
        });
        return;
      }

      const nextSolved = [...new Set([...solved, selectedExercise.id])];
      setSolved(nextSolved);
      localStorage.setItem(progressKey, JSON.stringify(nextSolved));
      setCheckMessage({ type: "success", text: "Correct! Exercise marked complete." });
    } catch (error) {
      setCheckMessage({ type: "error", text: explainSqlError(error) });
    } finally {
      learnerDb?.close();
      expectedDb?.close();
    }
  }

  const tabs = ["Playground", "Lessons", "Exercises", "Tables", "Cheat sheet"];

  return (
    <>
      <PageHeader
        eyebrow="Interactive learning"
        title="SQL practice"
        description="Learn query basics and run SQL against a seeded SQLite database in your browser."
      />
      {engineError ? (
        <Feedback message={`SQL engine failed to load: ${engineError}`} type="error" />
      ) : !engineReady ? (
        <Feedback message="Loading the in-browser SQL engine..." type="info" />
      ) : (
        <>
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Playground" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold text-slate-900">SQL editor</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Try SELECT, JOIN, UPDATE, or DELETE statements on your local sample database.
                </p>
                <label htmlFor="sql-query" className="sr-only">
                  SQL query
                </label>
                <textarea
                  id="sql-query"
                  rows={12}
                  spellCheck="false"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="mt-4 w-full resize-y rounded-xl bg-slate-950 p-4 font-mono text-sm leading-6 text-emerald-200 outline-none focus:ring-4 focus:ring-indigo-500/20"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runQuery}
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Run query
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(selectedExercise.answer);
                      setQueryError("");
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Load answer
                  </button>
                </div>
                <Feedback message={queryError} type="error" />
                {result && (
                  <p className="mt-3 text-xs text-slate-500">
                    {result.changedRows === null
                      ? `${result.values.length} row(s) returned`
                      : `${result.changedRows} row(s) changed`}
                  </p>
                )}
              </section>

              <section className="min-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">Query results</h2>
                </div>
                {result ? (
                  result.columns.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                          <tr>
                            {result.columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {result.values.slice(0, 200).map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((value, columnIndex) => (
                                <td key={columnIndex} className="whitespace-nowrap px-4 py-3 text-slate-700">
                                  {value === null ? <span className="italic text-slate-400">NULL</span> : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="p-5 text-sm text-slate-600">
                      Query completed. {result.changedRows} row(s) changed.
                    </p>
                  )
                ) : (
                  <p className="p-5 text-sm text-slate-500">Run a query to see its results here.</p>
                )}
              </section>
            </div>
          )}

          {activeTab === "Lessons" && (
            <div className="grid gap-4 md:grid-cols-2">
              {lessons.map((lesson, index) => (
                <article key={lesson.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    Lesson {index + 1}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{lesson.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{lesson.body}</p>
                  <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-emerald-200">
                    <code>{lesson.example}</code>
                  </pre>
                </article>
              ))}
            </div>
          )}

          {activeTab === "Exercises" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
              <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="px-2 pb-2 font-semibold text-slate-900">
                  Exercises <span className="text-sm font-normal text-slate-500">({solved.length}/{exercises.length} solved)</span>
                </h2>
                {exercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => {
                      setSelectedExercise(exercise);
                      setQuery("");
                      setCheckMessage(null);
                    }}
                    className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${
                      selectedExercise.id === exercise.id
                        ? "bg-indigo-50 text-indigo-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span>{exercise.title}</span>
                      {solved.includes(exercise.id) && <span className="text-emerald-600">✓</span>}
                    </span>
                  </button>
                ))}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Exercise</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{selectedExercise.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedExercise.prompt}</p>
                <label htmlFor="exercise-query" className="sr-only">Your SQL answer</label>
                <textarea
                  id="exercise-query"
                  rows={8}
                  spellCheck="false"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Write your query..."
                  className="mt-5 w-full resize-y rounded-xl bg-slate-950 p-4 font-mono text-sm leading-6 text-emerald-200 outline-none focus:ring-4 focus:ring-indigo-500/20"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={checkAnswer}
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Check answer
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Playground")}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Open playground
                  </button>
                </div>
                <div className="mt-4">
                  <Feedback message={checkMessage?.text} type={checkMessage?.type} />
                </div>
              </section>
            </div>
          )}

          {activeTab === "Tables" && (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["users", "id, name, email, role, active"],
                ["bugs", "id, title, severity, status"],
                ["test_cases", "id, title, module, status, tester_id"],
                ["signups", "id, email, confirmed"],
              ].map(([table, schema]) => (
                <article key={table} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="font-mono text-sm font-semibold text-indigo-700">{table}</h2>
                  <p className="mt-2 text-sm text-slate-600">{schema}</p>
                </article>
              ))}
            </div>
          )}

          {activeTab === "Cheat sheet" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-5 py-3">Task</th><th className="px-5 py-3">SQL pattern</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ["Filter rows", "WHERE condition"],
                      ["Sort output", "ORDER BY column ASC | DESC"],
                      ["Limit rows", "LIMIT number"],
                      ["Group rows", "GROUP BY column"],
                      ["Join tables", "JOIN other_table ON key = key"],
                      ["Add a row", "INSERT INTO table (column) VALUES (value)"],
                      ["Update rows", "UPDATE table SET column = value WHERE condition"],
                      ["Delete rows", "DELETE FROM table WHERE condition"],
                    ].map(([task, pattern]) => (
                      <tr key={task}><td className="px-5 py-3 font-medium text-slate-800">{task}</td><td className="px-5 py-3 font-mono text-xs text-slate-600">{pattern}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
