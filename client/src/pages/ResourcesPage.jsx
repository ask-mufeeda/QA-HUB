import { useEffect, useMemo, useState } from "react";
import Feedback from "../components/Feedback.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { learningSections } from "../data/learningSections.js";

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

function progressErrorMessage(error) {
  const message =
    error instanceof Error ? error.message : "The request could not be completed.";

  if (
    message.includes("learning_progress") &&
    /schema cache|relation|does not exist|not found/i.test(message)
  ) {
    return "Learning progress storage is not set up yet. Run client/supabase/learning-progress.sql in your Supabase SQL editor.";
  }

  return message;
}

export default function ResourcesPage() {
  const { user } = useAuth();
  const [completedLessonIds, setCompletedLessonIds] = useState(() => new Set());
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [savingLessonId, setSavingLessonId] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);

  const allLessonIds = useMemo(
    () => new Set(learningSections.flatMap((section) => section.lessons.map((lesson) => lesson.id))),
    [],
  );
  const totalLessons = allLessonIds.size;
  const completedCount = [...completedLessonIds].filter((id) =>
    allLessonIds.has(id),
  ).length;
  const overallProgress = totalLessons
    ? Math.round((completedCount / totalLessons) * 100)
    : 0;
  const selectedSection = learningSections.find(
    (section) => section.id === selectedSectionId,
  );
  const selectedLesson = selectedSection?.lessons.find(
    (lesson) => lesson.id === selectedLessonId,
  );

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      if (!user?.id) {
        setProgressError("Sign in to load your learning progress.");
        setProgressLoading(false);
        return;
      }

      setProgressLoading(true);
      setProgressError("");

      try {
        const { data, error } = await supabase
          .from("learning_progress")
          .select("lesson_id")
          .eq("user_id", user.id);
        if (error) throw error;

        if (active) {
          setCompletedLessonIds(
            new Set(
              (data ?? [])
                .map((row) => row.lesson_id)
                .filter((lessonId) => allLessonIds.has(lessonId)),
            ),
          );
        }
      } catch (error) {
        if (active) {
          console.error("Could not load learning progress:", error);
          setProgressError(progressErrorMessage(error));
        }
      } finally {
        if (active) setProgressLoading(false);
      }
    }

    loadProgress();
    return () => {
      active = false;
    };
  }, [allLessonIds, user?.id]);

  function openSection(section) {
    setSelectedSectionId(section.id);
    setSelectedLessonId(section.lessons[0]?.id ?? null);
    setFeedback(null);
  }

  async function markLessonCompleted(lessonId) {
    if (!user?.id || completedLessonIds.has(lessonId) || savingLessonId) return;

    setSavingLessonId(lessonId);
    setFeedback(null);

    try {
      const { error } = await supabase.from("learning_progress").upsert(
        { user_id: user.id, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id" },
      );
      if (error) throw error;

      setCompletedLessonIds((current) => new Set([...current, lessonId]));
      setProgressError("");
      setFeedback({
        type: "success",
        text: "Lesson completed and saved to your account.",
      });
    } catch (error) {
      console.error("Could not save lesson progress:", error);
      setFeedback({
        type: "error",
        text: `Could not save lesson progress: ${progressErrorMessage(error)}`,
      });
    } finally {
      setSavingLessonId("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Learning library"
        title={selectedSection?.title ?? "QA learning library"}
        description={
          selectedSection?.description ??
          "Build practical testing skills with short lessons, exercises, and interview questions."
        }
        actions={
          selectedSection ? (
            <button
              type="button"
              onClick={() => {
                setSelectedSectionId(null);
                setSelectedLessonId(null);
                setFeedback(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              All sections
            </button>
          ) : null
        }
      />

      <div className="space-y-5">
        {progressError && <Feedback message={progressError} type="error" />}
        {progressLoading && (
          <Feedback message="Loading your saved learning progress..." type="info" />
        )}

        {!selectedSection ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Your learning progress
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {completedCount} of {totalLessons} lessons completed
                  </p>
                </div>
                <p className="text-2xl font-bold tracking-tight text-indigo-700">
                  {overallProgress}%
                </p>
              </div>
              <ProgressBar value={overallProgress} label="Overall learning progress" />
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              {learningSections.map((section) => {
                const sectionCompletedCount = section.lessons.filter((lesson) =>
                  completedLessonIds.has(lesson.id),
                ).length;
                const sectionProgress = section.lessons.length
                  ? Math.round(
                      (sectionCompletedCount / section.lessons.length) * 100,
                    )
                  : 0;

                return (
                  <section
                    key={section.id}
                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                        {section.number}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {section.lessons.length} lessons
                      </span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-900">
                      {section.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                      {section.description}
                    </p>
                    <div className="mt-5">
                      <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
                        <span>
                          {sectionCompletedCount}/{section.lessons.length} completed
                        </span>
                        <span>{sectionProgress}%</span>
                      </div>
                      <ProgressBar
                        value={sectionProgress}
                        label={`${section.title} progress`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openSection(section)}
                      className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Learn more <span aria-hidden="true">→</span>
                    </button>
                  </section>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(230px,0.7fr)_minmax(0,1.7fr)]">
            <nav
              aria-label={`${selectedSection.title} lessons`}
              className="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lessons
                </p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {selectedSection.lessons.filter((lesson) =>
                    completedLessonIds.has(lesson.id),
                  ).length}{" "}
                  of {selectedSection.lessons.length} completed
                </p>
              </div>
              <div className="mt-1 space-y-1">
                {selectedSection.lessons.map((lesson, index) => {
                  const isSelected = lesson.id === selectedLessonId;
                  const isCompleted = completedLessonIds.has(lesson.id);
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      aria-current={isSelected ? "page" : undefined}
                      onClick={() => {
                        setSelectedLessonId(lesson.id);
                        setFeedback(null);
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-700"
                            : isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isCompleted ? "✓" : index + 1}
                      </span>
                      <span className="text-sm font-medium leading-5">
                        {lesson.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {selectedLesson && (
              <article className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    {selectedSection.title} · Lesson{" "}
                    {selectedSection.lessons.findIndex(
                      (lesson) => lesson.id === selectedLesson.id,
                    ) + 1}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    {selectedLesson.title}
                  </h2>
                </div>

                <section>
                  <h3 className="text-sm font-semibold text-slate-900">The idea</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedLesson.explanation}
                  </p>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Practical example
                  </h3>
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
                    {selectedLesson.example}
                  </pre>
                </section>

                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Try it yourself
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedLesson.exercise.prompt}
                  </p>
                  <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
                      Show exercise answer
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedLesson.exercise.answer}
                    </p>
                  </details>
                </section>

                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Interview practice
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    {selectedLesson.interview.question}
                  </p>
                  <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
                      Show suggested answer
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedLesson.interview.answer}
                    </p>
                  </details>
                </section>

                {feedback && (
                  <Feedback message={feedback.text} type={feedback.type} />
                )}

                <button
                  type="button"
                  onClick={() => markLessonCompleted(selectedLesson.id)}
                  disabled={
                    progressLoading ||
                    Boolean(savingLessonId) ||
                    completedLessonIds.has(selectedLesson.id)
                  }
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed ${
                    completedLessonIds.has(selectedLesson.id)
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  }`}
                >
                  {savingLessonId === selectedLesson.id
                    ? "Saving progress..."
                    : savingLessonId
                      ? "Saving another lesson..."
                      : completedLessonIds.has(selectedLesson.id)
                        ? "Completed"
                        : "Mark as Completed"}
                </button>
              </article>
            )}
          </div>
        )}
      </div>
    </>
  );
}
