import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pinyin } from "pinyin-pro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateImportRows } from "@/lib/admin-import/validateImportRows";
import { executeBulkImport } from "@/lib/admin-import/executeBulkImport";
import type {
  BulkImportReuseCandidate,
  ExecutionImportRow,
  ImportValidationError,
  PreviewImportRow,
} from "@/lib/admin-import/types";

const STUDENT_AUTH_DOMAIN = "orp.local";

function safeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.replace("Bearer ", "");
}

function nameToAccountPart(name: unknown) {
  const text = safeText(name);

  if (!text) return "";

  const manualMap: Record<string, string> = {
    柴一航: "chaiyihang",
  };

  if (manualMap[text]) {
    return manualMap[text];
  }

  return pinyin(text, {
    toneType: "none",
    type: "array",
  })
    .join("")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function buildStudentUsername(studentName: string) {
  return nameToAccountPart(studentName);
}

function buildStudentAuthEmail(studentUsername: string) {
  if (!studentUsername) return "";
  return `${studentUsername}@${STUDENT_AUTH_DOMAIN}`;
}

function expandPreviewRowsToExecutionRows(
  rows: PreviewImportRow[]
): ExecutionImportRow[] {
  const executionRows: ExecutionImportRow[] = [];

  rows.forEach((row) => {
    const rowNumber = Number(row.rowNumber || row.lineNumber || 0);

    const cohortName = safeText(row.cohortName);
    const className = safeText(row.className);
    const school = safeText(row.school);

    const teacherName = safeText(row.teacherName);
    const teacherEnteringYear = safeText(row.teacherEnteringYear);
    const teacherEmailPrefix = safeText(row.teacherEmailPrefix);
    const teacherEmail = safeText(row.teacherEmail).toLowerCase();

    const studentGrade = safeText(row.studentGrade);
    const rawLine = safeText(row.rawLine);

    const studentNames = Array.isArray(row.studentNames)
      ? row.studentNames.map(safeText).filter(Boolean)
      : [];

    studentNames.forEach((studentName) => {
      const studentUsername = buildStudentUsername(studentName);
      const studentAuthEmail = buildStudentAuthEmail(studentUsername);

      executionRows.push({
        rowNumber,
        lineNumber: rowNumber,

        cohortName,
        className,
        school,

        teacherName,
        teacherEnteringYear,
        teacherEmailPrefix,
        teacherEmail,

        studentName,
        studentNames: [studentName],
        studentGrade,
        studentUsername,
        studentAuthEmail,

        rawLine,
      });
    });
  });

  return executionRows;
}

function validateExecutionRowsLightly(
  rows: ExecutionImportRow[]
): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  if (rows.length === 0) {
    errors.push({
      rowNumber: 0,
      field: "studentNames",
      message: "没有可执行的导入数据，请检查学生名单是否为空。",
    });

    return errors;
  }

  rows.forEach((row) => {
    if (!safeText(row.studentName)) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "studentName",
        message: "执行导入时缺少学生姓名。",
      });
    }

    if (!safeText(row.studentUsername)) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "studentUsername",
        message: `学生「${row.studentName || "未知学生"}」无法生成用户名，请检查姓名。`,
      });
    }

    if (!safeText(row.studentAuthEmail)) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "studentAuthEmail",
        message: `学生「${row.studentName || "未知学生"}」无法生成登录邮箱，请检查姓名。`,
      });
    }

    if (!safeText(row.teacherEmail)) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "teacherEmail",
        message: "执行导入时缺少小老师邮箱。",
      });
    }
  });

  return errors;
}

async function getCurrentAdminFromRequest(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("缺少登录凭证，请重新登录。");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase 环境变量缺失。");
  }

  const supabaseWithUserToken = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseWithUserToken.auth.getUser();

  if (userError || !user) {
    throw new Error("无法识别当前登录用户，请重新登录。");
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admins")
    .select("id, name, email, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError) {
    throw new Error(`检查管理员身份失败：${adminError.message}`);
  }

  if (!admin) {
    throw new Error("当前账号不是 active 管理员，不能执行批量导入。");
  }

  return admin;
}

