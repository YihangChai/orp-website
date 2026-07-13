import { nameToPinyinAccountPart } from "./nameToPinyin";
import type { ParsedImportRow, PreviewImportRow } from "./types";

const TEACHER_EMAIL_DOMAIN = "shphschool.com";
const STUDENT_AUTH_DOMAIN = "orp.local";

function getTeacherEnteringYearSuffix(year: string) {
  const cleanedYear = year.trim();

  if (/^\d{4}$/.test(cleanedYear)) {
    return cleanedYear.slice(2);
  }

  if (/^\d{2}$/.test(cleanedYear)) {
    return cleanedYear;
  }

  return "";
}

export function buildPreviewRows(rows: ParsedImportRow[]): PreviewImportRow[] {
  return rows.map((row) => {
    const teacherEmailPrefix = nameToPinyinAccountPart(row.teacherName);
    const teacherEnteringYearSuffix = getTeacherEnteringYearSuffix(
      row.teacherEnteringYear
    );

    const studentUsername = nameToPinyinAccountPart(row.studentName);

    return {
      ...row,
      teacherEmailPrefix,
      teacherEmail: `${teacherEmailPrefix}${teacherEnteringYearSuffix}@${TEACHER_EMAIL_DOMAIN}`,
      studentUsername,
      studentAuthEmail: `${studentUsername}@${STUDENT_AUTH_DOMAIN}`,
    };
  });
}