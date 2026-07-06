"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type TeacherSession = {
  teacherId: string;
  teacherName: string;
  email: string | null;
  loggedInAt: string;
};

type ClassItem = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  cohorts?: {
    id: string;
    name: string;
    status: string;
  } | null;
};

type ClassTeacherRelation = {
  class_id: string;
  classes: ClassItem | ClassItem[] | null;
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
  const [classRelations, setClassRelations] = useState<ClassTeacherRelation[]>(
    []
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchTeacherClasses(teacherId: string) {
    const { data, error } = await supabase
      .from("class_teachers")
      .select(
        `
        class_id,
        classes (
          id,
          name,
          school,
          status,
          cohorts (
            id,
            name,
            status
          )
        )
      `
      )
      .eq("teacher_id", teacherId);

    if (error) {
      setMessage(`读取小老师班级失败：${error.message}`);
      return;
    }

    const relations = (data || []) as unknown as ClassTeacherRelation[];

    setClassRelations(relations);

    const firstRelation = relations[0];

    if (!firstRelation || !firstRelation.classes) {
      setTeacherClass(null);
      setMessage("没有读取到你负责的班级。请联系管理员分配班级。");
      return;
    }

    const firstClass = Array.isArray(firstRelation.classes)
      ? firstRelation.classes[0]
      : firstRelation.classes;

    if (!firstClass) {
      setTeacherClass(null);
      setMessage("没有读取到你负责的班级。请联系管理员分配班级。");
      return;
    }

    if (firstClass.status === "archived") {
      setTeacherClass(null);
      setMessage("你负责的班级已归档，暂时不能创建新目标。");
      return;
    }

    setTeacherClass(firstClass);
  }

  useEffect(() => {
    async function loadCurrentTeacher() {
      setIsLoading(true);
      setMessage("");

      const teacher = await getCurrentTeacher();

      if (!teacher) {
        localStorage.removeItem("orp_teacher_session");
        setTeacherSession(null);
        setIsLoading(false);
        return;
      }

      const activeSession: TeacherSession = {
        teacherId: teacher.id,
        teacherName: teacher.name,
        email: teacher.email,
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem("orp_teacher_session", JSON.stringify(activeSession));

      setTeacherSession(activeSession);

      await fetchTeacherClasses(teacher.id);

      setIsLoading(false);
    }

    loadCurrentTeacher();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!teacherSession) {
      setMessage("请先登录小老师账号。");
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
            href="/login"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 前往登录
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-emerald-950">
            请先登录
          </h1>

          <p className="mt-3 leading-7 text-stone-600">
            小老师需要使用邮箱和密码登录后，才能创建教学目标。
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
                班级根据当前登录的小老师账号自动读取。目前按一个小老师对应一个班级处理。
              </p>

              {classRelations.length > 1 && (
                <p className="mt-2 text-xs leading-5 text-amber-700">
                  系统检测到你关联了多个班级。当前页面会默认使用第一个班级；后续可以升级为班级下拉选择。
                </p>
              )}
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