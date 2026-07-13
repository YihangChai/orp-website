import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInitialPassword } from "./generateInitialPassword";
import type {
  BulkImportAccountItem,
  BulkImportResult,
  PreviewImportRow,
} from "./types";

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

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

async function getOrCreateCohort(cohortName: string) {
  const trimmedCohortName = cohortName.trim();
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
  const trimmedClassName = className.trim();
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
      school: school.trim() || null,
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
  row: PreviewImportRow,
  options: ExecuteBulkImportOptions
) {
  const email = row.teacherEmail.trim().toLowerCase();

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
      name: row.teacherName.trim(),
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
  row: PreviewImportRow,
  options: ExecuteBulkImportOptions
) {
  const username = row.studentUsername.trim().toLowerCase();

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
      email: row.studentAuthEmail.trim().toLowerCase(),
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
      name: row.studentName.trim(),
      username,
      auth_user_id: authData.user.id,
      grade: row.studentGrade.trim(),
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
  rows: PreviewImportRow[],
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
      const teacherEmailKey = row.teacherEmail.trim().toLowerCase();

      if (!processedTeacherEmails.has(teacherEmailKey)) {
        if (teacherResult.created) {
          createdTeachers += 1;

          accounts.push({
            role: "teacher",
            name: row.teacherName,
            loginAccount: row.teacherEmail,
            initialPassword: teacherResult.initialPassword || "",
            className: row.className,
            status: "created",
          });
        } else if (teacherResult.restored) {
          restoredAccounts += 1;
          skippedExisting += 1;

          accounts.push({
            role: "teacher",
            name: teacherResult.teacher.name || row.teacherName,
            loginAccount: teacherResult.teacher.email || row.teacherEmail,
            initialPassword: "",
            className: row.className,
            status: "restored",
            message: "小老师账号已从 archived 恢复为 active，并复用原账号。",
          });
        } else {
          skippedExisting += 1;

          accounts.push({
            role: "teacher",
            name: teacherResult.teacher.name || row.teacherName,
            loginAccount: teacherResult.teacher.email || row.teacherEmail,
            initialPassword: "",
            className: row.className,
            status: "existing",
            message: "小老师账号已存在，系统复用原账号，不会显示原密码。",
          });
        }

        processedTeacherEmails.add(teacherEmailKey);
      }

      await bindTeacherToClass(classItem.id, teacherResult.teacher.id);
      teacherBindings += 1;

      const studentResult = await getOrCreateStudent(row, options);

      if (studentResult.created) {
        createdStudents += 1;

        accounts.push({
          role: "student",
          name: row.studentName,
          loginAccount: row.studentUsername,
          initialPassword: studentResult.initialPassword || "",
          className: row.className,
          status: "created",
        });
      } else if (studentResult.restored) {
        restoredAccounts += 1;
        skippedExisting += 1;

        accounts.push({
          role: "student",
          name: studentResult.student.name || row.studentName,
          loginAccount: studentResult.student.username || row.studentUsername,
          initialPassword: "",
          className: row.className,
          status: "restored",
          message: "学生账号已从 archived 恢复为 active，并复用原账号。",
        });
      } else {
        skippedExisting += 1;

        accounts.push({
          role: "student",
          name: studentResult.student.name || row.studentName,
          loginAccount: studentResult.student.username || row.studentUsername,
          initialPassword: "",
          className: row.className,
          status: "existing",
          message: "学生账号已存在，系统复用原账号，不会显示原密码。",
        });
      }

      await bindStudentToClass(classItem.id, studentResult.student.id);
      studentBindings += 1;
    } catch (error) {
      failed += 1;

      accounts.push({
        role: "student",
        name: row.studentName || row.teacherName || "未知成员",
        loginAccount: row.studentUsername || row.teacherEmail || "",
        initialPassword: "",
        className: row.className || "",
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