"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ClassRow = {
  id: string;
  name: string;
  class_code: string | null;
  status: string;
};

type StudentRow = {
  id: string;
  name: string;
  status: string;
  student_code: string | null;
  pin_code: string | null;
};

export default function StudentLoginPage() {
  const router = useRouter();

  const [classCode, setClassCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [pinCode, setPinCode] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedClassCode = classCode.trim().toUpperCase();
    const normalizedStudentCode = studentCode.trim().toUpperCase();
    const normalizedPinCode = pinCode.trim();

    if (!normalizedClassCode || !normalizedStudentCode || !normalizedPinCode) {
      setMessage("请填写班级码、学生码和 PIN。");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, name, class_code, status")
      .eq("class_code", normalizedClassCode)
      .maybeSingle();

    if (classError) {
      setMessage(`读取班级失败：${classError.message}`);
      setIsLoading(false);
      return;
    }

    if (!classData) {
      setMessage("班级码不正确，请检查后重试。");
      setIsLoading(false);
      return;
    }

    const classItem = classData as ClassRow;

    if (classItem.status === "archived") {
      setMessage("这个班级已经封存，暂时不能登录。");
      setIsLoading(false);
      return;
    }

    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .select("id, name, status, student_code, pin_code")
      .eq("student_code", normalizedStudentCode)
      .eq("pin_code", normalizedPinCode)
      .maybeSingle();

    if (studentError) {
      setMessage(`读取学生失败：${studentError.message}`);
      setIsLoading(false);
      return;
    }

    if (!studentData) {
      setMessage("学生码或 PIN 不正确，请检查后重试。");
      setIsLoading(false);
      return;
    }

    const student = studentData as StudentRow;

    if (student.status === "withdrawn") {
      setMessage("这个学生已经被标记为退出。如有疑问，请联系 ORP 管理员或老师。");
      setIsLoading(false);
      return;
    }

    if (student.status === "archived") {
      setMessage("这个学生档案已经归档，暂时不能登录。");
      setIsLoading(false);
      return;
    }

    const { data: relationData, error: relationError } = await supabase
      .from("class_students")
      .select("id")
      .eq("class_id", classItem.id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (relationError) {
      setMessage(`验证班级关系失败：${relationError.message}`);
      setIsLoading(false);
      return;
    }

    if (!relationData) {
      setMessage("这个学生不属于该班级，请检查班级码和学生码是否匹配。");
      setIsLoading(false);
      return;
    }

    const session = {
      studentId: student.id,
      studentName: student.name,
      classId: classItem.id,
      className: classItem.name,
      loggedInAt: new Date().toISOString(),
    };

    localStorage.setItem("orp_student_session", JSON.stringify(session));
    window.dispatchEvent(new Event("orp-student-session-changed"));

    router.push("/student");
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-10 text-stone-800">
      <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-[#2f5d50]">
            ORP Student Portal
          </p>

          <h1 className="mt-3 text-4xl font-bold leading-tight text-emerald-950">
            学生登录
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600">
            输入班级码、学生码和 PIN 后，可以查看自己的课程记录、作业安排、材料链接和老师的下一步计划。
          </p>

          <div className="mt-8 rounded-[1.75rem] border border-dashed border-emerald-200 bg-[#fffdf4] p-5">
            <h2 className="text-lg font-bold text-emerald-950">
              登录信息从哪里来？
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              班级码、学生码和 PIN 由 ORP 管理员生成。第一版暂时不用邮箱密码，方便学生和家长共同查看学习情况。
            </p>
          </div>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回首页
          </Link>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-8"
        >
          <h2 className="text-2xl font-bold text-emerald-950">进入学生端</h2>

          <p className="mt-2 text-sm leading-7 text-stone-600">
            请按照老师或管理员提供的信息填写。
          </p>

          {message && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              {message}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">
                班级码
              </span>

              <input
                value={classCode}
                onChange={(event) => setClassCode(event.target.value)}
                placeholder="例如 QIUTYE"
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm uppercase outline-none focus:border-emerald-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">
                学生码
              </span>

              <input
                value={studentCode}
                onChange={(event) => setStudentCode(event.target.value)}
                placeholder="例如 S1234"
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm uppercase outline-none focus:border-emerald-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">PIN</span>

              <input
                value={pinCode}
                onChange={(event) => setPinCode(event.target.value)}
                placeholder="例如 4821"
                inputMode="numeric"
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-full bg-[#2f5d50] px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "正在登录..." : "登录学生端"}
          </button>
        </form>
      </section>
    </main>
  );
}