import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInitialPassword } from "./generateInitialPassword";
import type {
  BulkImportAccountItem,
  BulkImportResult,
  ExecutionImportRow,
} from "./types";

type ExecuteBulkImportOptions = {
  allowReuseArchived?: boolean;
};

type CohortRecord = {
  id: string;
  name: string;
};

type ClassRecord = {
  id: string;
  name: string;
};

type TeacherRecord = {
  id: string;
  name: string;
  email: string | null;
  auth_user_id: string | null;
  school_entering_year: number | null;
  status: string | null;
};

type StudentRecord = {
  id: string;
  name: string;
  username: string | null;
  auth_user_id: string | null;
  grade: string | null;
  status: string | null;
};

function safeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeName(name: unknown) {
  return safeText(name).replace(/\s+/g, "").toLowerCase();
}

function getTeacherEmail(row: ExecutionImportRow) {
  return safeText(row.teacherEmail).toLowerCase();
}

function getStudentUsername(row: ExecutionImportRow) {
  return safeText(row.studentUsername).toLowerCase();
}

function getStudentAuthEmail(row: ExecutionImportRow) {
  return safeText(row.studentAuthEmail).toLowerCase();
}

async function getOrCreateCohort(cohortName: string) {
  const trimmedCohortName = safeText(cohortName);
  const normalizedCohortName = normalizeName(trimmedCohortName);

  const { data: existingCohort, error: existingError } = await supabaseAdmin
    .from("cohorts")
    .select("id, name")
    .eq("normalized_name", normalizedCohortName)
    .maybeSingle();

  if (existingError) {
    throw new Error(`查找届别失败：${existingError.message}`);
  }

  if (existingCohort) {
    return {
      cohort: existingCohort as CohortRecord,
      created: false,
    };
  }

  const { data: newCohort, error: createError } = await supabaseAdmin
    .from("cohorts")
    .insert({
      name: trimmedCohortName,
      normalized_name: normalizedCohortName,
      status: "active",
    })
    .select("id, name")
    .single();

  if (createError) {
    throw new Error(`创建届别失败：${createError.message}`);
  }

  return {
    cohort: newCohort as CohortRecord,
    created: true,
  };
}

async function getOrCreateClass(
  cohortId: string,
  className: string,
  school: string
) {
  const trimmedClassName = safeText(className);
  const normalizedClassName = normalizeName(trimmedClassName);

  const { data: existingClass, error: existingError } = await supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("cohort_id", cohortId)
    .eq("normalized_name", normalizedClassName)
    .maybeSingle();

  if (existingError) {
    throw new Error(`查找班级失败：${existingError.message}`);
  }

  if (existingClass) {
    return {
      classItem: existingClass as ClassRecord,
      created: false,
    };
  }

  const { data: newClass, error: createError } = await supabaseAdmin
    .from("classes")
    .insert({
      cohort_id: cohortId,
      name: trimmedClassName,
      normalized_name: normalizedClassName,
      school: safeText(school) || null,
      status: "active",
    })
    .select("id, name")
    .single();

  if (createError) {
    throw new Error(`创建班级失败：${createError.message}`);
  }

  return {
    classItem: newClass as ClassRecord,
    created: true,
  };
}

async function getOrCreateTeacher(
  row: ExecutionImportRow,
  options: ExecuteBulkImportOptions
) {
  const email = getTeacherEmail(row);

  if (!email) {
    throw new Error(`第 ${row.rowNumber} 行缺少小老师邮箱。`);
  }

  const { data: existingTeacher, error: existingError } = await supabaseAdmin
    .from("teachers")
    .select("id, name, email, auth_user_id, school_entering_year, status")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    throw new Error(`查找小老师失败：${existingError.message}`);
  }

  if (existingTeacher) {
    if (existingTeacher.status === "archived") {
      if (!options.allowReuseArchived) {
        throw new Error(
          `小老师 ${
            existingTeacher.name || row.teacherName
          } 的账号已封存，需要管理员确认后才能恢复使用。`
        );
      }

      const { data: restoredTeacher, error: restoreError } =
        await supabaseAdmin
          .from("teachers")
          .update({
            status: "active",
          })
          .eq("id", existingTeacher.id)
          .select("id, name, email, auth_user_id, school_entering_year, status")
          .single();

      if (restoreError) {
        throw new Error(`恢复小老师账号失败：${restoreError.message}`);
      }

      return {
        teacher: restoredTeacher as TeacherRecord,
        created: false,
        restored: true,
        initialPassword: null as string | null,
      };
    }

    return {
      teacher: existingTeacher as TeacherRecord,
      created: false,
      restored: false,
      initialPassword: null as string | null,
    };
  }

  const initialPassword = generateInitialPassword("teacher");

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    throw new Error(
      `创建小老师 Auth 账号失败：${authError?.message || "未知错误"}`
    );
  }

  const { data: newTeacher, error: teacherError } = await supabaseAdmin
    .from("teachers")
    .insert({
      name: safeText(row.teacherName),
      email,
      auth_user_id: authData.user.id,
      school_entering_year: Number(row.teacherEnteringYear),
      status: "active",
      must_change_password: false,
    })
    .select("id, name, email, auth_user_id, school_entering_year, status")
    .single();

  if (teacherError) {
    throw new Error(`创建小老师资料失败：${teacherError.message}`);
  }

  return {
    teacher: newTeacher as TeacherRecord,
    created: true,
    restored: false,
    initialPassword,
  };
}

