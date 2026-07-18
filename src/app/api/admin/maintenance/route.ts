import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CurrentAdmin = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  auth_user_id: string;
};

type ExecuteResult = {
  message: string;
  resetPassword?: {
    role: "teacher" | "student";
    name: string;
    account: string | null;
    newPassword: string;
  } | null;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

function generateResetPassword(role: "teacher" | "student") {
  const prefix = role === "teacher" ? "ORP-T" : "ORP-S";

  const randomPart = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix}-${randomPart}`;
}

async function requireCurrentAdmin(request: NextRequest): Promise<CurrentAdmin> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("缺少登录信息，请重新登录。");
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    throw new Error("登录状态无效，请重新登录。");
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admins")
    .select("id, name, email, status, auth_user_id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (adminError) {
    throw new Error(`读取管理员身份失败：${adminError.message}`);
  }

  if (!admin || admin.status !== "active") {
    throw new Error("当前账号不是 active 管理员，不能执行维护操作。");
  }

  return admin as CurrentAdmin;
}

async function getActiveAdminCount() {
  const { count, error } = await supabaseAdmin
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (error) {
    throw new Error(`读取 active 管理员数量失败：${error.message}`);
  }

  return Math.max(count || 0, 1);
}

async function requireActiveClass(classId: string) {
  const { data: classItem, error } = await supabaseAdmin
    .from("classes")
    .select("id, name, school, status, cohort_id")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取班级失败：${error.message}`);
  }

  if (!classItem) {
    throw new Error("没有找到这个班级。");
  }

  if (classItem.status !== "active") {
    throw new Error("只能维护运行中的班级。");
  }

  return classItem;
}

async function ensureClassNameAvailable(params: {
  classId: string;
  newName: string;
}) {
  const classItem = await requireActiveClass(params.classId);
  const normalizedName = normalizeName(params.newName);

  const { data: existingClasses, error } = await supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("cohort_id", classItem.cohort_id)
    .eq("normalized_name", normalizedName)
    .neq("id", params.classId);

  if (error) {
    throw new Error(`检查班级重名失败：${error.message}`);
  }

  if ((existingClasses || []).length > 0) {
    throw new Error("同一届别中已经有这个班级名称，不能重复命名。");
  }

  return normalizedName;
}

async function validateResetTeacherPassword(targetId: string) {
  const { data: teacher, error } = await supabaseAdmin
    .from("teachers")
    .select("id, name, email, status, auth_user_id")
    .eq("id", targetId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取小老师失败：${error.message}`);
  }

  if (!teacher) {
    throw new Error("没有找到这个小老师。");
  }

  if (teacher.status !== "active") {
    throw new Error("只能重置 active 小老师的密码。");
  }

  if (!teacher.auth_user_id) {
    throw new Error("这个小老师没有绑定登录账号，无法重置密码。");
  }

  return teacher;
}

async function validateResetStudentPassword(targetId: string) {
  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("id, name, username, status, auth_user_id")
    .eq("id", targetId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取学生失败：${error.message}`);
  }

  if (!student) {
    throw new Error("没有找到这个学生。");
  }

  if (student.status !== "active") {
    throw new Error("只能重置 active 学生的密码。");
  }

  if (!student.auth_user_id) {
    throw new Error("这个学生没有绑定登录账号，无法重置密码。");
  }

  return student;
}

