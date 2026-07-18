import type { ParsedImportRow } from "./types";

export function splitStudentNames(value: unknown) {
  const text =
    typeof value === "string"
      ? value
      : value === null || value === undefined
      ? ""
      : String(value);

  return text
    .split(/[,\，、;；/／]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function safeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isHeaderLine(line: string) {
  return (
    line.includes("届别") &&
    line.includes("班级") &&
    line.includes("小老师") &&
    line.includes("学生")
  );
}

function splitImportLine(line: string) {
  const trimmedLine = safeText(line);

  if (trimmedLine.includes("\t")) {
    return trimmedLine.split(/\t+/).map((part) => safeText(part));
  }

  return trimmedLine.split(/\s+/).map((part) => safeText(part));
}

function cell(parts: string[], index: number) {
  return safeText(parts[index]);
}

export function parseImportText(text: string): ParsedImportRow[] {
  return safeText(text)
    .split(/\r?\n/)
    .map((line, index) => {
      const trimmedLine = safeText(line);

      return {
        rawLine: line,
        rowNumber: index + 1,
        lineNumber: index + 1,
        trimmedLine,
      };
    })
    .filter((item) => item.trimmedLine.length > 0)
    .filter((item) => !isHeaderLine(item.trimmedLine))
    .map((item) => {
      const parts = splitImportLine(item.trimmedLine);

      const cohortName = cell(parts, 0);
      const className = cell(parts, 1);
      const school = cell(parts, 2);
      const teacherName = cell(parts, 3);
      const teacherEnteringYear = cell(parts, 4);
      const studentNamesText = cell(parts, 5);
      const studentGrade = cell(parts, 6);

      return {
        rowNumber: item.rowNumber,
        lineNumber: item.lineNumber,
        cohortName,
        className,
        school,
        teacherName,
        teacherEnteringYear,
        studentNames: splitStudentNames(studentNamesText),
        studentGrade,
        rawLine: item.rawLine,
      };
    });
}