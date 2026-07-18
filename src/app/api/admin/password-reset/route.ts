import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ResetRole = "teacher" | "student";

function generateResetPassword(role: ResetRole) {
  const prefix = role === "teacher" ? "ORP-T" : "ORP-S";

  const randomPart = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix}-${randomPart}`;
}

async function requireCurrentAdmin(request: NextRequest) {
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
    throw new Error("当前账号不是 active 管理员，不能重置密码。");
  }

  return admin;
}

async function resetTeacherPassword(targetId: string) {
  const { data: teacher, error: teacherError } = await supabaseAdmin
    .from("teachers")
    .select("id, name, email, status, auth_user_id")
    .eq("id", targetId)
    .maybeSingle();

  if (teacherError) {
    throw new Error(`读取小老师失败：${teacherError.message}`);
  }

  if (!teacher) {
    throw new Error("没有找到这个小老师。");
  }

  if (!teacher.auth_user_id) {
    throw new Error(
      "这个小老师没有绑定 auth_user_id，无法在网站内重置密码。请检查账号创建流程。"
    );
  }

  if (teacher.status === "archived" || teacher.status === "withdrawn") {
    throw new Error("这个小老师已经归档或退出，不建议重置密码。");
  }

  const newPassword = generateResetPassword("teacher");

  const { error: updateAuthError } =
    await supabaseAdmin.auth.admin.updateUserById(teacher.auth_user_id, {
      password: newPassword,
    });

  if (updateAuthError) {
    throw new Error(`更新小老师登录密码失败：${updateAuthError.message}`);
  }

  await supabaseAdmin
    .from("teachers")
    .update({
      must_change_password: true,
    })
    .eq("id", teacher.id);

  return {
    role: "teacher",
    name: teacher.name,
    email: teacher.email,
    newPassword,
  };
}

async function resetStudentPassword(targetId: string) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, name, username, status, auth_user_id")
    .eq("id", targetId)
    .maybeSingle();

  if (studentError) {
    throw new Error(`读取学生失败：${studentError.message}`);
  }

  if (!student) {
    throw new Error("没有找到这个学生。");
  }

  if (!student.auth_user_id) {
    throw new Error(
      "这个学生没有绑定 auth_user_id，无法在网站内重置密码。请检查账号创建流程。"
    );
  }

  if (student.status === "archived" || student.status === "withdrawn") {
    throw new Error("这个学生已经归档或退出，不建议重置密码。");
  }

  const newPassword = generateResetPassword("student");

  const { error: updateAuthError } =
    await supabaseAdmin.auth.admin.updateUserById(student.auth_user_id, {
      password: newPassword,
    });

  if (updateAuthError) {
    throw new Error(`更新学生登录密码失败：${updateAuthError.message}`);
  }

  await supabaseAdmin
    .from("students")
    .update({
      must_change_password: true,
    })
    .eq("id", student.id);

  return {
    role: "student",
    name: student.name,
    username: student.username,
    newPassword,
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireCurrentAdmin(request);

    const body = await request.json();

    const role = body.role as ResetRole;
    const targetId = body.targetId as string;

    if (role !== "teacher" && role !== "student") {
      return NextResponse.json(
        { error: "只能重置小老师或学生密码。" },
        { status: 400 }
      );
    }

    if (!targetId) {
      return NextResponse.json(
        { error: "缺少要重置密码的账号 ID。" },
        { status: 400 }
      );
    }

    const result =
      role === "teacher"
        ? await resetTeacherPassword(targetId)
        : await resetStudentPassword(targetId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "重置密码失败。",
      },
      { status: 400 }
    );
  }
}