async function fetchOverview() {
  const activeAdminCount = await getActiveAdminCount();

  const { data: cohorts, error: cohortsError } = await supabaseAdmin
    .from("cohorts")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  if (cohortsError) {
    throw new Error(`读取届别失败：${cohortsError.message}`);
  }

  const { data: classesData, error: classesError } = await supabaseAdmin
    .from("classes")
    .select(
      `
      id,
      name,
      school,
      status,
      cohort_id,
      cohorts (
        name
      )
    `
    )
    .eq("status", "active")
    .order("name", { ascending: true });

  if (classesError) {
    throw new Error(`读取班级失败：${classesError.message}`);
  }

  const classes = ((classesData || []) as any[]).map((classItem) => {
    const cohortValue = Array.isArray(classItem.cohorts)
      ? classItem.cohorts[0] || null
      : classItem.cohorts;

    return {
      id: classItem.id,
      name: classItem.name,
      school: classItem.school,
      status: classItem.status,
      cohort_id: classItem.cohort_id,
      cohort_name: cohortValue?.name || "未设置届别",
    };
  });

  const { data: teachers, error: teachersError } = await supabaseAdmin
    .from("teachers")
    .select("id, name, email, status, auth_user_id")
    .order("name", { ascending: true });

  if (teachersError) {
    throw new Error(`读取小老师失败：${teachersError.message}`);
  }

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, name, username, status, grade, auth_user_id")
    .order("name", { ascending: true });

  if (studentsError) {
    throw new Error(`读取学生失败：${studentsError.message}`);
  }

  const { data: classTeachers, error: classTeachersError } = await supabaseAdmin
    .from("class_teachers")
    .select("class_id, teacher_id");

  if (classTeachersError) {
    throw new Error(`读取班级小老师关系失败：${classTeachersError.message}`);
  }

  const { data: classStudents, error: classStudentsError } = await supabaseAdmin
    .from("class_students")
    .select("class_id, student_id");

  if (classStudentsError) {
    throw new Error(`读取班级学生关系失败：${classStudentsError.message}`);
  }

  const { data: requests, error: requestsError } = await supabaseAdmin
    .from("admin_action_requests")
    .select(
      "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, requested_by, note, action_payload, created_at, updated_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (requestsError) {
    throw new Error(`读取维护申请失败：${requestsError.message}`);
  }

  const requestIds = (requests || []).map((request) => request.id);

  let approvals: any[] = [];

  if (requestIds.length > 0) {
    const { data: approvalsData, error: approvalsError } = await supabaseAdmin
      .from("admin_action_approvals")
      .select("id, request_id, admin_id, admin_name, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: true });

    if (approvalsError) {
      throw new Error(`读取确认记录失败：${approvalsError.message}`);
    }

    approvals = approvalsData || [];
  }

  return {
    activeAdminCount,
    cohorts: cohorts || [],
    classes,
    teachers: teachers || [],
    students: students || [],
    classTeachers: classTeachers || [],
    classStudents: classStudents || [],
    requests: requests || [],
    approvals,
  };
}

function getPayload(body: any) {
  if (!body.actionPayload || typeof body.actionPayload !== "object") {
    return {};
  }

  return body.actionPayload;
}

async function validateCreateRequest(body: any) {
  const actionType = body.actionType as string;
  const targetId = body.targetId as string;
  const payload = getPayload(body);

  if (actionType === "update_class_info") {
    if (!payload.classId || !payload.name) {
      throw new Error("修改班级信息缺少 classId 或班级名称。");
    }

    await ensureClassNameAvailable({
      classId: payload.classId,
      newName: payload.name,
    });
  }

  if (
    actionType === "add_teacher_to_class" ||
    actionType === "remove_teacher_from_class" ||
    actionType === "add_student_to_class" ||
    actionType === "remove_student_from_class" ||
    actionType === "delete_class"
  ) {
    const classId = payload.classId || targetId;
    await requireActiveClass(classId);
  }

  if (actionType === "reset_teacher_password") {
    await validateResetTeacherPassword(targetId);
  }

  if (actionType === "reset_student_password") {
    await validateResetStudentPassword(targetId);
  }
}

async function createRequest(body: any, admin: CurrentAdmin) {
  const actionType = body.actionType as string;
  const targetType = body.targetType as string;
  const targetId = body.targetId as string;
  const targetName = body.targetName as string;
  const note = body.note as string | undefined;
  const actionPayload = getPayload(body);

  if (!actionType || !targetType || !targetId || !targetName) {
    throw new Error("创建申请缺少必要信息。");
  }

  await validateCreateRequest(body);

  let duplicateQuery = supabaseAdmin
    .from("admin_action_requests")
    .select("id, action_payload")
    .eq("action_type", actionType)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "pending");

  const { data: existingRequests, error: duplicateError } =
    await duplicateQuery;

  if (duplicateError) {
    throw new Error(`检查重复申请失败：${duplicateError.message}`);
  }

  const hasDuplicate = (existingRequests || []).some((request: any) => {
    const existingPayload = request.action_payload || {};

    const isClassRelationAction =
      actionType === "add_teacher_to_class" ||
      actionType === "remove_teacher_from_class" ||
      actionType === "add_student_to_class" ||
      actionType === "remove_student_from_class";

    if (!isClassRelationAction) {
      return true;
    }

    return existingPayload.classId === actionPayload.classId;
  });

  if (hasDuplicate) {
    throw new Error("已经存在相同对象的待确认申请，请先处理原申请。");
  }

  const requiredApprovals = await getActiveAdminCount();

  const { error: insertError } = await supabaseAdmin
    .from("admin_action_requests")
    .insert({
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      status: "pending",
      approvals_count: 0,
      required_approvals: requiredApprovals,
      requested_by: admin.name,
      note: note || null,
      action_payload: actionPayload,
    });

  if (insertError) {
    throw new Error(`创建申请失败：${insertError.message}`);
  }

  return {
    message: `申请已创建，需要 ${requiredApprovals} 位 active 管理员确认。`,
  };
}

