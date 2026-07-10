import { nameToPinyinAccountPart } from "./nameToPinyin";
import type { ParsedImportRow, PreviewImportRow } from "./types";

const TEACHER_EMAIL_DOMAIN = "shphschool.com";
const STUDENT_AUTH_DOMAIN = "orp.local";

export function buildPreviewRows(rows: ParsedImportRow[]): PreviewImportRow[] {
  return rows.map((row) => {
    const teacherEmailPrefix = nameToPinyinAccountPart(row.teacherName);
    const studentUsername = nameToPinyinAccountPart(row.studentName);

    return {
      ...row,
      teacherEmailPrefix,
      teacherEmail: `${teacherEmailPrefix}@${TEACHER_EMAIL_DOMAIN}`,
      studentUsername,
      studentAuthEmail: `${studentUsername}@${STUDENT_AUTH_DOMAIN}`,
    };
  });
}