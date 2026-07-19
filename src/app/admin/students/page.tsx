"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

/**
 * admin/students 页面原则：
 * 1. AdminGuard 负责确认当前用户是否是管理员。
 * 2. 本页面只负责学生统计、查询和详情入口。
 * 3. 学生账号创建、密码重置、班级调整、退出/恢复、删除/归档等维护操作，统一放到 /admin/maintenance。
 * 4. 本页面不再展示旧版 student_code / pin_code / 班级码登录机制。
 * 5. 管理员在这里主要观察学生参与情况：出勤率、近 30 天上课次数、最近上课时间、关注状态。
 * 6. “待维护”包含：状态异常，或者 active 但未绑定班级。
 *
 * 学科规则：
 * - students 不存 subject。
 * - 学生学科由 class_students -> classes.subject 推导。
 * - 一个学生可以同时有英语和数学两个学科。
 */

type StudentRow = {
  id: string;
  name: string;
  note: string | null;
  status: string;
  username: string | null;
  grade: string | null;
  created_at: string;
};

type StudentClassSummary = {
  classId: string;
  className: string;
  subject: string | null;
  teacherNames: string[];
};

type StudentTableItem = {
  id: string;
  name: string;
  note: string | null;
  status: string;
  username: string | null;
  grade: string | null;

  classIds: string[];
  classNames: string[];
  classSummaries: StudentClassSummary[];
  cohortIds: string[];
  teacherNames: string[];
  subjects: string[];

  lessonCount: number;
  recentThirtyDaysLessonCount: number;
  attendanceCount: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number | null;
  recentLessonDate: string | null;
};

type ClassStudentRow = {
  student_id: string;
  class_id: string;
  classes: any;
};

type LessonRecordRow = {
  id: string;
  class_id: string | null;
  lesson_date: string;
};

type AttendanceRow = {
  student_id: string;
  is_present: boolean;
  lesson_record_id: string;
};

type CohortRow = {
  id: string;
  name: string;
  status: string;
};

function isCurrentStudent(student: StudentTableItem) {
  return student.status === "active" && student.classIds.length > 0;
}

function isMaintenanceStudent(student: StudentTableItem) {
  return (
    (student.status !== "active" &&
      student.status !== "withdrawn" &&
      student.status !== "archived") ||
    (student.status === "active" && student.classIds.length === 0)
  );
}

function getStudentStatusLabel(status: string) {
  if (status === "active") return "当前";
  if (status === "withdrawn") return "已退出";
  if (status === "archived") return "已归档";
  if (status === "delete_requested") return "待维护";
  return status;
}

function getStudentStatusClassName(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "withdrawn") return "bg-amber-50 text-amber-700";
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  return "bg-stone-100 text-stone-500";
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

