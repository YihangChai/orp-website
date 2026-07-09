"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCurrentAdmin,
  getCurrentTeacher,
  getCurrentStudent,
  logoutCurrentUser,
} from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

/**
 * AccountMenu 的原则：
 * 1. 它只负责显示当前账号入口和退出登录。
 * 2. 它不是权限系统，真正权限仍然依赖 Guard + Supabase RLS。
 * 3. 为了避免 Navbar 每次挂载都重复查 admin / teacher / student，
 *    这里做一个简单的模块级缓存。
 */

/* =========================
   1. 类型定义：账号菜单需要展示的账号状态
   ========================= */

type AccountState =
  | {
      role: "admin";
      name: string;
      dashboardPath: "/admin";
      roleLabel: "管理员";
    }
  | {
      role: "teacher";
      name: string;
      dashboardPath: "/teacher";
      roleLabel: "小老师";
    }
  | {
      role: "student";
      name: string;
      dashboardPath: "/student";
      roleLabel: "学生";
    }
  | null;

/* =========================
   2. 模块级缓存：避免 AccountMenu 重复查询当前账号
   ========================= */

let hasLoadedAccount = false;
let cachedAccount: AccountState = null;
let currentAccountRequest: Promise<AccountState> | null = null;

function clearAccountMenuCache() {
  hasLoadedAccount = false;
  cachedAccount = null;
  currentAccountRequest = null;
}

/* =========================
   3. 账号解析函数：按 admin → teacher → student 顺序识别账号
   ========================= */

async function resolveCurrentAccount(): Promise<AccountState> {
  /**
   * 如果已经查过账号，就直接复用结果。
   * 注意：cachedAccount 可能是 null，所以需要 hasLoadedAccount 来区分：
   * - 已经查过，结果是未登录
   * - 还没有查过
   */
  if (hasLoadedAccount) {
    return cachedAccount;
  }

  /**
   * 如果已经有一个账号查询正在进行，就复用这一个 Promise。
   * 这样可以避免组件重复挂载时同时发出多组请求。
   */
  if (currentAccountRequest) {
    return currentAccountRequest;
  }

  currentAccountRequest = (async () => {
    const admin = await getCurrentAdmin();

    if (admin) {
      return {
        role: "admin",
        name: admin.name,
        dashboardPath: "/admin",
        roleLabel: "管理员",
      } satisfies AccountState;
    }

    const teacher = await getCurrentTeacher();

    if (teacher) {
      return {
        role: "teacher",
        name: teacher.name,
        dashboardPath: "/teacher",
        roleLabel: "小老师",
      } satisfies AccountState;
    }

    const student = await getCurrentStudent();

    if (student) {
      return {
        role: "student",
        name: student.name,
        dashboardPath: "/student",
        roleLabel: "学生",
      } satisfies AccountState;
    }

    return null;
  })()
    .then((account) => {
      cachedAccount = account;
      hasLoadedAccount = true;
      return account;
    })
    .finally(() => {
      currentAccountRequest = null;
    });

  return currentAccountRequest;
}

/* =========================
   4. 主组件：账号菜单
   ========================= */

export default function AccountMenu() {
  const [account, setAccount] = useState<AccountState>(cachedAccount);
  const [isChecking, setIsChecking] = useState(!hasLoadedAccount);
  const [isOpen, setIsOpen] = useState(false);

  async function loadCurrentAccount() {
    setIsChecking(true);

    const currentAccount = await resolveCurrentAccount();

    setAccount(currentAccount);
    setIsChecking(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAccountSafely() {
      setIsChecking(true);

      const currentAccount = await resolveCurrentAccount();

      if (!isMounted) return;

      setAccount(currentAccount);
      setIsChecking(false);
    }

    loadAccountSafely();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      /**
       * Supabase 可能会在监听建立时触发 INITIAL_SESSION。
       * 页面刚加载时我们已经主动 loadAccountSafely()，所以这里不用重复处理。
       */
      if (event === "INITIAL_SESSION") return;

      clearAccountMenuCache();

      if (!isMounted) return;

      loadCurrentAccount();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =========================
     5. 退出登录：退出 Supabase，并清理前端缓存
     ========================= */

  async function handleLogout() {
    await logoutCurrentUser();

    clearAccountMenuCache();

    /**
     * 这里顺手清掉本地 session。
     * 真正登录状态已经由 Supabase Auth 控制；
     * localStorage 只是我们给 Guard / 菜单做体验优化用的缓存。
     */
    localStorage.removeItem("orp_admin_session");
    localStorage.removeItem("orp_teacher_session");
    localStorage.removeItem("orp_student_session");

    setAccount(null);
    setIsOpen(false);

    window.location.href = "/login";
  }

  function getInitial(name: string) {
    const trimmedName = name.trim();

    if (!trimmedName) return "?";

    return trimmedName[0].toUpperCase();
  }

  /* =========================
     6. 加载状态
     ========================= */

  if (isChecking) {
    return (
      <div className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-500" />
    );
  }

  /* =========================
     7. 未登录状态：显示登录按钮
     ========================= */

  if (!account) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
      >
        登录
      </Link>
    );
  }

  /* =========================
     8. 已登录状态：显示头像按钮和账号菜单
     ========================= */

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
        aria-label="打开账号菜单"
      >
        {getInitial(account.name)}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-lg">
          <div className="border-b border-emerald-50 px-4 py-3">
            <p className="text-sm font-bold text-emerald-950">
              {account.name}
            </p>
            <p className="mt-1 text-xs text-stone-500">{account.roleLabel}</p>
          </div>

          <div className="p-2">
            {account.role === "student" && (
              <>
                <Link
                  href="/student"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                >
                  我的主页
                </Link>

                <Link
                  href="/student/parent"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                >
                  家长模式
                </Link>
              </>
            )}

            {account.role === "teacher" && (
              <>
                <Link
                  href="/teacher"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                >
                  我的主页
                </Link>
              </>
            )}

            {account.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900"
              >
                管理后台
              </Link>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}