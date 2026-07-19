import { pinyin } from "pinyin-pro";
import type { ParsedImportRow, PreviewImportRow } from "./types";

const TEACHER_EMAIL_DOMAIN = "shphschool.com";

function safeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * 导入链路统一只传 english / math。
 * parseImportText.ts 已经做过一次规范化；
 * 这里再保守清洗一次，避免页面或测试直接传入中文。
 */
function normalizeSubject(value: unknown) {
  const text = safeText(value).toLowerCase();

  if (!text) return "";

  if (["英语", "英文", "english", "en"].includes(text)) {
    return "english";
  }

  if (["数学", "math", "maths", "mathematics"].includes(text)) {
    return "math";
  }

  return safeText(value);
}

function cleanTeacherEmailSuffix(value: unknown) {
  return safeText(value);
}

function nameToPinyinAccountPart(name: unknown) {
  const trimmedName = safeText(name);

  if (!trimmedName) return "";

  // 少数姓名的拼音账号可能需要人工指定，避免多音字或特殊规则出错。
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

      // subject 同时用于 classes.subject 和 teachers.subject。
      // students 不存 subject，学生学科从班级关系推导。
      subject: normalizeSubject(row.subject),

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