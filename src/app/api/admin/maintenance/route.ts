import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 当前登录管理员。
 */
type CurrentAdmin = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  auth_user_id: string;
};

/**
 * 密码重置完成后，需要临时返回给管理员的信息。
 */
type ResetPasswordResult = {
  role: "teacher" | "student";
  name: string;
  account: string | null;
  newPassword: string;
};

type ExecuteResult = {
  message: string;
  resetPassword?: ResetPasswordResult | null;
};

/**
 * JSON 对象中每个字段的值暂时未知。
 * 使用 unknown 比 any 安全，因为读取前必须进行类型检查。
 */
type UnknownRecord = Record<string, unknown>;

type CreateRequestBody = {
  action: "create_request";
  actionType: string;
  targetType: string;
  targetId: string;
  targetName: string;
  note?: string;
  actionPayload: UnknownRecord;
};

type ApproveRequestBody = {
  action: "approve_request";
  requestId: string;
};

type CancelRequestBody = {
  action: "cancel_request";
  requestId: string;
};

type MaintenanceRequestBody =
  | CreateRequestBody
  | ApproveRequestBody
  | CancelRequestBody;

type AdminActionRequest = {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_name: string;
  status: string;
  approvals_count: number;
  required_approvals: number;
  requested_by: string;
  note: string | null;
  action_payload: UnknownRecord | null;
  created_at: string;
  updated_at: string;
};

type ExistingRequestRow = {
  id: string;
  action_payload: UnknownRecord | null;
};

type ApprovalRow = {
  id: string;
  request_id: string;
  admin_id: string;
  admin_name: string;
  created_at: string;
};

type CohortOverviewRow = {
  id: string;
  name: string;
  status: string;
};

type CohortNameRelation = {
  name: string;
};

type ClassOverviewQueryRow = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  cohort_id: string | null;
  cohorts:
    | CohortNameRelation
    | CohortNameRelation[]
    | null;
};

type ClassOverviewRow = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  cohort_id: string | null;
  cohort_name: string;
};

type TeacherOverviewRow = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  auth_user_id: string | null;
};

type StudentOverviewRow = {
  id: string;
  name: string;
  username: string | null;
  status: string;
  grade: string | null;
  auth_user_id: string | null;
};

type ClassTeacherRelationRow = {
  class_id: string;
  teacher_id: string;
};

type ClassStudentRelationRow = {
  class_id: string;
  student_id: string;
};

type ActiveClassRow = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  cohort_id: string | null;
};

type ResetTeacherRow = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  auth_user_id: string | null;
};

type ResetStudentRow = {
  id: string;
  name: string;
  username: string | null;
  status: string;
  auth_user_id: string | null;
};

type DeleteTeacherRow = {
  id: string;
  name: string;
  auth_user_id: string | null;
};

type DeleteStudentRow = {
  id: string;
  name: string;
  auth_user_id: string | null;
};

type CohortClassRow = {
  id: string;
};

type TeacherClassRelationRow = {
  teacher_id: string;
  class_id: string;
};

type StudentClassRelationRow = {
  student_id: string;
  class_id: string;
};

type CancelRequestRow = {
  id: string;
  status: string;
};

/**
 * 判断未知值是不是普通对象。
 */
function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * 从未知对象中安全读取字符串。
 */
function getString(
  record: UnknownRecord,
  key: string
): string | undefined {
  const value = record[key];

  return typeof value === "string" ? value : undefined;
}

/**
 * 从未知对象中安全读取可选字符串，并清理前后空格。
 */
function getTrimmedString(
  record: UnknownRecord,
  key: string
): string | undefined {
  const value = getString(record, key);

  if (value === undefined) {
    return undefined;
  }

  return value.trim();
}

/**
 * Supabase 嵌套关系有时返回单个对象，有时返回数组。
 */
function getOne<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/**
 * 安全读取 actionPayload。
 */
function getPayload(body: UnknownRecord): UnknownRecord {
  const payload = body.actionPayload;

  return isRecord(payload) ? payload : {};
}

/**
 * action_payload 来自数据库，也需要再次确认结构。
 */
function getRequestPayload(
  request: AdminActionRequest
): UnknownRecord {
  return isRecord(request.action_payload)
    ? request.action_payload
    : {};
}

/**
 * 将 request.json() 的 unknown 数据转换成明确的联合类型。
 */
