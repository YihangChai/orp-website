import { nameToPinyinAccountPart } from "./nameToPinyin";
import type { ParsedImportRow, PreviewImportRow } from "./types";

const TEACHER_EMAIL_DOMAIN = "shphschool.com";
const STUDENT_AUTH_DOMAIN = "orp.local";

function cleanTeacherEmailSuffix(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function buildPreviewRows(rows: ParsedImportRow[]): PreviewImportRow[] {
  return rows.map((row) => {
    const teacherEmailPrefix = nameToPinyinAccountPart(row.teacherName);
    const teacherEmailSuffix = cleanTeacherEmailSuffix(row.teacherEnteringYear);
    const studentUsername = nameToPinyinAccountPart(row.studentName);

    return {
      ...row,
      teacherEmailPrefix,
      teacherEmail: `${teacherEmailPrefix}${teacherEmailSuffix}@${TEACHER_EMAIL_DOMAIN}`,
      studentUsername,
      studentAuthEmail: `${studentUsername}@${STUDENT_AUTH_DOMAIN}`,
    };
  });
}