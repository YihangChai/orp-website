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
};

type StudentRecord = {
  id: string;
  name: string;
  username: string | null;
  auth_user_id: string | null;
};

async function getOrCreateCohort(cohortName: string) {
  const trimmedName = cohortName.trim();
  const normalizedName = normalizeName(trimmedName);

  const { data: existingCohort, error: existingError } = await supabaseAdmin
    .from("cohorts")
    .select("id, name")
    .eq("normalized_name", normalizedName)
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
      name: trimmedName,
      normalized_name: normalizedName,
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

async function getOrCreateTeacher(row: PreviewImportRow) {
  const email = row.teacherEmail.trim().toLowerCase();

  const { data: existingTeacher, error: existingError } = await supabaseAdmin
    .from("teachers")
    .select("id, name, email, auth_user_id, school_entering_year")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    throw new Error(`查找小老师失败：${existingError.message}`);
  }

  if (existingTeacher) {
    return {
      teacher: existingTeacher as TeacherRecord,
      created: false,
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
      must_change_password: true,
    })
    .select("id, name, email, auth_user_id")
    .single();

  if (teacherError) {
    throw new Error(`创建小老师资料失败：${teacherError.message}`);
  }

  return {
    teacher: newTeacher as TeacherRecord,
    created: true,
    initialPassword,
  };
}

async function getOrCreateStudent(row: PreviewImportRow) {
  const username = row.studentUsername.trim().toLowerCase();
  const authEmail = row.studentAuthEmail.trim().toLowerCase();

  const { data: existingStudent, error: existingError } = await supabaseAdmin
    .from("students")
    .select("id, name, username, auth_user_id")
    .eq("username", username)
    .maybeSingle();

  if (existingError) {
    throw new Error(`查找学生失败：${existingError.message}`);
  }

  if (existingStudent) {
    return {
      student: existingStudent as StudentRecord,
      created: false,
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
      name: row.studentName.trim(),
      username,
      auth_user_id: authData.user.id,
      grade: row.studentGrade.trim() || null,
      status: "active",
      must_change_password: true,
    })
    .select("id, name, username, auth_user_id")
    .single();

  if (studentError) {
    throw new Error(`创建学生资料失败：${studentError.message}`);
  }

  return {
    student: newStudent as StudentRecord,
    created: true,
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
  rows: PreviewImportRow[]
): Promise<BulkImportResult> {
  let createdClasses = 0;
  let createdTeachers = 0;
  let createdStudents = 0;
  let teacherBindings = 0;
  let studentBindings = 0;
  let skippedExisting = 0;
  let failed = 0;

  const accounts: BulkImportAccountItem[] = [];
  const processedTeacherEmails = new Set<string>();

  for (const row of rows) {
    try {
      const { cohort } = await getOrCreateCohort(row.cohortName);

      const { classItem, created: classCreated } = await getOrCreateClass(
        cohort.id,
        row.className,
        row.school
      );

      if (classCreated) {
        createdClasses += 1;
      }

      const {
        teacher,
        created: teacherCreated,
        initialPassword: teacherInitialPassword,
      } = await getOrCreateTeacher(row);

      if (teacherCreated) {
        createdTeachers += 1;
      } else {
        skippedExisting += 1;
      }

      await bindTeacherToClass(classItem.id, teacher.id);
      teacherBindings += 1;

      if (teacherCreated && teacherInitialPassword) {
        accounts.push({
          role: "teacher",
          name: row.teacherName,
          loginAccount: row.teacherEmail,
          initialPassword: teacherInitialPassword,
          className: row.className,
          status: "created",
        });
      } else if (!processedTeacherEmails.has(row.teacherEmail)) {
        accounts.push({
          role: "teacher",
          name: teacher.name,
          loginAccount: teacher.email || row.teacherEmail,
          initialPassword: "",
          className: row.className,
          status: "existing",
          message: "小老师账号已存在，系统不会显示原密码。",
        });
      }

      processedTeacherEmails.add(row.teacherEmail);

      const {
        student,
        created: studentCreated,
        initialPassword: studentInitialPassword,
      } = await getOrCreateStudent(row);

      if (studentCreated) {
        createdStudents += 1;
      } else {
        skippedExisting += 1;
      }

      await bindStudentToClass(classItem.id, student.id);
      studentBindings += 1;

      if (studentCreated && studentInitialPassword) {
        accounts.push({
          role: "student",
          name: row.studentName,
          loginAccount: row.studentUsername,
          initialPassword: studentInitialPassword,
          className: row.className,
          status: "created",
        });
      } else {
        accounts.push({
          role: "student",
          name: student.name,
          loginAccount: student.username || row.studentUsername,
          initialPassword: "",
          className: row.className,
          status: "existing",
          message: "学生账号已存在，系统不会显示原密码。",
        });
      }
    } catch (error) {
      failed += 1;

      accounts.push({
        role: "student",
        name: row.studentName || "未知学生",
        loginAccount: row.studentUsername || "",
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
    failed,
    accounts,
    errors: [],
  };
}