function parseMaintenanceRequestBody(
  value: unknown
): MaintenanceRequestBody {
  if (!isRecord(value)) {
    throw new Error("请求内容格式不正确。");
  }

  const action = getString(value, "action");

  if (action === "create_request") {
    const actionType = getTrimmedString(value, "actionType");
    const targetType = getTrimmedString(value, "targetType");
    const targetId = getTrimmedString(value, "targetId");
    const targetName = getTrimmedString(value, "targetName");
    const note = getTrimmedString(value, "note");

    if (
      !actionType ||
      !targetType ||
      !targetId ||
      !targetName
    ) {
      throw new Error("创建申请缺少必要信息。");
    }

    return {
      action,
      actionType,
      targetType,
      targetId,
      targetName,
      note,
      actionPayload: getPayload(value),
    };
  }

  if (action === "approve_request") {
    const requestId = getTrimmedString(value, "requestId");

    if (!requestId) {
      throw new Error("缺少申请 ID。");
    }

    return {
      action,
      requestId,
    };
  }

  if (action === "cancel_request") {
    const requestId = getTrimmedString(value, "requestId");

    if (!requestId) {
      throw new Error("缺少申请 ID。");
    }

    return {
      action,
      requestId,
    };
  }

  throw new Error("未知维护中心操作。");
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

function generateResetPassword(
  role: "teacher" | "student"
) {
  const prefix = role === "teacher" ? "ORP-T" : "ORP-S";

  const randomPart = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix}-${randomPart}`;
}

async function requireCurrentAdmin(
  request: NextRequest
): Promise<CurrentAdmin> {
  const authHeader =
    request.headers.get("authorization") || "";

  const token = authHeader
    .replace("Bearer ", "")
    .trim();

  if (!token) {
    throw new Error("缺少登录信息，请重新登录。");
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    throw new Error("登录状态无效，请重新登录。");
  }

  const { data: admin, error: adminError } =
    await supabaseAdmin
      .from("admins")
      .select("id, name, email, status, auth_user_id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

  if (adminError) {
    throw new Error(
      `读取管理员身份失败：${adminError.message}`
    );
  }

  if (!admin || admin.status !== "active") {
    throw new Error(
      "当前账号不是 active 管理员，不能执行维护操作。"
    );
  }

  return admin as CurrentAdmin;
}

async function getActiveAdminCount() {
  const { count, error } = await supabaseAdmin
    .from("admins")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("status", "active");

  if (error) {
    throw new Error(
      `读取 active 管理员数量失败：${error.message}`
    );
  }

  return Math.max(count ?? 0, 1);
}

async function requireActiveClass(
  classId: string
): Promise<ActiveClassRow> {
  const { data: classItem, error } =
    await supabaseAdmin
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

  return classItem as ActiveClassRow;
}

async function ensureClassNameAvailable(params: {
  classId: string;
  newName: string;
}) {
  const classItem = await requireActiveClass(
    params.classId
  );

  const normalizedName = normalizeName(params.newName);

  let query = supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("normalized_name", normalizedName)
    .neq("id", params.classId);

  if (classItem.cohort_id) {
    query = query.eq(
      "cohort_id",
      classItem.cohort_id
    );
  } else {
    query = query.is("cohort_id", null);
  }

  const { data: existingClasses, error } = await query;

  if (error) {
    throw new Error(
      `检查班级重名失败：${error.message}`
    );
  }

  if ((existingClasses ?? []).length > 0) {
    throw new Error(
      "同一届别中已经有这个班级名称，不能重复命名。"
    );
  }

  return normalizedName;
}

async function validateResetTeacherPassword(
  targetId: string
): Promise<ResetTeacherRow> {
  const { data: teacher, error } =
    await supabaseAdmin
      .from("teachers")
      .select(
        "id, name, email, status, auth_user_id"
      )
      .eq("id", targetId)
      .maybeSingle();

  if (error) {
    throw new Error(`读取小老师失败：${error.message}`);
  }

  if (!teacher) {
    throw new Error("没有找到这个小老师。");
  }

  if (teacher.status !== "active") {
    throw new Error(
      "只能重置 active 小老师的密码。"
    );
  }

  if (!teacher.auth_user_id) {
    throw new Error(
      "这个小老师没有绑定登录账号，无法重置密码。"
    );
  }

  return teacher as ResetTeacherRow;
}

async function validateResetStudentPassword(
  targetId: string
): Promise<ResetStudentRow> {
  const { data: student, error } =
    await supabaseAdmin
      .from("students")
      .select(
        "id, name, username, status, auth_user_id"
      )
      .eq("id", targetId)
      .maybeSingle();

  if (error) {
    throw new Error(`读取学生失败：${error.message}`);
  }

  if (!student) {
    throw new Error("没有找到这个学生。");
  }

  if (student.status !== "active") {
    throw new Error(
      "只能重置 active 学生的密码。"
    );
  }

  if (!student.auth_user_id) {
    throw new Error(
      "这个学生没有绑定登录账号，无法重置密码。"
    );
  }

  return student as ResetStudentRow;
}

async function fetchOverview() {
  const activeAdminCount = await getActiveAdminCount();

  const [
    cohortsResult,
    classesResult,
    teachersResult,
    studentsResult,
    classTeachersResult,
    classStudentsResult,
    requestsResult,
  ] = await Promise.all([
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
          cohorts (
            name
          )
        `
      )
      .eq("status", "active")
      .order("name", { ascending: true }),

    supabaseAdmin
      .from("teachers")
      .select(
        "id, name, email, status, auth_user_id"
      )
      .order("name", { ascending: true }),

    supabaseAdmin
      .from("students")
      .select(
        "id, name, username, status, grade, auth_user_id"
      )
      .order("name", { ascending: true }),

    supabaseAdmin
      .from("class_teachers")
      .select("class_id, teacher_id"),

    supabaseAdmin
      .from("class_students")
      .select("class_id, student_id"),

    supabaseAdmin
      .from("admin_action_requests")
      .select(
        "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, requested_by, note, action_payload, created_at, updated_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (cohortsResult.error) {
    throw new Error(
      `读取届别失败：${cohortsResult.error.message}`
    );
  }

  if (classesResult.error) {
    throw new Error(
      `读取班级失败：${classesResult.error.message}`
    );
  }

  if (teachersResult.error) {
    throw new Error(
      `读取小老师失败：${teachersResult.error.message}`
    );
  }

  if (studentsResult.error) {
    throw new Error(
      `读取学生失败：${studentsResult.error.message}`
    );
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
    throw new Error(
      `读取维护申请失败：${requestsResult.error.message}`
    );
  }

  const classQueryRows =
    (classesResult.data ??
      []) as unknown as ClassOverviewQueryRow[];

  const classes: ClassOverviewRow[] =
    classQueryRows.map((classItem) => {
      const cohort = getOne(classItem.cohorts);

      return {
        id: classItem.id,
        name: classItem.name,
        school: classItem.school,
        status: classItem.status,
        cohort_id: classItem.cohort_id,
        cohort_name: cohort?.name || "未设置届别",
      };
    });

  const requests =
    (requestsResult.data ??
      []) as unknown as AdminActionRequest[];

  const requestIds = requests.map(
    (requestItem) => requestItem.id
  );

  let approvals: ApprovalRow[] = [];

  if (requestIds.length > 0) {
    const { data: approvalsData, error: approvalsError } =
      await supabaseAdmin
        .from("admin_action_approvals")
        .select(
          "id, request_id, admin_id, admin_name, created_at"
        )
        .in("request_id", requestIds)
        .order("created_at", { ascending: true });

    if (approvalsError) {
      throw new Error(
        `读取确认记录失败：${approvalsError.message}`
      );
    }

    approvals =
      (approvalsData ?? []) as ApprovalRow[];
  }

  return {
    activeAdminCount,
    cohorts:
      (cohortsResult.data ??
        []) as CohortOverviewRow[],
    classes,
    teachers:
      (teachersResult.data ??
        []) as TeacherOverviewRow[],
    students:
      (studentsResult.data ??
        []) as StudentOverviewRow[],
    classTeachers:
      (classTeachersResult.data ??
        []) as ClassTeacherRelationRow[],
    classStudents:
      (classStudentsResult.data ??
        []) as ClassStudentRelationRow[],
    requests,
    approvals,
  };
}

