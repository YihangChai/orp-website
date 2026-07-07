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

export default function AccountMenu() {
  const [account, setAccount] = useState<AccountState>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  async function loadCurrentAccount() {
    setIsChecking(true);

    const admin = await getCurrentAdmin();

    if (admin) {
      setAccount({
        role: "admin",
        name: admin.name,
        dashboardPath: "/admin",
        roleLabel: "管理员",
      });
      setIsChecking(false);
      return;
    }

    const teacher = await getCurrentTeacher();

    if (teacher) {
      setAccount({
        role: "teacher",
        name: teacher.name,
        dashboardPath: "/teacher",
        roleLabel: "小老师",
      });
      setIsChecking(false);
      return;
    }

    const student = await getCurrentStudent();

    if (student) {
      setAccount({
        role: "student",
        name: student.name,
        dashboardPath: "/student",
        roleLabel: "学生",
      });
      setIsChecking(false);
      return;
    }

    setAccount(null);
    setIsChecking(false);
  }

  useEffect(() => {
      const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
        loadCurrentAccount();
    });

    return () => {

        subscription.unsubscribe();

    };
  }, []);

  async function handleLogout() {
    await logoutCurrentUser();
    setAccount(null);
    setIsOpen(false);
    window.location.href = "/login";
  }

  function getInitial(name: string) {
    const trimmedName = name.trim();

    if (!trimmedName) return "?";

    return trimmedName[0].toUpperCase();
    }

  if (isChecking) {
    return (
      <div className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-500" />
    );
  }

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
                  href="/student/lessons"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                >
                  我的课程记录
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
                  href="/teacher/new-record"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                >
                  新增课程记录
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