"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard, { useCurrentAdmin } from "@/components/AdminGuard";

/**
 * admin/classes 页面原则：
 * 1. AdminGuard 负责确认当前用户是否是管理员。
 * 2. 本页面只负责班级统计、查询和详情入口。
 * 3. 批量导入、账号创建、初始密码生成、老师学生绑定，统一放在 /admin/import。
 * 4. 班级基础信息修改、人员调整、删除/恢复等维护操作，统一放到后续的 /admin/maintenance。
 * 5. 本页面仅保留“整届封存”作为学年结束时的集中操作。
 *
 * 学科规则：
 * - classes.subject 存储 english / math
 * - 页面显示中文：英语 / 数学
 * - 学生不单独存 subject，学生学科由 class_students -> classes.subject 推导
 */

type ClassTableItem = {
  id: string;
  name: string;
  school: string | null;
  subject: string | null;
  status: string;
  cohortName: string;
  cohortId: string | null;
  teacherNames: string[];
  studentNames: string[];
};

type CohortItem = {
  id: string;
  name: string;
  status: string;
};

type AdminActionRequest = {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_name: string;
  status: string;
  approvals_count: number;
  required_approvals: number;
  note: string | null;
};

const TOTAL_ADMIN_COUNT = 1;

function getStatusLabel(status: string) {
  if (status === "active") return "运行中";
  if (status === "archived") return "已封存";
  if (status === "delete_requested") return "待维护";
  return status;
}