function getAttendanceRateClassName(attendanceRate: number | null) {
  if (attendanceRate === null) return "bg-stone-100 text-stone-500";
  if (attendanceRate < 0.6) return "bg-red-50 text-red-700";
  if (attendanceRate < 0.8) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function getAttentionLabel(student: StudentTableItem) {
  if (student.status === "withdrawn") {
    return {
      text: "已退出",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (student.status === "archived") {
    return {
      text: "已归档",
      className: "bg-stone-100 text-stone-500",
    };
  }

  if (student.status !== "active") {
    return {
      text: "待维护：状态异常",
      className: "bg-red-50 text-red-700",
    };
  }

  if (student.classIds.length === 0) {
    return {
      text: "待维护：未绑定班级",
      className: "bg-red-50 text-red-700",
    };
  }

  if (student.attendanceCount === 0 && student.lessonCount > 0) {
    return {
      text: "缺少出勤记录",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (student.attendanceRate !== null && student.attendanceRate < 0.6) {
    return {
      text: "需要关注",
      className: "bg-red-50 text-red-700",
    };
  }

  if (student.recentThirtyDaysLessonCount === 0 && student.lessonCount > 0) {
    return {
      text: "近 30 天无课",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (student.lessonCount === 0) {
    return {
      text: "暂无课程",
      className: "bg-stone-100 text-stone-500",
    };
  }

  return {
    text: "正常",
    className: "bg-emerald-50 text-emerald-700",
  };
}

function formatAttendanceRate(student: StudentTableItem) {
  if (student.attendanceRate === null) return "暂无";
  return `${Math.round(student.attendanceRate * 100)}%`;
}

function isWithinRecentThirtyDays(dateString: string) {
  const lessonDate = new Date(dateString);
  const today = new Date();
  const thirtyDaysAgo = new Date();

  thirtyDaysAgo.setDate(today.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  return lessonDate >= thirtyDaysAgo && lessonDate <= today;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default function AdminStudentsPage() {
  return (
    <AdminGuard>
      <AdminStudentsContent />
    </AdminGuard>
  );
}

function AdminStudentsContent() {
  const [students, setStudents] = useState<StudentTableItem[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);

  const [selectedCohortId, setSelectedCohortId] = useState("all");
  const [selectedStatusView, setSelectedStatusView] = useState("current");
  const [keyword, setKeyword] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function fetchStudents() {
    setIsLoading(true);
    setMessage("");

    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name, note, status, username, grade, created_at")
        .order("created_at", { ascending: false });

      if (studentError) {
        throw new Error(`读取学生失败：${studentError.message}`);
      }

      const { data: classStudentData, error: classStudentError } =
        await supabase.from("class_students").select(
          `
          student_id,
          class_id,
          classes (
            id,
            name,
            subject,
            status,
            cohort_id,
            cohorts (
              id,
              name,
              status
            ),
            class_teachers (
              teachers (
                id,
                name
              )
            )
          )
        `
        );

      if (classStudentError) {
        throw new Error(`读取学生班级关系失败：${classStudentError.message}`);
      }

      const { data: lessonData, error: lessonError } = await supabase
        .from("lesson_records")
        .select("id, class_id, lesson_date")
        .order("lesson_date", { ascending: false });

      if (lessonError) {
        throw new Error(`读取课程记录失败：${lessonError.message}`);
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("lesson_attendance")
        .select("student_id, is_present, lesson_record_id");

      if (attendanceError) {
        throw new Error(`读取出勤记录失败：${attendanceError.message}`);
      }

      const { data: cohortData, error: cohortError } = await supabase
        .from("cohorts")
        .select("id, name, status")
        .order("created_at", { ascending: false });

      if (cohortError) {
        throw new Error(`读取届别失败：${cohortError.message}`);
      }

      const studentRows = (studentData || []) as StudentRow[];
      const classStudentRows = (classStudentData || []) as ClassStudentRow[];
      const lessonRows = (lessonData || []) as LessonRecordRow[];
      const attendanceRows = (attendanceData || []) as AttendanceRow[];

      const formattedStudents: StudentTableItem[] = studentRows.map(
        (student) => {
          const studentClassRelations = classStudentRows.filter(
            (relation) => relation.student_id === student.id
          );

          const classIds = studentClassRelations
            .map((relation) => relation.class_id)
            .filter(Boolean);

          const classNames = studentClassRelations
            .map((relation) => relation.classes?.name)
            .filter(Boolean) as string[];

          const cohortIds = uniqueStrings(
            studentClassRelations
              .map((relation) => relation.classes?.cohorts?.id)
              .filter(Boolean) as string[]
          );

          const subjects = uniqueStrings(
            studentClassRelations
              .map((relation) => relation.classes?.subject)
              .filter(Boolean) as string[]
          );

          const classSummaries = studentClassRelations
            .map((relation) => {
              const classItem = relation.classes;

              if (!classItem) return null;

              const classTeachers = classItem.class_teachers || [];

              const teacherNames = uniqueStrings(
                classTeachers
                  .map((item: any) => item.teachers?.name)
                  .filter(Boolean)
              );

              return {
                classId: relation.class_id,
                className: classItem.name || "未知班级",
                subject: classItem.subject || null,
                teacherNames,
              };
            })
            .filter(Boolean) as StudentClassSummary[];

          const teacherNames = uniqueStrings(
            classSummaries.flatMap((summary) => summary.teacherNames)
          );

          const studentLessons = lessonRows.filter((lesson) => {
            if (!lesson.class_id) return false;
            return classIds.includes(lesson.class_id);
          });

          const lessonIds = new Set(studentLessons.map((lesson) => lesson.id));

          const recentThirtyDaysLessonCount = studentLessons.filter((lesson) =>
            isWithinRecentThirtyDays(lesson.lesson_date)
          ).length;

          const recentLessonDate = studentLessons[0]?.lesson_date || null;

          const studentAttendances = attendanceRows.filter((attendance) => {
            return (
              attendance.student_id === student.id &&
              lessonIds.has(attendance.lesson_record_id)
            );
          });

          const presentCount = studentAttendances.filter(
            (attendance) => attendance.is_present
          ).length;

          const absentCount = studentAttendances.filter(
            (attendance) => !attendance.is_present
          ).length;

          const attendanceRate =
            studentAttendances.length > 0
              ? presentCount / studentAttendances.length
              : null;

          return {
            id: student.id,
            name: student.name,
            note: student.note,
            status: student.status || "active",
            username: student.username,
            grade: student.grade,

            classIds,
            classNames,
            classSummaries,
            cohortIds,
            teacherNames,
            subjects,

            lessonCount: studentLessons.length,
            recentThirtyDaysLessonCount,
            attendanceCount: studentAttendances.length,
            presentCount,
            absentCount,
            attendanceRate,
            recentLessonDate,
          };
        }
      );

      setStudents(formattedStudents);
      setCohorts((cohortData || []) as CohortRow[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取学生数据失败。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  const selectedCohort = useMemo(() => {
    if (selectedCohortId === "all") return null;

    return cohorts.find((cohort) => cohort.id === selectedCohortId) || null;
  }, [cohorts, selectedCohortId]);

  const isSelectedCohortArchived = selectedCohort?.status === "archived";

  const filteredStudents = useMemo(() => {
    const searchText = keyword.trim().toLowerCase();

    let result = students;

    if (selectedCohortId !== "all") {
      result = result.filter((student) =>
        student.cohortIds.includes(selectedCohortId)
      );
    }

    if (!isSelectedCohortArchived) {
      if (selectedStatusView === "current") {
        result = result.filter(isCurrentStudent);
      }

      if (selectedStatusView === "needs_maintenance") {
        result = result.filter(isMaintenanceStudent);
      }

      if (selectedStatusView === "withdrawn") {
        result = result.filter((student) => student.status === "withdrawn");
      }

      if (selectedStatusView === "archived") {
        result = result.filter((student) => student.status === "archived");
      }
    }

    if (searchText) {
      result = result.filter((student) => {
        const searchableText = [
          student.name,
          student.username || "",
          student.grade || "",
          student.note || "",
          student.classNames.join(" "),
          student.teacherNames.join(" "),
          student.subjects.map(getSubjectLabel).join(" "),
          getStudentStatusLabel(student.status),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchText);
      });
    }

    return result;
  }, [
    students,
    selectedCohortId,
    selectedStatusView,
    keyword,
    isSelectedCohortArchived,
  ]);

  const currentStudentCount = useMemo(() => {
    return students.filter(isCurrentStudent).length;
  }, [students]);

  const needsMaintenanceStudentCount = useMemo(() => {
    return students.filter(isMaintenanceStudent).length;
  }, [students]);

  const withdrawnStudentCount = useMemo(() => {
    return students.filter((student) => student.status === "withdrawn").length;
  }, [students]);

  const archivedStudentCount = useMemo(() => {
    return students.filter((student) => student.status === "archived").length;
  }, [students]);

  const averageAttendanceRate = useMemo(() => {
    const studentsWithAttendance = students.filter(
      (student) => isCurrentStudent(student) && student.attendanceRate !== null
    );

    if (studentsWithAttendance.length === 0) return null;

    const total = studentsWithAttendance.reduce(
      (sum, student) => sum + (student.attendanceRate || 0),
      0
    );

    return total / studentsWithAttendance.length;
  }, [students]);

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              Admin / 学生查询
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              学生查询
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/maintenance"
              className="w-fit rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              进入维护中心
            </Link>

            <Link
              href="/admin"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回管理员首页
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">当前学生</p>

            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {currentStudentCount}
            </p>

            <p className="mt-1 text-xs text-stone-500">当前且已绑定班级</p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">待维护</p>

            <p className="mt-2 text-3xl font-bold text-red-700">
              {needsMaintenanceStudentCount}
            </p>

            <p className="mt-1 text-xs text-stone-500">
              状态异常或未绑定班级
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">已退出学生</p>

            <p className="mt-2 text-3xl font-bold text-amber-700">
              {withdrawnStudentCount}
            </p>
          </div>

          <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">已归档学生</p>

            <p className="mt-2 text-3xl font-bold text-stone-600">
              {archivedStudentCount}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">平均出勤率</p>

            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {averageAttendanceRate === null
                ? "暂无"
                : `${Math.round(averageAttendanceRate * 100)}%`}
            </p>

            <p className="mt-1 text-xs text-stone-500">当前学生平均</p>
          </div>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-bold text-emerald-950">学生列表</h2>
            </div>

            <div className="flex flex-col gap-2 md:items-end">
              <div
                className={`grid gap-2 ${
                  isSelectedCohortArchived ? "md:grid-cols-2" : "md:grid-cols-3"
                }`}
              >
                <select
                  value={selectedCohortId}
                  onChange={(event) => setSelectedCohortId(event.target.value)}
                  className="rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="all">全部届别</option>

                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name} -{" "}
                      {cohort.status === "active" ? "运行中" : "已封存"}
                    </option>
                  ))}
                </select>

                {!isSelectedCohortArchived && (
                  <select
                    value={selectedStatusView}
                    onChange={(event) =>
                      setSelectedStatusView(event.target.value)
                    }
                    className="rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="current">当前学生</option>
                    <option value="needs_maintenance">待维护</option>
                    <option value="withdrawn">已退出学生</option>
                    <option value="archived">已归档学生</option>
                  </select>
                )}

                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索学生、学科、班级、老师..."
                  className="rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <p className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
              正在读取学生数据...
            </p>
          ) : filteredStudents.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
              暂时没有找到符合条件的学生。
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-emerald-100">
              <table className="w-full min-w-[1180px] border-collapse bg-white text-left text-sm">
                <thead className="bg-[#fffdf4] text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">学生</th>
                    <th className="px-4 py-3 font-semibold">学科</th>
                    <th className="px-4 py-3 font-semibold">班级 / 小老师</th>
                    <th className="px-4 py-3 font-semibold">出勤率</th>
                    <th className="px-4 py-3 font-semibold">近 30 天</th>
                    <th className="px-4 py-3 font-semibold">上课情况</th>
                    <th className="px-4 py-3 font-semibold">关注状态</th>
                    <th className="px-4 py-3 font-semibold">状态</th>
                    <th className="px-4 py-3 font-semibold">详情</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-emerald-50">
                  {filteredStudents.map((student) => {
                    const attention = getAttentionLabel(student);

                    return (
                      <tr key={student.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="font-bold text-emerald-950">
                            {student.name}
                          </p>

                          <p className="mt-1 text-xs text-stone-500">
                            {student.username || "无用户名"} ·{" "}
                            {student.grade || "未填写年级"}
                          </p>

                          {student.note && (
                            <p className="mt-2 line-clamp-3 max-w-xs text-xs leading-5 text-stone-500">
                              {student.note}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {student.subjects.length === 0 ? (
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">
                              未设置
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {student.subjects.map((subject) => (
                                <span
                                  key={`${student.id}-${subject}`}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getSubjectClassName(
                                    subject
                                  )}`}
                                >
                                  {getSubjectLabel(subject)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {student.classSummaries.length === 0 ? (
                            <p className="text-sm text-red-500">
                              暂未绑定班级
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {student.classSummaries.map((summary) => (
                                <div
                                  key={`${student.id}-${summary.classId}`}
                                  className="rounded-2xl bg-[#fffdf4] px-3 py-2 text-xs text-stone-600"
                                >
                                  <p className="font-semibold text-emerald-950">
                                    {summary.className}
                                  </p>

                                  <p className="mt-1 text-stone-500">
                                    小老师：
                                    {summary.teacherNames.length > 0
                                      ? summary.teacherNames.join("、")
                                      : "暂无"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-4 py-2 text-base font-bold ${getAttendanceRateClassName(
                              student.attendanceRate
                            )}`}
                          >
                            {formatAttendanceRate(student)}
                          </span>

                          <p className="mt-2 text-xs text-stone-500">
                            出勤：{student.presentCount}/
                            {student.attendanceCount}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-2xl font-bold text-emerald-950">
                            {student.recentThirtyDaysLessonCount}
                          </p>

                          <p className="mt-1 text-xs text-stone-500">次课程</p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-emerald-950">
                            {student.lessonCount} 节相关课程
                          </p>

                          <p className="mt-1 text-xs text-stone-500">
                            最近课程：{student.recentLessonDate || "暂无"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${attention.className}`}
                          >
                            {attention.text}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStudentStatusClassName(
                              student.status
                            )}`}
                          >
                            {getStudentStatusLabel(student.status)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/admin/students/${student.id}`}
                            className="rounded-full border border-emerald-700 px-3 py-1.5 text-center text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                          >
                            查看详情
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}