async function getOrCreateStudent(
  row: ExecutionImportRow,
  options: ExecuteBulkImportOptions
) {
  const username = getStudentUsername(row);
  const authEmail = getStudentAuthEmail(row);

  if (!username) {
    throw new Error(`第 ${row.rowNumber} 行缺少学生用户名。`);
  }

  if (!authEmail) {
    throw new Error(`第 ${row.rowNumber} 行缺少学生登录邮箱。`);
  }

  const { data: existingStudent, error: existingError } = await supabaseAdmin
    .from("students")
    .select("id, name, username, auth_user_id, grade, status")
    .eq("username", username)
    .maybeSingle();

  if (existingError) {
    throw new Error(`查找学生失败：${existingError.message}`);
  }

  if (existingStudent) {
    if (existingStudent.status === "archived") {
      if (!options.allowReuseArchived) {
        throw new Error(
          `学生 ${
            existingStudent.name || row.studentName
          } 的账号已封存，需要管理员确认后才能恢复使用。`
        );
      }

      const { data: restoredStudent, error: restoreError } =
        await supabaseAdmin
          .from("students")
          .update({
            status: "active",
          })
          .eq("id", existingStudent.id)
          .select("id, name, username, auth_user_id, grade, status")
          .single();

      if (restoreError) {
        throw new Error(`恢复学生账号失败：${restoreError.message}`);
      }

      return {
        student: restoredStudent as StudentRecord,
        created: false,
        restored: true,
        initialPassword: null as string | null,
      };
    }

    return {
      student: existingStudent as StudentRecord,
      created: false,
      restored: false,
      initialPassword: null as string | null,
    };
  }

  const initialPassword = generateInitialPassword("student");

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: initialPassword,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    throw new Error(
      `创建学生 Auth 账号失败：${authError?.message || "未知错误"}`
    );
  }

  const { data: newStudent, error: studentError } = await supabaseAdmin
    .from("students")
    .insert({
      name: safeText(row.studentName),
      username,
      auth_user_id: authData.user.id,
      grade: safeText(row.studentGrade),
      status: "active",
      must_change_password: false,
    })
    .select("id, name, username, auth_user_id, grade, status")
    .single();

  if (studentError) {
    throw new Error(`创建学生资料失败：${studentError.message}`);
  }

  return {
    student: newStudent as StudentRecord,
    created: true,
    restored: false,
    initialPassword,
  };
}

async function bindTeacherToClass(classId: string, teacherId: string) {
  const { error } = await supabaseAdmin.from("class_teachers").upsert(
    {
      class_id: classId,
      teacher_id: teacherId,
    },
    {
      onConflict: "class_id,teacher_id",
    }
  );

  if (error) {
    throw new Error(`绑定小老师到班级失败：${error.message}`);
  }
}

async function bindStudentToClass(classId: string, studentId: string) {
  const { error } = await supabaseAdmin.from("class_students").upsert(
    {
      class_id: classId,
      student_id: studentId,
    },
    {
      onConflict: "class_id,student_id",
    }
  );

  if (error) {
    throw new Error(`绑定学生到班级失败：${error.message}`);
  }
}