async function validateCreateRequest(
  body: CreateRequestBody
) {
  const {
    actionType,
    targetId,
    actionPayload,
  } = body;

  if (actionType === "update_class_info") {
    const classId = getTrimmedString(
      actionPayload,
      "classId"
    );

    const name = getTrimmedString(
      actionPayload,
      "name"
    );

    if (!classId || !name) {
      throw new Error(
        "修改班级信息缺少 classId 或班级名称。"
      );
    }

    await ensureClassNameAvailable({
      classId,
      newName: name,
    });
  }

  const classRelationActions = new Set([
    "add_teacher_to_class",
    "remove_teacher_from_class",
    "add_student_to_class",
    "remove_student_from_class",
    "delete_class",
  ]);

  if (classRelationActions.has(actionType)) {
    const classId =
      getTrimmedString(actionPayload, "classId") ||
      targetId;

    await requireActiveClass(classId);
  }

  if (actionType === "reset_teacher_password") {
    await validateResetTeacherPassword(targetId);
  }

  if (actionType === "reset_student_password") {
    await validateResetStudentPassword(targetId);
  }
}

async function createRequest(
  body: CreateRequestBody,
  admin: CurrentAdmin
) {
  await validateCreateRequest(body);

  const {
    actionType,
    targetType,
    targetId,
    targetName,
    note,
    actionPayload,
  } = body;

  const { data: existingRequests, error: duplicateError } =
    await supabaseAdmin
      .from("admin_action_requests")
      .select("id, action_payload")
      .eq("action_type", actionType)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("status", "pending");

  if (duplicateError) {
    throw new Error(
      `检查重复申请失败：${duplicateError.message}`
    );
  }

  const existingRequestRows =
    (existingRequests ??
      []) as unknown as ExistingRequestRow[];

  const classRelationActions = new Set([
    "add_teacher_to_class",
    "remove_teacher_from_class",
    "add_student_to_class",
    "remove_student_from_class",
  ]);

  const newClassId = getTrimmedString(
    actionPayload,
    "classId"
  );

  const hasDuplicate = existingRequestRows.some(
    (requestItem) => {
      if (!classRelationActions.has(actionType)) {
        return true;
      }

      const existingPayload = isRecord(
        requestItem.action_payload
      )
        ? requestItem.action_payload
        : {};

      const existingClassId = getTrimmedString(
        existingPayload,
        "classId"
      );

      return existingClassId === newClassId;
    }
  );

  if (hasDuplicate) {
    throw new Error(
      "已经存在相同对象的待确认申请，请先处理原申请。"
    );
  }

  const requiredApprovals =
    await getActiveAdminCount();

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
    throw new Error(
      `创建申请失败：${insertError.message}`
    );
  }

  return {
    message: `申请已创建，需要 ${requiredApprovals} 位 active 管理员确认。`,
  };
}

