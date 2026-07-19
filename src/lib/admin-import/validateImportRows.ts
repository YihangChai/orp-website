import type {
  ExecutionImportRow,
  ImportValidationError,
  ParsedImportRow,
  PreviewImportRow,
  SubjectCode,
} from "./types";

type ImportRowForValidation =
  | ParsedImportRow
  | PreviewImportRow
  | ExecutionImportRow;

type TeacherSubjectCheck = {
  rowNumber: number;
  subject: SubjectCode | "";
};

function safeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getRowNumber(row: ImportRowForValidation) {
  return Number(row.rowNumber || row.lineNumber || 0);
}

/**
 * Preview/Parsed 阶段是一行一个班级，有 studentNames 数组。
 * Execution 阶段是一行一个学生，有 studentName。
 */
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

function isExecutionRow(row: ImportRowForValidation) {
  const possibleExecutionRow = row as Partial<ExecutionImportRow>;

  return Boolean(
    safeText(possibleExecutionRow.studentName) ||
      safeText(possibleExecutionRow.studentUsername) ||
      safeText(possibleExecutionRow.studentAuthEmail)
  );
}

function isValidTeacherEmailSuffix(value: unknown) {
  const suffix = safeText(value);
  return /^\d{2,3}$/.test(suffix);
}

function isValidSubject(value: unknown): value is SubjectCode {
  const subject = safeText(value);
  return subject === "english" || subject === "math";
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

function getSubjectLabel(subject: SubjectCode | "") {
  if (subject === "english") return "英语";
  if (subject === "math") return "数学";
  return "未设置";
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

  /**
   * 同一个老师可以出现在多行，但只能对应一个学科。
   * 这里按 teacherEmail 判断，比按姓名更可靠。
   */
  const teacherSubjectByEmail = new Map<string, TeacherSubjectCheck>();

  rows.forEach((row) => {
    const rowNumber = getRowNumber(row);

    const cohortName = safeText(row.cohortName);
    const className = safeText(row.className);
    const school = safeText(row.school);
    const subject = safeText(row.subject);
    const teacherName = safeText(row.teacherName);
    const teacherEnteringYear = safeText(row.teacherEnteringYear);
    const studentNames = getStudentNames(row);
    const currentRowIsExecutionRow = isExecutionRow(row);

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

    if (!subject) {
      pushError(errors, {
        rowNumber,
        field: "subject",
        message: "缺少学科，请填写“英语”或“数学”。",
      });
    } else if (!isValidSubject(subject)) {
      pushError(errors, {
        rowNumber,
        field: "subject",
        message: "学科格式不合法，请填写“英语”或“数学”。",
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

    /**
     * 同一个班级内部不能重复写同一个学生。
     * 学生跨班重复是允许的，比如同时在英语班和数学班。
     */
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

    /**
     * 只有 Parsed/Preview 阶段校验班级重复。
     * Execution 阶段已经是一行一个学生，同一个班级会自然出现多次。
     */
    if (!currentRowIsExecutionRow && cohortName && className) {
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

    if (teacherEmail && isValidSubject(subject)) {
      const existingTeacherSubject = teacherSubjectByEmail.get(teacherEmail);

      if (!existingTeacherSubject) {
        teacherSubjectByEmail.set(teacherEmail, {
          rowNumber,
          subject,
        });
      } else if (existingTeacherSubject.subject !== subject) {
        pushError(errors, {
          rowNumber,
          field: "teacherEmail",
          message: `小老师邮箱「${teacherEmail}」在本次导入中同时对应「${getSubjectLabel(
            existingTeacherSubject.subject
          )}」和「${getSubjectLabel(
            subject
          )}」。一个小老师只能对应一个学科。第一次出现于第 ${
            existingTeacherSubject.rowNumber
          } 行。`,
        });
      }
    }
  });

  return errors;
}