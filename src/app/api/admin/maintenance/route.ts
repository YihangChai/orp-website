import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

async function requireCurrentAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("缺少登录凭证，请重新登录。");
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

  return admin as {
    id: string;
    name: string;
    email: string | null;
    status: string;
    auth_user_id: string;
  };
}

async function getActiveAdminCount() {
  const { count, error } = await supabaseAdmin
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (error) {
    throw new Error(`读取管理员数量失败：${error.message}`);
  }

  return Math.max(count || 1, 1);
}

async function requireActiveClass(classId: string) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, name, school, status, cohort_id")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取班级失败：${error.message}`);
  }

  if (!data) {
    throw new Error("班级不存在。");
  }

  if (data.status !== "active") {
    throw new Error("这个班级不是运行中状态，不能在维护中心修改。");
  }

  return data as {
    id: string;
    name: string;
    school: string | null;
    status: string;
    cohort_id: string | null;
  };
}

async function ensureClassNameAvailable(params: {
  classId: string;
  newName: string;
}) {
  const currentClass = await requireActiveClass(params.classId);
  const normalizedName = normalizeName(params.newName);

  let query = supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("normalized_name", normalizedName)
    .neq("id", params.classId);

  if (currentClass.cohort_id) {
    query = query.eq("cohort_id", currentClass.cohort_id);
  } else {
    query = query.is("cohort_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`检查班级重名失败：${error.message}`);
  }

  if ((data || []).length > 0) {
    throw new Error("同一届别中已经有这个班级名称，不能重复命名。");
  }

  return currentClass;
}

async function fetchOverview() {
  const [
    activeAdminCount,
    cohortsResult,
    classesResult,
    teachersResult,
    studentsResult,
    classTeachersResult,
    classStudentsResult,
    requestsResult,
  ] = await Promise.all([
    getActiveAdminCount(),

    supabaseAdmin
      .from("cohorts")
      .select("id, name, status")
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("classes")
      .select(
        `
        id,
        name,
        school,
        status,
        cohort_id,
        cohorts(name)
      `
      )
      .eq("status", "active")
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("teachers")
      .select("id, name, email, status")
      .order("name", { ascending: true }),

    supabaseAdmin
      .from("students")
      .select("id, name, username, status, grade")
      .order("name", { ascending: true }),

    supabaseAdmin.from("class_teachers").select("class_id, teacher_id"),

    supabaseAdmin.from("class_students").select("class_id, student_id"),

    supabaseAdmin
      .from("admin_action_requests")
      .select(
        "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, requested_by, note, action_payload, created_at, updated_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (typeof activeAdminCount !== "number") {
    throw new Error("读取管理员数量失败。");
  }

  if (cohortsResult.error) {
    throw new Error(`读取届别失败：${cohortsResult.error.message}`);
  }

  if (classesResult.error) {
    throw new Error(`读取班级失败：${classesResult.error.message}`);
  }

  if (teachersResult.error) {
    throw new Error(`读取小老师失败：${teachersResult.error.message}`);
  }

  if (studentsResult.error) {
    throw new Error(`读取学生失败：${studentsResult.error.message}`);
  }

  if (classTeachersResult.error) {
    throw new Error(
      `读取班级小老师关系失败：${classTeachersResult.error.message}`
    );
  }

  if (classStudentsResult.error) {
    throw new Error(
      `读取班级学生关系失败：${classStudentsResult.error.message}`
    );
  }

  if (requestsResult.error) {
    throw new Error(`读取申请失败：${requestsResult.error.message}`);
  }

  const requestIds = (requestsResult.data || []).map((request) => request.id);

  let approvals: any[] = [];

  if (requestIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("admin_action_approvals")
      .select("id, request_id, admin_id, admin_name, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`读取确认记录失败：${error.message}`);
    }

    approvals = data || [];
  }

  const classes = ((classesResult.data || []) as any[]).map((classItem) => ({
    id: classItem.id,
    name: classItem.name,
    school: classItem.school,
    status: classItem.status,
    cohort_id: classItem.cohort_id,
    cohort_name: classItem.cohorts?.name || "未设置届别",
  }));

  return {
    activeAdminCount,
    cohorts: cohortsResult.data || [],
    classes,
    teachers: teachersResult.data || [],
    students: studentsResult.data || [],
    classTeachers: classTeachersResult.data || [],
    classStudents: classStudentsResult.data || [],
    requests: requestsResult.data || [],
    approvals,
  };
}

function getPayload(body: any) {
  if (!body.actionPayload || typeof body.actionPayload !== "object") {
    return {};
  }

  return body.actionPayload as Record<string, any>;
}

async function validateCreateRequest(body: any) {
  const actionType = String(body.actionType || "");
  const targetId = String(body.targetId || "");
  const payload = getPayload(body);

  if (actionType === "update_class_info") {
    const classId = String(payload.classId || targetId || "");
    const newName = String(payload.name || "").trim();

    if (!classId || !newName) {
      throw new Error("修改班级信息申请缺少班级 ID 或新班级名称。");
    }

    await ensureClassNameAvailable({
      classId,
      newName,
    });
  }

  if (
    actionType === "add_teacher_to_class" ||
    actionType === "remove_teacher_from_class" ||
    actionType === "add_student_to_class" ||
    actionType === "remove_student_from_class" ||
    actionType === "delete_class"
  ) {
    const classId =
      actionType === "delete_class"
        ? targetId
        : String(payload.classId || "");

    if (!classId) {
      throw new Error("申请缺少班级 ID。");
    }

    await requireActiveClass(classId);
  }
}

async function createRequest(body: any, admin: { name: string }) {
  const actionType = String(body.actionType || "");
  const targetType = String(body.targetType || "");
  const targetId = String(body.targetId || "");
  const targetName = String(body.targetName || "");
  const note = body.note ? String(body.note) : null;
  const actionPayload = getPayload(body);

  if (!actionType || !targetType || !targetId || !targetName) {
    throw new Error("创建申请失败：缺少必要参数。");
  }

  await validateCreateRequest(body);

  const { data: existingRequests, error: existingError } = await supabaseAdmin
    .from("admin_action_requests")
    .select("id, action_payload")
    .eq("action_type", actionType)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "pending");

  if (existingError) {
    throw new Error(`检查已有申请失败：${existingError.message}`);
  }

  const hasDuplicate = (existingRequests || []).some((request) => {
    const existingPayload = request.action_payload || {};

    if (
      actionType === "add_teacher_to_class" ||
      actionType === "remove_teacher_from_class" ||
      actionType === "add_student_to_class" ||
      actionType === "remove_student_from_class"
    ) {
      return existingPayload.classId === actionPayload.classId;
    }

    return true;
  });

  if (hasDuplicate) {
    throw new Error("这个对象已经有同类待处理申请，不需要重复提交。");
  }

  const activeAdminCount = await getActiveAdminCount();

  const { error } = await supabaseAdmin.from("admin_action_requests").insert({
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    status: "pending",
    approvals_count: 0,
    required_approvals: activeAdminCount,
    requested_by: admin.name,
    note,
    action_payload: actionPayload,
  });

  if (error) {
    throw new Error(`创建申请失败：${error.message}`);
  }

  return {
    message: `已创建申请：${targetName}。需要 ${activeAdminCount} 位 active 管理员确认。`,
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
    throw new Error(`检查班级目标记录失败：${goalError.message}`);
  }

  return (lessonCount || 0) + (goalCount || 0);
}

async function executeArchiveCohort(request: any) {
  const { data: cohortClasses, error: cohortClassesError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("cohort_id", request.target_id);

  if (cohortClassesError) {
    throw new Error(`读取该届班级失败：${cohortClassesError.message}`);
  }

  const cohortClassIds = (cohortClasses || []).map((classItem) => classItem.id);

  const { data: teacherRelations, error: teacherRelationError } =
    await supabaseAdmin
      .from("class_teachers")
      .select("teacher_id, class_id")
      .in("class_id", cohortClassIds.length > 0 ? cohortClassIds : [""]);

  if (teacherRelationError) {
    throw new Error(`读取该届小老师失败：${teacherRelationError.message}`);
  }

  const { data: studentRelations, error: studentRelationError } =
    await supabaseAdmin
      .from("class_students")
      .select("student_id, class_id")
      .in("class_id", cohortClassIds.length > 0 ? cohortClassIds : [""]);

  if (studentRelationError) {
    throw new Error(`读取该届学生失败：${studentRelationError.message}`);
  }

  const relatedTeacherIds = Array.from(
    new Set((teacherRelations || []).map((relation) => relation.teacher_id))
  );

  const relatedStudentIds = Array.from(
    new Set((studentRelations || []).map((relation) => relation.student_id))
  );

  const { error: classError } = await supabaseAdmin
    .from("classes")
    .update({ status: "archived" })
    .eq("cohort_id", request.target_id);

  if (classError) {
    throw new Error(`封存班级失败：${classError.message}`);
  }

  const { error: cohortError } = await supabaseAdmin
    .from("cohorts")
    .update({ status: "archived" })
    .eq("id", request.target_id);

  if (cohortError) {
    throw new Error(`封存届别失败：${cohortError.message}`);
  }

  const { data: activeClasses, error: activeClassesError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("status", "active");

  if (activeClassesError) {
    throw new Error(`检查运行中班级失败：${activeClassesError.message}`);
  }

  const activeClassIds = new Set((activeClasses || []).map((item) => item.id));

  if (relatedTeacherIds.length > 0) {
    const { data: allTeacherRelations, error } = await supabaseAdmin
      .from("class_teachers")
      .select("teacher_id, class_id")
      .in("teacher_id", relatedTeacherIds);

    if (error) {
      throw new Error(`检查小老师其他班级失败：${error.message}`);
    }

    const stillActiveTeacherIds = new Set(
      (allTeacherRelations || [])
        .filter((relation) => activeClassIds.has(relation.class_id))
        .map((relation) => relation.teacher_id)
    );

    const teachersToArchive = relatedTeacherIds.filter(
      (teacherId) => !stillActiveTeacherIds.has(teacherId)
    );

    if (teachersToArchive.length > 0) {
      const { error: teacherError } = await supabaseAdmin
        .from("teachers")
        .update({ status: "archived" })
        .in("id", teachersToArchive);

      if (teacherError) {
        throw new Error(`同步归档小老师失败：${teacherError.message}`);
      }
    }
  }

  if (relatedStudentIds.length > 0) {
    const { data: allStudentRelations, error } = await supabaseAdmin
      .from("class_students")
      .select("student_id, class_id")
      .in("student_id", relatedStudentIds);

    if (error) {
      throw new Error(`检查学生其他班级失败：${error.message}`);
    }

    const stillActiveStudentIds = new Set(
      (allStudentRelations || [])
        .filter((relation) => activeClassIds.has(relation.class_id))
        .map((relation) => relation.student_id)
    );

    const studentsToArchive = relatedStudentIds.filter(
      (studentId) => !stillActiveStudentIds.has(studentId)
    );

    if (studentsToArchive.length > 0) {
      const { error: studentError } = await supabaseAdmin
        .from("students")
        .update({ status: "archived" })
        .in("id", studentsToArchive);

      if (studentError) {
        throw new Error(`同步归档学生失败：${studentError.message}`);
      }
    }
  }

  return "整届已封存；只属于该届的老师和学生已同步归档。";
}

async function executeDeleteClass(request: any) {
  const classId = request.target_id;
  await requireActiveClass(classId);

  const recordCount = await countClassRecords(classId);

  if (recordCount > 0) {
    const { error } = await supabaseAdmin
      .from("classes")
      .update({ status: "archived" })
      .eq("id", classId);

    if (error) {
      throw new Error(`班级已有记录，改为封存失败：${error.message}`);
    }

    return "班级已有课程或目标记录，系统没有物理删除，已改为封存。";
  }

  const { error: teacherRelationError } = await supabaseAdmin
    .from("class_teachers")
    .delete()
    .eq("class_id", classId);

  if (teacherRelationError) {
    throw new Error(`删除班级老师关系失败：${teacherRelationError.message}`);
  }

  const { error: studentRelationError } = await supabaseAdmin
    .from("class_students")
    .delete()
    .eq("class_id", classId);

  if (studentRelationError) {
    throw new Error(`删除班级学生关系失败：${studentRelationError.message}`);
  }

  const { error: classError } = await supabaseAdmin
    .from("classes")
    .delete()
    .eq("id", classId);

  if (classError) {
    throw new Error(`删除班级失败：${classError.message}`);
  }

  return "班级没有课程或目标记录，已彻底删除。";
}

async function executeDeleteTeacher(request: any) {
  const { data: teacher, error: teacherFetchError } = await supabaseAdmin
    .from("teachers")
    .select("id, auth_user_id")
    .eq("id", request.target_id)
    .maybeSingle();

  if (teacherFetchError) {
    throw new Error(`读取小老师失败：${teacherFetchError.message}`);
  }

  if (!teacher) {
    throw new Error("小老师不存在，可能已经被处理。");
  }

  const { count: lessonCount, error: lessonError } = await supabaseAdmin
    .from("lesson_records")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", request.target_id);

  if (lessonError) {
    throw new Error(`检查小老师课程记录失败：${lessonError.message}`);
  }

  if ((lessonCount || 0) > 0) {
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ status: "archived" })
      .eq("id", request.target_id);

    if (error) {
      throw new Error(`小老师已有记录，归档失败：${error.message}`);
    }

    return "小老师已有课程记录，系统没有物理删除，已改为归档。";
  }

  const { error: relationError } = await supabaseAdmin
    .from("class_teachers")
    .delete()
    .eq("teacher_id", request.target_id);

  if (relationError) {
    throw new Error(`删除小老师班级关系失败：${relationError.message}`);
  }

  const { error: teacherDeleteError } = await supabaseAdmin
    .from("teachers")
    .delete()
    .eq("id", request.target_id);

  if (teacherDeleteError) {
    throw new Error(`删除小老师失败：${teacherDeleteError.message}`);
  }

  if (teacher.auth_user_id) {
    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(teacher.auth_user_id);

    if (authDeleteError) {
      throw new Error(
        `小老师资料已删除，但 Auth 账号删除失败：${authDeleteError.message}`
      );
    }
  }

  return "小老师没有课程记录，已彻底删除资料和登录账号。";
}

async function executeDeleteStudent(request: any) {
  const { data: student, error: studentFetchError } = await supabaseAdmin
    .from("students")
    .select("id, auth_user_id")
    .eq("id", request.target_id)
    .maybeSingle();

  if (studentFetchError) {
    throw new Error(`读取学生失败：${studentFetchError.message}`);
  }

  if (!student) {
    throw new Error("学生不存在，可能已经被处理。");
  }

  const { count: commentCount, error: commentError } = await supabaseAdmin
    .from("student_lesson_comments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", request.target_id);

  if (commentError) {
    throw new Error(`检查学生留言记录失败：${commentError.message}`);
  }

  if ((commentCount || 0) > 0) {
    const { error } = await supabaseAdmin
      .from("students")
      .update({ status: "archived" })
      .eq("id", request.target_id);

    if (error) {
      throw new Error(`学生已有记录，归档失败：${error.message}`);
    }

    return "学生已有留言或历史记录，系统没有物理删除，已改为归档。";
  }

  const { error: relationError } = await supabaseAdmin
    .from("class_students")
    .delete()
    .eq("student_id", request.target_id);

  if (relationError) {
    throw new Error(`删除学生班级关系失败：${relationError.message}`);
  }

  const { error: studentDeleteError } = await supabaseAdmin
    .from("students")
    .delete()
    .eq("id", request.target_id);

  if (studentDeleteError) {
    throw new Error(`删除学生失败：${studentDeleteError.message}`);
  }

  if (student.auth_user_id) {
    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(student.auth_user_id);

    if (authDeleteError) {
      throw new Error(
        `学生资料已删除，但 Auth 账号删除失败：${authDeleteError.message}`
      );
    }
  }

  return "学生没有留言记录，已彻底删除资料和登录账号。";
}

async function executeUpdateClassInfo(request: any) {
  const payload = request.action_payload || {};
  const classId = String(payload.classId || request.target_id || "");
  const name = String(payload.name || "").trim();
  const school = String(payload.school || "").trim();

  if (!classId || !name) {
    throw new Error("修改班级信息失败：缺少班级 ID 或班级名称。");
  }

  await ensureClassNameAvailable({
    classId,
    newName: name,
  });

  const { error } = await supabaseAdmin
    .from("classes")
    .update({
      name,
      normalized_name: normalizeName(name),
      school: school || null,
    })
    .eq("id", classId);

  if (error) {
    throw new Error(`修改班级信息失败：${error.message}`);
  }

  return "班级名称和合作学校已更新。";
}

async function executeAddTeacherToClass(request: any) {
  const payload = request.action_payload || {};
  const classId = String(payload.classId || "");
  const teacherId = String(payload.teacherId || request.target_id || "");

  if (!classId || !teacherId) {
    throw new Error("添加小老师失败：缺少班级 ID 或小老师 ID。");
  }

  await requireActiveClass(classId);

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
    throw new Error(`添加小老师到班级失败：${error.message}`);
  }

  await supabaseAdmin
    .from("teachers")
    .update({ status: "active" })
    .eq("id", teacherId);

  return "已将小老师加入班级。";
}

async function executeRemoveTeacherFromClass(request: any) {
  const payload = request.action_payload || {};
  const classId = String(payload.classId || "");
  const teacherId = String(payload.teacherId || request.target_id || "");

  if (!classId || !teacherId) {
    throw new Error("移除小老师失败：缺少班级 ID 或小老师 ID。");
  }

  await requireActiveClass(classId);

  const { error } = await supabaseAdmin
    .from("class_teachers")
    .delete()
    .eq("class_id", classId)
    .eq("teacher_id", teacherId);

  if (error) {
    throw new Error(`从班级移除小老师失败：${error.message}`);
  }

  return "已从班级移除小老师。小老师账号没有被删除。";
}

async function executeAddStudentToClass(request: any) {
  const payload = request.action_payload || {};
  const classId = String(payload.classId || "");
  const studentId = String(payload.studentId || request.target_id || "");

  if (!classId || !studentId) {
    throw new Error("添加学生失败：缺少班级 ID 或学生 ID。");
  }

  await requireActiveClass(classId);

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
    throw new Error(`添加学生到班级失败：${error.message}`);
  }

  await supabaseAdmin
    .from("students")
    .update({ status: "active" })
    .eq("id", studentId);

  return "已将学生加入班级。";
}

