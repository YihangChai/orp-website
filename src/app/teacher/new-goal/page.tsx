"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TeacherGuard, { useCurrentTeacher } from "@/components/TeacherGuard";
import type { CurrentTeacher } from "@/lib/auth";

/**
 * teacher/new-goal 页面原则：
 * 1. TeacherGuard 负责确认当前小老师身份。
 * 2. 本页面只读取“创建目标”需要的业务数据。
 * 3. 本页面不再调用 getCurrentTeacher，避免重复身份查询。
 * 4. 创建目标时继续写入 teacher_id 和 class_id，保证目标和老师、班级绑定清楚。
 */

/* =========================
   1. 类型定义：描述页面会用到的数据结构
   ========================= */

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

type NewGoalPageData = {
  teacherClass: ClassItem;
  classRelations: ClassTeacherRelation[];
};

/* =========================
   2. 工具函数：生成今天日期，作为默认开始日期
   ========================= */

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

/* =========================
   3. 页面外壳：只负责套 TeacherGuard
   ========================= */

export default function NewGoalPage() {
  return (
    <TeacherGuard>
      <NewGoalContent />
    </TeacherGuard>
  );
}

/* =========================
   4. 页面主体：创建阶段教学目标
   ========================= */

function NewGoalContent() {
  const router = useRouter();
  const today = getTodayDate();

  /**
   * currentTeacher 来自 TeacherGuard。
   * 这里不会再次访问数据库确认老师身份。
   */
  const currentTeacher = useCurrentTeacher();

  const [pageData, setPageData] = useState<NewGoalPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  /* =========================
     5. 数据读取函数：读取当前老师负责的班级
     ========================= */

  async function loadNewGoalPageData(
    activeTeacher: CurrentTeacher
  ): Promise<NewGoalPageData> {
    /**
     * 这里只需要读取当前老师负责的班级。
     * 当前版本默认使用第一个未归档班级。
     * 后续如果正式支持一个老师多个班级，可以把这里升级为班级下拉选择。
     */
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
      .eq("teacher_id", activeTeacher.id);

    if (error) {
      throw new Error(`读取小老师班级失败：${error.message}`);
    }

    const classRelations = (data || []) as unknown as ClassTeacherRelation[];

    const classRows = classRelations
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
      throw new Error("没有读取到你负责的班级。请联系管理员分配班级。");
    }

    return {
      teacherClass,
      classRelations,
    };
  }

  /* =========================
     6. 页面加载：currentTeacher 准备好后读取班级数据
     ========================= */

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setMessage("");

      try {
        const loadedPageData = await loadNewGoalPageData(currentTeacher);

        if (!isMounted) return;

        setPageData(loadedPageData);
      } catch (error) {
        if (!isMounted) return;

        const errorMessage =
          error instanceof Error ? error.message : "读取小老师信息失败。";

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
  }, [currentTeacher]);

  /* =========================
     7. 提交函数：创建新的教学目标
     ========================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pageData) {
      setMessage("班级信息尚未加载完成，暂时不能创建目标。");
      return;
    }

    const { teacherClass } = pageData;

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

    /**
     * 创建目标时写入 teacher_id 和 class_id。
     * 页面上用 currentTeacher.id，不再依赖 teacherSession。
     * 真正权限仍然依赖 Supabase RLS。
     */
    const { error } = await supabase.from("teaching_goals").insert({
      teacher_id: currentTeacher.id,
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

    /**
     * 这里不再 router.refresh()。
     * 创建成功后直接回到 teacher 主页，主页会自行读取最新数据。
     */
    setMessage("目标保存成功，正在返回小老师主页...");
    setIsSubmitting(false);

    router.push("/teacher");
  }

  /* =========================
     8. 派生数据：给 JSX 使用
     ========================= */

  const teacherClass = pageData?.teacherClass || null;
  const classRelations = pageData?.classRelations || [];
  const hasMultipleClasses = classRelations.length > 1;

  /* =========================
     9. 加载状态
     ========================= */

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-600">正在读取小老师信息...</p>
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
          ← 返回小老师主页
        </Link>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-[#2f5d50]">
            当前小老师：{currentTeacher.name}
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
            {/* 所属班级 */}
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

              {hasMultipleClasses && (
                <p className="mt-2 text-xs leading-5 text-amber-700">
                  系统检测到你关联了多个班级。当前页面会默认使用第一个班级；后续可以升级为班级下拉选择。
                </p>
              )}
            </div>

            {/* 目标标题 */}
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

            {/* 目标说明 */}
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

            {/* 开始日期与预计课时 */}
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

            {/* 提交按钮 */}
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