async function countClassRecords(classId: string) {
  const { count: lessonCount, error: lessonError } = await supabaseAdmin
    .from("lesson_records")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);

  if (lessonError) {
    throw new Error(`检查班级课程记录失败：${lessonError.message}`);
  }

  const { count: goalCount, error: goalError } = await supabaseAdmin
    .from("teaching_goals")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);

  if (goalError) {
    throw new Error(`检查班级学习目标失败：${goalError.message}`);
  }

  return {
    lessonCount: lessonCount || 0,
    goalCount: goalCount || 0,
  };
}

async function executeArchiveCohort(request: any) {
  const cohortId = request.target_id;

  const { data: cohortClasses, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("cohort_id", cohortId);

  if (classError) {
    throw new Error(`读取届别班级失败：${classError.message}`);
  }

  const cohortClassIds = (cohortClasses || []).map((classItem) => classItem.id);

  let teacherRelations: { teacher_id: string; class_id: string }[] = [];
  let studentRelations: { student_id: string; class_id: string }[] = [];

  if (cohortClassIds.length > 0) {
    const { data: teachersData, error: teachersError } = await supabaseAdmin
      .from("class_teachers")
      .select("teacher_id, class_id")
      .in("class_id", cohortClassIds);

    if (teachersError) {
      throw new Error(`读取届别小老师关系失败：${teachersError.message}`);
    }

    teacherRelations = teachersData || [];

    const { data: studentsData, error: studentsError } = await supabaseAdmin
      .from("class_students")
      .select("student_id, class_id")
      .in("class_id", cohortClassIds);

    if (studentsError) {
      throw new Error(`读取届别学生关系失败：${studentsError.message}`);
    }

    studentRelations = studentsData || [];
  }

  if (cohortClassIds.length > 0) {
    const { error: classUpdateError } = await supabaseAdmin
      .from("classes")
      .update({ status: "archived" })
      .in("id", cohortClassIds);

    if (classUpdateError) {
      throw new Error(`封存届别班级失败：${classUpdateError.message}`);
    }
  }

  const { error: cohortUpdateError } = await supabaseAdmin
    .from("cohorts")
    .update({ status: "archived" })
    .eq("id", cohortId);

  if (cohortUpdateError) {
    throw new Error(`封存届别失败：${cohortUpdateError.message}`);
  }

  const teacherIds = Array.from(
    new Set(teacherRelations.map((relation) => relation.teacher_id))
  );

  const studentIds = Array.from(
    new Set(studentRelations.map((relation) => relation.student_id))
  );

  for (const teacherId of teacherIds) {
    const { data: activeRelations, error } = await supabaseAdmin
      .from("class_teachers")
      .select("classes!inner(id, status)")
      .eq("teacher_id", teacherId)
      .eq("classes.status", "active");

    if (error) {
      throw new Error(`检查小老师其他 active 班级失败：${error.message}`);
    }

    if ((activeRelations || []).length === 0) {
      await supabaseAdmin
        .from("teachers")
        .update({ status: "archived" })
        .eq("id", teacherId);
    }
  }

  for (const studentId of studentIds) {
    const { data: activeRelations, error } = await supabaseAdmin
      .from("class_students")
      .select("classes!inner(id, status)")
      .eq("student_id", studentId)
      .eq("classes.status", "active");

    if (error) {
      throw new Error(`检查学生其他 active 班级失败：${error.message}`);
    }

    if ((activeRelations || []).length === 0) {
      await supabaseAdmin
        .from("students")
        .update({ status: "archived" })
        .eq("id", studentId);
    }
  }

  return {
    message: `届别「${request.target_name}」已封存。`,
  };
}

async function executeDeleteClass(request: any) {
  const classId = request.target_id;
  await requireActiveClass(classId);

  const { lessonCount, goalCount } = await countClassRecords(classId);

  if (lessonCount > 0 || goalCount > 0) {
    const { error } = await supabaseAdmin
      .from("classes")
      .update({ status: "archived" })
      .eq("id", classId);

    if (error) {
      throw new Error(`封存班级失败：${error.message}`);
    }

    return {
      message: `班级「${request.target_name}」已有历史记录，已改为封存。`,
    };
  }

  await supabaseAdmin.from("class_teachers").delete().eq("class_id", classId);
  await supabaseAdmin.from("class_students").delete().eq("class_id", classId);

  const { error: deleteError } = await supabaseAdmin
    .from("classes")
    .delete()
    .eq("id", classId);

  if (deleteError) {
    throw new Error(`删除班级失败：${deleteError.message}`);
  }

  return {
    message: `班级「${request.target_name}」没有历史记录，已删除。`,
  };
}

async function executeDeleteTeacher(request: any) {
  const teacherId = request.target_id;

  const { data: teacher, error: teacherError } = await supabaseAdmin
    .from("teachers")
    .select("id, name, auth_user_id")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherError) {
    throw new Error(`读取小老师失败：${teacherError.message}`);
  }

  if (!teacher) {
    throw new Error("没有找到这个小老师。");
  }

  const { count: lessonCount, error: countError } = await supabaseAdmin
    .from("lesson_records")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId);

  if (countError) {
    throw new Error(`检查小老师课程记录失败：${countError.message}`);
  }

  if ((lessonCount || 0) > 0) {
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ status: "archived" })
      .eq("id", teacherId);

    if (error) {
      throw new Error(`归档小老师失败：${error.message}`);
    }

    return {
      message: `小老师「${teacher.name}」已有课程记录，已归档。`,
    };
  }

  await supabaseAdmin.from("class_teachers").delete().eq("teacher_id", teacherId);

  const { error: deleteTeacherError } = await supabaseAdmin
    .from("teachers")
    .delete()
    .eq("id", teacherId);

  if (deleteTeacherError) {
    throw new Error(`删除小老师失败：${deleteTeacherError.message}`);
  }

  if (teacher.auth_user_id) {
    await supabaseAdmin.auth.admin.deleteUser(teacher.auth_user_id);
  }

  return {
    message: `小老师「${teacher.name}」没有课程记录，已删除。`,
  };
}

