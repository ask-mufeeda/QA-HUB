export function normalizeColumns(columns = []) {
  return columns.map((column) => String(column ?? "").trim().toLowerCase());
}

export function normalizeCell(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return value.trim();
  return String(value);
}

export function normalizeRows(rows = []) {
  return rows.map((row) => row.map((value) => normalizeCell(value)));
}

export function compareSqlResults(actual, expected, options = {}) {
  const { ignoreRowOrder = true } = options;

  const actualColumns = normalizeColumns(actual?.columns ?? []);
  const expectedColumns = normalizeColumns(expected?.columns ?? []);

  if (actualColumns.length !== expectedColumns.length) {
    return {
      isMatch: false,
      reason: `Wrong number of columns. Expected ${expectedColumns.length}, got ${actualColumns.length}.`,
    };
  }

  const columnMismatch = actualColumns.some((column, index) => column !== expectedColumns[index]);
  if (columnMismatch) {
    return {
      isMatch: false,
      reason: "The result columns do not match the expected output.",
    };
  }

  const actualRows = normalizeRows(actual?.values ?? []);
  const expectedRows = normalizeRows(expected?.values ?? []);

  const sortedActual = [...actualRows].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const sortedExpected = [...expectedRows].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

  const rowsToCompare = ignoreRowOrder ? [sortedActual, sortedExpected] : [actualRows, expectedRows];
  const [comparableActualRows, comparableExpectedRows] = rowsToCompare;

  if (comparableActualRows.length !== comparableExpectedRows.length) {
    const difference = comparableActualRows.length - comparableExpectedRows.length;
    if (difference > 0) {
      return {
        isMatch: false,
        reason: `Extra rows returned. Expected ${comparableExpectedRows.length}, got ${comparableActualRows.length}.`,
      };
    }

    return {
      isMatch: false,
      reason: `Missing rows. Expected ${comparableExpectedRows.length}, got ${comparableActualRows.length}.`,
    };
  }

  const mismatched = comparableActualRows.some((row, index) => {
    const expectedRow = comparableExpectedRows[index];
    return JSON.stringify(row) !== JSON.stringify(expectedRow);
  });

  if (mismatched) {
    return {
      isMatch: false,
      reason: "The row values do not match the expected result.",
    };
  }

  return {
    isMatch: true,
    reason: "Correct.",
  };
}
