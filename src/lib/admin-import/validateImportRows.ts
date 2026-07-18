import type { ImportValidationError, PreviewImportRow } from "./types";

function isValidAccountPart(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

// function isValidTeacherEnteringYear(value: string) {
//   return /^\d{4}$/.test(value.trim());
// }

function isValidTeacherEmailSuffix(value: string) {
  return /^\d{2,3}$/.test(value.trim());
}

export function validateImportRows(rows: PreviewImportRow[]) {
  const errors: ImportValidationError[] = [];

  if (rows.length === 0) {
    return [
      {
        rowNumber: 0,
        field: "table",
        message: "请先粘贴要导入的表格内容。",
      },
    ];
  }

  const studentUsernameMap = new Map<string, number>();
  const teacherEmailNameMap = new Map<string, string>();

  rows.forEach((row) => {
    if (!row.cohortName) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "cohortName",
        message: "缺少届别。",
      });
    }

    if (!row.className) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "className",
        message: "缺少班级名称。",
      });
    }

    if (!row.school) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "school",
        message: "缺少合作学校。",
      });
    }

    if (!row.teacherName) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "teacherName",
        message: "缺少小老师姓名。",
      });
    }

    if (!row.teacherEnteringYear) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "teacherEnteringYear",
        message: "缺少小老师邮箱后缀，例如 24 或 259。",
      });
    }

    if (
      row.teacherEnteringYear &&
      !isValidTeacherEmailSuffix(row.teacherEnteringYear)
    ) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "teacherEnteringYear",
        message: "请检查小老师邮箱后缀格式",
      });
    }

    if (!row.studentName) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "studentName",
        message: "缺少学生姓名。",
      });
    }

    if (!row.studentGrade) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "studentGrade",
        message: "缺少学生年级。",
      });
    }

    if (row.teacherName && !row.teacherEmailPrefix) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "teacherEmailPrefix",
        message: "无法根据小老师姓名生成邮箱前缀，请检查姓名。",
      });
    }

    if (
      row.teacherName &&
      row.teacherEnteringYear &&
      isValidTeacherEmailSuffix(row.teacherEnteringYear) &&
      !row.teacherEmail
    ) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "teacherEmail",
        message: "无法生成小老师邮箱，请检查小老师姓名和届别。",
      });
    }

    if (row.studentName && !row.studentUsername) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "studentUsername",
        message: "无法根据学生姓名生成用户名，请检查姓名。",
      });
    }

    if (row.teacherEmailPrefix && !isValidAccountPart(row.teacherEmailPrefix)) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "teacherEmailPrefix",
        message: "自动生成的小老师邮箱前缀格式不合法。",
      });
    }

    if (row.studentUsername && !isValidAccountPart(row.studentUsername)) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "studentUsername",
        message: "自动生成的学生用户名格式不合法。",
      });
    }

    if (row.studentUsername) {
      const existingRowNumber = studentUsernameMap.get(row.studentUsername);

      if (existingRowNumber !== undefined) {
        errors.push({
          rowNumber: row.rowNumber,
          field: "studentUsername",
          message: `自动生成的学生用户名与第 ${existingRowNumber} 行重复：${row.studentUsername}。请检查是否有重名学生。`,
        });
      } else {
        studentUsernameMap.set(row.studentUsername, row.rowNumber);
      }
    }

    if (row.teacherEmail) {
      const existingTeacherName = teacherEmailNameMap.get(row.teacherEmail);

      if (existingTeacherName && existingTeacherName !== row.teacherName) {
        errors.push({
          rowNumber: row.rowNumber,
          field: "teacherEmail",
          message: `自动生成的老师邮箱对应了不同姓名：${existingTeacherName} / ${row.teacherName}。请检查是否有老师重名或拼音冲突。`,
        });
      } else {
        teacherEmailNameMap.set(row.teacherEmail, row.teacherName);
      }
    }
  });

  return errors;
}