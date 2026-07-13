import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildPreviewRows } from "@/lib/admin-import/buildPreviewRows";
import { validateImportRows } from "@/lib/admin-import/validateImportRows";
import { executeBulkImport } from "@/lib/admin-import/executeBulkImport";
import type {
  BulkImportReuseCandidate,
  ParsedImportRow,
  PreviewImportRow,
} from "@/lib/admin-import/types";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.replace("Bearer ", "");
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

async function findArchivedReuseCandidates(rows: PreviewImportRow[]) {
  const candidates: BulkImportReuseCandidate[] = [];

  const checkedTeacherEmails = new Set<string>();
  const checkedStudentUsernames = new Set<string>();

  for (const row of rows) {
    const teacherEmail = row.teacherEmail.trim().toLowerCase();

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

    const studentUsername = row.studentUsername.trim().toLowerCase();

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

    const parsedRows = (body.rows || []) as ParsedImportRow[];
    const allowReuseArchived = Boolean(body.allowReuseArchived);

    const previewRows = buildPreviewRows(parsedRows);
    const validationErrors = validateImportRows(previewRows);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          message: "导入数据存在格式问题。",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    const reuseCandidates = await findArchivedReuseCandidates(previewRows);

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

    const result = await executeBulkImport(previewRows, {
      allowReuseArchived,
    });

    return NextResponse.json({
      message: "批量导入完成。",
      requestedBy: currentAdmin.name,
      receivedRows: previewRows.length,
      result,
    });
  } catch (error) {
    console.error("bulk-import API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "批量导入失败。";

    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}