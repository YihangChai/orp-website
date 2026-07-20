"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CurrentUserInfo = {
  email: string;
  roleLabel: string;
  homeHref: string;
};

type RoleInfo = {
  roleLabel: string;
  homeHref: string;
};

/**
 * 账号设置页需要根据当前 auth_user_id 判断用户角色。
 * 这个函数不依赖组件状态，所以放在组件外面，避免 useEffect 里调用时出现
 * “Cannot access variable before it is declared” 的 lint error。
 */
async function getRoleInfo(authUserId: string): Promise<RoleInfo> {
  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (admin) {
    return {
      roleLabel: "管理员",
      homeHref: "/admin",
    };
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (teacher) {
    return {
      roleLabel: "小老师",
      homeHref: "/teacher",
    };
  }

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (student) {
    return {
      roleLabel: "学生",
      homeHref: "/student",
    };
  }

  return {
    roleLabel: "未知角色",
    homeHref: "/",
  };
}

export default function AccountSettingsPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserInfo | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadCurrentUser() {
      setIsLoading(true);
      setMessage("");
      setErrorMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        router.push("/login");
        return;
      }

      const user = session.user;
      const email = user.email || "";

      const roleInfo = await getRoleInfo(user.id);

      setCurrentUser({
        email,
        roleLabel: roleInfo.roleLabel,
        homeHref: roleInfo.homeHref,
      });

      setIsLoading(false);
    }

    loadCurrentUser();
  }, [router]);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    const cleanedPassword = newPassword.trim();
    const cleanedConfirmPassword = confirmPassword.trim();

    if (!cleanedPassword || !cleanedConfirmPassword) {
      setErrorMessage("请输入新密码并再次确认。");
      return;
    }

    if (cleanedPassword.length < 8) {
      setErrorMessage("新密码至少需要 8 位。");
      return;
    }

    if (cleanedPassword !== cleanedConfirmPassword) {
      setErrorMessage("两次输入的新密码不一致。");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: cleanedPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      setNewPassword("");
      setConfirmPassword("");
      setMessage("密码修改成功。下次登录请使用新密码。");
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "密码修改失败，请稍后再试。";

      setErrorMessage(errorText);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-4xl">
          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-stone-600">正在加载账号设置...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Account Settings
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              账号设置
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              这里用于管理你的登录账号。当前先支持可选修改密码，后续可以继续加入昵称、通知、账号安全等功能。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={currentUser?.homeHref || "/"}
              className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回系统主页
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="mt-6 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-7">
          <div>
            <h2 className="text-2xl font-bold text-emerald-950">修改密码</h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              如果你想把初始密码改成自己更方便记忆的密码，可以在这里修改。修改成功后，下次登录需要使用新密码。
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="text-sm font-semibold text-stone-700"
              >
                新密码
              </label>

              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setMessage("");
                  setErrorMessage("");
                }}
                placeholder="至少 8 位"
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="text-sm font-semibold text-stone-700"
              >
                确认新密码
              </label>

              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setMessage("");
                  setErrorMessage("");
                }}
                placeholder="再次输入新密码"
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
              修改密码后，旧密码会失效。管理员也不能查看你的新密码；如果以后忘记，只能联系管理员重置。
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-[#2f5d50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "正在保存..." : "保存新密码"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}