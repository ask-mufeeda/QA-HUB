import test from "node:test";
import assert from "node:assert/strict";

import { automationLessons } from "../data/automationLessons.js";
import { getProgressSummary, markLessonDone } from "./automationLearning.js";

test("getProgressSummary counts completed lessons and percent", () => {
  const summary = getProgressSummary(
    ["automation-lesson-1", "automation-lesson-3"],
    automationLessons,
  );

  assert.equal(summary.completedCount, 2);
  assert.equal(summary.totalLessons, 6);
  assert.equal(summary.progressPercent, 33);
});

test("markLessonDone keeps each user set separate", () => {
  const userA = new Set(["automation-lesson-1"]);
  const userB = new Set();

  const updatedUserA = markLessonDone(userA, "automation-lesson-2");
  const updatedUserB = markLessonDone(userB, "automation-lesson-2");

  assert.deepEqual([...updatedUserA].sort(), ["automation-lesson-1", "automation-lesson-2"]);
  assert.deepEqual([...updatedUserB].sort(), ["automation-lesson-2"]);
  assert.equal(updatedUserA.has("automation-lesson-1"), true);
  assert.equal(updatedUserB.has("automation-lesson-1"), false);
});
