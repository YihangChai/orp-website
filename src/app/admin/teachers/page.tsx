"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

const DELETE_TEACHER_REQUIRED_APPROVALS = 2;

type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  auth_user_id: string | null;
  created_at: string;
};

type TeacherTableItem = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  authUserId: string | null;
  classNames: string[];
  classDescriptions: string[];
  classIds: string[];
  cohortIds: string[];
  studentCount: number;
  lessonCount: number;
  totalMinutes: number;
  recentLessonDate: string | null;
  recentFourWeeksCount: number;
};

type ClassTeacherRow = {
  teacher_id: string;
  class_id: string;
  classes: any;
};

type ClassStudentRow = {
  class_id: string;
  student_id: string;
};

type LessonRecordRow = {
  id: string;
  teacher_id: string | null;
  class_id: string | null;
  lesson_date: string;
  duration_minutes: number;
};

type CohortRow = {
  id: string;
  name: string;
  status: string;
};

type PendingRequest = {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_name: string;
  status: string;
  approvals_count: number;
  required_approvals: number;
  requested_by: string | null;
  note: string | null;
  created_at: string;
};

function getTeacherStatusLabel(status: string) {
  if (status === "archived") return "已归档";
  if (status === "delete_requested") return "待删除确认";
  return "当前";
}

function getTeacherStatusClassName(status: string) {
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  return "bg-emerald-50 text-emerald-700";
}