async function executeDeleteStudent(request: any) {
  const studentId = request.target_id;

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, name, auth_user_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    throw new Error(`读取学生失败：${studentError.message}`);
  }

  if (!student) {
    throw new Error("没有找到这个学生。");
  }

  const { count: commentCount, error: commentError } = await supabaseAdmin
    .from("student_lesson_comments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (commentError) {
    throw new Error(`检查学生留言记录失败：${commentError.message}`);
  }

  if ((commentCount || 0) > 0) {
    const { error } = await supabaseAdmin
      .from("students")
      .update({ status: "archived" })
      .eq("id", studentId);

    if (error) {
      throw new Error(`归档学生失败：${error.message}`);
    }

    return {
      message: `学生「${student.name}」已有留言记录，已归档。`,
    };
  }

  await supabaseAdmin.from("class_students").delete().eq("student_id", studentId);

  const { error: deleteStudentError } = await supabaseAdmin
    .from("students")
    .delete()
    .eq("id", studentId);

  if (deleteStudentError) {
    throw new Error(`删除学生失败：${deleteStudentError.message}`);
  }

  if (student.auth_user_id) {
    await supabaseAdmin.auth.admin.deleteUser(student.auth_user_id);
  }

  return {
    message: `学生「${student.name}」没有留言记录，已删除。`,
  };
}

async function executeUpdateClassInfo(request: any) {
  const payload = request.action_payload || {};
  const classId = payload.classId;
  const newName = String(payload.name || "").trim();
  const newSchool = String(payload.school || "").trim();

  if (!classId || !newName) {
    throw new Error("修改班级信息缺少必要字段。");
  }

  const normalizedName = await ensureClassNameAvailable({
    classId,
    newName,
  });

  const { error } = await supabaseAdmin
    .from("classes")
    .update({
      name: newName,
      normalized_name: normalizedName,
      school: newSchool || null,
    })
    .eq("id", classId);

  if (error) {
    throw new Error(`修改班级信息失败：${error.message}`);
  }

  return {
    message: `班级信息已修改为「${newName}」。`,
  };
}

