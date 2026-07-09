"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import StudentGuard, { useCurrentStudent } from "@/components/StudentGuard";
import type { CurrentStudent } from "@/lib/auth";

type StudentRow = {
  id: string;
  name: string;
  note: string | null;
  status: string;
};

type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
};

type ClassTeacherRelation = {
  teachers: TeacherRow | null;
};

type CohortRow = {
  id: string;
  name: string;
  status: string;
};

type ClassRow = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  class_code: string | null;
  cohorts: CohortRow | null;
  class_teachers: ClassTeacherRelation[];
};

type ClassRelation = {
  class_id: string;
  classes: ClassRow | null;
};

type ClassmateRelation = {
  student_id: string;
  students: StudentRow | null;
};

type TeachingGoal = {
  id: string;
  title: string;
  description: string | null;
  expected_lessons: number | null;
  status: string;
};

type LessonRecord = {
  id: string;
  goal_id: string | null;
  lesson_date: string;
  duration_minutes: number;
  lesson_title: string;
  lesson_content_and_feedback: string;
  homework: string | null;
  next_plan: string | null;
  material_link: string | null;
  created_at: string;
};

type StudentLessonComment = {
  id: string;
  lesson_record_id: string;
  student_name: string | null;
  comment: string;
  created_at: string;
};

type StudentHomePageData = {
  student: StudentRow;
  classRelation: ClassRelation;
  classmates: StudentRow[];
  goals: TeachingGoal[];
  records: LessonRecord[];
  latestRecordComments: StudentLessonComment[];
};

export default function StudentPage() {
  return (
    <StudentGuard>
      <StudentHomeContent />
    </StudentGuard>
  );
}