function getActionLabel(actionType: string) {
  if (actionType === "delete_teacher") return "删除小老师";
  return actionType;
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

function getRecentFourWeeksCount(lessons: LessonRecordRow[]) {
  const today = new Date();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(today.getDate() - 28);

  const recentLessons = lessons.filter((lesson) => {
    const lessonDate = new Date(lesson.lesson_date);
    return lessonDate >= fourWeeksAgo && lessonDate <= today;
  });

  const weekKeys = new Set<string>();

  recentLessons.forEach((lesson) => {
    weekKeys.add(getMondayKey(lesson.lesson_date));
  });

  return weekKeys.size;
}

function formatHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherTableItem[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  const [keyword, setKeyword] = useState("");
  const [selectedTeacherView, setSelectedTeacherView] = useState("current");
  const [currentAdminName, setCurrentAdminName] = useState("");

  const [isTeacherListOpen, setIsTeacherListOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function fetchTeachers() {
    setIsLoading(true);
    setMessage("");

    const { data: teacherData, error: teacherError } = await supabase
      .from("teachers")
      .select("id, name, email, status, auth_user_id, created_at")
      .order("created_at", { ascending: false });

    if (teacherError) {
      setMessage(`读取小老师失败：${teacherError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: classTeacherData, error: classTeacherError } = await supabase
      .from("class_teachers")
      .select(
        `
        teacher_id,
        class_id,
        classes (
          id,
          name,
          school,
          status,
          cohorts (
            id,
            name
          )
        )
      `
      );

    if (classTeacherError) {
      setMessage(`读取小老师班级关系失败：${classTeacherError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: classStudentData, error: classStudentError } = await supabase
      .from("class_students")
      .select("class_id, student_id");

    if (classStudentError) {
      setMessage(`读取班级学生关系失败：${classStudentError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: lessonData, error: lessonError } = await supabase
      .from("lesson_records")
      .select("id, teacher_id, class_id, lesson_date, duration_minutes")
      .order("lesson_date", { ascending: false });

    if (lessonError) {
      setMessage(`读取课程记录失败：${lessonError.message}`);
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

    const { data: requestData, error: requestError } = await supabase
      .from("admin_action_requests")
      .select(
        "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, requested_by, note, created_at"
      )
      .eq("action_type", "delete_teacher")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (requestError) {
      setMessage(`读取待处理操作失败：${requestError.message}`);
      setIsLoading(false);
      return;
    }

    const teacherRows = (teacherData || []) as TeacherRow[];
    const classTeacherRows = (classTeacherData || []) as ClassTeacherRow[];
    const classStudentRows = (classStudentData || []) as ClassStudentRow[];
    const lessonRows = (lessonData || []) as LessonRecordRow[];

    const formattedTeachers: TeacherTableItem[] = teacherRows.map((teacher) => {
      const teacherClassRelations = classTeacherRows.filter(
        (relation) => relation.teacher_id === teacher.id
      );

      const classIds = teacherClassRelations
        .map((relation) => relation.class_id)
        .filter(Boolean);

      const classNames = teacherClassRelations
        .map((relation) => relation.classes?.name)
        .filter(Boolean);

      const cohortIds = Array.from(
        new Set(
          teacherClassRelations
            .map((relation) => relation.classes?.cohorts?.id)
            .filter(Boolean)
        )
      );

      const classDescriptions = teacherClassRelations
        .map((relation) => {
          const classItem = relation.classes;

          if (!classItem) return null;

          const cohortName = classItem.cohorts?.name || "未设置届别";
          const schoolName = classItem.school || "未填写学校";

          return `${classItem.name} · ${cohortName} · ${schoolName}`;
        })
        .filter(Boolean) as string[];

      const studentIds = new Set<string>();

      classStudentRows.forEach((relation) => {
        if (classIds.includes(relation.class_id)) {
          studentIds.add(relation.student_id);
        }
      });

      const teacherLessons = lessonRows.filter((lesson) => {
        return lesson.teacher_id === teacher.id;
      });

      const totalMinutes = teacherLessons.reduce(
        (sum, lesson) => sum + (lesson.duration_minutes || 0),
        0
      );

      const sortedLessons = [...teacherLessons].sort(
        (a, b) =>
          new Date(b.lesson_date).getTime() -
          new Date(a.lesson_date).getTime()
      );

      return {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        status: teacher.status || "active",
        authUserId: teacher.auth_user_id,
        classNames,
        classDescriptions,
        classIds,
        cohortIds,
        studentCount: studentIds.size,
        lessonCount: teacherLessons.length,
        totalMinutes,
        recentLessonDate: sortedLessons[0]?.lesson_date || null,
        recentFourWeeksCount: getRecentFourWeeksCount(teacherLessons),
      };
    });

    setTeachers(formattedTeachers);
    setCohorts((cohortData || []) as CohortRow[]);
    setPendingRequests((requestData || []) as PendingRequest[]);
    setIsLoading(false);
  }

  async function handleRequestDeleteTeacher(
    teacherId: string,
    teacherName: string
  ) {
    const confirmed = window.confirm(
      `确定要发起删除「${teacherName}」的申请吗？需要 ${DELETE_TEACHER_REQUIRED_APPROVALS} 位管理员确认。没有课程记录会物理删除；有课程记录会归档。`
    );

    if (!confirmed) return;

    const existingRequest = pendingRequests.find(
      (request) =>
        request.action_type === "delete_teacher" &&
        request.target_id === teacherId &&
        request.status === "pending"
    );

    if (existingRequest) {
      setMessage("这个小老师已经有待处理的删除申请。");
      return;
    }

    const { error: requestError } = await supabase
      .from("admin_action_requests")
      .insert({
        action_type: "delete_teacher",
        target_type: "teacher",
        target_id: teacherId,
        target_name: teacherName,
        status: "pending",
        approvals_count: 0,
        required_approvals: DELETE_TEACHER_REQUIRED_APPROVALS,
        requested_by: "当前管理员",
        note: "删除小老师申请。无课程记录则物理删除；有课程记录则归档。",
      });

    if (requestError) {
      setMessage(`创建删除申请失败：${requestError.message}`);
      return;
    }

    const { error: teacherError } = await supabase
      .from("teachers")
      .update({ status: "delete_requested" })
      .eq("id", teacherId);

    if (teacherError) {
      setMessage(`删除申请已创建，但更新老师状态失败：${teacherError.message}`);
      fetchTeachers();
      return;
    }

    setMessage(`已发起删除申请：${teacherName}`);
    fetchTeachers();
  }

  async function registerApproval(request: PendingRequest) {
    const trimmedAdminName = currentAdminName.trim();

    if (!trimmedAdminName) {
      setMessage("请先在高风险操作区填写当前管理员姓名。");
      return null;
    }

    const { error: approvalError } = await supabase
      .from("admin_action_approvals")
      .insert({
        request_id: request.id,
        admin_name: trimmedAdminName,
      });

    if (approvalError) {
      if (
        approvalError.message.includes("duplicate") ||
        approvalError.message.includes("unique")
      ) {
        setMessage(
          `管理员「${trimmedAdminName}」已经确认过这项申请，不能重复确认。`
        );
      } else {
        setMessage(`记录确认失败：${approvalError.message}`);
      }

      return null;
    }

    const { count, error: countError } = await supabase
      .from("admin_action_approvals")
      .select("id", { count: "exact", head: true })
      .eq("request_id", request.id);

    if (countError) {
      setMessage(`统计确认次数失败：${countError.message}`);
      return null;
    }

    const approvalCount = count || 0;

    const { error: updateError } = await supabase
      .from("admin_action_requests")
      .update({
        approvals_count: approvalCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (updateError) {
      setMessage(`更新确认次数失败：${updateError.message}`);
      return null;
    }

    return approvalCount;
  }

  async function handleApproveTeacherRequest(request: PendingRequest) {
    const approvalCount = await registerApproval(request);

    if (approvalCount === null) return;

    if (approvalCount < request.required_approvals) {
      setMessage(
        `已确认，还需要 ${request.required_approvals - approvalCount} 位管理员确认。`
      );
      fetchTeachers();
      return;
    }

    const { count: lessonCount, error: lessonCountError } = await supabase
      .from("lesson_records")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", request.target_id);

    if (lessonCountError) {
      setMessage(`检查课程记录失败：${lessonCountError.message}`);
      return;
    }

    if ((lessonCount || 0) > 0) {
      const { error: archiveError } = await supabase
        .from("teachers")
        .update({ status: "archived" })
        .eq("id", request.target_id);

      if (archiveError) {
        setMessage(`归档小老师失败：${archiveError.message}`);
        return;
      }
    } else {
      const { error: relationDeleteError } = await supabase
        .from("class_teachers")
        .delete()
        .eq("teacher_id", request.target_id);

      if (relationDeleteError) {
        setMessage(`删除老师班级关系失败：${relationDeleteError.message}`);
        return;
      }

      const { error: teacherDeleteError } = await supabase
        .from("teachers")
        .delete()
        .eq("id", request.target_id);

      if (teacherDeleteError) {
        setMessage(`删除小老师失败：${teacherDeleteError.message}`);
        return;
      }
    }

    const { error: completeError } = await supabase
      .from("admin_action_requests")
      .update({
        approvals_count: approvalCount,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (completeError) {
      setMessage(`操作已执行，但更新申请状态失败：${completeError.message}`);
      fetchTeachers();
      return;
    }

    setMessage(`删除/归档已完成：${request.target_name}`);
    fetchTeachers();
  }

  async function handleCancelRequest(request: PendingRequest) {
    const confirmed = window.confirm(
      `确定要撤回「${request.target_name}」的申请吗？`
    );

    if (!confirmed) return;

    const { error: approvalDeleteError } = await supabase
      .from("admin_action_approvals")
      .delete()
      .eq("request_id", request.id);

    if (approvalDeleteError) {
      setMessage(`清除确认记录失败：${approvalDeleteError.message}`);
      return;
    }

    const { error: requestError } = await supabase
      .from("admin_action_requests")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestError) {
      setMessage(`撤回申请失败：${requestError.message}`);
      return;
    }

    const { error: teacherError } = await supabase
      .from("teachers")
      .update({ status: "active" })
      .eq("id", request.target_id);

    if (teacherError) {
      setMessage(`申请已撤回，但恢复老师状态失败：${teacherError.message}`);
      fetchTeachers();
      return;
    }

    setMessage(`已撤回申请：${request.target_name}`);
    fetchTeachers();
  }

  useEffect(() => {
    fetchTeachers();
  }, []);

  const filteredTeachers = useMemo(() => {
    const searchText = keyword.trim().toLowerCase();

    const viewFilteredTeachers = teachers.filter((teacher) => {
      if (selectedTeacherView === "current") {
        return teacher.status !== "archived";
      }

      return teacher.cohortIds.includes(selectedTeacherView);
    });

    if (!searchText) return viewFilteredTeachers;

    return viewFilteredTeachers.filter((teacher) => {
      const searchableText = [
        teacher.name,
        teacher.email || "",
        teacher.classNames.join(" "),
        teacher.classDescriptions.join(" "),
        getTeacherStatusLabel(teacher.status),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchText);
    });
  }, [keyword, selectedTeacherView, teachers]);

  const currentTeacherCount = teachers.filter(
    (teacher) => teacher.status !== "archived"
  ).length;

  const archivedTeacherCount = teachers.filter(
    (teacher) => teacher.status === "archived"
  ).length;

  const unboundTeacherCount = teachers.filter(
    (teacher) => !teacher.authUserId
  ).length;

  const totalLessonCount = teachers.reduce(
    (sum, teacher) => sum + teacher.lessonCount,
    0
  );

  return (
    <AdminGuard>
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold text-[#2f5d50]">
                Admin / 小老师管理
              </p>

              <h1 className="mt-2 text-3xl font-bold text-emerald-950">
                小老师管理
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                小老师由班级管理中的分班导入自动创建。这里用于查看小老师、核对负责班级、处理账号绑定和删除错建资料。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
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

          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">在任小老师</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {currentTeacherCount}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">已归档小老师</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {archivedTeacherCount}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">未绑定账号</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {unboundTeacherCount}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                账号系统接入后会逐步减少
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">课程记录</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {totalLessonCount}
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-[1.75rem] border border-dashed border-emerald-200 bg-[#fffdf4] p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              邮件邀请注册 / 账号绑定
            </h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              小老师资料应该先通过班级管理导入并绑定到具体班级，避免出现没有任何班级关系的孤立老师档案。正式接入 Supabase Auth 后，这里会用于根据邮箱发送邀请链接。
            </p>

            <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-stone-600">
              <p className="font-semibold text-emerald-950">
                当前状态：暂未接入账号创建
              </p>

              <div className="mt-3 space-y-2 leading-7">
                <p>1. 班级管理导入分班表时，系统自动创建小老师档案。</p>
                <p>2. 小老师必须通过 class_teachers 关系绑定到班级。</p>
                <p>3. 之后系统根据邮箱发送注册邀请。</p>
                <p>4. 小老师自己设置密码，不由管理员手动保存密码。</p>
                <p>5. 登录账号生成后，写入 teachers.auth_user_id。</p>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">
                  小老师列表
                </h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  默认显示在任小老师。选择具体届别后，可以查看该届相关小老师，包括已归档成员。
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <select
                  value={selectedTeacherView}
                  onChange={(event) => setSelectedTeacherView(event.target.value)}
                  className="w-full rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none transition focus:border-emerald-500 focus:bg-white md:w-64"
                >
                  <option value="current">在任小老师</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </option>
                  ))}
                </select>

                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索小老师、班级、邮箱..."
                  className="w-full rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none transition focus:border-emerald-500 focus:bg-white md:w-80"
                />

                <button
                  onClick={() => setIsTeacherListOpen((prev) => !prev)}
                  className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                >
                  {isTeacherListOpen ? "收起列表" : "展开列表"}
                </button>
              </div>
            </div>

            {!isTeacherListOpen ? (
              <div className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
                小老师列表已收起。当前共有 {filteredTeachers.length} 位符合条件的小老师。
              </div>
            ) : isLoading ? (
              <p className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
                正在读取小老师数据...
              </p>
            ) : filteredTeachers.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
                暂时没有找到符合条件的小老师。
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-emerald-100">
                <table className="w-full min-w-[1050px] border-collapse bg-white text-left text-sm">
                  <thead className="bg-[#fffdf4] text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">小老师</th>
                      <th className="px-4 py-3 font-semibold">负责班级</th>
                      <th className="px-4 py-3 font-semibold">学生</th>
                      <th className="px-4 py-3 font-semibold">课程</th>
                      <th className="px-4 py-3 font-semibold">近 4 周</th>
                      <th className="px-4 py-3 font-semibold">最近上课</th>
                      <th className="px-4 py-3 font-semibold">状态</th>
                      <th className="px-4 py-3 font-semibold">账号</th>
                      <th className="px-4 py-3 font-semibold">操作</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-emerald-50">
                    {filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="font-bold text-emerald-950">
                            {teacher.name}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {teacher.email || "暂未填写邮箱"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {teacher.classDescriptions.length === 0 ? (
                            <p className="text-sm text-red-500">
                              暂未分配班级
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {teacher.classDescriptions.map((description) => (
                                <p
                                  key={description}
                                  className="rounded-full bg-[#fffdf4] px-3 py-1 text-xs text-stone-600"
                                >
                                  {description}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-emerald-950">
                            {teacher.studentCount}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">名学生</p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-emerald-950">
                            {teacher.lessonCount}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {formatHours(teacher.totalMinutes)} 小时
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-emerald-950">
                            {teacher.recentFourWeeksCount}/4 周
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            暂不判断是否需关注
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-sm text-stone-700">
                            {teacher.recentLessonDate || "暂无记录"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getTeacherStatusClassName(
                              teacher.status
                            )}`}
                          >
                            {getTeacherStatusLabel(teacher.status)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              teacher.authUserId
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            {teacher.authUserId ? "已绑定" : "未绑定"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <Link
                              href={`/admin/teachers/${teacher.id}`}
                              className="rounded-full border border-emerald-700 px-3 py-1.5 text-center text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                            >
                              查看详情
                            </Link>

                            {teacher.status !== "archived" &&
                              teacher.status !== "delete_requested" && (
                                <button
                                  onClick={() =>
                                    handleRequestDeleteTeacher(
                                      teacher.id,
                                      teacher.name
                                    )
                                  }
                                  className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                >
                                  删除申请
                                </button>
                              )}

                            {teacher.status === "delete_requested" && (
                              <p className="text-xs text-red-500">等待确认</p>
                            )}

                            {teacher.status === "archived" && (
                              <p className="text-xs text-stone-500">
                                已归档，不可修改
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            id="danger-zone"
            className="mt-10 rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm md:p-6"
          >
            <h2 className="text-xl font-bold text-emerald-950">高风险操作</h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              这里仅处理单个小老师的删除申请。整届归档请在班级管理中通过“学年结束与整届封存”统一完成。
              同一位管理员不能重复确认同一项申请。
            </p>

            <div className="mt-5 rounded-2xl bg-[#fffdf4] p-4">
              <p className="font-semibold text-emerald-950">当前确认管理员</p>

              <p className="mt-2 text-sm leading-7 text-stone-600">
                现在还没有正式登录系统，所以先用管理员姓名模拟。之后接入 Auth 后，会自动使用当前登录管理员账号。
              </p>

              <input
                value={currentAdminName}
                onChange={(event) => setCurrentAdminName(event.target.value)}
                placeholder="填写当前管理员姓名，例如 Ethan"
                className="mt-3 w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 md:w-96"
              />
            </div>

            <div className="mt-5 rounded-2xl bg-[#fffdf4] p-4">
              <p className="font-semibold text-emerald-950">待确认操作</p>

              {pendingRequests.length === 0 ? (
                <p className="mt-3 text-sm text-stone-600">暂无待确认操作。</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="rounded-2xl bg-white p-4">
                      <p className="font-semibold text-emerald-950">
                        {getActionLabel(request.action_type)}：
                        {request.target_name}
                      </p>

                      <p className="mt-1 text-xs text-stone-500">
                        已确认 {request.approvals_count}/
                        {request.required_approvals}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => handleApproveTeacherRequest(request)}
                          className="rounded-full bg-[#2f5d50] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-900"
                        >
                          确认一次
                        </button>

                        <button
                          onClick={() => handleCancelRequest(request)}
                          className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
                        >
                          撤回申请
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    </AdminGuard>
  );
}