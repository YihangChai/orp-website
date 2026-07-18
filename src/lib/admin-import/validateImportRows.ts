import type {
  ExecutionImportRow,
  ImportValidationError,
  ParsedImportRow,
  PreviewImportRow,
} from "./types";

type ImportRowForValidation =
  | ParsedImportRow
  | PreviewImportRow
  | ExecutionImportRow;

function safeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getRowNumber(row: ImportRowForValidation) {
  return Number(row.rowNumber || row.lineNumber || 0);
}

function getStudentNames(row: ImportRowForValidation) {
  const possibleExecutionRow = row as Partial<ExecutionImportRow>;

  if (Array.isArray(row.studentNames)) {
    return row.studentNames.map(safeText).filter(Boolean);
  }

  const singleStudentName = safeText(possibleExecutionRow.studentName);

  if (singleStudentName) {
    return [singleStudentName];
  }

  return [];
}

function isValidTeacherEmailSuffix(value: unknown) {
  const suffix = safeText(value);
  return /^\d{2,3}$/.test(suffix);
}

function normalizeClassKey(params: { cohortName: string; className: string }) {
  return [
    params.cohortName,
    params.className.replace(/\s+/g, "").toLowerCase(),
  ].join("__");
}

function normalizeStudentName(name: unknown) {
  return safeText(name).replace(/\s+/g, "");
}

function pushError(
  errors: ImportValidationError[],
  params: {
    rowNumber: number;
    field: string;
    message: string;
  }
) {
  errors.push({
    rowNumber: params.rowNumber,
    field: params.field,
    message: params.message,
  });
}

export function validateImportRows(
  rows: ImportRowForValidation[]
): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  const classKeys = new Map<string, number>();
  const teacherEmailKeys = new Map<string, number>();

  rows.forEach((row) => {
    const rowNumber = getRowNumber(row);

    const cohortName = safeText(row.cohortName);
    const className = safeText(row.className);
    const school = safeText(row.school);
    const teacherName = safeText(row.teacherName);
    const teacherEnteringYear = safeText(row.teacherEnteringYear);
    const studentNames = getStudentNames(row);

    if (!cohortName) {
      pushError(errors, {
        rowNumber,
        field: "cohortName",
        message: "缺少届别。",
      });
    }

    if (!className) {
      pushError(errors, {
        rowNumber,
        field: "className",
        message: "缺少班级名称。",
      });
    }

    if (!school) {
      pushError(errors, {
        rowNumber,
        field: "school",
        message: "缺少合作学校。",
      });
    }

    if (!teacherName) {
      pushError(errors, {
        rowNumber,
        field: "teacherName",
        message: "缺少小老师姓名。",
      });
    }

    if (!teacherEnteringYear) {
      pushError(errors, {
        rowNumber,
        field: "teacherEnteringYear",
        message: "缺少小老师邮箱后缀。",
      });
    } else if (!isValidTeacherEmailSuffix(teacherEnteringYear)) {
      pushError(errors, {
        rowNumber,
        field: "teacherEnteringYear",
        message:
          "小老师邮箱后缀格式不合法，请填写 2 到 3 位数字，例如 24 或 259，不要填写完整年份 2024。",
      });
    }

    if (studentNames.length === 0) {
      pushError(errors, {
        rowNumber,
        field: "studentNames",
        message:
          "缺少学生姓名。学生名单可以用顿号、中文逗号、英文逗号、分号或斜杠分隔。",
      });
    }

    const seenStudentsInThisClass = new Set<string>();

    studentNames.forEach((studentName) => {
      const normalizedStudentName = normalizeStudentName(studentName);

      if (!normalizedStudentName) {
        return;
      }

      if (seenStudentsInThisClass.has(normalizedStudentName)) {
        pushError(errors, {
          rowNumber,
          field: "studentNames",
          message: `同一个班级内学生「${studentName}」重复出现。`,
        });
      }

      seenStudentsInThisClass.add(normalizedStudentName);
    });

    if (cohortName && className) {
      const classKey = normalizeClassKey({
        cohortName,
        className,
      });

      if (classKeys.has(classKey)) {
        pushError(errors, {
          rowNumber,
          field: "className",
          message: `同一届别中班级「${className}」重复。第一次出现于第 ${classKeys.get(
            classKey
          )} 行。`,
        });
      } else {
        classKeys.set(classKey, rowNumber);
      }
    }

    const possiblePreviewRow = row as Partial<PreviewImportRow>;

    const teacherEmail = safeText(possiblePreviewRow.teacherEmail).toLowerCase();

    if (teacherEmail) {
      if (teacherEmailKeys.has(teacherEmail)) {
        pushError(errors, {
          rowNumber,
          field: "teacherEmail",
          message: `小老师邮箱「${teacherEmail}」重复。第一次出现于第 ${teacherEmailKeys.get(
            teacherEmail
          )} 行。`,
        });
      } else {
        teacherEmailKeys.set(teacherEmail, rowNumber);
      }
    }
  });

  return errors;
}