async function findArchivedReuseCandidates(rows: ExecutionImportRow[]) {
  const candidates: BulkImportReuseCandidate[] = [];

  const checkedTeacherEmails = new Set<string>();
  const checkedStudentUsernames = new Set<string>();

  for (const row of rows) {
    const teacherEmail = safeText(row.teacherEmail).toLowerCase();

    if (teacherEmail && !checkedTeacherEmails.has(teacherEmail)) {
      checkedTeacherEmails.add(teacherEmail);

      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .select("id, name, email, status")
        .eq("email", teacherEmail)
        .maybeSingle();

      if (teacherError) {
        throw new Error(`检查已有小老师账号失败：${teacherError.message}`);
      }

      if (teacher && teacher.status === "archived") {
        candidates.push({
          role: "teacher",
          rowNumber: row.rowNumber,
          name: teacher.name || row.teacherName,
          loginAccount: teacher.email || teacherEmail,
          currentStatus: teacher.status,
          className: row.className,
          reason:
            "系统发现这个小老师账号以前存在但已封存。请确认这是同一个人继续参加，而不是重名或邮箱规则错误。",
        });
      }
    }

    const studentUsername = safeText(row.studentUsername).toLowerCase();

    if (studentUsername && !checkedStudentUsernames.has(studentUsername)) {
      checkedStudentUsernames.add(studentUsername);

      const { data: student, error: studentError } = await supabaseAdmin
        .from("students")
        .select("id, name, username, status")
        .eq("username", studentUsername)
        .maybeSingle();

      if (studentError) {
        throw new Error(`检查已有学生账号失败：${studentError.message}`);
      }

      if (student && student.status === "archived") {
        candidates.push({
          role: "student",
          rowNumber: row.rowNumber,
          name: student.name || row.studentName,
          loginAccount: student.username || studentUsername,
          currentStatus: student.status,
          className: row.className,
          reason:
            "系统发现这个学生用户名以前存在但已封存。学生重名概率较高，请确认这是同一个学生继续参加，而不是重名。",
        });
      }
    }
  }

  return candidates;
}

export async function POST(request: Request) {
  try {
    const currentAdmin = await getCurrentAdminFromRequest(request);

    const body = await request.json();

    const previewRows = (body.rows || []) as PreviewImportRow[];
    const allowReuseArchived = Boolean(body.allowReuseArchived);

    const previewValidationErrors = validateImportRows(previewRows);

    if (previewValidationErrors.length > 0) {
      return NextResponse.json(
        {
          message: "导入数据存在格式问题。",
          errors: previewValidationErrors,
        },
        { status: 400 }
      );
    }

    const executionRows = expandPreviewRowsToExecutionRows(previewRows);

    const executionErrors = validateExecutionRowsLightly(executionRows);

    if (executionErrors.length > 0) {
      return NextResponse.json(
        {
          message: "导入执行数据生成失败。",
          errors: executionErrors,
        },
        { status: 400 }
      );
    }

    const reuseCandidates = await findArchivedReuseCandidates(executionRows);

    if (reuseCandidates.length > 0 && !allowReuseArchived) {
      return NextResponse.json(
        {
          message:
            "系统发现已封存账号。请确认这些账号是否为继续参加 ORP 的成员，再继续导入。",
          requiresReuseConfirmation: true,
          reuseCandidates,
        },
        { status: 409 }
      );
    }

    const result = await executeBulkImport(executionRows, {
      allowReuseArchived,
    });

    return NextResponse.json({
      message: "批量导入完成。",
      requestedBy: currentAdmin.name,
      receivedRows: executionRows.length,
      result,
    });
  } catch (error) {
    console.error("bulk-import API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "批量导入失败。";

    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}