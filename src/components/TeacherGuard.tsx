"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentTeacher, type CurrentTeacher } from "@/lib/auth";

type TeacherGuardProps = {
  children: React.ReactNode;
};

export default function TeacherGuard({ children }: TeacherGuardProps) {
  const [currentTeacher, setCurrentTeacher] = useState<CurrentTeacher | null>(
    null
  );
  const [isCheckingTeacher, setIsCheckingTeacher] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkTeacher() {
      setIsCheckingTeacher(true);
      setMessage("");

      const teacher = await getCurrentTeacher();

      if (!teacher) {
        setCurrentTeacher(null);
        setMessage("请先使用小老师账号登录。");
        setIsCheckingTeacher(false);
        return;
      }

      setCurrentTeacher(teacher);
      setIsCheckingTeacher(false);
    }

    checkTeacher();
  }, []);

  if (isCheckingTeacher) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-600">正在检查小老师身份...</p>
        </section>
      </main>
    );
  }

  if (!currentTeacher) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-emerald-950">
            请先登录小老师账号
          </h1>

          <p className="mt-3 leading-7 text-stone-600">
            {message || "当前账号没有小老师权限。"}
          </p>

          <Link
            href="/login"
            className="mt-5 inline-block rounded-full bg-[#2f5d50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            前往登录
          </Link>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}