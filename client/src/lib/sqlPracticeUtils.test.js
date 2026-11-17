import test from "node:test";
import assert from "node:assert/strict";

import { compareSqlResults } from "./sqlPracticeUtils.js";

test("compareSqlResults matches rows when order differs", () => {
  const actual = {
    columns: ["name", "status"],
    values: [["Mina", "Open"], ["Asha", "Closed"]],
  };
  const expected = {
    columns: ["NAME", "STATUS"],
    values: [["Asha", "Closed"], ["Mina", "Open"]],
  };

  const result = compareSqlResults(actual, expected, { ignoreRowOrder: true });

  assert.equal(result.isMatch, true);
  assert.equal(result.reason, "Correct.");
});

test("compareSqlResults catches missing rows", () => {
  const actual = {
    columns: ["id"],
    values: [[1]],
  };
  const expected = {
    columns: ["id"],
    values: [[1], [2]],
  };

  const result = compareSqlResults(actual, expected, { ignoreRowOrder: true });

  assert.equal(result.isMatch, false);
  assert.match(result.reason, /Missing rows/i);
});

test("compareSqlResults catches extra rows", () => {
  const actual = {
    columns: ["id"],
    values: [[1], [2], [3]],
  };
  const expected = {
    columns: ["id"],
    values: [[1], [2]],
  };

  const result = compareSqlResults(actual, expected, { ignoreRowOrder: true });

  assert.equal(result.isMatch, false);
  assert.match(result.reason, /Extra rows/i);
});

test("compareSqlResults catches column mismatch and row mismatch", () => {
  const actual = {
    columns: ["name"],
    values: [["Asha"]],
  };
  const expected = {
    columns: ["email"],
    values: [["asha@example.test"]],
  };

  const result = compareSqlResults(actual, expected, { ignoreRowOrder: true });

  assert.equal(result.isMatch, false);
  assert.match(result.reason, /columns do not match/i);
});
