"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TeacherGuard, { useCurrentTeacher } from "@/components/TeacherGuard";
import type { CurrentTeacher } from "@/lib/auth";

/**
 * teacher/new-record 页面原则：
 * 1. TeacherGuard 负责确认当前小老师身份。
 * 2. 本页面只读取“添加授课记录”需要的业务数据。
 * 3. 本页面不再调用 getCurrentTeacher，避免重复身份查询。
 * 4. 保存课程记录时，同时写入 teacher_id、class_id、goal_id 和学生出勤。
 */

/* =========================
   1. 类型定义：描述页面会用到的数据结构
   ========================= */

type TeachingGoal = {
  id: string;
  class_id: string | null;
  title: string;
  expected_lessons: number | null;
};

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

type ClassStudentItem = {
  id: string;
  name: string;
  note: string | null;
  status: string;
};

type ClassStudentRelation = {
  students: ClassStudentItem | null;
};

type NewRecordPageData = {
  classes: ClassItem[];
  selectedClassId: string;
  goals: TeachingGoal[];
  students: ClassStudentItem[];
};

/* =========================
   2. 工具函数：生成今天日期，作为默认上课日期
   ========================= */

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

/* =========================
   3. 页面外壳：只负责套 TeacherGuard
   ========================= */

export default function NewRecordPage() {
  return (
    <TeacherGuard>
      <NewRecordContent />
    </TeacherGuard>
  );
}

/* =========================
   4. 页面主体：添加授课记录
   ========================= */

