import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { supabase } from "../lib/supabase.js";
import { compareSqlResults } from "../lib/sqlPracticeUtils.js";

const progressKey = "qahub_sql_solved_v2";

const tableSchemas = {
  users: [
    { name: "id", type: "INTEGER" },
    { name: "name", type: "TEXT" },
    { name: "email", type: "TEXT" },
    { name: "role", type: "TEXT" },
    { name: "active", type: "INTEGER" },
  ],
  bugs: [
    { name: "id", type: "INTEGER" },
    { name: "title", type: "TEXT" },
    { name: "severity", type: "TEXT" },
    { name: "status", type: "TEXT" },
  ],
  test_cases: [
    { name: "id", type: "INTEGER" },
    { name: "title", type: "TEXT" },
    { name: "module", type: "TEXT" },
    { name: "status", type: "TEXT" },
    { name: "tester_id", type: "INTEGER" },
  ],
  signups: [
    { name: "id", type: "INTEGER" },
    { name: "email", type: "TEXT" },
    { name: "confirmed", type: "INTEGER" },
  ],
};

const exercises = [
  {
    id: "active-users",
    title: "Find active users",
    difficulty: "easy",
    task: "Select the names of all active users.",
    expectedQuery: "SELECT name FROM users WHERE active = 1 ORDER BY id;",
    hints: [
      "Start with SELECT name FROM users.",
      "Use WHERE active = 1 to keep only active users.",
      "Add ORDER BY id to make the list easy to read.",
    ],
  },
  {
    id: "open-bugs",
    title: "Count open bugs",
    difficulty: "easy",
    task: "Return one column named open_bugs with the number of open bugs.",
    expectedQuery: "SELECT COUNT(*) AS open_bugs FROM bugs WHERE status = 'Open';",
    hints: [
      "Use COUNT(*) to count rows.",
      "Filter the rows with WHERE status = 'Open'.",
      "Give the result column an alias with AS open_bugs.",
    ],
  },
  {
    id: "tester-join",
    title: "Join test cases to users",
    difficulty: "easy",
    task: "List each test case title and the tester name responsible for it.",
    expectedQuery:
      "SELECT test_cases.title, users.name FROM test_cases JOIN users ON test_cases.tester_id = users.id ORDER BY test_cases.id;",
    hints: [
      "Join test_cases to users with the tester_id column.",
      "Select the test title and the user name.",
      "Use ORDER BY test_cases.id to keep the rows in a clear order.",
    ],
  },
  {
    id: "bump-priority",
    title: "Find high priority bugs",
    difficulty: "easy",
    task: "Show all bug titles with severity High.",
    expectedQuery: "SELECT title FROM bugs WHERE severity = 'High';",
    hints: [
      "Use WHERE severity = 'High'.",
      "Select only the title column.",
      "No sorting is required for this one.",
    ],
  },
  {
    id: "ordered-bugs",
    title: "Sort bugs by ID",
    difficulty: "medium",
    task: "List all bug ids and titles from newest to oldest, using the smallest number first.",
    expectedQuery: "SELECT id, title FROM bugs ORDER BY id ASC;",
    hints: [
      "Choose the columns id and title.",
      "Add ORDER BY id ASC to sort the rows.",
      "The query should return all three bug rows.",
    ],
  },
  {
    id: "top-two-bugs",
    title: "Limit rows",
    difficulty: "medium",
    task: "Show the first two bug titles only.",
    expectedQuery: "SELECT title FROM bugs LIMIT 2;",
    hints: [
      "Select the title column only.",
      "Use LIMIT 2 to keep the first two rows.",
      "You do not need a WHERE clause here.",
    ],
  },
  {
    id: "bugs-by-severity",
    title: "Group bugs by severity",
    difficulty: "medium",
    task: "Count bugs in each severity group.",
    expectedQuery: "SELECT severity, COUNT(*) AS bug_count FROM bugs GROUP BY severity ORDER BY severity;",
    hints: [
      "Group by severity.",
      "Use COUNT(*) to count each group.",
      "Give the count a name and sort by severity.",
    ],
  },
  {
    id: "test-cases-per-module",
    title: "Failed test cases per module",
    difficulty: "medium",
    task: "Count failed test cases by module.",
    expectedQuery:
      "SELECT module, COUNT(*) AS failed_tests FROM test_cases WHERE status = 'Fail' GROUP BY module ORDER BY module;",
    hints: [
      "Filter to rows where status = 'Fail'.",
      "Group by module.",
      "Count rows and sort by module.",
    ],
  },
  {
    id: "users-with-no-bugs",
    title: "Users with no bugs",
    difficulty: "hard",
    task: "List users who have no matching bug record.",
    expectedQuery:
      "SELECT users.name FROM users LEFT JOIN bugs ON bugs.title = users.name WHERE bugs.id IS NULL;",
    hints: [
      "Use LEFT JOIN and compare with the bug table.",
      "Keep rows where the bug row is missing.",
      "Select the user name from the users table.",
    ],
  },
  {
    id: "unconfirmed-signups",
    title: "Find unconfirmed signups",
    difficulty: "easy",
    task: "List emails from signups that are not confirmed.",
    expectedQuery: "SELECT email FROM signups WHERE confirmed = 0 ORDER BY id;",
    hints: [
      "Filter with WHERE confirmed = 0.",
      "Select the email column.",
      "Add ORDER BY id if you want a stable order.",
    ],
  },
  {
    id: "active-testers",
    title: "Active testers only",
    difficulty: "easy",
    task: "Show the names of testers whose account is active.",
    expectedQuery: "SELECT name FROM users WHERE role = 'tester' AND active = 1 ORDER BY name;",
    hints: [
      "Use both a role filter and an active filter.",
      "Select the name column.",
      "Sort by name for a tidy list.",
    ],
  },
  {
    id: "bugs-per-status",
    title: "Bugs per status",
    difficulty: "medium",
    task: "Count bugs by their status.",
    expectedQuery: "SELECT status, COUNT(*) AS total FROM bugs GROUP BY status ORDER BY status;",
    hints: [
      "Group by the status column.",
      "Use COUNT(*) to count rows in each group.",
      "Sort by status so the output is easy to read.",
    ],
  },
  {
    id: "search-case-status",
    title: "Search module status",
    difficulty: "medium",
    task: "Show the titles and module names for failed test cases in the Search module.",
    expectedQuery:
      "SELECT title, module FROM test_cases WHERE module = 'Search' AND status = 'Fail';",
    hints: [
      "Use WHERE module = 'Search'.",
      "Also filter on status = 'Fail'.",
      "Select the title and module columns.",
    ],
  },
  {
    id: "user-bug-counts",
    title: "Count bugs by severity and status",
    difficulty: "hard",
    task: "Show severity and the count of bugs in each severity group.",
    expectedQuery: "SELECT severity, COUNT(*) AS total FROM bugs GROUP BY severity ORDER BY severity;",
    hints: [
      "Group by severity.",
      "Count the rows in each group.",
      "Use ORDER BY severity for a stable result.",
    ],
  },
  {
    id: "tester-summary",
    title: "Tester summary",
    difficulty: "hard",
    task: "List each tester name and how many test cases they own.",
    expectedQuery:
      "SELECT users.name, COUNT(test_cases.id) AS total_cases FROM users LEFT JOIN test_cases ON users.id = test_cases.tester_id WHERE users.role = 'tester' GROUP BY users.name ORDER BY users.name;",
    hints: [
      "Join users to test_cases on the user id.",
      "Filter to testers only.",
      "Group by the tester name and count matching rows.",
    ],
  },
  {
    id: "latest-signup",
    title: "Most recent signup",
    difficulty: "medium",
    task: "Show the newest unconfirmed signup email and id.",
    expectedQuery: "SELECT id, email FROM signups WHERE confirmed = 0 ORDER BY id DESC LIMIT 1;",
    hints: [
      "Filter with confirmed = 0.",
      "Sort by id in descending order.",
      "Use LIMIT 1 to keep the newest row.",
    ],
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
  const statement = finalStatement(sql);

  if (!statement) {
    return { columns: [], values: [], changedRows: null };
  }

  const readOnly = /^(SELECT|WITH|PRAGMA)\b/i.test(statement);

  if (!readOnly) {
    const result = db.run(sql);
    return {
      columns: ["Rows changed"],
      values: [[db.getRowsModified()]],
      changedRows: result ? db.getRowsModified() : 0,
    };
  }

  const result = db.exec(sql);
  const lastResult = result.at(-1);
  return {
    columns: lastResult?.columns ?? [],
    values: lastResult?.values ?? [],
    changedRows: null,
  };
}

function explainSqlError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/no such table/i.test(message)) return `${message}. Check the table name.`;
  if (/no such column/i.test(message)) return `${message}. Check the column name.`;
  if (/syntax error/i.test(message)) return `${message}. Check your SQL syntax and commas.`;
  if (/unique constraint/i.test(message)) return `${message}. A value must be unique.`;
  return message;
}

