function quoteCsvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function downloadCsv(filename, headers, rows, { protectFormula = false } = {}) {
  const csvRows = [
    headers,
    ...rows.map((row) =>
      headers.map((header) => {
        let value = row[header] ?? "";
        if (protectFormula && /^[=+\-@]/.test(String(value))) {
          value = `'${value}`;
        }
        return value;
      }),
    ),
  ];
  const content = `\uFEFF${csvRows
    .map((row) => row.map(quoteCsvValue).join(","))
    .join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