function StudentHomeContent() {
  const currentStudent = useCurrentStudent();

  const [pageData, setPageData] = useState<StudentHomePageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadStudentHomePageData(
    activeStudent: CurrentStudent
  ): Promise<StudentHomePageData> {
    const { data: studentFromSupabase, error: studentError } = await supabase
      .from("students")
      .select("id, name, note, status")
      .eq("id", activeStudent.id)
      .maybeSingle();

    if (studentError) {
      throw new Error(`读取学生资料失败：${studentError.message}`);
    }

    if (!studentFromSupabase) {
      throw new Error("没有找到学生资料，请重新登录。");
    }

    const studentData = studentFromSupabase as StudentRow;

    if (
      studentData.status === "withdrawn" ||
      studentData.status === "archived"
    ) {
      throw new Error("这个学生账号当前不可用。如有疑问，请联系 ORP 管理员。");
    }

    const { data: classRelationsFromSupabase, error: classRelationError } =
      await supabase
        .from("class_students")
        .select(
          `
          class_id,
          classes (
            id,
            name,
            school,
            status,
            class_code,
            cohorts (
              id,
              name,
              status
            ),
            class_teachers (
              teachers (
                id,
                name,
                email
              )
            )
          )
        `
        )
        .eq("student_id", activeStudent.id);

    if (classRelationError) {
      throw new Error(`读取班级信息失败：${classRelationError.message}`);
    }

    const relation = (
      (classRelationsFromSupabase || []) as unknown as ClassRelation[]
    )[0];

    if (!relation) {
      throw new Error("没有找到你的班级信息，请联系 ORP 管理员。");
    }

    const activeClassId = relation.class_id;

    const [
      classmatesResult,
      goalsResult,
      recordsResult,
    ] = await Promise.all([
      supabase
        .from("class_students")
        .select(
          `
          student_id,
          students (
            id,
            name,
            note,
            status
          )
        `
        )
        .eq("class_id", activeClassId),

      supabase
        .from("teaching_goals")
        .select("id, title, description, expected_lessons, status")
        .eq("class_id", activeClassId)
        .eq("status", "active")
        .order("created_at", { ascending: false }),

      supabase
        .from("lesson_records")
        .select(
          "id, goal_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, created_at"
        )
        .eq("class_id", activeClassId)
        .order("lesson_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (classmatesResult.error) {
      throw new Error(`读取同学信息失败：${classmatesResult.error.message}`);
    }

    if (goalsResult.error) {
      throw new Error(`读取学习计划失败：${goalsResult.error.message}`);
    }

    if (recordsResult.error) {
      throw new Error(`读取课程记录失败：${recordsResult.error.message}`);
    }

    const classmateRows = (
      (classmatesResult.data || []) as unknown as ClassmateRelation[]
    )
      .map((relationItem) => relationItem.students)
      .filter((classmate): classmate is StudentRow => Boolean(classmate))
      .filter((classmate) => classmate.id !== activeStudent.id)
      .filter((classmate) => classmate.status !== "withdrawn")
      .filter((classmate) => classmate.status !== "archived");

    const lessonRecords = (recordsResult.data || []) as LessonRecord[];
    const latestRecord = lessonRecords[0];

    let commentsForLatestRecord: StudentLessonComment[] = [];

    if (latestRecord) {
      const { data: commentsFromSupabase, error: commentsError } =
        await supabase
          .from("student_lesson_comments")
          .select("id, lesson_record_id, student_name, comment, created_at")
          .eq("student_id", activeStudent.id)
          .eq("lesson_record_id", latestRecord.id)
          .order("created_at", { ascending: false });

      if (commentsError) {
        throw new Error(`读取留言失败：${commentsError.message}`);
      }

      commentsForLatestRecord =
        (commentsFromSupabase || []) as StudentLessonComment[];
    }

    return {
      student: studentData,
      classRelation: relation,
      classmates: classmateRows,
      goals: (goalsResult.data || []) as TeachingGoal[],
      records: lessonRecords,
      latestRecordComments: commentsForLatestRecord,
    };
  }

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setMessage("");

      try {
        const loadedPageData = await loadStudentHomePageData(currentStudent);

        if (!isMounted) return;

        setPageData(loadedPageData);
      } catch (error) {
        if (!isMounted) return;

        const errorMessage =
          error instanceof Error ? error.message : "读取学生信息失败。";

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
  }, [currentStudent]);

  const currentGoal = pageData?.goals[0] || null;
  const latestRecord = pageData?.records[0] || null;
  const hasCommentForLatestRecord =
    (pageData?.latestRecordComments.length || 0) > 0;

  const completedLessonsForCurrentGoal = currentGoal
    ? (pageData?.records || []).filter(
        (record) => record.goal_id === currentGoal.id
      ).length
    : 0;

  const expectedLessons = currentGoal?.expected_lessons || 0;

  const teacherNames = useMemo(() => {
    return Array.from(
      new Set(
        (pageData?.classRelation.classes?.class_teachers || [])
          .map((item) => item.teachers?.name)
          .filter(Boolean)
      )
    );
  }, [pageData?.classRelation.classes?.class_teachers]);

  const classmateNames = useMemo(() => {
    return (pageData?.classmates || []).map((classmate) => classmate.name);
  }, [pageData?.classmates]);

  const studentInfo = {
    name: pageData?.student.name || currentStudent.name || "学生",
    className:
      pageData?.classRelation.classes?.name || "暂未读取班级",
    classmateName:
      classmateNames.length > 0 ? classmateNames.join("、") : "暂无其他同学",
    teacherName: teacherNames.length > 0 ? teacherNames.join("、") : "暂无小老师",
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-600">正在读取学生信息...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-4xl">
        {message && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-[0.8fr_1.4fr]">
          <aside className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2f5d50] text-2xl font-bold text-white">
                {studentInfo.name.slice(0, 1)}
              </div>

              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  我的学习信息
                </p>

                <h2 className="mt-1 text-2xl font-bold text-emerald-950">
                  {studentInfo.name}
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-[#fffdf4] px-4 py-3">
                <p className="text-xs text-stone-500">班级</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">
                  {studentInfo.className}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fffdf4] px-4 py-3">
                <p className="text-xs text-stone-500">我的同学</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-emerald-950">
                  {studentInfo.classmateName}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fffdf4] px-4 py-3">
                <p className="text-xs text-stone-500">小老师</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">
                  {studentInfo.teacherName}
                </p>
              </div>
            </div>
          </aside>

          <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <p className="text-sm font-semibold text-[#2f5d50]">
              ORP 学习空间
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              你好，{studentInfo.name}
            </h1>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              这里会帮你记住最近学了什么、课后要做什么，也可以给小老师留一句话。
            </p>

            <div className="mt-5 rounded-2xl bg-[#fffdf4] p-5">
              <h2 className="text-lg font-bold text-emerald-950">
                你正在学习
              </h2>

              {currentGoal ? (
                <div className="mt-3">
                  <p className="text-2xl font-bold text-emerald-950">
                    {currentGoal.title}
                  </p>

                  {currentGoal.description && (
                    <p className="mt-3 text-sm leading-7 text-stone-600">
                      {currentGoal.description}
                    </p>
                  )}

                  <p className="mt-4 text-sm font-semibold text-emerald-800">
                    我们已经一起完成了 {completedLessonsForCurrentGoal} /{" "}
                    {expectedLessons || "?"} 节课
                  </p>

                  {expectedLessons > 0 && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-[#2f5d50]"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (completedLessonsForCurrentGoal /
                                expectedLessons) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  目前还没有正在进行的学习计划。
                </p>
              )}
            </div>
          </section>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold text-emerald-950">
                最近一次上课
              </h2>
            </div>

            <Link
              href="/student/lessons"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              查看全部课程
            </Link>
          </div>

          {latestRecord ? (
            <article className="mt-5 rounded-2xl bg-[#fffdf4] p-5">
              <p className="text-sm text-stone-500">
                {latestRecord.lesson_date} · {latestRecord.duration_minutes}{" "}
                分钟
              </p>

              <h3 className="mt-2 text-2xl font-bold text-emerald-950">
                {latestRecord.lesson_title}
              </h3>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    这节课学了什么
                  </p>
                  <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
                    {latestRecord.lesson_content_and_feedback}
                  </p>
                </div>

                {latestRecord.homework && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      课后小任务
                    </p>
                    <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
                      {latestRecord.homework}
                    </p>
                  </div>
                )}

                {latestRecord.next_plan && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      下次课预告
                    </p>
                    <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
                      {latestRecord.next_plan}
                    </p>
                  </div>
                )}

                {latestRecord.material_link && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      学习材料
                    </p>
                    <a
                      href={latestRecord.material_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block break-all text-sm font-semibold text-emerald-700 underline"
                    >
                      打开学习材料
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      {hasCommentForLatestRecord
                        ? "小老师收到你的留言了😁"
                        : "想对小老师说一句话吗？"}
                    </p>

                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      {hasCommentForLatestRecord
                        ? "你可以去课程记录里点击展开来查看或继续补充留言。"
                        : "你可以在课程记录里点击展开，然后给这节课写一句留言。"}
                    </p>
                  </div>
                </div>

                <Link
                  href="/student/lessons"
                  className="mt-3 inline-block rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
                >
                  {hasCommentForLatestRecord
                    ? "查看我的留言"
                    : "去课程记录里留言"}
                </Link>
              </div>
            </article>
          ) : (
            <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 leading-7 text-stone-600">
              目前还没有课程记录。
            </p>
          )}
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-bold text-emerald-950">家长模式</h2>

          <p className="mt-2 text-sm leading-7 text-stone-600">
            家长可以查看孩子最近的学习情况、课程记录和学习计划，也可以给
            ORP 留下一些反馈。
          </p>

          <Link
            href="/student/parent"
            className="mt-4 inline-block rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            进入家长模式
          </Link>
        </section>
      </section>
    </main>
  );
}