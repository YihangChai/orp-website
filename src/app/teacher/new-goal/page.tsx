"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TeacherSession = {
  teacherId: string;
  teacherName: string;
  loggedInAt: string;
};

type ClassItem = {
  id: string;
  name: string;
  school: string | null;
  status: string;
};

type ClassTeacherRelation = {
  class_id: string;
  classes: any;
};

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export default function NewGoalPage() {
  const router = useRouter();
  const today = getTodayDate();

  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(
    null
  );
  const [teacherClass, setTeacherClass] = useState<ClassItem | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function initPage() {
      const storedSession = localStorage.getItem("orp_teacher_session");

      if (!storedSession) {
        setIsLoading(false);
        return;
      }

      try {
        const parsedSession = JSON.parse(storedSession) as TeacherSession;

        if (!parsedSession.teacherId) {
          localStorage.removeItem("orp_teacher_session");
          setIsLoading(false);
          return;
        }

        setTeacherSession(parsedSession);

        const { data: classTeacherData, error: classTeacherError } =
          await supabase
            .from("class_teachers")
            .select(
              `
              class_id,
              classes (
                id,
                name,
                school,
                status
              )
            `
            )
            .eq("teacher_id", parsedSession.teacherId);

        if (classTeacherError) {
          setMessage(`读取小老师班级失败：${classTeacherError.message}`);
          setIsLoading(false);
          return;
        }

        const classRows = ((classTeacherData || []) as ClassTeacherRelation[])
          .map((relation) => relation.classes)
          .filter(Boolean)
          .filter((classItem) => classItem.status !== "archived") as ClassItem[];

        if (classRows.length === 0) {
          setMessage("这个小老师还没有绑定班级。请先在管理员端为小老师分配班级。");
          setIsLoading(false);
          return;
        }

        if (classRows.length > 1) {
          setMessage(
            "检测到这个小老师绑定了多个班级。第一版系统要求一个小老师只对应一个班级，请先在管理员端检查分班数据。"
          );
          setIsLoading(false);
          return;
        }

        setTeacherClass(classRows[0]);
        setIsLoading(false);
      } catch {
        localStorage.removeItem("orp_teacher_session");
        setIsLoading(false);
      }
    }

    initPage();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!teacherSession) {
      setMessage("请先回到小老师主页，选择小老师身份。");
      return;
    }

    if (!teacherClass) {
      setMessage("没有读取到当前小老师对应的班级，暂时不能创建目标。");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const startDate = String(formData.get("start_date") || "").trim();
    const expectedLessonsValue = String(
      formData.get("expected_lessons") || ""
    ).trim();
    const expectedLessons = expectedLessonsValue
      ? Number(expectedLessonsValue)
      : null;

    if (!title) {
      setMessage("请填写目标标题。");
      setIsSubmitting(false);
      return;
    }

    if (expectedLessons !== null && expectedLessons <= 0) {
      setMessage("预计课时必须大于 0。");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("teaching_goals").insert({
      teacher_id: teacherSession.teacherId,
      class_id: teacherClass.id,
      title,
      description: description || null,
      start_date: startDate || null,
      expected_lessons: expectedLessons,
      status: "active",
    });

    if (error) {
      setMessage(`保存目标失败：${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setMessage("目标保存成功，正在返回小老师主页...");
    setIsSubmitting(false);

    router.push("/teacher");
    router.refresh();
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-600">正在读取小老师信息...</p>
        </section>
      </main>
    );
  }

  if (!teacherSession) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 返回小老师主页
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-emerald-950">
            请先选择小老师身份
          </h1>

          <p className="mt-3 leading-7 text-stone-600">
            现在是测试阶段。你需要先回到小老师主页，从下拉框选择一个小老师身份，然后再创建教学目标。
          </p>

          <Link
            href="/teacher"
            className="mt-5 inline-block rounded-full bg-[#2f5d50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            去选择小老师身份
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <section className="mx-auto max-w-3xl">
        <Link
          href="/teacher"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回小老师主页
        </Link>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-[#2f5d50]">
            当前小老师：{teacherSession.teacherName}
          </p>

          <h1 className="mt-3 text-4xl font-bold text-emerald-950">
            设置阶段教学目标
          </h1>

          <p className="mt-4 leading-8 text-stone-600">
            为当前班级设定一个阶段性教学目标。目标不需要提前固定结束日期，后续可以根据实际授课进度手动标记完成。
          </p>

          {message && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            <div>
              <label className="text-sm font-semibold text-stone-700">
                所属班级
              </label>

              <input
                value={teacherClass?.name || "未读取到班级"}
                readOnly
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-stone-100 px-4 py-3 text-stone-500 outline-none"
              />

              <p className="mt-2 text-xs leading-5 text-stone-500">
                班级根据当前小老师身份自动填写，不能在这里手动更改。
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-700">
                目标标题 <span className="text-red-500">*</span>
              </label>

              <input
                name="title"
                placeholder="例如：小王子五周阅读计划"
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-700">
                目标说明
              </label>

              <textarea
                name="description"
                rows={5}
                placeholder="例如：带领学生完成《小王子》前五章阅读，重点训练情节理解、词汇积累和表达能力。"
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-stone-700">
                  开始日期
                </label>

                <input
                  type="date"
                  name="start_date"
                  defaultValue={today}
                  className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-stone-700">
                  预计课时
                </label>

                <input
                  type="number"
                  name="expected_lessons"
                  min="1"
                  placeholder="例如：5"
                  className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !teacherClass}
              className="rounded-full bg-[#2f5d50] px-6 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "保存中..." : "保存目标"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}