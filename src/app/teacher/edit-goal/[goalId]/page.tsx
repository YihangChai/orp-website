"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TeacherGuard, { useCurrentTeacher } from "@/components/TeacherGuard";
import type { CurrentTeacher } from "@/lib/auth";

/**
 * teacher/edit-goal/[goalId] 页面原则：
 * 1. TeacherGuard 负责确认当前小老师身份。
 * 2. 本页面只读取“修改目标”需要的业务数据。
 * 3. 本页面不再调用 getCurrentTeacher，避免重复身份查询。
 * 4. 修改时仍然带 teacher_id 和 class_id 条件，避免误改其他老师的数据。
 */

/* =========================
   1. 类型定义：描述页面会用到的数据结构
   ========================= */

type ClassItem = {
  id: string;
  name: string;
  school: string | null;
  status: string;
};

type ClassTeacherRelation = {
  class_id: string;
  classes: ClassItem | ClassItem[] | null;
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

type EditGoalPageData = {
  teacherClass: ClassItem;
  goal: TeachingGoal;
  completedLessons: number;
};

/* =========================
   2. 页面外壳：只负责套 TeacherGuard
   ========================= */

export default function EditGoalPage() {
  return (
    <TeacherGuard>
      <EditGoalContent />
    </TeacherGuard>
  );
}

/* =========================
   3. 页面主体：修改教学目标
   ========================= */

function EditGoalContent() {
  const router = useRouter();
  const params = useParams<{ goalId: string }>();
  const goalId = params.goalId;

  /**
   * currentTeacher 来自 TeacherGuard。
   * 这里不会再次访问数据库确认老师身份。
   */
  const currentTeacher = useCurrentTeacher();

  const [pageData, setPageData] = useState<EditGoalPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  /* =========================
     4. 数据读取函数：读取班级、目标、目标进度
     ========================= */

  async function loadEditGoalPageData(
    activeTeacher: CurrentTeacher,
    activeGoalId: string
  ): Promise<EditGoalPageData> {
    /**
     * 第一步：读取当前老师绑定的班级。
     * 当前版本默认使用第一个可用班级。
     * 后续如果老师正式管理多个班级，可以升级为班级选择。
     */
    const { data: classTeacherData, error: classTeacherError } = await supabase
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
      .eq("teacher_id", activeTeacher.id);

    if (classTeacherError) {
      throw new Error(`读取小老师班级失败：${classTeacherError.message}`);
    }

    const relations = (
      (classTeacherData || []) as unknown as ClassTeacherRelation[]
    );

    const classRows = relations
      .map((relation) => {
        if (!relation.classes) return null;

        return Array.isArray(relation.classes)
          ? relation.classes[0] || null
          : relation.classes;
      })
      .filter((classItem): classItem is ClassItem => Boolean(classItem))
      .filter((classItem) => classItem.status !== "archived");

    const teacherClass = classRows[0];

    if (!teacherClass) {
      throw new Error(
        "这个小老师还没有绑定班级。请先在管理员端为小老师分配班级。"
      );
    }

    /**
     * 第二步：读取要修改的目标。
     * 条件里同时带：
     * - goal id
     * - teacher_id
     * - class_id
     *
     * 这样前端即使拿到别人的 goalId，也读不到不属于自己的目标。
     */
    const { data: goalData, error: goalError } = await supabase
      .from("teaching_goals")
      .select(
        "id, teacher_id, class_id, title, description, start_date, expected_lessons, status"
      )
      .eq("id", activeGoalId)
      .eq("teacher_id", activeTeacher.id)
      .eq("class_id", teacherClass.id)
      .maybeSingle();

    if (goalError) {
      throw new Error(`目标读取失败：${goalError.message}`);
    }

    if (!goalData) {
      throw new Error("目标不存在，或者这个目标不属于当前小老师。");
    }

    /**
     * 第三步：读取这个目标已经关联了多少节课。
     * 用 head + count，只要数量，不下载整批课程记录。
     */
    const { count, error: countError } = await supabase
      .from("lesson_records")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", activeGoalId)
      .eq("teacher_id", activeTeacher.id)
      .eq("class_id", teacherClass.id);

    if (countError) {
      throw new Error(`目标进度读取失败：${countError.message}`);
    }

    return {
      teacherClass,
      goal: goalData as TeachingGoal,
      completedLessons: count || 0,
    };
  }

  /* =========================
     5. 页面加载：currentTeacher 和 goalId 准备好后读取业务数据
     ========================= */

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setMessage("");

      try {
        const loadedPageData = await loadEditGoalPageData(
          currentTeacher,
          goalId
        );

        if (!isMounted) return;

        setPageData(loadedPageData);
      } catch (error) {
        if (!isMounted) return;

        const errorMessage =
          error instanceof Error ? error.message : "读取目标失败。";

        setMessage(errorMessage);
        setPageData(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [currentTeacher, goalId]);

  /* =========================
     6. 提交函数：保存目标修改
     ========================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pageData) {
      setMessage("目标数据尚未加载完成，请稍后再试。");
      return;
    }

    const { teacherClass, goal, completedLessons } = pageData;

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

    /**
     * 修改目标时继续带上 teacher_id 和 class_id。
     * 这是前端层面的安全条件。
     * 真正数据库权限仍然要靠 Supabase RLS。
     */
    const { error } = await supabase
      .from("teaching_goals")
      .update({
        title,
        description: description || null,
        expected_lessons: expectedLessons,
      })
      .eq("id", goalId)
      .eq("teacher_id", currentTeacher.id)
      .eq("class_id", teacherClass.id)
      .neq("status", "completed");

    if (error) {
      setMessage(`修改失败：${error.message}`);
      setIsSubmitting(false);
      return;
    }

    /**
     * 这里不再 router.refresh()。
     * 因为修改成功后直接回到 teacher 主页，teacher 主页会自己加载需要的数据。
     * 少一次不必要的刷新。
     */
    setMessage("修改成功，正在返回小老师主页...");
    setIsSubmitting(false);

    router.push("/teacher");
  }

  /* =========================
     7. 派生数据：给 JSX 使用
     ========================= */

  const teacherClass = pageData?.teacherClass || null;
  const goal = pageData?.goal || null;
  const completedLessons = pageData?.completedLessons || 0;
  const isCompleted = goal?.status === "completed";

  /* =========================
     8. 加载状态
     ========================= */

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

  /* =========================
     9. 目标不存在或无权限
     ========================= */

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

  /* =========================
     10. 页面渲染
     ========================= */

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
              {currentTeacher.name}
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