function NewRecordContent() {
  const router = useRouter();
  const today = getTodayDate();

  /**
   * currentTeacher 来自 TeacherGuard。
   * 这里不会再次访问数据库确认老师身份。
   */
  const currentTeacher = useCurrentTeacher();

  const [pageData, setPageData] = useState<NewRecordPageData | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>(
    {}
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  /* =========================
     5. 数据读取函数：读取班级、学生、当前目标
     ========================= */

  async function loadNewRecordPageData(
    activeTeacher: CurrentTeacher
  ): Promise<NewRecordPageData> {
    /**
     * 第一步：读取当前小老师负责的班级。
     * 当前版本默认使用第一个未归档班级。
     * 后续如果正式支持一个老师多个班级，可以升级为班级下拉选择。
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

    const classRelations = (
      (classTeacherData || []) as unknown as ClassTeacherRelation[]
    );

    const classes = classRelations
      .map((relation) => {
        if (!relation.classes) return null;

        return Array.isArray(relation.classes)
          ? relation.classes[0] || null
          : relation.classes;
      })
      .filter((classItem): classItem is ClassItem => Boolean(classItem))
      .filter((classItem) => classItem.status !== "archived");

    const selectedClass = classes[0];

    if (!selectedClass) {
      throw new Error(
        "这个小老师还没有绑定班级。请先在管理员端为小老师分配班级。"
      );
    }

    /**
     * 第二步：并行读取当前班级学生和当前班级正在进行的教学目标。
     * 这两个查询互不依赖，所以可以同时读取。
     */
    const [studentsResult, goalsResult] = await Promise.all([
      supabase
        .from("class_students")
        .select(
          `
          students (
            id,
            name,
            note,
            status
          )
        `
        )
        .eq("class_id", selectedClass.id),

      supabase
        .from("teaching_goals")
        .select("id, class_id, title, expected_lessons")
        .eq("teacher_id", activeTeacher.id)
        .eq("class_id", selectedClass.id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    if (studentsResult.error) {
      throw new Error(`读取学生名单失败：${studentsResult.error.message}`);
    }

    if (goalsResult.error) {
      throw new Error(`读取教学目标失败：${goalsResult.error.message}`);
    }

    const students = (
      (studentsResult.data || []) as unknown as ClassStudentRelation[]
    )
      .map((relation) => relation.students)
      .filter((student): student is ClassStudentItem => Boolean(student))
      .filter((student) => student.status !== "withdrawn")
      .filter((student) => student.status !== "archived");

    const goals = (goalsResult.data || []) as TeachingGoal[];

    return {
      classes,
      selectedClassId: selectedClass.id,
      students,
      goals,
    };
  }

  /* =========================
     6. 页面加载：currentTeacher 准备好后读取业务数据
     ========================= */

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setMessage("");

      try {
        const loadedPageData = await loadNewRecordPageData(currentTeacher);

        if (!isMounted) return;

        setPageData(loadedPageData);

        /**
         * 默认所有学生都出勤。
         * 小老师只需要取消未出勤学生的勾选。
         */
        const initialAttendanceMap: Record<string, boolean> = {};

        loadedPageData.students.forEach((student) => {
          initialAttendanceMap[student.id] = true;
        });

        setAttendanceMap(initialAttendanceMap);
      } catch (error) {
        if (!isMounted) return;

        const errorMessage =
          error instanceof Error ? error.message : "读取小老师信息失败。";

        setMessage(errorMessage);
        setPageData(null);
        setAttendanceMap({});
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
     7. 提交函数：保存课程记录和学生出勤
     ========================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pageData) {
      setMessage("页面数据尚未加载完成，暂时不能保存记录。");
      return;
    }

    const { selectedClassId, students } = pageData;

    setIsSubmitting(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const lessonDate = String(formData.get("lesson_date") || "");
    const durationMinutes = Number(formData.get("duration_minutes"));
    const goalId = String(formData.get("goal_id") || "");
    const lessonTitle = String(formData.get("lesson_title") || "").trim();
    const lessonContentAndFeedback = String(
      formData.get("lesson_content_and_feedback") || ""
    ).trim();
    const homework = String(formData.get("homework") || "").trim();
    const nextPlan = String(formData.get("next_plan") || "").trim();
    const materialLink = String(formData.get("material_link") || "").trim();
    const teacherReflection = String(
      formData.get("teacher_reflection") || ""
    ).trim();

    if (
      !lessonDate ||
      !durationMinutes ||
      !lessonTitle ||
      !lessonContentAndFeedback
    ) {
      setMessage("请填写上课日期、授课时长、本节课主题和课程内容。");
      setIsSubmitting(false);
      return;
    }

    if (durationMinutes <= 0) {
      setMessage("授课时长必须大于 0。");
      setIsSubmitting(false);
      return;
    }

    /**
     * 第一步：保存课程记录。
     * 这里写入 teacher_id 和 class_id，保证记录归属清楚。
     */
    const { data: insertedLesson, error: lessonError } = await supabase
      .from("lesson_records")
      .insert({
        teacher_id: currentTeacher.id,
        class_id: selectedClassId,
        goal_id: goalId || null,
        lesson_date: lessonDate,
        duration_minutes: durationMinutes,
        lesson_title: lessonTitle,
        lesson_content_and_feedback: lessonContentAndFeedback,
        homework: homework || null,
        next_plan: nextPlan || null,
        material_link: materialLink || null,
        teacher_reflection: teacherReflection || null,
      })
      .select("id")
      .single();

    if (lessonError) {
      setMessage(`保存课程记录失败：${lessonError.message}`);
      setIsSubmitting(false);
      return;
    }

    /**
     * 第二步：保存学生出勤。
     * 出勤记录依附于刚刚创建的 lesson_record_id。
     */
    const attendanceRows = students.map((student) => ({
      lesson_record_id: insertedLesson.id,
      student_id: student.id,
      is_present: attendanceMap[student.id] ?? false,
    }));

    if (attendanceRows.length > 0) {
      const { error: attendanceError } = await supabase
        .from("lesson_attendance")
        .insert(attendanceRows);

      if (attendanceError) {
        setMessage(`课程记录已提交，但学生出勤保存失败：${attendanceError.message}`);
        setIsSubmitting(false);
        return;
      }
    }

    /**
     * 保存成功后直接回到 teacher 主页。
     * 不再 router.refresh()，teacher 主页会自己读取最新数据。
     */
    setMessage("课程记录和学生出勤已提交。");
    setIsSubmitting(false);

    router.push("/teacher");
  }

  /* =========================
     8. 派生数据：给 JSX 使用
     ========================= */

  const classes = pageData?.classes || [];
  const selectedClassId = pageData?.selectedClassId || "";
  const goals = pageData?.goals || [];
  const students = pageData?.students || [];

  const selectedClass = useMemo(() => {
    return classes.find((classItem) => classItem.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  const hasMultipleClasses = classes.length > 1;

  /* =========================
     9. 加载状态
     ========================= */

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
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
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            ← 返回小老师主页
          </Link>

          <h1 className="mt-3 text-4xl font-bold text-emerald-950">
            添加授课记录
          </h1>

          <p className="mt-4 leading-8 text-stone-600">
            当前小老师：
            <span className="font-semibold text-emerald-800">
              {currentTeacher.name}
            </span>
            。请记录本节课的基本信息、出勤情况、课程内容和后续计划。
          </p>

          {message && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
              {message}
            </div>
          )}
        </div>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
          <form onSubmit={handleSubmit} className="space-y-7">
            {/* 基本信息 */}
            <section>
              <h2 className="text-2xl font-bold text-emerald-950">
                基本信息
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    所属班级
                  </label>

                  <input
                    type="text"
                    value={selectedClass?.name || "未读取到班级"}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-stone-100 px-4 py-3 text-stone-600 outline-none"
                  />

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    班级根据当前登录的小老师账号自动读取。当前版本默认使用第一个未归档班级。
                  </p>

                  {hasMultipleClasses && (
                    <p className="mt-2 text-xs leading-5 text-amber-700">
                      系统检测到你关联了多个班级。当前页面会默认使用第一个班级；后续可以升级为班级下拉选择。
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    所属课程目标
                  </label>

                  <select
                    name="goal_id"
                    disabled={!selectedClassId}
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">不关联教学目标</option>

                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                        {goal.expected_lessons
                          ? `（计划 ${goal.expected_lessons} 节）`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    上课日期
                  </label>

                  <input
                    type="date"
                    name="lesson_date"
                    defaultValue={today}
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    默认是今天，也可以手动修改为实际上课日期。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    授课时长（分钟）
                  </label>

                  <input
                    type="number"
                    name="duration_minutes"
                    defaultValue={40}
                    min="1"
                    placeholder="例如：40"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-stone-700">
                    本节课主题
                  </label>

                  <input
                    type="text"
                    name="lesson_title"
                    placeholder="例如：小王子第一章 / 自我介绍与阅读导入"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </section>

            {/* 学生出勤 */}
            <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-emerald-950">学生出勤</h2>

              <p className="mt-2 text-sm leading-7 text-stone-600">
                默认全部出勤。如果有学生没有参加本节课，请取消勾选。
              </p>

              {students.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                  当前班级还没有录入学生，暂时无法记录出勤。
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {students.map((student) => (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#fffdf4] p-4 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-emerald-950">
                          {student.name}
                        </p>

                        <p className="mt-1 text-xs text-stone-500">
                          {student.note || "暂无备注"}
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        checked={attendanceMap[student.id] ?? false}
                        onChange={(event) => {
                          setAttendanceMap((previousMap) => ({
                            ...previousMap,
                            [student.id]: event.target.checked,
                          }));
                        }}
                        className="h-4 w-4"
                      />
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* 课程内容与课后安排 */}
            <section className="border-t border-emerald-100 pt-7">
              <h2 className="text-2xl font-bold text-emerald-950">
                课程内容与课后安排
              </h2>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    本节课内容与课堂反馈
                  </label>

                  <textarea
                    name="lesson_content_and_feedback"
                    rows={6}
                    placeholder="记录本节课讲了什么、学生整体理解情况、互动情况、哪里做得好、哪里需要继续练习。"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-stone-700">
                      课后作业（选填）
                    </label>

                    <textarea
                      name="homework"
                      rows={3}
                      placeholder="例如：复习关键词，完成一段复述。"
                      className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-stone-700">
                      下节课计划（选填）
                    </label>

                    <textarea
                      name="next_plan"
                      rows={3}
                      placeholder="例如：继续阅读下一章，加入开放式问题。"
                      className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    视频 / 材料链接（选填）
                  </label>

                  <input
                    type="url"
                    name="material_link"
                    placeholder="https://..."
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </section>

            {/* 小老师反思 */}
            <section className="border-t border-emerald-100 pt-7">
              <div className="rounded-2xl border border-emerald-100 bg-[#edf3df] p-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-emerald-950">
                      小老师反思（私密）
                    </h2>

                    <p className="mt-2 leading-7 text-stone-600">
                      这部分只对小老师本人和管理员可见，不会显示给学生。
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-800">
                    私密
                  </span>
                </div>

                <textarea
                  name="teacher_reflection"
                  rows={4}
                  placeholder="例如：这节课哪里顺利？哪里需要调整？下次如何改进？有没有需要管理员或课程部帮助的地方？"
                  className="mt-5 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                />
              </div>
            </section>

            {/* 提交区 */}
            <div className="flex flex-col gap-3 border-t border-emerald-100 pt-6 md:flex-row md:items-center md:justify-between">
              <p className="text-sm leading-6 text-stone-500">
                当前版本会根据登录的小老师账号，自动保存真实 teacher_id、class_id 和学生出勤。
              </p>

              <button
                type="submit"
                disabled={isSubmitting || !selectedClassId}
                className="rounded-full bg-[#cfe8d6] px-7 py-3 font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "保存中..." : "保存记录"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}