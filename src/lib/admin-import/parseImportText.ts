import type { ParsedImportRow } from "./types";

/**
 * 一行导入文本目前对应一个班级。
 *
 * 当前列顺序：
 * 0 届别
 * 1 班级名称
 * 2 合作学校
 * 3 学科
 * 4 小老师姓名
 * 5 小老师邮箱后缀
 * 6 学生名单
 * 7 学生年级
 */

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

/**
 * 导入时数据库只存英文值：
 * english / math
 *
 * 前端展示中文交给页面层处理。
 * 如果这里无法识别，先保留原文本，后续 validateImportRows.ts 会报错。
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

function isHeaderLine(line: string) {
  const text = safeText(line);

  return (
    text.includes("届别") &&
    text.includes("班级") &&
    text.includes("小老师") &&
    text.includes("学生")
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
  const sourceText = typeof text === "string" ? text : safeText(text);

  return sourceText
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
      const subject = normalizeSubject(cell(parts, 3));

      const teacherName = cell(parts, 4);
      const teacherEnteringYear = cell(parts, 5);

      const studentNamesText = cell(parts, 6);
      const studentGrade = cell(parts, 7);

      return {
        rowNumber: item.rowNumber,
        lineNumber: item.lineNumber,

        cohortName,
        className,
        school,
        subject,

        teacherName,
        teacherEnteringYear,

        studentNames: splitStudentNames(studentNamesText),
        studentGrade,

        rawLine: item.rawLine,
      };
    });
}