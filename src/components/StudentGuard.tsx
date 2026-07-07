"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentStudent, type CurrentStudent } from "@/lib/auth";

type StudentGuardProps = {
  children: React.ReactNode;
};

export default function StudentGuard({ children }: StudentGuardProps) {
  const [currentStudent, setCurrentStudent] = useState<CurrentStudent | null>(
    null
  );
  const [isCheckingStudent, setIsCheckingStudent] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkStudent() {
      setIsCheckingStudent(true);
      setMessage("");

      const student = await getCurrentStudent();

      if (!student) {
        setCurrentStudent(null);
        setMessage("请先使用学生账号登录。");
        setIsCheckingStudent(false);
        return;
      }

      setCurrentStudent(student);
      setIsCheckingStudent(false);
    }

    checkStudent();
  }, []);

  if (isCheckingStudent) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-600">正在检查学生身份...</p>
        </section>
      </main>
    );
  }

  if (!currentStudent) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-emerald-950">
            请先登录学生账号
          </h1>

          <p className="mt-3 leading-7 text-stone-600">
            {message || "当前账号没有学生权限。"}
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