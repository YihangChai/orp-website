import type { ParsedImportRow } from "./types";

function cleanCell(value: string | undefined) {
  return (value || "").trim();
}

function splitStudentNames(text: string) {
  return text
    .split(/、|,|，|;|；|\//)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function parseImportText(text: string): ParsedImportRow[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const firstLine = lines[0];

  const hasHeader =
    firstLine.includes("届别") ||
    firstLine.includes("班级") ||
    firstLine.includes("老师") ||
    firstLine.includes("学生");

  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: ParsedImportRow[] = [];

  dataLines.forEach((line, index) => {
    const rowNumber = hasHeader ? index + 2 : index + 1;

    const columns = line.split(/\t|,/).map((column) => column.trim());

    const [
      cohortName,
      className,
      school,
      teacherName,
      studentNamesText,
      studentGrade,
    ] = columns;

    const cleanedStudentNamesText = cleanCell(studentNamesText);
    const studentNames = splitStudentNames(cleanedStudentNamesText);

    if (studentNames.length === 0) {
      rows.push({
        rowNumber,
        cohortName: cleanCell(cohortName),
        className: cleanCell(className),
        school: cleanCell(school),
        teacherName: cleanCell(teacherName),
        studentName: "",
        studentGrade: cleanCell(studentGrade),
      });

      return;
    }

    studentNames.forEach((studentName) => {
      rows.push({
        rowNumber,
        cohortName: cleanCell(cohortName),
        className: cleanCell(className),
        school: cleanCell(school),
        teacherName: cleanCell(teacherName),
        studentName,
        studentGrade: cleanCell(studentGrade),
      });
    });
  });

  return rows;
}