async function countClassRecords(classId: string) {
  const [lessonResult, goalResult] =
    await Promise.all([
      supabaseAdmin
        .from("lesson_records")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("class_id", classId),

      supabaseAdmin
        .from("teaching_goals")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("class_id", classId),
    ]);

  if (lessonResult.error) {
    throw new Error(
      `检查班级课程记录失败：${lessonResult.error.message}`
    );
  }

  if (goalResult.error) {
    throw new Error(
      `检查班级学习目标失败：${goalResult.error.message}`
    );
  }

  return {
    lessonCount: lessonResult.count ?? 0,
    goalCount: goalResult.count ?? 0,
  };
}

async function executeArchiveCohort(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const cohortId = request.target_id;

  const { data: cohortClasses, error: classError } =
    await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("cohort_id", cohortId);

  if (classError) {
    throw new Error(
      `读取届别班级失败：${classError.message}`
    );
  }

  const cohortClassIds = (
    (cohortClasses ?? []) as CohortClassRow[]
  ).map((classItem) => classItem.id);

  let teacherRelations: TeacherClassRelationRow[] = [];
  let studentRelations: StudentClassRelationRow[] = [];

  if (cohortClassIds.length > 0) {
    const [teachersResult, studentsResult] =
      await Promise.all([
        supabaseAdmin
          .from("class_teachers")
          .select("teacher_id, class_id")
          .in("class_id", cohortClassIds),

        supabaseAdmin
          .from("class_students")
          .select("student_id, class_id")
          .in("class_id", cohortClassIds),
      ]);

    if (teachersResult.error) {
      throw new Error(
        `读取届别小老师关系失败：${teachersResult.error.message}`
      );
    }

    if (studentsResult.error) {
      throw new Error(
        `读取届别学生关系失败：${studentsResult.error.message}`
      );
    }

    teacherRelations =
      (teachersResult.data ??
        []) as TeacherClassRelationRow[];

    studentRelations =
      (studentsResult.data ??
        []) as StudentClassRelationRow[];
  }

  if (cohortClassIds.length > 0) {
    const { error: classUpdateError } =
      await supabaseAdmin
        .from("classes")
        .update({ status: "archived" })
        .in("id", cohortClassIds);

    if (classUpdateError) {
      throw new Error(
        `封存届别班级失败：${classUpdateError.message}`
      );
    }
  }

  const { error: cohortUpdateError } =
    await supabaseAdmin
      .from("cohorts")
      .update({ status: "archived" })
      .eq("id", cohortId);

  if (cohortUpdateError) {
    throw new Error(
      `封存届别失败：${cohortUpdateError.message}`
    );
  }

  const teacherIds = Array.from(
    new Set(
      teacherRelations.map(
        (relation) => relation.teacher_id
      )
    )
  );

  const studentIds = Array.from(
    new Set(
      studentRelations.map(
        (relation) => relation.student_id
      )
    )
  );

  for (const teacherId of teacherIds) {
    const { data: activeRelations, error } =
      await supabaseAdmin
        .from("class_teachers")
        .select("classes!inner(id, status)")
        .eq("teacher_id", teacherId)
        .eq("classes.status", "active");

    if (error) {
      throw new Error(
        `检查小老师其他 active 班级失败：${error.message}`
      );
    }

    if ((activeRelations ?? []).length === 0) {
      const { error: archiveTeacherError } =
        await supabaseAdmin
          .from("teachers")
          .update({ status: "archived" })
          .eq("id", teacherId);

      if (archiveTeacherError) {
        throw new Error(
          `归档小老师失败：${archiveTeacherError.message}`
        );
      }
    }
  }

  for (const studentId of studentIds) {
    const { data: activeRelations, error } =
      await supabaseAdmin
        .from("class_students")
        .select("classes!inner(id, status)")
        .eq("student_id", studentId)
        .eq("classes.status", "active");

    if (error) {
      throw new Error(
        `检查学生其他 active 班级失败：${error.message}`
      );
    }

    if ((activeRelations ?? []).length === 0) {
      const { error: archiveStudentError } =
        await supabaseAdmin
          .from("students")
          .update({ status: "archived" })
          .eq("id", studentId);

      if (archiveStudentError) {
        throw new Error(
          `归档学生失败：${archiveStudentError.message}`
        );
      }
    }
  }

  return {
    message: `届别「${request.target_name}」已封存。`,
  };
}