async function executeRemoveStudentFromClass(request: any) {
  const payload = request.action_payload || {};
  const classId = String(payload.classId || "");
  const studentId = String(payload.studentId || request.target_id || "");

  if (!classId || !studentId) {
    throw new Error("移除学生失败：缺少班级 ID 或学生 ID。");
  }

  await requireActiveClass(classId);

  const { error } = await supabaseAdmin
    .from("class_students")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentId);

  if (error) {
    throw new Error(`从班级移除学生失败：${error.message}`);
  }

  return "已从班级移除学生。学生账号没有被删除。";
}

async function executeApprovedRequest(request: any) {
  if (
    request.action_type === "archive_cohort" &&
    request.target_type === "cohort"
  ) {
    return executeArchiveCohort(request);
  }

  if (request.action_type === "delete_class" && request.target_type === "class") {
    return executeDeleteClass(request);
  }

  if (
    request.action_type === "delete_teacher" &&
    request.target_type === "teacher"
  ) {
    return executeDeleteTeacher(request);
  }

  if (
    request.action_type === "delete_student" &&
    request.target_type === "student"
  ) {
    return executeDeleteStudent(request);
  }

  if (
    request.action_type === "update_class_info" &&
    request.target_type === "class"
  ) {
    return executeUpdateClassInfo(request);
  }

  if (
    request.action_type === "add_teacher_to_class" &&
    request.target_type === "teacher"
  ) {
    return executeAddTeacherToClass(request);
  }

  if (
    request.action_type === "remove_teacher_from_class" &&
    request.target_type === "teacher"
  ) {
    return executeRemoveTeacherFromClass(request);
  }

  if (
    request.action_type === "add_student_to_class" &&
    request.target_type === "student"
  ) {
    return executeAddStudentToClass(request);
  }

  if (
    request.action_type === "remove_student_from_class" &&
    request.target_type === "student"
  ) {
    return executeRemoveStudentFromClass(request);
  }

  throw new Error(`暂不支持的申请类型：${request.action_type}`);
}