function getStatusClassName(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-amber-50 text-amber-700";
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

export default function AdminClassesPage() {
  return (
    <AdminGuard>
      <AdminClassesContent />
    </AdminGuard>
  );
}

function AdminClassesContent() {
  const currentAdmin = useCurrentAdmin();
  const currentAdminName = currentAdmin.name;

  const [classes, setClasses] = useState<ClassTableItem[]>([]);
  const [cohorts, setCohorts] = useState<CohortItem[]>([]);
  const [requests, setRequests] = useState<AdminActionRequest[]>([]);

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isClassListOpen, setIsClassListOpen] = useState(true);
  const [selectedClassView, setSelectedClassView] = useState("active");

  const [selectedArchiveCohortId, setSelectedArchiveCohortId] = useState("");
  const [isArchivingCohort, setIsArchivingCohort] = useState(false);

  const activeClasses = useMemo(() => {
    return classes.filter((classItem) => classItem.status === "active");
  }, [classes]);

  const archivedClasses = useMemo(() => {
    return classes.filter((classItem) => classItem.status === "archived");
  }, [classes]);

  const needsMaintenanceClasses = useMemo(() => {
    return classes.filter(
      (classItem) =>
        classItem.status !== "active" && classItem.status !== "archived"
    );
  }, [classes]);

  const filteredClasses = useMemo(() => {
    return classes.filter((classItem) => {
      if (selectedClassView === "active") {
        return classItem.status === "active";
      }

      if (selectedClassView === "needs_maintenance") {
        return (
          classItem.status !== "active" && classItem.status !== "archived"
        );
      }

      return classItem.cohortId === selectedClassView;
    });
  }, [classes, selectedClassView]);

  const archiveRequests = useMemo(() => {
    return requests.filter(
      (request) =>
        request.action_type === "archive_cohort" &&
        request.target_type === "cohort"
    );
  }, [requests]);

  async function fetchCohorts() {
    const { data, error } = await supabase
      .from("cohorts")
      .select("id, name, status")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`读取届别失败：${error.message}`);
    }

    const formattedCohorts = (data || []) as CohortItem[];
    setCohorts(formattedCohorts);

    if (!selectedArchiveCohortId && formattedCohorts.length > 0) {
      const activeCohort = formattedCohorts.find(
        (cohort) => cohort.status === "active"
      );

      setSelectedArchiveCohortId(activeCohort?.id || formattedCohorts[0].id);
    }
  }

  async function fetchRequests() {
    const { data, error } = await supabase
      .from("admin_action_requests")
      .select(
        "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, note"
      )
      .eq("status", "pending")
      .eq("action_type", "archive_cohort")
      .eq("target_type", "cohort")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`读取整届封存申请失败：${error.message}`);
    }

    setRequests((data || []) as AdminActionRequest[]);
  }

  async function fetchClasses() {
    const { data, error } = await supabase
      .from("classes")
      .select(
        `
        id,
        name,
        school,
        subject,
        status,
        cohort_id,
        cohorts(name),
        class_teachers(
          teachers(name)
        ),
        class_students(
          students(name)
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`读取班级失败：${error.message}`);
    }

    const formattedClasses = ((data || []) as any[]).map((classItem) => {
      const teacherNames =
        classItem.class_teachers
          ?.map((item: any) => item.teachers?.name)
          .filter(Boolean) || [];

      const studentNames =
        classItem.class_students
          ?.map((item: any) => item.students?.name)
          .filter(Boolean) || [];

      return {
        id: classItem.id,
        name: classItem.name,
        school: classItem.school,
        subject: classItem.subject,
        status: classItem.status,
        cohortId: classItem.cohort_id,
        cohortName: classItem.cohorts?.name || "未设置届别",
        teacherNames,
        studentNames,
      };
    });

    setClasses(formattedClasses);
  }

  async function refreshData() {
    setIsLoading(true);
    setMessage("");

    try {
      await Promise.all([fetchCohorts(), fetchRequests(), fetchClasses()]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "读取班级管理数据失败。";

      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registerApproval(request: AdminActionRequest) {
    const trimmedAdminName = currentAdmin.name.trim();

    if (!trimmedAdminName) {
      setMessage("当前管理员身份异常，请重新登录。");
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

  async function archiveSelectedCohort() {
    const cohort = cohorts.find(
      (cohortItem) => cohortItem.id === selectedArchiveCohortId
    );

    if (!cohort) {
      setMessage("请先选择要封存的届别。");
      return;
    }

    if (cohort.status === "archived") {
      setMessage("这个届别已经是已封存状态，不需要重复封存。");
      return;
    }

    const typedName = window.prompt(
      `你正在发起封存整个届别：${cohort.name}\n\n这应该只在学年或项目周期结束后操作。\n封存需要所有管理员确认，目前系统设定为 ${TOTAL_ADMIN_COUNT} 位管理员。\n\n封存完成后：该届班级会封存；只属于该届的老师和学生也会同步归档。\n\n请输入届别名称以确认：`
    );

    if (typedName !== cohort.name) {
      setMessage("封存已取消：输入的届别名称不匹配。");
      return;
    }

    setIsArchivingCohort(true);
    setMessage("");

    try {
      const { data: existingRequest, error: existingRequestError } =
        await supabase
          .from("admin_action_requests")
          .select("id")
          .eq("action_type", "archive_cohort")
          .eq("target_type", "cohort")
          .eq("target_id", cohort.id)
          .eq("status", "pending")
          .maybeSingle();

      if (existingRequestError) {
        throw new Error(existingRequestError.message);
      }

      if (existingRequest) {
        setMessage("这个届别已经有封存申请，不需要重复提交。");
        return;
      }

      const { error: requestError } = await supabase
        .from("admin_action_requests")
        .insert({
          action_type: "archive_cohort",
          target_type: "cohort",
          target_id: cohort.id,
          target_name: cohort.name,
          status: "pending",
          approvals_count: 0,
          required_approvals: TOTAL_ADMIN_COUNT,
          requested_by: currentAdminName,
          note: "学年结束，申请封存整届班级，并同步归档只属于该届的老师和学生。",
        });

      if (requestError) {
        throw new Error(requestError.message);
      }

      setMessage(
        `${cohort.name} 的封存申请已提交。需要 ${TOTAL_ADMIN_COUNT} 位管理员全部确认后，才会正式封存这一届。`
      );

      await refreshData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `封存申请失败：${error.message}`
          : "封存申请失败：未知错误。"
      );
    } finally {
      setIsArchivingCohort(false);
    }
  }

  async function approveArchiveCohort(request: AdminActionRequest) {
    const confirmed = window.confirm(
      `确认批准封存整届吗？\n\n届别：${request.target_name}\n当前确认数：${request.approvals_count}/${request.required_approvals}\n\n同一管理员不能重复确认。`
    );

    if (!confirmed) return;

    const approvalCount = await registerApproval(request);

    if (approvalCount === null) return;

    if (approvalCount < request.required_approvals) {
      setMessage(
        `已记录一次确认。封存整届还需要 ${
          request.required_approvals - approvalCount
        } 次确认。`
      );

      await refreshData();
      return;
    }

    const { data: cohortClasses, error: cohortClassesError } = await supabase
      .from("classes")
      .select("id")
      .eq("cohort_id", request.target_id);

    if (cohortClassesError) {
      setMessage(`读取该届班级失败：${cohortClassesError.message}`);
      return;
    }

    const cohortClassIds = (cohortClasses || []).map(
      (classItem) => classItem.id
    );

    const { data: teacherRelations, error: teacherRelationError } =
      await supabase
        .from("class_teachers")
        .select("teacher_id, class_id")
        .in("class_id", cohortClassIds.length > 0 ? cohortClassIds : [""]);

    if (teacherRelationError) {
      setMessage(`读取该届小老师失败：${teacherRelationError.message}`);
      return;
    }

    const { data: studentRelations, error: studentRelationError } =
      await supabase
        .from("class_students")
        .select("student_id, class_id")
        .in("class_id", cohortClassIds.length > 0 ? cohortClassIds : [""]);

    if (studentRelationError) {
      setMessage(`读取该届学生失败：${studentRelationError.message}`);
      return;
    }

    const relatedTeacherIds = Array.from(
      new Set((teacherRelations || []).map((relation) => relation.teacher_id))
    );

    const relatedStudentIds = Array.from(
      new Set((studentRelations || []).map((relation) => relation.student_id))
    );

    const { error: classError } = await supabase
      .from("classes")
      .update({
        status: "archived",
      })
      .eq("cohort_id", request.target_id);

    if (classError) {
      setMessage(`封存班级失败：${classError.message}`);
      return;
    }

    const { error: cohortError } = await supabase
      .from("cohorts")
      .update({
        status: "archived",
      })
      .eq("id", request.target_id);

    if (cohortError) {
      setMessage(`封存届别失败：${cohortError.message}`);
      return;
    }

    const { data: activeClassesAfterArchive, error: activeClassesError } =
      await supabase.from("classes").select("id").eq("status", "active");

    if (activeClassesError) {
      setMessage(`检查运行中班级失败：${activeClassesError.message}`);
      return;
    }

    const activeClassIds = new Set(
      (activeClassesAfterArchive || []).map((classItem) => classItem.id)
    );

    if (relatedTeacherIds.length > 0) {
      const { data: allTeacherRelations, error: allTeacherRelationError } =
        await supabase
          .from("class_teachers")
          .select("teacher_id, class_id")
          .in("teacher_id", relatedTeacherIds);

      if (allTeacherRelationError) {
        setMessage(
          `检查小老师是否仍有运行中班级失败：${allTeacherRelationError.message}`
        );
        return;
      }

      const teachersStillActive = new Set(
        (allTeacherRelations || [])
          .filter((relation) => activeClassIds.has(relation.class_id))
          .map((relation) => relation.teacher_id)
      );

      const teachersToArchive = relatedTeacherIds.filter(
        (teacherId) => !teachersStillActive.has(teacherId)
      );

      if (teachersToArchive.length > 0) {
        const { error: teacherArchiveError } = await supabase
          .from("teachers")
          .update({ status: "archived" })
          .in("id", teachersToArchive);

        if (teacherArchiveError) {
          setMessage(`同步归档小老师失败：${teacherArchiveError.message}`);
          return;
        }
      }
    }

    if (relatedStudentIds.length > 0) {
      const { data: allStudentRelations, error: allStudentRelationError } =
        await supabase
          .from("class_students")
          .select("student_id, class_id")
          .in("student_id", relatedStudentIds);

      if (allStudentRelationError) {
        setMessage(
          `检查学生是否仍有运行中班级失败：${allStudentRelationError.message}`
        );
        return;
      }

      const studentsStillActive = new Set(
        (allStudentRelations || [])
          .filter((relation) => activeClassIds.has(relation.class_id))
          .map((relation) => relation.student_id)
      );

      const studentsToArchive = relatedStudentIds.filter(
        (studentId) => !studentsStillActive.has(studentId)
      );

      if (studentsToArchive.length > 0) {
        const { error: studentArchiveError } = await supabase
          .from("students")
          .update({ status: "archived" })
          .in("id", studentsToArchive);

        if (studentArchiveError) {
          setMessage(`同步归档学生失败：${studentArchiveError.message}`);
          return;
        }
      }
    }

    const { error: requestError } = await supabase
      .from("admin_action_requests")
      .update({
        approvals_count: approvalCount,
        status: "completed",
        note: "整届已封存；只属于该届的老师和学生已同步归档。",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestError) {
      setMessage(`更新封存申请失败：${requestError.message}`);
      return;
    }

    setMessage(
      `${request.target_name} 已正式封存。该届班级已封存；只属于这一届的老师和学生也已同步归档。`
    );

    setSelectedClassView("active");
    await refreshData();
  }

  async function cancelArchiveCohortRequest(request: AdminActionRequest) {
    const confirmed = window.confirm(
      `确认取消封存申请吗？\n\n届别：${request.target_name}\n\n取消后，这一届不会被封存，所有班级状态保持不变。`
    );

    if (!confirmed) return;

    const { error: approvalError } = await supabase
      .from("admin_action_approvals")
      .delete()
      .eq("request_id", request.id);

    if (approvalError) {
      setMessage(`清除确认记录失败：${approvalError.message}`);
      return;
    }

    const { error } = await supabase
      .from("admin_action_requests")
      .update({
        status: "canceled",
        approvals_count: 0,
        note: "封存申请已取消。",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      setMessage(`取消封存申请失败：${error.message}`);
      return;
    }

    setMessage(`${request.target_name} 的封存申请已取消。`);
    await refreshData();
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-600">正在读取班级管理数据...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              班级与分班查询
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/import"
              className="w-fit rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              导入账号
            </Link>

            <Link
              href="/admin"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回管理员主页
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-100 bg-white p-4 text-sm font-semibold text-emerald-800 shadow-sm">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-bold text-emerald-950">
                已导入班级
              </h2>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <div className="flex flex-col gap-2 md:flex-row">
                <select
                  value={selectedClassView}
                  onChange={(event) => setSelectedClassView(event.target.value)}
                  className="w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-2.5 text-sm outline-none focus:border-emerald-500 md:w-64"
                >
                  <option value="active">当前运行中班级</option>
                  <option value="needs_maintenance">待维护状态班级</option>

                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name} -{" "}
                      {cohort.status === "active" ? "运行中" : "已封存"}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsClassListOpen((prev) => !prev)}
                  className="rounded-2xl border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                >
                  {isClassListOpen ? "收起列表" : "展开列表"}
                </button>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  运行中 {activeClasses.length}
                </span>

                <span className="w-fit rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
                  已封存 {archivedClasses.length}
                </span>

                <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  待维护 {needsMaintenanceClasses.length}
                </span>

                <span className="w-fit rounded-full bg-[#fffdf4] px-3 py-1.5 text-xs font-semibold text-stone-600">
                  当前显示 {filteredClasses.length}
                </span>
              </div>
            </div>
          </div>

          {!isClassListOpen ? (
            <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
              班级列表已收起。当前筛选条件下共有 {filteredClasses.length}{" "}
              个班级。
            </p>
          ) : filteredClasses.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
              当前筛选条件下没有班级。你可以切换届别筛选，或者进入导入页面添加新班级。
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-emerald-100">
              <table className="w-full min-w-[1080px] border-collapse bg-white text-left text-sm">
                <thead className="bg-[#fffdf4] text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">届别</th>
                    <th className="px-4 py-3 font-semibold">班级</th>
                    <th className="px-4 py-3 font-semibold">学科</th>
                    <th className="px-4 py-3 font-semibold">合作学校</th>
                    <th className="px-4 py-3 font-semibold">小老师</th>
                    <th className="px-4 py-3 font-semibold">学生名单</th>
                    <th className="px-4 py-3 font-semibold">人数</th>
                    <th className="px-4 py-3 font-semibold">状态</th>
                    <th className="px-4 py-3 font-semibold">详情</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClasses.map((classItem) => (
                    <tr
                      key={classItem.id}
                      className="border-t border-emerald-50"
                    >
                      <td className="px-4 py-4 align-top text-stone-600">
                        {classItem.cohortName}
                      </td>

                      <td className="px-4 py-4 align-top font-bold text-emerald-950">
                        {classItem.name}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getSubjectClassName(
                            classItem.subject
                          )}`}
                        >
                          {getSubjectLabel(classItem.subject)}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top text-stone-600">
                        {classItem.school || "暂未填写"}
                      </td>

                      <td className="px-4 py-4 align-top text-stone-600">
                        {classItem.teacherNames.length > 0
                          ? classItem.teacherNames.join("、")
                          : "暂未分配"}
                      </td>

                      <td className="px-4 py-4 align-top text-stone-600">
                        <div className="flex flex-wrap gap-2">
                          {classItem.studentNames.length > 0 ? (
                            classItem.studentNames.map((studentName, index) => (
                              <span
                                key={`${classItem.id}-${studentName}-${index}`}
                                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                              >
                                {studentName}
                              </span>
                            ))
                          ) : (
                            <span className="text-stone-400">暂无学生</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top font-semibold text-stone-700">
                        {classItem.studentNames.length}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(
                            classItem.status
                          )}`}
                        >
                          {getStatusLabel(classItem.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <Link
                          href={`/admin/classes/${classItem.id}`}
                          className="rounded-full bg-[#2f5d50] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-900"
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}