export async function executeBulkImport(
  rows: ExecutionImportRow[],
  options: ExecuteBulkImportOptions = {}
): Promise<BulkImportResult> {
  let createdClasses = 0;
  let createdTeachers = 0;
  let createdStudents = 0;
  let teacherBindings = 0;
  let studentBindings = 0;
  let skippedExisting = 0;
  let restoredAccounts = 0;
  let failed = 0;

  const accounts: BulkImportAccountItem[] = [];

  const processedClassKeys = new Set<string>();
  const processedTeacherEmails = new Set<string>();
  const processedStudentUsernames = new Set<string>();
  const processedTeacherBindingKeys = new Set<string>();
  const processedStudentBindingKeys = new Set<string>();

  for (const row of rows) {
    try {
      const { cohort } = await getOrCreateCohort(row.cohortName);

      const classKey = `${cohort.id}__${normalizeName(row.className)}`;

      const { classItem, created: classCreated } = await getOrCreateClass(
        cohort.id,
        row.className,
        row.school
      );

      if (classCreated && !processedClassKeys.has(classKey)) {
        createdClasses += 1;
      }

      processedClassKeys.add(classKey);

      const teacherResult = await getOrCreateTeacher(row, options);
      const teacherEmailKey = getTeacherEmail(row);

      if (!processedTeacherEmails.has(teacherEmailKey)) {
        if (teacherResult.created) {
          createdTeachers += 1;

          accounts.push({
            role: "teacher",
            name: safeText(row.teacherName),
            loginAccount: teacherEmailKey,
            initialPassword: teacherResult.initialPassword || "",
            className: safeText(row.className),
            status: "created",
          });
        } else if (teacherResult.restored) {
          restoredAccounts += 1;
          skippedExisting += 1;

          accounts.push({
            role: "teacher",
            name: teacherResult.teacher.name || safeText(row.teacherName),
            loginAccount: teacherResult.teacher.email || teacherEmailKey,
            initialPassword: "",
            className: safeText(row.className),
            status: "restored",
            message: "小老师账号已从 archived 恢复为 active，并复用原账号。",
          });
        } else {
          skippedExisting += 1;

          accounts.push({
            role: "teacher",
            name: teacherResult.teacher.name || safeText(row.teacherName),
            loginAccount: teacherResult.teacher.email || teacherEmailKey,
            initialPassword: "",
            className: safeText(row.className),
            status: "existing",
            message: "小老师账号已存在，系统复用原账号，不会显示原密码。",
          });
        }

        processedTeacherEmails.add(teacherEmailKey);
      }

      const teacherBindingKey = `${classItem.id}__${teacherResult.teacher.id}`;

      if (!processedTeacherBindingKeys.has(teacherBindingKey)) {
        await bindTeacherToClass(classItem.id, teacherResult.teacher.id);
        teacherBindings += 1;
        processedTeacherBindingKeys.add(teacherBindingKey);
      }

      const studentResult = await getOrCreateStudent(row, options);
      const studentUsernameKey = getStudentUsername(row);

      if (!processedStudentUsernames.has(studentUsernameKey)) {
        if (studentResult.created) {
          createdStudents += 1;

          accounts.push({
            role: "student",
            name: safeText(row.studentName),
            loginAccount: studentUsernameKey,
            initialPassword: studentResult.initialPassword || "",
            className: safeText(row.className),
            status: "created",
          });
        } else if (studentResult.restored) {
          restoredAccounts += 1;
          skippedExisting += 1;

          accounts.push({
            role: "student",
            name: studentResult.student.name || safeText(row.studentName),
            loginAccount: studentResult.student.username || studentUsernameKey,
            initialPassword: "",
            className: safeText(row.className),
            status: "restored",
            message: "学生账号已从 archived 恢复为 active，并复用原账号。",
          });
        } else {
          skippedExisting += 1;

          accounts.push({
            role: "student",
            name: studentResult.student.name || safeText(row.studentName),
            loginAccount: studentResult.student.username || studentUsernameKey,
            initialPassword: "",
            className: safeText(row.className),
            status: "existing",
            message: "学生账号已存在，系统复用原账号，不会显示原密码。",
          });
        }

        processedStudentUsernames.add(studentUsernameKey);
      }

      const studentBindingKey = `${classItem.id}__${studentResult.student.id}`;

      if (!processedStudentBindingKeys.has(studentBindingKey)) {
        await bindStudentToClass(classItem.id, studentResult.student.id);
        studentBindings += 1;
        processedStudentBindingKeys.add(studentBindingKey);
      }
    } catch (error) {
      failed += 1;

      accounts.push({
        role: "student",
        name: safeText(row.studentName) || safeText(row.teacherName) || "未知成员",
        loginAccount:
          safeText(row.studentUsername) || safeText(row.teacherEmail) || "",
        initialPassword: "",
        className: safeText(row.className),
        status: "failed",
        message: error instanceof Error ? error.message : "导入失败。",
      });
    }
  }

  return {
    createdClasses,
    createdTeachers,
    createdStudents,
    teacherBindings,
    studentBindings,
    skippedExisting,
    restoredAccounts,
    failed,
    accounts,
    errors: [],
  };
}