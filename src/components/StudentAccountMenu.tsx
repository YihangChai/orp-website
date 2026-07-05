"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type StudentSession = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  loggedInAt: string;
};

export default function StudentAccountMenu() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [session, setSession] = useState<StudentSession | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  function readStudentSession() {
    const storedSession = localStorage.getItem("orp_student_session");

    if (!storedSession) {
      setSession(null);
      return;
    }

    try {
      const parsedSession = JSON.parse(storedSession) as StudentSession;

      if (!parsedSession.studentId || !parsedSession.classId) {
        localStorage.removeItem("orp_student_session");
        setSession(null);
        return;
      }

      setSession(parsedSession);
    } catch {
      localStorage.removeItem("orp_student_session");
      setSession(null);
    }
  }

  useEffect(() => {
    readStudentSession();

    function handleSessionChange() {
      readStudentSession();
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("storage", handleSessionChange);
    window.addEventListener("orp-student-session-changed", handleSessionChange);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("storage", handleSessionChange);
      window.removeEventListener(
        "orp-student-session-changed",
        handleSessionChange
      );
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem("orp_student_session");
    window.dispatchEvent(new Event("orp-student-session-changed"));
    setIsOpen(false);
    router.push("/student-login");
  }

  if (!session) {
    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
        >
          登录
        </button>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border border-emerald-100 bg-white p-3 shadow-lg">
            <div className="border-b border-emerald-50 pb-3">
              <p className="text-sm font-bold text-emerald-950">
                选择登录入口
              </p>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                根据你的身份进入对应页面。
              </p>
            </div>

            <div className="mt-3 space-y-1">
              <Link
                href="/student-login"
                onClick={() => setIsOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-[#fffdf4]"
              >
                学生 / 家长登录
              </Link>

              <Link
                href="/teacher"
                onClick={() => setIsOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-[#fffdf4]"
              >
                小老师入口
              </Link>

              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-[#fffdf4]"
              >
                管理员入口
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  const avatarText = session.studentName.slice(0, 1);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2f5d50] text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900"
        aria-label="打开学生账号菜单"
      >
        {avatarText}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border border-emerald-100 bg-white p-3 shadow-lg">
          <div className="border-b border-emerald-50 pb-3">
            <p className="text-sm font-bold text-emerald-950">
              {session.studentName}
            </p>

            <p className="mt-1 text-xs text-stone-500">{session.className}</p>
          </div>

          <div className="mt-3 space-y-1">
            <Link
              href="/student"
              onClick={() => setIsOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-[#fffdf4]"
            >
              进入学习空间
            </Link>

            <Link
              href="/student/lessons"
              onClick={() => setIsOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-[#fffdf4]"
            >
              查看课程记录
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}