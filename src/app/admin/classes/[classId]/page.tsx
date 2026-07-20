"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

/**
 * admin/classes/[classId] 页面原则：
 * 1. AdminGuard 负责确认管理员身份。
 * 2. 页面确认管理员身份后，再读取班级详情。
 * 3. 本页面只读班级、成员、课程记录、教学目标和出勤数据。
 * 4. 后续数据量变大后，课程记录可以做分页，出勤统计可以改成数据库聚合。
 *
 * 学科展示原则：
 * - 班级学科只在页面标题旁边显示一次。
 * - 学生不单独显示学科，因为学生学科由当前班级推导。
 * - 小老师学科默认不重复显示；只有和班级学科冲突时才提示。
 */

/* =========================
   1. 类型定义
   ========================= */

type LessonRecordItem = {
  id: string;
  lesson_title: string;
  lesson_date: string;
  duration_minutes: number;
  lesson_content_and_feedback: string;
  homework: string | null;
  next_plan: string | null;
  teacher_reflection: string | null;
  created_at: string;
};

type AttendanceItem = {
  id: string;
  lesson_record_id: string;
  student_id: string | null;
  is_present: boolean;
  created_at: string;
};

type TeacherItem = {
  id: string;
  name: string;
  email: string | null;
  subject: string | null;
  status: string;
};

type StudentItem = {
  id: string;
  name: string;
  note: string | null;
  status: string;
};

type TeachingGoalItem = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  expected_lessons: number | null;
  completed_at: string | null;
  created_at: string;
};

type ClassDetailData = {
  id: string;
  name: string;
  school: string | null;
  subject: string | null;
  status: string;
  cohort_id: string | null;
  cohorts: {
    name: string;
    status: string;
  } | null;
  class_teachers:
    | {
        teachers: TeacherItem | null;
      }[]
    | null;
  class_students:
    | {
        students: StudentItem | null;
      }[]
    | null;
};

type PageData = {
  classData: ClassDetailData;
  lessons: LessonRecordItem[];
  goals: TeachingGoalItem[];
  attendanceRecords: AttendanceItem[];
};

type AttendanceStudentSummary = {
  id: string;
  name: string;
  total: number;
  present: number;
  rate: number | null;
};

/* =========================
   2. 工具函数
   ========================= */

function getStatusLabel(status: string) {
  if (status === "active") return "运行中";
  if (status === "archived") return "已封存";
  if (status === "delete_requested") return "删除申请中";
  if (status === "completed") return "已完成";
  return status;
}

function getStatusClassName(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  if (status === "completed") return "bg-blue-50 text-blue-700";
  return "bg-stone-100 text-stone-600";
}

function getSubjectLabel(subject: string | null | undefined) {
  if (subject === "english") return "英语";
  if (subject === "math") return "数学";
  return "未设置";
}

function getSubjectClassName(subject: string | null | undefined) {
  if (subject === "english") return "bg-sky-50 text-sky-700";
  if (subject === "math") return "bg-violet-50 text-violet-700";
  return "bg-stone-100 text-stone-500";
}

function hasTeacherSubjectConflict(
  teacherSubject: string | null | undefined,
  classSubject: string | null | undefined
) {
  if (!teacherSubject || !classSubject) return false;
  return teacherSubject !== classSubject;
}

function getMondayKey(dateString: string) {
  const date = new Date(dateString);
  const monday = new Date(date);

  const day = monday.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  return monday.toISOString().slice(0, 10);
}

function getTeachingFrequencySummary(lessons: LessonRecordItem[]) {
  if (lessons.length === 0) {
    return {
      recentLessonDate: null as string | null,
      recentFourWeeksCount: 0,
      totalActiveWeeks: 0,
      averageLessonsPerActiveWeek: 0,
    };
  }

  const sortedLessons = [...lessons].sort(
    (a, b) =>
      new Date(b.lesson_date).getTime() - new Date(a.lesson_date).getTime()
  );

  const today = new Date();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(today.getDate() - 28);

  const recentLessons = lessons.filter((lesson) => {
    const lessonDate = new Date(lesson.lesson_date);
    return lessonDate >= fourWeeksAgo && lessonDate <= today;
  });

  const recentWeekKeys = new Set<string>();
  recentLessons.forEach((lesson) => {
    recentWeekKeys.add(getMondayKey(lesson.lesson_date));
  });

  const allWeekKeys = new Set<string>();
  lessons.forEach((lesson) => {
    allWeekKeys.add(getMondayKey(lesson.lesson_date));
  });

  const totalActiveWeeks = allWeekKeys.size;

  return {
    recentLessonDate: sortedLessons[0]?.lesson_date || null,
    recentFourWeeksCount: recentWeekKeys.size,
    totalActiveWeeks,
    averageLessonsPerActiveWeek:
      totalActiveWeeks === 0
        ? 0
        : Math.round((lessons.length / totalActiveWeeks) * 10) / 10,
  };
}

