export function getProgressSummary(completedLessonIds = [], lessons = []) {
  const completedSet = new Set(
    (Array.isArray(completedLessonIds) ? completedLessonIds : []).map(String),
  );
  const totalLessons = Array.isArray(lessons) ? lessons.length : 0;
  const completedCount = lessons.reduce((count, lesson) => {
    return completedSet.has(String(lesson?.id ?? "")) ? count + 1 : count;
  }, 0);

  return {
    completedCount,
    totalLessons,
    progressPercent:
      totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
  };
}

export function markLessonDone(currentCompletedIds = new Set(), lessonId) {
  const nextSet = new Set(currentCompletedIds);
  if (lessonId) {
    nextSet.add(String(lessonId));
  }
  return nextSet;
}
