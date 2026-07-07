"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

type StudentRow = {
  id: string;
  name: string;
  note: string | null;
  status: string;
  student_code: string | null;
  pin_code: string | null;
  auth_user_id: string | null;
  created_at: string;
};

type StudentTableItem = {
  id: string;
  name: string;
  note: string | null;
  status: string;
  studentCode: string | null;
  pinCode: string | null;
  authUserId: string | null;

  classIds: string[];
  classNames: string[];
  classDescriptions: string[];
  cohortIds: string[];
  teacherNames: string[];

  lessonCount: number;
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

type ClassRow = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  class_code: string | null;
  cohort_id: string | null;
};

function getStudentStatusLabel(status: string) {
  if (status === "withdrawn") return "已退出";
  if (status === "archived") return "已归档";
  if (status === "delete_requested") return "待删除确认";
  return "当前";
}

function getStudentStatusClassName(status: string) {
  if (status === "withdrawn") return "bg-red-50 text-red-700";
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  return "bg-emerald-50 text-emerald-700";
}

function getAttentionLabel(student: StudentTableItem) {
  if (student.status === "withdrawn") {
    return {
      text: "已退出",
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

function generatePinCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateStudentCode() {
  return `S${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateClassCode(className: string) {
  const cleaned = className
    .replace(/\s/g, "")
    .replace(/班/g, "")
    .slice(0, 3)
    .toUpperCase();

  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${cleaned || "ORP"}${randomPart}`;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentTableItem[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);

  const [selectedCohortId, setSelectedCohortId] = useState("all");
  const [selectedAccountView, setSelectedAccountView] = useState("all");
  const [keyword, setKeyword] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchStudents() {
    setIsLoading(true);
    setMessage("");

    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .select(
        "id, name, note, status, student_code, pin_code, auth_user_id, created_at"
      )
      .order("created_at", { ascending: false });

    if (studentError) {
      setMessage(`读取学生失败：${studentError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: classStudentData, error: classStudentError } = await supabase
      .from("class_students")
      .select(
        `
        student_id,
        class_id,
        classes (
          id,
          name,
          school,
          status,
          class_code,
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
      setMessage(`读取学生班级关系失败：${classStudentError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: lessonData, error: lessonError } = await supabase
      .from("lesson_records")
      .select("id, class_id, lesson_date")
      .order("lesson_date", { ascending: false });

    if (lessonError) {
      setMessage(`读取课程记录失败：${lessonError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: attendanceData, error: attendanceError } = await supabase
      .from("lesson_attendance")
      .select("student_id, is_present, lesson_record_id");

    if (attendanceError) {
      setMessage(`读取出勤记录失败：${attendanceError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: cohortData, error: cohortError } = await supabase
      .from("cohorts")
      .select("id, name, status")
      .order("created_at", { ascending: false });

    if (cohortError) {
      setMessage(`读取届别失败：${cohortError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, name, school, status, class_code, cohort_id")
      .order("created_at", { ascending: false });

    if (classError) {
      setMessage(`读取班级失败：${classError.message}`);
      setIsLoading(false);
      return;
    }

    const studentRows = (studentData || []) as StudentRow[];
    const classStudentRows = (classStudentData || []) as ClassStudentRow[];
    const lessonRows = (lessonData || []) as LessonRecordRow[];
    const attendanceRows = (attendanceData || []) as AttendanceRow[];

    const formattedStudents: StudentTableItem[] = studentRows.map((student) => {
      const studentClassRelations = classStudentRows.filter(
        (relation) => relation.student_id === student.id
      );

      const classIds = studentClassRelations
        .map((relation) => relation.class_id)
        .filter(Boolean);

      const classNames = studentClassRelations
        .map((relation) => relation.classes?.name)
        .filter(Boolean);

      const cohortIds = Array.from(
        new Set(
          studentClassRelations
            .map((relation) => relation.classes?.cohorts?.id)
            .filter(Boolean)
        )
      );

      const classDescriptions = studentClassRelations
        .map((relation) => {
          const classItem = relation.classes;

          if (!classItem) return null;

          const cohortName = classItem.cohorts?.name || "未设置届别";
          const schoolName = classItem.school || "未填写学校";

          return `${classItem.name} · ${cohortName} · ${schoolName}`;
        })
        .filter(Boolean) as string[];

      const teacherNames = Array.from(
        new Set(
          studentClassRelations.flatMap((relation) => {
            const classTeachers = relation.classes?.class_teachers || [];

            return classTeachers
              .map((item: any) => item.teachers?.name)
              .filter(Boolean);
          })
        )
      );

      const studentLessons = lessonRows.filter((lesson) => {
        if (!lesson.class_id) return false;
        return classIds.includes(lesson.class_id);
      });

      const recentLessonDate = studentLessons[0]?.lesson_date || null;

      const studentAttendances = attendanceRows.filter(
        (attendance) => attendance.student_id === student.id
      );

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
        studentCode: student.student_code,
        pinCode: student.pin_code,
        authUserId: student.auth_user_id,

        classIds,
        classNames,
        classDescriptions,
        cohortIds,
        teacherNames,

        lessonCount: studentLessons.length,
        attendanceCount: studentAttendances.length,
        presentCount,
        absentCount,
        attendanceRate,
        recentLessonDate,
      };
    });

    setStudents(formattedStudents);
    setCohorts((cohortData || []) as CohortRow[]);
    setClasses((classData || []) as ClassRow[]);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const searchText = keyword.trim().toLowerCase();

    let result = students;

    if (selectedCohortId !== "all") {
      result = result.filter((student) =>
        student.cohortIds.includes(selectedCohortId)
      );
    }

    if (selectedAccountView === "generated") {
      result = result.filter((student) => student.studentCode && student.pinCode);
    }

    if (selectedAccountView === "missing") {
      result = result.filter(
        (student) => !student.studentCode || !student.pinCode
      );
    }

    if (searchText) {
      result = result.filter((student) => {
        const searchableText = [
          student.name,
          student.note || "",
          student.studentCode || "",
          student.classNames.join(" "),
          student.classDescriptions.join(" "),
          student.teacherNames.join(" "),
          getStudentStatusLabel(student.status),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchText);
      });
    }

    return result;
  }, [students, selectedCohortId, selectedAccountView, keyword]);

  const currentStudentCount = students.filter(
    (student) => student.status !== "archived" && student.status !== "withdrawn"
  ).length;

  const withdrawnStudentCount = students.filter(
    (student) => student.status === "withdrawn"
  ).length;

  const needAttentionCount = students.filter((student) => {
    const attention = getAttentionLabel(student);
    return attention.text === "需要关注" || attention.text === "缺少出勤记录";
  }).length;

  const generatedAccountCount = students.filter(
    (student) => student.studentCode && student.pinCode
  ).length;

  function formatAttendanceRate(student: StudentTableItem) {
    if (student.attendanceRate === null) return "暂无";
    return `${Math.round(student.attendanceRate * 100)}%`;
  }

  async function ensureClassCode(classId: string, className: string) {
    const currentClass = classes.find((classItem) => classItem.id === classId);

    if (currentClass?.class_code) {
      return currentClass.class_code;
    }

    let newClassCode = generateClassCode(className);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { error } = await supabase
        .from("classes")
        .update({
          class_code: newClassCode,
        })
        .eq("id", classId);

      if (!error) {
        return newClassCode;
      }

      newClassCode = generateClassCode(className);
    }

    throw new Error("生成班级码失败，请稍后重试。");
  }

  async function generateLoginForStudent(student: StudentTableItem) {
    if (student.classIds.length === 0) {
      setMessage("生成失败：这个学生还没有绑定班级。请先在班级管理中检查分班关系。");
      return;
    }

    const firstClassId = student.classIds[0];
    const firstClassName = student.classNames[0] || "ORP班级";

    const confirmed = window.confirm(
      `确认为「${student.name}」生成或重置登录信息吗？\n\n学生之后可以用：班级码 + 学生码 + PIN 登录。`
    );

    if (!confirmed) return;

    setMessage("");

    try {
      await ensureClassCode(firstClassId, firstClassName);

      const { error } = await supabase
        .from("students")
        .update({
          student_code: student.studentCode || generateStudentCode(),
          pin_code: generatePinCode(),
        })
        .eq("id", student.id);

      if (error) {
        setMessage(`生成学生登录信息失败：${error.message}`);
        return;
      }

      setMessage(`已为 ${student.name} 生成/重置登录信息。`);
      await fetchStudents();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `生成学生登录信息失败：${error.message}`
          : "生成学生登录信息失败：未知错误。"
      );
    }
  }

  async function generateMissingLoginCodes() {
    const studentsMissingCodes = filteredStudents.filter(
      (student) =>
        student.status !== "archived" &&
        student.status !== "withdrawn" &&
        student.classIds.length > 0 &&
        (!student.studentCode || !student.pinCode)
    );

    if (studentsMissingCodes.length === 0) {
      setMessage("当前筛选范围内没有需要生成登录信息的学生。");
      return;
    }

    const confirmed = window.confirm(
      `确认为当前筛选范围内 ${studentsMissingCodes.length} 名学生批量生成登录信息吗？`
    );

    if (!confirmed) return;

    setIsGeneratingCodes(true);
    setMessage("");

    try {
      let successCount = 0;

      for (const student of studentsMissingCodes) {
        const firstClassId = student.classIds[0];
        const firstClassName = student.classNames[0] || "ORP班级";

        await ensureClassCode(firstClassId, firstClassName);

        const { error } = await supabase
          .from("students")
          .update({
            student_code: student.studentCode || generateStudentCode(),
            pin_code: student.pinCode || generatePinCode(),
          })
          .eq("id", student.id);

        if (!error) {
          successCount += 1;
        }
      }

      setMessage(`已为 ${successCount} 名学生生成登录信息。`);
      await fetchStudents();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `批量生成登录信息失败：${error.message}`
          : "批量生成登录信息失败：未知错误。"
      );
    } finally {
      setIsGeneratingCodes(false);
    }
  }

  async function markStudentWithdrawn(student: StudentTableItem) {
    const reason = window.prompt(
      `确认将「${student.name}」标记为已退出吗？\n\n请填写退出原因，例如：长期未参加课程 / 家长反馈退出 / 联系不上 / 其他。`
    );

    if (reason === null) return;

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setMessage("操作取消：退出原因不能为空。");
      return;
    }

    const confirmed = window.confirm(
      `确认标记「${student.name}」为已退出吗？\n\n退出原因：${trimmedReason}\n\n这个操作不会删除历史课程和出勤记录。`
    );

    if (!confirmed) return;

    const previousNote = student.note?.trim();
    const newNote = previousNote
      ? `${previousNote}\n\n[退出记录] ${new Date()
          .toISOString()
          .slice(0, 10)}：${trimmedReason}`
      : `[退出记录] ${new Date().toISOString().slice(0, 10)}：${trimmedReason}`;

    const { error } = await supabase
      .from("students")
      .update({
        status: "withdrawn",
        note: newNote,
      })
      .eq("id", student.id);

    if (error) {
      setMessage(`标记退出失败：${error.message}`);
      return;
    }

    setMessage(`已将 ${student.name} 标记为已退出。历史记录仍然保留。`);
    await fetchStudents();
  }

  async function restoreStudent(student: StudentTableItem) {
    const confirmed = window.confirm(
      `确认将「${student.name}」恢复为当前学生吗？`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("students")
      .update({
        status: "active",
      })
      .eq("id", student.id);

    if (error) {
      setMessage(`恢复学生状态失败：${error.message}`);
      return;
    }

    setMessage(`已将 ${student.name} 恢复为当前学生。`);
    await fetchStudents();
  }

  return (
    <AdminGuard>
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="mt-2 text-3xl font-bold text-emerald-950">
                学生管理
              </h1>
            </div>
            
            <Link
              href="/admin"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回管理员首页
            </Link>
          </div>

          {message && (
            <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              {message}
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">当前学生</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {currentStudentCount}
              </p>
            </div>

            <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">已退出学生</p>
              <p className="mt-2 text-3xl font-bold text-red-700">
                {withdrawnStudentCount}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">需要关注</p>
              <p className="mt-2 text-3xl font-bold text-amber-700">
                {needAttentionCount}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">已生成登录信息</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {generatedAccountCount}
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">学生列表</h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  重点看学生是否持续参与课程。出勤率过低或缺少出勤记录的学生会被标记为需要关注。
                </p>
              </div>

              <div className="flex flex-col gap-2 md:items-end">
                <div className="grid gap-2 md:grid-cols-3">
                  <select
                    value={selectedCohortId}
                    onChange={(event) => setSelectedCohortId(event.target.value)}
                    className="rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="all">全部届别</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedAccountView}
                    onChange={(event) =>
                      setSelectedAccountView(event.target.value)
                    }
                    className="rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="all">全部账号状态</option>
                    <option value="generated">已生成登录信息</option>
                    <option value="missing">未生成登录信息</option>
                  </select>

                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="搜索学生、班级、老师..."
                    className="rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={generateMissingLoginCodes}
                  disabled={isGeneratingCodes}
                  className="w-fit rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGeneratingCodes ? "生成中..." : "批量生成登录信息"}
                </button>
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
                <table className="w-full min-w-[1100px] border-collapse bg-white text-left text-sm">
                  <thead className="bg-[#fffdf4] text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">学生</th>
                      <th className="px-4 py-3 font-semibold">班级 / 小老师</th>
                      <th className="px-4 py-3 font-semibold">上课情况</th>
                      <th className="px-4 py-3 font-semibold">关注状态</th>
                      <th className="px-4 py-3 font-semibold">登录信息</th>
                      <th className="px-4 py-3 font-semibold">状态</th>
                      <th className="px-4 py-3 font-semibold">操作</th>
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

                            {student.note && (
                              <p className="mt-2 line-clamp-3 max-w-xs text-xs leading-5 text-stone-500">
                                {student.note}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {student.classDescriptions.length === 0 ? (
                              <p className="text-sm text-red-500">
                                暂未绑定班级
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {student.classDescriptions.map((description) => (
                                  <p
                                    key={description}
                                    className="rounded-full bg-[#fffdf4] px-3 py-1 text-xs text-stone-600"
                                  >
                                    {description}
                                  </p>
                                ))}
                              </div>
                            )}

                            <p className="mt-2 text-xs text-stone-500">
                              小老师：
                              {student.teacherNames.length > 0
                                ? student.teacherNames.join("、")
                                : "暂无"}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-semibold text-emerald-950">
                              {student.lessonCount} 节相关课程
                            </p>

                            <p className="mt-1 text-xs text-stone-500">
                              出勤：{student.presentCount}/
                              {student.attendanceCount}
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
                            {student.studentCode && student.pinCode ? (
                              <div className="space-y-1 text-xs">
                                <p>
                                  学生码：
                                  <span className="font-semibold text-emerald-800">
                                    {student.studentCode}
                                  </span>
                                </p>

                                <p>
                                  PIN：
                                  <span className="font-semibold text-emerald-800">
                                    {student.pinCode}
                                  </span>
                                </p>
                              </div>
                            ) : (
                              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">
                                未生成
                              </span>
                            )}
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
                            <div className="flex flex-col gap-2">
                              <Link
                                href={`/admin/students/${student.id}`}
                                className="rounded-full border border-emerald-700 px-3 py-1.5 text-center text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                              >
                                查看详情
                              </Link>

                              {student.status !== "archived" &&
                                student.status !== "withdrawn" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      generateLoginForStudent(student)
                                    }
                                    className="rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                                  >
                                    {student.studentCode && student.pinCode
                                      ? "重置 PIN"
                                      : "生成登录信息"}
                                  </button>
                                )}

                              {student.status !== "archived" &&
                                student.status !== "withdrawn" && (
                                  <button
                                    type="button"
                                    onClick={() => markStudentWithdrawn(student)}
                                    className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                  >
                                    标记退出
                                  </button>
                                )}

                              {student.status === "withdrawn" && (
                                <button
                                  type="button"
                                  onClick={() => restoreStudent(student)}
                                  className="rounded-full border border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                                >
                                  恢复当前
                                </button>
                              )}
                            </div>
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
    </AdminGuard>
  );
}