function getAttendanceSummary(
  attendanceRecords: AttendanceItem[],
  students: StudentItem[]
) {
  if (attendanceRecords.length === 0) {
    return {
      totalRecords: 0,
      presentRecords: 0,
      attendanceRate: null as number | null,
      studentSummaries: [] as AttendanceStudentSummary[],
    };
  }

  let presentRecords = 0;

  const studentSummaryMap = new Map<
    string,
    {
      id: string;
      name: string;
      total: number;
      present: number;
    }
  >();

  students.forEach((student) => {
    studentSummaryMap.set(student.id, {
      id: student.id,
      name: student.name,
      total: 0,
      present: 0,
    });
  });

  attendanceRecords.forEach((record) => {
    if (record.is_present) {
      presentRecords += 1;
    }

    if (!record.student_id) return;

    const studentSummary = studentSummaryMap.get(record.student_id);

    if (!studentSummary) return;

    studentSummary.total += 1;

    if (record.is_present) {
      studentSummary.present += 1;
    }
  });

  const attendanceRate = Math.round(
    (presentRecords / attendanceRecords.length) * 100
  );

  const studentSummaries = Array.from(studentSummaryMap.values()).map(
    (student) => {
      return {
        id: student.id,
        name: student.name,
        total: student.total,
        present: student.present,
        rate:
          student.total === 0
            ? null
            : Math.round((student.present / student.total) * 100),
      };
    }
  );

  return {
    totalRecords: attendanceRecords.length,
    presentRecords,
    attendanceRate,
    studentSummaries,
  };
}

/* =========================
   3. 页面外壳：只负责 AdminGuard
   ========================= */

export default function AdminClassDetailPage() {
  return (
    <AdminGuard>
      <AdminClassDetailContent />
    </AdminGuard>
  );
}

/* =========================
   4. 页面主体：班级详情
   ========================= */