function sqlProgressErrorMessage(error) {
  const message =
    error instanceof Error ? error.message : "The request could not be completed.";

  if (
    message.includes("sql_practice_progress") &&
    /schema cache|relation|does not exist|not found/i.test(message)
  ) {
    return "SQL progress storage is not set up yet. Run client/supabase/sql-practice-progress.sql in your Supabase SQL editor.";
  }

  return message;
}

function toCsvRow(values) {
  return values
    .map((value) => {
      const text = value === null ? "" : String(value).replace(/"/g, '""');
      return `"${text}"`;
    })
    .join(",");
}

function downloadCsv(result) {
  if (!result || !result.columns.length) return;
  const rows = [toCsvRow(result.columns), ...result.values.map((row) => toCsvRow(row))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = "sql-practice-results.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ProgressBar({ value, label }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full bg-slate-200"
    >
      <div
        className="h-full rounded-full bg-indigo-600 transition-[width]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function SqlPracticePage() {
  const { user } = useAuth();
  const database = useRef(null);
  const sqlModule = useRef(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [activeTab, setActiveTab] = useState("Playground");
  const [query, setQuery] = useState("SELECT * FROM bugs;");
  const [result, setResult] = useState(null);
  const [queryError, setQueryError] = useState("");
  const [checkMessage, setCheckMessage] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [executionTime, setExecutionTime] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]);
  const [exerciseProgress, setExerciseProgress] = useState({});
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [attemptsByExercise, setAttemptsByExercise] = useState({});
  const [hintIndex, setHintIndex] = useState(0);
  const [hintsVisible, setHintsVisible] = useState(false);
  const [tablePreview, setTablePreview] = useState({});

  const tabs = ["Playground", "Lessons", "Exercises", "Tables", "Cheat sheet"];
  const visibleExercises = useMemo(
    () =>
      exercises.filter(
        (exercise) => selectedDifficulty === "all" || exercise.difficulty === selectedDifficulty,
      ),
    [selectedDifficulty],
  );

  const completedExerciseIds = useMemo(
    () => new Set(Object.entries(exerciseProgress).filter(([, value]) => value?.completed).map(([id]) => id)),
    [exerciseProgress],
  );
  const totalExercises = exercises.length;
  const completedExercises = completedExerciseIds.size;
  const progressPercent = totalExercises ? Math.round((completedExercises / totalExercises) * 100) : 0;

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

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      if (!user?.id) {
        try {
          const savedProgress = JSON.parse(localStorage.getItem(progressKey) ?? "{}");
          if (active) {
            setExerciseProgress(savedProgress);
          }
        } catch {
          if (active) {
            setExerciseProgress({});
          }
        }
        if (active) setProgressLoading(false);
        return;
      }

      setProgressLoading(true);
      setProgressError("");

      try {
        const { data, error } = await supabase
          .from("sql_practice_progress")
          .select("exercise_id, attempt_count, completed, completed_at")
          .eq("user_id", user.id);

        if (error) throw error;

        const nextProgress = {};
        for (const row of data ?? []) {
          nextProgress[row.exercise_id] = {
            attemptCount: row.attempt_count ?? 0,
            completed: Boolean(row.completed),
            completedAt: row.completed_at,
          };
        }

        if (active) {
          setExerciseProgress(nextProgress);
        }
      } catch (error) {
        if (active) {
        setProgressError(sqlProgressErrorMessage(error));
        }
      } finally {
        if (active) setProgressLoading(false);
      }
    }

    loadProgress();
    return () => {
      active = false;
    };
  }, [user?.id]);

  function persistProgress(exerciseId, completed, nextAttemptCount) {
    const nextProgress = {
      ...exerciseProgress,
      [exerciseId]: {
        attemptCount: nextAttemptCount,
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      },
    };
    setExerciseProgress(nextProgress);

    if (user?.id) {
      supabase
        .from("sql_practice_progress")
        .upsert(
          {
            user_id: user.id,
            exercise_id: exerciseId,
            attempt_count: nextAttemptCount,
            completed,
            completed_at: completed ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,exercise_id" },
        )
        .then(({ error }) => {
          if (error) {
            setProgressError(error.message);
          }
        });
      return;
    }

    localStorage.setItem(progressKey, JSON.stringify(nextProgress));
  }

  function runQuery() {
    if (!database.current) return;
    setQueryError("");
    const started = performance.now();
    try {
      const nextResult = runSql(database.current, query);
      setResult(nextResult);
      setExecutionTime(Math.round(performance.now() - started));
      setQueryHistory((current) => [query.trim(), ...current.filter((item) => item !== query.trim())].slice(0, 20));
    } catch (error) {
      setExecutionTime(Math.round(performance.now() - started));
      setQueryError(explainSqlError(error));
    }
  }

  function resetDatabase() {
    if (!sqlModule.current) return;
    database.current = seedDatabase(sqlModule.current);
    setResult(null);
    setQueryError("");
    setQuery("SELECT * FROM bugs;");
    setCheckMessage({ type: "success", text: "The sample database has been reset." });
  }

  function handleExerciseHint() {
    if (!selectedExercise?.hints.length) return;
    const nextIndex = Math.min((hintIndex ?? 0) + 1, selectedExercise.hints.length - 1);
    setHintsVisible(true);
    setHintIndex(nextIndex);
  }

  function handleExerciseSelection(exercise) {
    setSelectedExercise(exercise);
    setQuery("");
    setCheckMessage(null);
    setHintsVisible(false);
    setHintIndex(0);
  }

  function checkAnswer() {
    if (!database.current || !selectedExercise) return;

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setCheckMessage({ type: "error", text: "Write a query before checking the answer." });
      return;
    }

    const nextAttemptCount = (attemptsByExercise[selectedExercise.id] ?? 0) + 1;
    setAttemptsByExercise((current) => ({ ...current, [selectedExercise.id]: nextAttemptCount }));
    setHintsVisible(false);
    setHintIndex(0);

    let learnerDb = null;
    let expectedDb = null;

    try {
      learnerDb = seedDatabase(sqlModule.current);
      expectedDb = seedDatabase(sqlModule.current);

      const wantedOutput = runSql(expectedDb, selectedExercise.expectedQuery);
      const learnerOutput = runSql(learnerDb, trimmedQuery);
      const comparison = compareSqlResults(
        learnerOutput,
        wantedOutput,
        { ignoreRowOrder: !/ORDER BY/i.test(selectedExercise.expectedQuery) },
      );

      if (!comparison.isMatch) {
        setCheckMessage({ type: "error", text: `Not quite. ${comparison.reason}` });
        persistProgress(selectedExercise.id, false, nextAttemptCount);
        return;
      }

      setCheckMessage({ type: "success", text: "Correct! Exercise marked complete." });
      persistProgress(selectedExercise.id, true, nextAttemptCount);
    } catch (error) {
      setCheckMessage({ type: "error", text: explainSqlError(error) });
      persistProgress(selectedExercise.id, false, nextAttemptCount);
    } finally {
      learnerDb?.close();
      expectedDb?.close();
    }
  }

  function showSolution() {
    if (!selectedExercise) return;
    const confirmed = window.confirm(
      "This will reveal the answer. Do you want to continue?",
    );
    if (!confirmed) return;
    setQuery(selectedExercise.expectedQuery);
    setCheckMessage({ type: "info", text: "The expected query is shown below. Try it in the playground." });
  }

  function previewTable(tableName) {
    if (!database.current) return;
    const queryText = `SELECT * FROM ${tableName} LIMIT 5;`;
    const tableResult = runSql(database.current, queryText);
    setTablePreview((current) => ({ ...current, [tableName]: tableResult }));
  }

  const failedAttempts = attemptsByExercise[selectedExercise.id] ?? 0;
  const selectedExerciseProgress = exerciseProgress[selectedExercise.id] ?? { attemptCount: 0, completed: false };

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
          {progressError && <Feedback message={progressError} type="error" />}
          {progressLoading && <Feedback message="Loading saved exercise progress..." type="info" />}

          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Your SQL progress</p>
                <p className="text-sm text-slate-500">
                  {completedExercises} of {totalExercises} exercises completed
                </p>
              </div>
              <div className="text-xl font-bold text-indigo-700">{progressPercent}%</div>
            </div>
            <div className="mt-3">
              <ProgressBar value={progressPercent} label="SQL practice progress" />
            </div>
          </div>

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
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900">SQL editor</h2>
                  <button
                    type="button"
                    onClick={resetDatabase}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Reset database
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Try SELECT, JOIN, UPDATE, or DELETE statements on your local sample database.
                </p>
                <textarea
                  id="sql-query"
                  rows={12}
                  spellCheck="false"
                  value={query}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      runQuery();
                    }
                  }}
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
                    onClick={() => setQuery(selectedExercise.expectedQuery)}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Load exercise answer
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCsv(result)}
                    disabled={!result || !result.columns.length}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Export CSV
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-500">
                    {result
                      ? `${result.values.length} row(s) returned in ${executionTime} ms`
                      : "Run a query to see the row count and time."}
                  </p>
                  {queryHistory.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Recent queries
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {queryHistory.map((historyItem, index) => (
                          <button
                            key={`${historyItem}-${index}`}
                            type="button"
                            onClick={() => setQuery(historyItem)}
                            className="max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                          >
                            {historyItem}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {queryError && <div className="mt-3"><Feedback message={queryError} type="error" /></div>}
              </section>

              <section className="min-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">Query results</h2>
                </div>
                {result ? (
                  result.columns.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            {result.columns.map((column) => (
                              <th key={column} className="px-4 py-3 font-semibold">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {result.values.slice(0, 200).map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((value, columnIndex) => (
                                <td key={`${rowIndex}-${columnIndex}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
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
                      Query completed. {result.changedRows ?? 0} row(s) changed.
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
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3 px-2">
                  <h2 className="font-semibold text-slate-900">
                    Exercises <span className="text-sm font-normal text-slate-500">({completedExercises}/{totalExercises})</span>
                  </h2>
                  <select
                    value={selectedDifficulty}
                    onChange={(event) => setSelectedDifficulty(event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
                  >
                    <option value="all">All levels</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="space-y-2">
                  {visibleExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => handleExerciseSelection(exercise)}
                      className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${
                        selectedExercise.id === exercise.id
                          ? "bg-indigo-50 text-indigo-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-medium">{exercise.title}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-500">{exercise.difficulty}</span>
                      </span>
                      {completedExerciseIds.has(exercise.id) && (
                        <span className="mt-1 block text-xs font-semibold text-emerald-600">Completed</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Exercise</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{selectedExercise.title}</h2>
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>{selectedExercise.difficulty}</span>
                  {selectedExerciseProgress.completed && <span className="text-emerald-600">✓ complete</span>}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedExercise.task}</p>

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
                  {failedAttempts > 0 && !selectedExerciseProgress.completed && (
                    <button
                      type="button"
                      onClick={showSolution}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700"
                    >
                      Show solution
                    </button>
                  )}
                </div>

                {selectedExercise.hints.length > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">Hint</p>
                      <button
                        type="button"
                        onClick={handleExerciseHint}
                        className="text-sm font-semibold text-indigo-700"
                      >
                        {hintsVisible ? "Next hint" : "Reveal hint"}
                      </button>
                    </div>
                    {hintsVisible && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {selectedExercise.hints[Math.min(hintIndex, selectedExercise.hints.length - 1)]}
                      </p>
                    )}
                  </div>
                )}

                {checkMessage && (
                  <div className="mt-4">
                    <Feedback message={checkMessage.text} type={checkMessage.type} />
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "Tables" && (
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(tableSchemas).map(([tableName, columns]) => (
                <article key={tableName} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-mono text-sm font-semibold text-indigo-700">{tableName}</h2>
                    <button
                      type="button"
                      onClick={() => previewTable(tableName)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Preview 5 rows
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {columns.map((column) => (
                      <div key={`${tableName}-${column.name}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="font-mono text-xs text-slate-700">{column.name}</span>
                        <span className="text-xs text-slate-500">{column.type}</span>
                      </div>
                    ))}
                  </div>

                  {tablePreview[tableName] && tablePreview[tableName].columns.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            {tablePreview[tableName].columns.map((column) => (
                              <th key={`${tableName}-header-${column}`} className="px-2 py-1.5 font-semibold">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tablePreview[tableName].values.slice(0, 5).map((row, rowIndex) => (
                            <tr key={`${tableName}-row-${rowIndex}`}>
                              {row.map((value, columnIndex) => (
                                <td key={`${tableName}-cell-${rowIndex}-${columnIndex}`} className="px-2 py-1.5 text-slate-700">
                                  {value === null ? "NULL" : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {activeTab === "Cheat sheet" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Task</th>
                      <th className="px-5 py-3">SQL pattern</th>
                    </tr>
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
                      <tr key={task}>
                        <td className="px-5 py-3 font-medium text-slate-800">{task}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">{pattern}</td>
                      </tr>
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