async function executeAddTeacherToClass(request: any) {
  const payload = request.action_payload || {};
  const classId = payload.classId;
  const teacherId = payload.teacherId || request.target_id;

  if (!classId || !teacherId) {
    throw new Error("添加小老师缺少班级或小老师 ID。");
  }

  await requireActiveClass(classId);

  const { error } = await supabaseAdmin
    .from("class_teachers")
    .upsert(
      {
        class_id: classId,
        teacher_id: teacherId,
      },
      {
        onConflict: "class_id,teacher_id",
      }
    );

  if (error) {
    throw new Error(`添加小老师失败：${error.message}`);
  }

  await supabaseAdmin
    .from("teachers")
    .update({ status: "active" })
    .eq("id", teacherId);

  return {
    message: `小老师「${request.target_name}」已加入班级。`,
  };
}

async function executeRemoveTeacherFromClass(request: any) {
  const payload = request.action_payload || {};
  const classId = payload.classId;
  const teacherId = payload.teacherId || request.target_id;

  if (!classId || !teacherId) {
    throw new Error("移除小老师缺少班级或小老师 ID。");
  }

  await requireActiveClass(classId);

  const { error } = await supabaseAdmin
    .from("class_teachers")
    .delete()
    .eq("class_id", classId)
    .eq("teacher_id", teacherId);

  if (error) {
    throw new Error(`移除小老师失败：${error.message}`);
  }

  return {
    message: `小老师「${request.target_name}」已从班级移除。`,
  };
}

async function executeAddStudentToClass(request: any) {
  const payload = request.action_payload || {};
  const classId = payload.classId;
  const studentId = payload.studentId || request.target_id;

  if (!classId || !studentId) {
    throw new Error("添加学生缺少班级或学生 ID。");
  }

  await requireActiveClass(classId);

  const { error } = await supabaseAdmin
    .from("class_students")
    .upsert(
      {
        class_id: classId,
        student_id: studentId,
      },
      {
        onConflict: "class_id,student_id",
      }
    );

  if (error) {
    throw new Error(`添加学生失败：${error.message}`);
  }

  await supabaseAdmin
    .from("students")
    .update({ status: "active" })
    .eq("id", studentId);

  return {
    message: `学生「${request.target_name}」已加入班级。`,
  };
}

async function executeRemoveStudentFromClass(request: any) {
  const payload = request.action_payload || {};
  const classId = payload.classId;
  const studentId = payload.studentId || request.target_id;

  if (!classId || !studentId) {
    throw new Error("移除学生缺少班级或学生 ID。");
  }

  await requireActiveClass(classId);

  const { error } = await supabaseAdmin
    .from("class_students")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentId);

  if (error) {
    throw new Error(`移除学生失败：${error.message}`);
  }

  return {
    message: `学生「${request.target_name}」已从班级移除。`,
  };
}

async function executeResetTeacherPassword(
  request: any
): Promise<ExecuteResult> {
  const teacher = await validateResetTeacherPassword(request.target_id);
  const newPassword = generateResetPassword("teacher");

  const { error: updateAuthError } =
    await supabaseAdmin.auth.admin.updateUserById(teacher.auth_user_id, {
      password: newPassword,
    });

  if (updateAuthError) {
    throw new Error(`更新小老师密码失败：${updateAuthError.message}`);
  }

  await supabaseAdmin
    .from("teachers")
    .update({ must_change_password: true })
    .eq("id", teacher.id);

  return {
  message: `小老师「${teacher.name}」的密码已重置。`,
  resetPassword: {
    role: "teacher" as const,
    name: teacher.name,
    account: teacher.email,
    newPassword,
    },
  };
}

async function executeResetStudentPassword(
  request: any
): Promise<ExecuteResult> {
  const student = await validateResetStudentPassword(request.target_id);
  const newPassword = generateResetPassword("student");

  const { error: updateAuthError } =
    await supabaseAdmin.auth.admin.updateUserById(student.auth_user_id, {
      password: newPassword,
    });

  if (updateAuthError) {
    throw new Error(`更新学生密码失败：${updateAuthError.message}`);
  }

  await supabaseAdmin
    .from("students")
    .update({ must_change_password: true })
    .eq("id", student.id);

  return {
    message: `学生「${student.name}」的密码已重置。`,
    resetPassword: {
      role: "student" as const,
      name: student.name,
      account: student.username,
      newPassword,
    },
  };
}

