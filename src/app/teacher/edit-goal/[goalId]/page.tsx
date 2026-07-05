"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

type TeachingGoal = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  expected_lessons: number | null;
  status: string;
};

export default function EditGoalPage() {
  const router = useRouter();
  const params = useParams<{ goalId: string }>();
  const goalId = params.goalId;

  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(
    null
  );
  const [teacherClass, setTeacherClass] = useState<ClassItem | null>(null);
  const [goal, setGoal] = useState<TeachingGoal | null>(null);
  const [completedLessons, setCompletedLessons] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function initPage() {
      setIsLoading(true);
      setMessage("");

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

        const currentClass = classRows[0];
        setTeacherClass(currentClass);

        const { data: goalData, error: goalError } = await supabase
          .from("teaching_goals")
          .select(
            "id, teacher_id, class_id, title, description, start_date, expected_lessons, status"
          )
          .eq("id", goalId)
          .eq("teacher_id", parsedSession.teacherId)
          .eq("class_id", currentClass.id)
          .maybeSingle();

        if (goalError) {
          setMessage(`目标读取失败：${goalError.message}`);
          setIsLoading(false);
          return;
        }

        if (!goalData) {
          setMessage("目标不存在，或者这个目标不属于当前小老师。");
          setIsLoading(false);
          return;
        }

        const { count, error: countError } = await supabase
          .from("lesson_records")
          .select("id", { count: "exact", head: true })
          .eq("goal_id", goalId)
          .eq("teacher_id", parsedSession.teacherId)
          .eq("class_id", currentClass.id);

        if (countError) {
          setMessage(`目标进度读取失败：${countError.message}`);
          setIsLoading(false);
          return;
        }

        setGoal(goalData as TeachingGoal);
        setCompletedLessons(count || 0);
        setIsLoading(false);
      } catch {
        localStorage.removeItem("orp_teacher_session");
        setIsLoading(false);
      }
    }

    initPage();
  }, [goalId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!teacherSession) {
      setMessage("请先回到小老师主页，选择小老师身份。");
      return;
    }

    if (!teacherClass) {
      setMessage("没有读取到当前小老师对应的班级，暂时不能修改目标。");
      return;
    }

    if (!goal) return;

    if (goal.status === "completed") {
      setMessage("这个目标已经结束，不能再修改。");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const expectedLessonsText = String(
      formData.get("expected_lessons") || ""
    ).trim();

    const expectedLessons = expectedLessonsText
      ? Number(expectedLessonsText)
      : null;

    if (!title) {
      setMessage("请填写目标标题。");
      setIsSubmitting(false);
      return;
    }

    if (!expectedLessons || expectedLessons < 1) {
      setMessage("请填写有效的计划课次。");
      setIsSubmitting(false);
      return;
    }

    if (expectedLessons < completedLessons) {
      setMessage(
        `计划课次不能少于当前已经完成的课次数。这个目标已经关联了 ${completedLessons} 节课。`
      );
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from("teaching_goals")
      .update({
        title,
        description: description || null,
        expected_lessons: expectedLessons,
      })
      .eq("id", goalId)
      .eq("teacher_id", teacherSession.teacherId)
      .eq("class_id", teacherClass.id)
      .neq("status", "completed");

    if (error) {
      setMessage(`修改失败：${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setMessage("修改成功，正在返回小老师主页...");
    setIsSubmitting(false);

    router.push("/teacher");
    router.refresh();
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-3xl">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 返回首页
          </Link>

          <p className="mt-8 text-stone-600">正在读取目标...</p>
        </section>
      </main>
    );
  }

  if (!teacherSession) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-3xl">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 返回首页
          </Link>

          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-bold text-emerald-950">
              请先选择小老师身份
            </h1>

            <p className="mt-3 leading-7 text-stone-600">
              现在是测试阶段。你需要先回到小老师主页，从下拉框选择一个小老师身份，然后再修改教学目标。
            </p>

            <Link
              href="/teacher"
              className="mt-5 inline-block rounded-full bg-[#2f5d50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              去选择小老师身份
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!goal) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-3xl">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 返回首页
          </Link>

          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
            <p className="leading-7 text-stone-600">
              {message || "目标不存在，或者这个目标不属于当前小老师。"}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const isCompleted = goal.status === "completed";

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <section className="mx-auto max-w-3xl">
        <Link
          href="/teacher"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回首页
        </Link>

        <div className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
            Edit Goal
          </p>

          <h1 className="mt-3 text-4xl font-bold text-emerald-950">
            修改教学目标
          </h1>

          <p className="mt-4 leading-8 text-stone-600">
            当前小老师：
            <span className="font-semibold text-emerald-800">
              {teacherSession.teacherName}
            </span>
            。目标是教学计划，可以根据实际进度调整。已经关联到这个目标的授课记录不会被改变。
          </p>

          <div className="mt-6 rounded-2xl bg-[#f6f5e9] p-5">
            <p className="text-sm text-stone-500">所属班级</p>
            <p className="mt-1 text-xl font-bold text-emerald-950">
              {teacherClass?.name || "未读取到班级"}
            </p>

            <p className="mt-4 text-sm text-stone-500">当前已完成课次</p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">
              {completedLessons} 节
            </p>

            <p className="mt-2 text-sm leading-6 text-stone-500">
              修改后的计划课次不能少于这个数字。
            </p>
          </div>

          {isCompleted ? (
            <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-6">
              <p className="font-semibold text-stone-700">
                这个目标已经结束，暂时不能修改。
              </p>

              <p className="mt-2 leading-7 text-stone-500">
                已结束目标属于历史归档。之后如果确实需要调整，可以交给管理员手动处理。
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-7">
              <div>
                <label className="text-sm font-semibold text-stone-700">
                  目标标题 <span className="text-red-500">*</span>
                </label>

                <input
                  name="title"
                  defaultValue={goal.title}
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
                  defaultValue={goal.description || ""}
                  className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    开始日期
                  </label>

                  <input
                    type="text"
                    value={goal.start_date || "未设置"}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-stone-100 px-4 py-3 text-stone-500 outline-none"
                  />

                  <p className="mt-2 text-sm text-stone-500">
                    开始日期是目标创建时的记录，不能在这里修改。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    计划课次 <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="number"
                    name="expected_lessons"
                    min={Math.max(1, completedLessons)}
                    defaultValue={goal.expected_lessons || ""}
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <p className="mt-2 text-sm text-stone-500">
                    不能少于当前已完成的 {completedLessons} 节。
                  </p>
                </div>
              </div>

              {message && (
                <p className="rounded-xl bg-[#f6f5e9] px-4 py-3 text-sm font-semibold text-emerald-800">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-[#2f5d50] px-6 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "保存中..." : "保存修改"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}