async function executeDeleteClass(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const classId = request.target_id;

  await requireActiveClass(classId);

  const { lessonCount, goalCount } =
    await countClassRecords(classId);

  if (lessonCount > 0 || goalCount > 0) {
    const { error } = await supabaseAdmin
      .from("classes")
      .update({ status: "archived" })
      .eq("id", classId);

    if (error) {
      throw new Error(
        `封存班级失败：${error.message}`
      );
    }

    return {
      message: `班级「${request.target_name}」已有历史记录，已改为封存。`,
    };
  }

  const [teacherDeleteResult, studentDeleteResult] =
    await Promise.all([
      supabaseAdmin
        .from("class_teachers")
        .delete()
        .eq("class_id", classId),

      supabaseAdmin
        .from("class_students")
        .delete()
        .eq("class_id", classId),
    ]);

  if (teacherDeleteResult.error) {
    throw new Error(
      `删除班级小老师关系失败：${teacherDeleteResult.error.message}`
    );
  }

  if (studentDeleteResult.error) {
    throw new Error(
      `删除班级学生关系失败：${studentDeleteResult.error.message}`
    );
  }

  const { error: deleteError } =
    await supabaseAdmin
      .from("classes")
      .delete()
      .eq("id", classId);

  if (deleteError) {
    throw new Error(
      `删除班级失败：${deleteError.message}`
    );
  }

  return {
    message: `班级「${request.target_name}」没有历史记录，已删除。`,
  };
}

async function executeDeleteTeacher(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const teacherId = request.target_id;

  const { data: teacher, error: teacherError } =
    await supabaseAdmin
      .from("teachers")
      .select("id, name, auth_user_id")
      .eq("id", teacherId)
      .maybeSingle();

  if (teacherError) {
    throw new Error(
      `读取小老师失败：${teacherError.message}`
    );
  }

  if (!teacher) {
    throw new Error("没有找到这个小老师。");
  }

  const teacherRow = teacher as DeleteTeacherRow;

  const { count: lessonCount, error: countError } =
    await supabaseAdmin
      .from("lesson_records")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("teacher_id", teacherId);

  if (countError) {
    throw new Error(
      `检查小老师课程记录失败：${countError.message}`
    );
  }

  if ((lessonCount ?? 0) > 0) {
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ status: "archived" })
      .eq("id", teacherId);

    if (error) {
      throw new Error(
        `归档小老师失败：${error.message}`
      );
    }

    return {
      message: `小老师「${teacherRow.name}」已有课程记录，已归档。`,
    };
  }

  const { error: relationDeleteError } =
    await supabaseAdmin
      .from("class_teachers")
      .delete()
      .eq("teacher_id", teacherId);

  if (relationDeleteError) {
    throw new Error(
      `删除小老师班级关系失败：${relationDeleteError.message}`
    );
  }

  const { error: deleteTeacherError } =
    await supabaseAdmin
      .from("teachers")
      .delete()
      .eq("id", teacherId);

  if (deleteTeacherError) {
    throw new Error(
      `删除小老师失败：${deleteTeacherError.message}`
    );
  }

  if (teacherRow.auth_user_id) {
    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(
        teacherRow.auth_user_id
      );

    if (deleteAuthError) {
      throw new Error(
        `删除小老师登录账号失败：${deleteAuthError.message}`
      );
    }
  }

  return {
    message: `小老师「${teacherRow.name}」没有课程记录，已删除。`,
  };
}