async function executeApprovedRequest(request: any): Promise<ExecuteResult> {
  if (request.action_type === "archive_cohort") {
    return executeArchiveCohort(request);
  }

  if (request.action_type === "delete_class") {
    return executeDeleteClass(request);
  }

  if (request.action_type === "delete_teacher") {
    return executeDeleteTeacher(request);
  }

  if (request.action_type === "delete_student") {
    return executeDeleteStudent(request);
  }

  if (request.action_type === "update_class_info") {
    return executeUpdateClassInfo(request);
  }

  if (request.action_type === "add_teacher_to_class") {
    return executeAddTeacherToClass(request);
  }

  if (request.action_type === "remove_teacher_from_class") {
    return executeRemoveTeacherFromClass(request);
  }

  if (request.action_type === "add_student_to_class") {
    return executeAddStudentToClass(request);
  }

  if (request.action_type === "remove_student_from_class") {
    return executeRemoveStudentFromClass(request);
  }

  if (request.action_type === "reset_teacher_password") {
    return executeResetTeacherPassword(request);
  }

  if (request.action_type === "reset_student_password") {
    return executeResetStudentPassword(request);
  }

  throw new Error(`未知维护操作：${request.action_type}`);
}

async function approveRequest(body: any, admin: CurrentAdmin) {
  const requestId = body.requestId as string;

  if (!requestId) {
    throw new Error("缺少申请 ID。");
  }

  const { data: request, error: requestError } = await supabaseAdmin
    .from("admin_action_requests")
    .select(
      "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, requested_by, note, action_payload, created_at, updated_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(`读取申请失败：${requestError.message}`);
  }

  if (!request) {
    throw new Error("没有找到这项申请。");
  }

  if (request.status !== "pending") {
    throw new Error("这项申请已经处理过，不能重复确认。");
  }

  const { error: approvalError } = await supabaseAdmin
    .from("admin_action_approvals")
    .insert({
      request_id: requestId,
      admin_id: admin.id,
      admin_name: admin.name,
    });

  if (approvalError) {
    if (approvalError.code === "23505") {
      throw new Error(`管理员「${admin.name}」已经确认过这项申请。`);
    }

    throw new Error(`确认申请失败：${approvalError.message}`);
  }

  const { count: approvalCount, error: countError } = await supabaseAdmin
    .from("admin_action_approvals")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId);

  if (countError) {
    throw new Error(`统计确认人数失败：${countError.message}`);
  }

  const currentApprovalCount = approvalCount || 0;

  await supabaseAdmin
    .from("admin_action_requests")
    .update({
      approvals_count: currentApprovalCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (currentApprovalCount < request.required_approvals) {
    return {
      message: `确认成功，目前 ${currentApprovalCount}/${request.required_approvals} 位管理员已确认。`,
      resetPassword: null,
    };
  }

  const executeResult = await executeApprovedRequest(request);

  const { error: completeError } = await supabaseAdmin
    .from("admin_action_requests")
    .update({
      status: "completed",
      approvals_count: currentApprovalCount,
      note: executeResult.message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (completeError) {
    throw new Error(`更新申请完成状态失败：${completeError.message}`);
  }

  return {
    message: executeResult.message,
    resetPassword: executeResult.resetPassword ?? null,
  };
}

async function cancelRequest(body: any, admin: CurrentAdmin) {
  const requestId = body.requestId as string;

  if (!requestId) {
    throw new Error("缺少申请 ID。");
  }

  const { data: request, error: requestError } = await supabaseAdmin
    .from("admin_action_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(`读取申请失败：${requestError.message}`);
  }

  if (!request) {
    throw new Error("没有找到这项申请。");
  }

  if (request.status !== "pending") {
    throw new Error("只能取消待确认申请。");
  }

  await supabaseAdmin
    .from("admin_action_approvals")
    .delete()
    .eq("request_id", requestId);

  const { error: updateError } = await supabaseAdmin
    .from("admin_action_requests")
    .update({
      status: "canceled",
      note: `由管理员「${admin.name}」取消。`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    throw new Error(`取消申请失败：${updateError.message}`);
  }

  return {
    message: "申请已取消。",
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireCurrentAdmin(request);
    const overview = await fetchOverview();

    return NextResponse.json(overview);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "读取维护中心失败。",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireCurrentAdmin(request);
    const body = await request.json();

    if (body.action === "create_request") {
      const result = await createRequest(body, admin);
      return NextResponse.json(result);
    }

    if (body.action === "approve_request") {
      const result = await approveRequest(body, admin);
      return NextResponse.json(result);
    }

    if (body.action === "cancel_request") {
      const result = await cancelRequest(body, admin);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "未知维护中心操作。" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "维护中心操作失败。",
      },
      { status: 400 }
    );
  }
}