import { pinyin } from "pinyin-pro";
import type { ParsedImportRow, PreviewImportRow } from "./types";

const TEACHER_EMAIL_DOMAIN = "shphschool.com";

function safeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function cleanTeacherEmailSuffix(value: unknown) {
  return safeText(value);
}

function nameToPinyinAccountPart(name: unknown) {
  const trimmedName = safeText(name);

  if (!trimmedName) return "";

  const manualMap: Record<string, string> = {
    柴一航: "chaiyihang",
  };

  if (manualMap[trimmedName]) {
    return manualMap[trimmedName];
  }

  return pinyin(trimmedName, {
    toneType: "none",
    type: "array",
  })
    .join("")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function cleanStudentNames(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.map((name) => safeText(name)).filter(Boolean);
}

export function buildPreviewRows(rows: ParsedImportRow[]): PreviewImportRow[] {
  return rows.map((row) => {
    const rowNumber = Number(row.rowNumber || row.lineNumber || 0);

    const teacherEmailPrefix = nameToPinyinAccountPart(row.teacherName);
    const teacherEmailSuffix = cleanTeacherEmailSuffix(
      row.teacherEnteringYear
    );

    const teacherEmail =
      teacherEmailPrefix && teacherEmailSuffix
        ? `${teacherEmailPrefix}${teacherEmailSuffix}@${TEACHER_EMAIL_DOMAIN}`
        : "";

    return {
      rowNumber,
      lineNumber: rowNumber,

      cohortName: safeText(row.cohortName),
      className: safeText(row.className),
      school: safeText(row.school),

      teacherName: safeText(row.teacherName),
      teacherEnteringYear: safeText(row.teacherEnteringYear),
      teacherEmailPrefix,
      teacherEmail,

      studentNames: cleanStudentNames(row.studentNames),
      studentGrade: safeText(row.studentGrade),

      rawLine: safeText(row.rawLine),
    };
  });
}