async function executeDeleteStudent(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const studentId = request.target_id;

  const { data: student, error: studentError } =
    await supabaseAdmin
      .from("students")
      .select("id, name, auth_user_id")
      .eq("id", studentId)
      .maybeSingle();

  if (studentError) {
    throw new Error(
      `读取学生失败：${studentError.message}`
    );
  }

  if (!student) {
    throw new Error("没有找到这个学生。");
  }

  const studentRow = student as DeleteStudentRow;

  const { count: commentCount, error: commentError } =
    await supabaseAdmin
      .from("student_lesson_comments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("student_id", studentId);

  if (commentError) {
    throw new Error(
      `检查学生留言记录失败：${commentError.message}`
    );
  }

  if ((commentCount ?? 0) > 0) {
    const { error } = await supabaseAdmin
      .from("students")
      .update({ status: "archived" })
      .eq("id", studentId);

    if (error) {
      throw new Error(
        `归档学生失败：${error.message}`
      );
    }

    return {
      message: `学生「${studentRow.name}」已有留言记录，已归档。`,
    };
  }

  const { error: relationDeleteError } =
    await supabaseAdmin
      .from("class_students")
      .delete()
      .eq("student_id", studentId);

  if (relationDeleteError) {
    throw new Error(
      `删除学生班级关系失败：${relationDeleteError.message}`
    );
  }

  const { error: deleteStudentError } =
    await supabaseAdmin
      .from("students")
      .delete()
      .eq("id", studentId);

  if (deleteStudentError) {
    throw new Error(
      `删除学生失败：${deleteStudentError.message}`
    );
  }

  if (studentRow.auth_user_id) {
    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(
        studentRow.auth_user_id
      );

    if (deleteAuthError) {
      throw new Error(
        `删除学生登录账号失败：${deleteAuthError.message}`
      );
    }
  }

  return {
    message: `学生「${studentRow.name}」没有留言记录，已删除。`,
  };
}

async function executeUpdateClassInfo(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const payload = getRequestPayload(request);

  const classId = getTrimmedString(
    payload,
    "classId"
  );

  const newName = getTrimmedString(
    payload,
    "name"
  );

  const newSchool =
    getTrimmedString(payload, "school") || "";

  if (!classId || !newName) {
    throw new Error(
      "修改班级信息缺少必要字段。"
    );
  }

  const normalizedName =
    await ensureClassNameAvailable({
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
    throw new Error(
      `修改班级信息失败：${error.message}`
    );
  }

  return {
    message: `班级信息已修改为「${newName}」。`,
  };
}

async function executeAddTeacherToClass(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const payload = getRequestPayload(request);

  const classId = getTrimmedString(
    payload,
    "classId"
  );

  const teacherId =
    getTrimmedString(payload, "teacherId") ||
    request.target_id;

  if (!classId || !teacherId) {
    throw new Error(
      "添加小老师缺少班级或小老师 ID。"
    );
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
    throw new Error(
      `添加小老师失败：${error.message}`
    );
  }

  const { error: activateTeacherError } =
    await supabaseAdmin
      .from("teachers")
      .update({ status: "active" })
      .eq("id", teacherId);

  if (activateTeacherError) {
    throw new Error(
      `恢复小老师状态失败：${activateTeacherError.message}`
    );
  }

  return {
    message: `小老师「${request.target_name}」已加入班级。`,
  };
}

async function executeRemoveTeacherFromClass(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const payload = getRequestPayload(request);

  const classId = getTrimmedString(
    payload,
    "classId"
  );

  const teacherId =
    getTrimmedString(payload, "teacherId") ||
    request.target_id;

  if (!classId || !teacherId) {
    throw new Error(
      "移除小老师缺少班级或小老师 ID。"
    );
  }

  await requireActiveClass(classId);

  const { error } = await supabaseAdmin
    .from("class_teachers")
    .delete()
    .eq("class_id", classId)
    .eq("teacher_id", teacherId);

  if (error) {
    throw new Error(
      `移除小老师失败：${error.message}`
    );
  }

  return {
    message: `小老师「${request.target_name}」已从班级移除。`,
  };
}

async function executeAddStudentToClass(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const payload = getRequestPayload(request);

  const classId = getTrimmedString(
    payload,
    "classId"
  );

  const studentId =
    getTrimmedString(payload, "studentId") ||
    request.target_id;

  if (!classId || !studentId) {
    throw new Error(
      "添加学生缺少班级或学生 ID。"
    );
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
    throw new Error(
      `添加学生失败：${error.message}`
    );
  }

  const { error: activateStudentError } =
    await supabaseAdmin
      .from("students")
      .update({ status: "active" })
      .eq("id", studentId);

  if (activateStudentError) {
    throw new Error(
      `恢复学生状态失败：${activateStudentError.message}`
    );
  }

  return {
    message: `学生「${request.target_name}」已加入班级。`,
  };
}

async function executeRemoveStudentFromClass(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const payload = getRequestPayload(request);

  const classId = getTrimmedString(
    payload,
    "classId"
  );

  const studentId =
    getTrimmedString(payload, "studentId") ||
    request.target_id;

  if (!classId || !studentId) {
    throw new Error(
      "移除学生缺少班级或学生 ID。"
    );
  }

  await requireActiveClass(classId);

  const { error } = await supabaseAdmin
    .from("class_students")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentId);

  if (error) {
    throw new Error(
      `移除学生失败：${error.message}`
    );
  }

  return {
    message: `学生「${request.target_name}」已从班级移除。`,
  };
}

async function executeResetTeacherPassword(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const teacher =
    await validateResetTeacherPassword(
      request.target_id
    );

  if (!teacher.auth_user_id) {
    throw new Error(
      "这个小老师没有绑定登录账号。"
    );
  }

  const newPassword =
    generateResetPassword("teacher");

  const { error: updateAuthError } =
    await supabaseAdmin.auth.admin.updateUserById(
      teacher.auth_user_id,
      {
        password: newPassword,
      }
    );

  if (updateAuthError) {
    throw new Error(
      `更新小老师密码失败：${updateAuthError.message}`
    );
  }

  const { error: updateTeacherError } =
    await supabaseAdmin
      .from("teachers")
      .update({
        must_change_password: true,
      })
      .eq("id", teacher.id);

  if (updateTeacherError) {
    throw new Error(
      `更新小老师密码状态失败：${updateTeacherError.message}`
    );
  }

  return {
    message: `小老师「${teacher.name}」的密码已重置。`,
    resetPassword: {
      role: "teacher",
      name: teacher.name,
      account: teacher.email,
      newPassword,
    },
  };
}

async function executeResetStudentPassword(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  const student =
    await validateResetStudentPassword(
      request.target_id
    );

  if (!student.auth_user_id) {
    throw new Error(
      "这个学生没有绑定登录账号。"
    );
  }

  const newPassword =
    generateResetPassword("student");

  const { error: updateAuthError } =
    await supabaseAdmin.auth.admin.updateUserById(
      student.auth_user_id,
      {
        password: newPassword,
      }
    );

  if (updateAuthError) {
    throw new Error(
      `更新学生密码失败：${updateAuthError.message}`
    );
  }

  const { error: updateStudentError } =
    await supabaseAdmin
      .from("students")
      .update({
        must_change_password: true,
      })
      .eq("id", student.id);

  if (updateStudentError) {
    throw new Error(
      `更新学生密码状态失败：${updateStudentError.message}`
    );
  }

  return {
    message: `学生「${student.name}」的密码已重置。`,
    resetPassword: {
      role: "student",
      name: student.name,
      account: student.username,
      newPassword,
    },
  };
}

async function executeApprovedRequest(
  request: AdminActionRequest
): Promise<ExecuteResult> {
  switch (request.action_type) {
    case "archive_cohort":
      return executeArchiveCohort(request);

    case "delete_class":
      return executeDeleteClass(request);

    case "delete_teacher":
      return executeDeleteTeacher(request);

    case "delete_student":
      return executeDeleteStudent(request);

    case "update_class_info":
      return executeUpdateClassInfo(request);

    case "add_teacher_to_class":
      return executeAddTeacherToClass(request);

    case "remove_teacher_from_class":
      return executeRemoveTeacherFromClass(request);

    case "add_student_to_class":
      return executeAddStudentToClass(request);

    case "remove_student_from_class":
      return executeRemoveStudentFromClass(request);

    case "reset_teacher_password":
      return executeResetTeacherPassword(request);

    case "reset_student_password":
      return executeResetStudentPassword(request);

    default:
      throw new Error(
        `未知维护操作：${request.action_type}`
      );
  }
}

async function approveRequest(
  body: ApproveRequestBody,
  admin: CurrentAdmin
) {
  const requestId = body.requestId;

  const { data: requestData, error: requestError } =
    await supabaseAdmin
      .from("admin_action_requests")
      .select(
        "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, requested_by, note, action_payload, created_at, updated_at"
      )
      .eq("id", requestId)
      .maybeSingle();

  if (requestError) {
    throw new Error(
      `读取申请失败：${requestError.message}`
    );
  }

  if (!requestData) {
    throw new Error("没有找到这项申请。");
  }

  const actionRequest =
    requestData as unknown as AdminActionRequest;

  if (actionRequest.status !== "pending") {
    throw new Error(
      "这项申请已经处理过，不能重复确认。"
    );
  }

  const { error: approvalError } =
    await supabaseAdmin
      .from("admin_action_approvals")
      .insert({
        request_id: requestId,
        admin_id: admin.id,
        admin_name: admin.name,
      });

  if (approvalError) {
    if (approvalError.code === "23505") {
      throw new Error(
        `管理员「${admin.name}」已经确认过这项申请。`
      );
    }

    throw new Error(
      `确认申请失败：${approvalError.message}`
    );
  }

  const { count: approvalCount, error: countError } =
    await supabaseAdmin
      .from("admin_action_approvals")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("request_id", requestId);

  if (countError) {
    throw new Error(
      `统计确认人数失败：${countError.message}`
    );
  }

  const currentApprovalCount =
    approvalCount ?? 0;

  const { error: updateCountError } =
    await supabaseAdmin
      .from("admin_action_requests")
      .update({
        approvals_count: currentApprovalCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

  if (updateCountError) {
    throw new Error(
      `更新申请确认人数失败：${updateCountError.message}`
    );
  }

  if (
    currentApprovalCount <
    actionRequest.required_approvals
  ) {
    return {
      message: `确认成功，目前 ${currentApprovalCount}/${actionRequest.required_approvals} 位管理员已确认。`,
      resetPassword: null,
    };
  }

  const executeResult =
    await executeApprovedRequest(actionRequest);

  const { error: completeError } =
    await supabaseAdmin
      .from("admin_action_requests")
      .update({
        status: "completed",
        approvals_count: currentApprovalCount,
        note: executeResult.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

  if (completeError) {
    throw new Error(
      `更新申请完成状态失败：${completeError.message}`
    );
  }

  return {
    message: executeResult.message,
    resetPassword:
      executeResult.resetPassword ?? null,
  };
}

async function cancelRequest(
  body: CancelRequestBody,
  admin: CurrentAdmin
) {
  const requestId = body.requestId;

  const { data: requestData, error: requestError } =
    await supabaseAdmin
      .from("admin_action_requests")
      .select("id, status")
      .eq("id", requestId)
      .maybeSingle();

  if (requestError) {
    throw new Error(
      `读取申请失败：${requestError.message}`
    );
  }

  if (!requestData) {
    throw new Error("没有找到这项申请。");
  }

  const actionRequest =
    requestData as CancelRequestRow;

  if (actionRequest.status !== "pending") {
    throw new Error("只能取消待确认申请。");
  }

  const { error: deleteApprovalsError } =
    await supabaseAdmin
      .from("admin_action_approvals")
      .delete()
      .eq("request_id", requestId);

  if (deleteApprovalsError) {
    throw new Error(
      `删除确认记录失败：${deleteApprovalsError.message}`
    );
  }

  const { error: updateError } =
    await supabaseAdmin
      .from("admin_action_requests")
      .update({
        status: "canceled",
        note: `由管理员「${admin.name}」取消。`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

  if (updateError) {
    throw new Error(
      `取消申请失败：${updateError.message}`
    );
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
        error:
          error instanceof Error
            ? error.message
            : "读取维护中心失败。",
      },
      {
        status: 400,
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireCurrentAdmin(request);

    /*
     * request.json() 来自外部请求，因此先作为 unknown 处理，
     * 不能直接假设它一定有正确字段。
     */
    const rawBody: unknown = await request.json();

    const body =
      parseMaintenanceRequestBody(rawBody);

    if (body.action === "create_request") {
      const result = await createRequest(
        body,
        admin
      );

      return NextResponse.json(result);
    }

    if (body.action === "approve_request") {
      const result = await approveRequest(
        body,
        admin
      );

      return NextResponse.json(result);
    }

    const result = await cancelRequest(
      body,
      admin
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "维护中心操作失败。",
      },
      {
        status: 400,
      }
    );
  }
}