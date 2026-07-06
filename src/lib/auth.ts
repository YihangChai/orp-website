import { supabase } from "@/lib/supabaseClient";

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  auth_user_id: string;
  role: string;
  status: string;
};

export type CurrentTeacher = {
  id: string;
  name: string;
  email: string | null;
  auth_user_id: string;
  status: string;
};

export type CurrentStudent = {
  id: string;
  name: string;
  username: string | null;
  auth_user_id: string;
  status: string;
};

export type LoginResult =
  | {
      role: "admin";
      admin: CurrentAdmin;
      redirectTo: "/admin";
    }
  | {
      role: "teacher";
      teacher: CurrentTeacher;
      redirectTo: "/teacher";
    }
  | {
      role: "student";
      student: CurrentStudent;
      redirectTo: "/student";
    }
  | {
      role: "none";
      message: string;
    };

function normalizeAccountToEmail(account: string) {
  const trimmedAccount = account.trim().toLowerCase();

  if (trimmedAccount.includes("@")) {
    return trimmedAccount;
  }

  return `${trimmedAccount}@orp.local`;
}

export async function loginWithAccountAndPassword(
  account: string,
  password: string
): Promise<LoginResult> {
  const trimmedAccount = account.trim();

  if (!trimmedAccount || !password) {
    return {
      role: "none",
      message: "请填写账号和密码。",
    };
  }

  const emailForAuth = normalizeAccountToEmail(trimmedAccount);

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: emailForAuth,
      password,
    });

  if (authError) {
    return {
      role: "none",
      message: `登录失败：${authError.message}`,
    };
  }

  const user = authData.user;

  if (!user) {
    return {
      role: "none",
      message: "登录失败：没有读取到用户信息。",
    };
  }

  const { data: adminData, error: adminError } = await supabase
    .from("admins")
    .select("id, name, email, auth_user_id, role, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError) {
    return {
      role: "none",
      message: `读取管理员身份失败：${adminError.message}`,
    };
  }

  if (adminData) {
    const admin = adminData as CurrentAdmin;

    localStorage.setItem(
      "orp_admin_session",
      JSON.stringify({
        adminId: admin.id,
        adminName: admin.name,
        email: admin.email,
        role: admin.role,
        loggedInAt: new Date().toISOString(),
      })
    );

    return {
      role: "admin",
      admin,
      redirectTo: "/admin",
    };
  }

  const { data: teacherData, error: teacherError } = await supabase
    .from("teachers")
    .select("id, name, email, auth_user_id, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (teacherError) {
    return {
      role: "none",
      message: `读取小老师身份失败：${teacherError.message}`,
    };
  }

  if (teacherData) {
    const teacher = teacherData as CurrentTeacher;

    localStorage.setItem(
      "orp_teacher_session",
      JSON.stringify({
        teacherId: teacher.id,
        teacherName: teacher.name,
        email: teacher.email,
        loggedInAt: new Date().toISOString(),
      })
    );

    return {
      role: "teacher",
      teacher,
      redirectTo: "/teacher",
    };
  }

  const { data: studentData, error: studentError } = await supabase
    .from("students")
    .select("id, name, username, auth_user_id, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (studentError) {
    return {
      role: "none",
      message: `读取学生身份失败：${studentError.message}`,
    };
  }

  if (studentData) {
    const student = studentData as CurrentStudent;

    localStorage.setItem(
      "orp_student_session",
      JSON.stringify({
        studentId: student.id,
        studentName: student.name,
        username: student.username,
        loggedInAt: new Date().toISOString(),
      })
    );

    return {
      role: "student",
      student,
      redirectTo: "/student",
    };
  }

  await supabase.auth.signOut();

  return {
    role: "none",
    message:
      "这个账号已经登录成功，但没有绑定管理员、小老师或学生身份。请检查 auth_user_id 绑定。",
  };
}

export async function getCurrentAuthUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function getCurrentAdmin() {
  const user = await getCurrentAuthUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("admins")
    .select("id, name, email, auth_user_id, role, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  return data as CurrentAdmin;
}

export async function getCurrentTeacher() {
  const user = await getCurrentAuthUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select("id, name, email, auth_user_id, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  return data as CurrentTeacher;
}

export async function getCurrentStudent() {
  const user = await getCurrentAuthUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("students")
    .select("id, name, username, auth_user_id, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  return data as CurrentStudent;
}

export async function logoutCurrentUser() {
  localStorage.removeItem("orp_admin_session");
  localStorage.removeItem("orp_teacher_session");
  localStorage.removeItem("orp_student_session");

  await supabase.auth.signOut();
}