async function approveRequest(body: any, admin: { id: string; name: string }) {
  const requestId = String(body.requestId || "");

  if (!requestId) {
    throw new Error("缺少 requestId。");
  }

  const { data: actionRequest, error: requestError } = await supabaseAdmin
    .from("admin_action_requests")
    .select(
      "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, requested_by, note, action_payload"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(`读取申请失败：${requestError.message}`);
  }

  if (!actionRequest || actionRequest.status !== "pending") {
    throw new Error("申请不存在或已经不是待处理状态。");
  }

  const { error: approvalError } = await supabaseAdmin
    .from("admin_action_approvals")
    .insert({
      request_id: requestId,
      admin_id: admin.id,
      admin_name: admin.name,
    });

  if (approvalError) {
    if (
      approvalError.message.includes("duplicate") ||
      approvalError.message.includes("unique")
    ) {
      throw new Error(`管理员「${admin.name}」已经确认过这项申请。`);
    }

    throw new Error(`记录确认失败：${approvalError.message}`);
  }

  const { count, error: countError } = await supabaseAdmin
    .from("admin_action_approvals")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId);

  if (countError) {
    throw new Error(`统计确认次数失败：${countError.message}`);
  }

  const approvalCount = count || 0;

  const { error: updateCountError } = await supabaseAdmin
    .from("admin_action_requests")
    .update({
      approvals_count: approvalCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateCountError) {
    throw new Error(`更新确认次数失败：${updateCountError.message}`);
  }

  if (approvalCount < actionRequest.required_approvals) {
    return {
      completed: false,
      message: `已记录确认。还需要 ${
        actionRequest.required_approvals - approvalCount
      } 位管理员确认。`,
    };
  }

  const resultNote = await executeApprovedRequest(actionRequest);

  const { error: completeError } = await supabaseAdmin
    .from("admin_action_requests")
    .update({
      approvals_count: approvalCount,
      status: "completed",
      note: resultNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (completeError) {
    throw new Error(`操作已执行，但更新申请状态失败：${completeError.message}`);
  }

  return {
    completed: true,
    message: resultNote,
  };
}

async function cancelRequest(body: any) {
  const requestId = String(body.requestId || "");

  if (!requestId) {
    throw new Error("缺少 requestId。");
  }

  const { error: approvalError } = await supabaseAdmin
    .from("admin_action_approvals")
    .delete()
    .eq("request_id", requestId);

  if (approvalError) {
    throw new Error(`清除确认记录失败：${approvalError.message}`);
  }

  const { error } = await supabaseAdmin
    .from("admin_action_requests")
    .update({
      status: "canceled",
      approvals_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(`取消申请失败：${error.message}`);
  }

  return { message: "申请已取消。" };
}

export async function GET(request: NextRequest) {
  try {
    await requireCurrentAdmin(request);

    const overview = await fetchOverview();

    return NextResponse.json(overview);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "读取维护中心数据失败。",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireCurrentAdmin(request);
    const body = await request.json();

    let result;

    if (body.action === "create_request") {
      result = await createRequest(body, admin);
    } else if (body.action === "approve_request") {
      result = await approveRequest(body, admin);
    } else if (body.action === "cancel_request") {
      result = await cancelRequest(body);
    } else {
      throw new Error("未知维护操作。");
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "维护操作失败。",
      },
      { status: 400 }
    );
  }
}