function AdminClassDetailContent() {
  const params = useParams<{ classId: string }>();
  const classId = params.classId;

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  /* =========================
     5. 数据读取：班级详情、课程记录、目标、出勤
     ========================= */

  async function loadClassDetailPageData(
    activeClassId: string
  ): Promise<PageData> {
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select(
        `
        id,
        name,
        school,
        subject,
        status,
        cohort_id,
        cohorts(name, status),
        class_teachers(
          teachers(id, name, email, subject, status)
        ),
        class_students(
          students(id, name, note, status)
        )
      `
      )
      .eq("id", activeClassId)
      .maybeSingle();

    if (classError) {
      throw new Error(`读取班级失败：${classError.message}`);
    }

    if (!classData) {
      throw new Error(
        "没有找到这个班级。这个班级可能已经被删除，或者链接里的 classId 不正确。"
      );
    }

    const [lessonResult, goalResult] = await Promise.all([
      supabase
        .from("lesson_records")
        .select(
          "id, lesson_title, lesson_date, duration_minutes, lesson_content_and_feedback, homework, next_plan, teacher_reflection, created_at"
        )
        .eq("class_id", activeClassId)
        .order("lesson_date", { ascending: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("teaching_goals")
        .select(
          "id, title, description, start_date, end_date, status, expected_lessons, completed_at, created_at"
        )
        .eq("class_id", activeClassId)
        .order("created_at", { ascending: false }),
    ]);

    if (lessonResult.error) {
      throw new Error(`读取课程记录失败：${lessonResult.error.message}`);
    }

    if (goalResult.error) {
      throw new Error(`读取教学目标失败：${goalResult.error.message}`);
    }

    const lessons = (lessonResult.data || []) as LessonRecordItem[];
    const goals = (goalResult.data || []) as TeachingGoalItem[];

    const lessonIds = lessons.map((lesson) => lesson.id);
    let attendanceRecords: AttendanceItem[] = [];

    if (lessonIds.length > 0) {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("lesson_attendance")
        .select("id, lesson_record_id, student_id, is_present, created_at")
        .in("lesson_record_id", lessonIds);

      if (attendanceError) {
        console.error("读取出勤记录失败：", attendanceError.message);
        attendanceRecords = [];
      } else {
        attendanceRecords = (attendanceData || []) as AttendanceItem[];
      }
    }

    return {
      classData: classData as unknown as ClassDetailData,
      lessons,
      goals,
      attendanceRecords,
    };
  }

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setMessage("");

      try {
        const loadedData = await loadClassDetailPageData(classId);

        if (!isMounted) return;

        setPageData(loadedData);
      } catch (error) {
        if (!isMounted) return;

        const errorMessage =
          error instanceof Error
            ? error.message
            : "读取班级详情失败：未知错误。";

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
  }, [classId]);

  /* =========================
     6. 派生数据：必须放在所有 return 之前
     ========================= */

    const classData = pageData?.classData || null;

  /**
   * 这里不要直接写 pageData?.lessons || []。
   * 否则在 pageData 为空时，每次 render 都会创建新的空数组，
   * ESLint 会认为 useMemo 的依赖可能每次都变化。
   */
  const lessons = useMemo(() => {
    return pageData?.lessons || [];
  }, [pageData?.lessons]);

  const goals = useMemo(() => {
    return pageData?.goals || [];
  }, [pageData?.goals]);

  const attendanceRecords = useMemo(() => {
    return pageData?.attendanceRecords || [];
  }, [pageData?.attendanceRecords]);

  const teachers = useMemo(() => {
    return (
      classData?.class_teachers
        ?.map((item) => item.teachers)
        .filter((teacher): teacher is TeacherItem => Boolean(teacher)) || []
    );
  }, [classData]);

  const students = useMemo(() => {
    return (
      classData?.class_students
        ?.map((item) => item.students)
        .filter((student): student is StudentItem => Boolean(student)) || []
    );
  }, [classData]);

  const totalLessons = lessons.length;

  const totalMinutes = useMemo(() => {
    return lessons.reduce(
      (sum, lesson) => sum + (lesson.duration_minutes || 0),
      0
    );
  }, [lessons]);

  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  const activeGoals = useMemo(() => {
    return goals.filter((goal) => goal.status === "active");
  }, [goals]);

  const completedGoals = useMemo(() => {
    return goals.filter((goal) => goal.status === "completed");
  }, [goals]);

  const teachingFrequency = useMemo(() => {
    return getTeachingFrequencySummary(lessons);
  }, [lessons]);

  const attendanceSummary = useMemo(() => {
    return getAttendanceSummary(attendanceRecords, students);
  }, [attendanceRecords, students]);

  /* =========================
     7. 加载和错误状态
     ========================= */

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-600">正在读取班级详情...</p>
        </section>
      </main>
    );
  }

  if (!pageData || !classData) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-emerald-950">
            无法显示班级详情
          </h1>

          <p className="mt-3 text-sm leading-7 text-stone-600">
            {message || "这个班级可能已经被删除，或者链接里的 classId 不正确。"}
          </p>

          <Link
            href="/admin/classes"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回班级管理
          </Link>
        </section>
      </main>
    );
  }

  /* =========================
     8. 页面渲染
     ========================= */

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-emerald-950">
                {classData.name}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getSubjectClassName(
                  classData.subject
                )}`}
              >
                {getSubjectLabel(classData.subject)}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(
                  classData.status
                )}`}
              >
                {getStatusLabel(classData.status)}
              </span>
            </div>
          </div>

          <Link
            href="/admin/classes"
            className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回班级管理
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">学生人数</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {students.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">小老师</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {teachers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">课程记录</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {totalLessons}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">累计时长</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {totalHours}
            </p>
            <p className="mt-1 text-xs text-stone-500">小时</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.5fr_1.8fr]">
          <section className="space-y-4">
            <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-emerald-950">
                基本信息
              </h2>

              <div className="mt-4 space-y-2 text-sm leading-6 text-stone-600">
                <p>
                  <span className="font-semibold text-stone-800">届别：</span>
                  {classData.cohorts?.name || "未设置"}
                </p>

                <p>
                  <span className="font-semibold text-stone-800">学校：</span>
                  {classData.school || "暂未填写"}
                </p>

                <p>
                  <span className="font-semibold text-stone-800">状态：</span>
                  {getStatusLabel(classData.status)}
                </p>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-emerald-950">小老师</h2>

              {teachers.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#fffdf4] p-3 text-sm text-stone-600">
                  暂未分配小老师。
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {teachers.map((teacher) => {
                    const subjectConflict = hasTeacherSubjectConflict(
                      teacher.subject,
                      classData.subject
                    );

                    return (
                      <div
                        key={teacher.id}
                        className="rounded-xl bg-[#fffdf4] p-3"
                      >
                        <p className="text-sm font-bold text-emerald-950">
                          {teacher.name}
                        </p>

                        <p className="mt-1 text-xs text-stone-500">
                          {teacher.email || "暂未填写邮箱"}
                        </p>

                        {subjectConflict && (
                          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                            学科不一致：老师为
                            {getSubjectLabel(teacher.subject)}，班级为
                            {getSubjectLabel(classData.subject)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-emerald-950">
                学生名单
              </h2>

              {students.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#fffdf4] p-3 text-sm text-stone-600">
                  暂未录入学生。
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="rounded-xl bg-[#fffdf4] p-3"
                    >
                      <p className="text-sm font-bold text-emerald-950">
                        {student.name}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        {student.note || "暂无备注"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>

          <section className="space-y-6">
            <section className="grid gap-3 md:grid-cols-2">
              <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
                <h2 className="text-xl font-bold text-emerald-950">
                  上课频率
                </h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#fffdf4] p-4">
                    <p className="text-xs font-semibold text-stone-500">
                      最近一次上课
                    </p>
                    <p className="mt-2 text-lg font-bold text-emerald-950">
                      {teachingFrequency.recentLessonDate || "暂无"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#fffdf4] p-4">
                    <p className="text-xs font-semibold text-stone-500">
                      近 4 周上课次数
                    </p>
                    <p className="mt-2 text-lg font-bold text-emerald-950">
                      {teachingFrequency.recentFourWeeksCount} 次
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#fffdf4] p-4">
                    <p className="text-xs font-semibold text-stone-500">
                      累计有课周数
                    </p>
                    <p className="mt-2 text-lg font-bold text-emerald-950">
                      {teachingFrequency.totalActiveWeeks} 周
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
                <h2 className="text-xl font-bold text-emerald-950">
                  学生出勤率
                </h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  根据课程记录中的学生出勤信息计算。若老师提交记录时没有填写出勤，或当前出勤权限尚未开放，则这里暂时没有数据。
                </p>

                <div className="mt-5 rounded-2xl bg-[#fffdf4] p-4">
                  <p className="text-xs font-semibold text-stone-500">
                    班级总体出勤率
                  </p>

                  <p className="mt-2 text-3xl font-bold text-emerald-950">
                    {attendanceSummary.attendanceRate === null
                      ? "暂无"
                      : `${attendanceSummary.attendanceRate}%`}
                  </p>

                  <p className="mt-2 text-xs text-stone-500">
                    已出勤记录：{attendanceSummary.presentRecords}/
                    {attendanceSummary.totalRecords}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {attendanceSummary.studentSummaries.length === 0 ? (
                    <p className="rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                      暂无学生出勤记录。
                    </p>
                  ) : (
                    attendanceSummary.studentSummaries.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between rounded-2xl bg-[#fffdf4] p-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-emerald-950">
                            {student.name}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            出勤 {student.present}/{student.total}
                          </p>
                        </div>

                        <p className="font-bold text-emerald-800">
                          {student.rate === null ? "暂无" : `${student.rate}%`}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </section>

            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-bold text-emerald-950">
                    教学目标
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    进行中 {activeGoals.length}
                  </span>

                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                    已完成 {completedGoals.length}
                  </span>
                </div>
              </div>

              {goals.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                  这个班级还没有教学目标。
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusClassName(
                            goal.status
                          )}`}
                        >
                          {getStatusLabel(goal.status)}
                        </span>

                        {goal.expected_lessons && (
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500">
                            预计 {goal.expected_lessons} 节课
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 font-bold text-emerald-950">
                        {goal.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {goal.description || "暂无目标描述"}
                      </p>

                      <p className="mt-2 text-xs text-stone-500">
                        {goal.start_date || "未设置开始日期"} -{" "}
                        {goal.end_date || "未设置结束日期"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">课程记录</h2>

              {lessons.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                  这个班级还没有课程记录。
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500">
                          {lesson.lesson_date || "未填写日期"}
                        </span>

                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          {lesson.duration_minutes || 0} 分钟
                        </span>
                      </div>

                      <h3 className="mt-2 font-bold text-emerald-950">
                        {lesson.lesson_title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {lesson.lesson_content_and_feedback ||
                          "暂无课程内容记录"}
                      </p>

                      {lesson.next_plan && (
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          <span className="font-semibold text-stone-700">
                            下一步：
                          </span>
                          {lesson.next_plan}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        </section>
      </section>
    </main>
  );
}