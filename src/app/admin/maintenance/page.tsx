"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import {
  approveMaintenanceRequest,
  cancelMaintenanceRequest,
  createMaintenanceRequest,
  fetchMaintenanceOverview,
} from "@/lib/admin-maintenance/client";
import type {
  AdminActionApproval,
  AdminActionRequest,
  MaintenanceClassItem,
  MaintenanceCohortItem,
  MaintenanceStudentItem,
  MaintenanceTeacherItem,
} from "@/lib/admin-maintenance/types";

type ClassTeacherRelation = {
  class_id: string;
  teacher_id: string;
};

type ClassStudentRelation = {
  class_id: string;
  student_id: string;
};

type OverviewData = {
  activeAdminCount: number;
  cohorts: MaintenanceCohortItem[];
  classes: MaintenanceClassItem[];
  teachers: MaintenanceTeacherItem[];
  students: MaintenanceStudentItem[];
  classTeachers: ClassTeacherRelation[];
  classStudents: ClassStudentRelation[];
  requests: AdminActionRequest[];
  approvals: AdminActionApproval[];
};

type ResetPasswordResult = {
  role: "teacher" | "student";
  name: string;
  account: string | null;
  newPassword: string;
};

function getActionLabel(actionType: string) {
  if (actionType === "archive_cohort") return "整届封存";
  if (actionType === "delete_class") return "删除/封存班级";
  if (actionType === "delete_teacher") return "删除/归档小老师";
  if (actionType === "delete_student") return "删除/归档学生";
  if (actionType === "update_class_info") return "修改班级信息";
  if (actionType === "add_teacher_to_class") return "添加小老师";
  if (actionType === "remove_teacher_from_class") return "移除小老师";
  if (actionType === "add_student_to_class") return "添加学生";
  if (actionType === "remove_student_from_class") return "移除学生";
  if (actionType === "reset_teacher_password") return "重置小老师密码";
  if (actionType === "reset_student_password") return "重置学生密码";
  return actionType;
}

function getTargetTypeLabel(targetType: string) {
  if (targetType === "cohort") return "届别";
  if (targetType === "class") return "班级";
  if (targetType === "teacher") return "小老师";
  if (targetType === "student") return "学生";
  return targetType;
}

function getStatusLabel(status: string) {
  if (status === "active") return "运行中";
  if (status === "archived") return "已封存";
  if (status === "withdrawn") return "已退出";
  if (status === "delete_requested") return "待维护";
  return status;
}

function getStatusClassName(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "withdrawn") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export default function AdminMaintenancePage() {
  return (
    <AdminGuard>
      <AdminMaintenanceContent />
    </AdminGuard>
  );
}

function AdminMaintenanceContent() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [resetPasswordResult, setResetPasswordResult] =
    useState<ResetPasswordResult | null>(null);

  const [classKeyword, setClassKeyword] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  const [editClassName, setEditClassName] = useState("");
  const [editClassSchool, setEditClassSchool] = useState("");

  const [teacherKeyword, setTeacherKeyword] = useState("");
  const [studentKeyword, setStudentKeyword] = useState("");

  const [selectedTeacherToAdd, setSelectedTeacherToAdd] = useState("");
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState("");

  const [selectedCohortId, setSelectedCohortId] = useState("");

  async function refreshData() {
    setIsLoading(true);
    setMessage("");

    try {
      const overview = (await fetchMaintenanceOverview()) as OverviewData;
      setData(overview);

      const firstClassId = selectedClassId || overview.classes[0]?.id || "";
      const firstClass = overview.classes.find(
        (classItem) => classItem.id === firstClassId
      );

      if (!selectedClassId && firstClassId) {
        setSelectedClassId(firstClassId);
      }

      if (firstClass) {
        setEditClassName(firstClass.name);
        setEditClassSchool(firstClass.school || "");
      }

      if (!selectedTeacherToAdd) {
        const firstActiveTeacher = overview.teachers.find(
          (teacher) => teacher.status === "active"
        );

        if (firstActiveTeacher) {
          setSelectedTeacherToAdd(firstActiveTeacher.id);
        }
      }

      if (!selectedStudentToAdd) {
        const firstActiveStudent = overview.students.find(
          (student) => student.status === "active"
        );

        if (firstActiveStudent) {
          setSelectedStudentToAdd(firstActiveStudent.id);
        }
      }

      if (!selectedCohortId) {
        const firstActiveCohort = overview.cohorts.find(
          (cohort) => cohort.status === "active"
        );

        if (firstActiveCohort) {
          setSelectedCohortId(firstActiveCohort.id);
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "读取维护中心数据失败。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClass = useMemo(() => {
    return data?.classes.find((classItem) => classItem.id === selectedClassId);
  }, [data, selectedClassId]);

  const filteredClasses = useMemo(() => {
    if (!data) return [];

    const keyword = classKeyword.trim().toLowerCase();

    if (!keyword) return data.classes;

    return data.classes.filter((classItem) => {
      return [
        classItem.name,
        classItem.school || "",
        classItem.cohort_name,
        classItem.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [data, classKeyword]);

  const classTeachers = useMemo(() => {
    if (!data || !selectedClassId) return [];

    const teacherIds = new Set(
      data.classTeachers
        .filter((relation) => relation.class_id === selectedClassId)
        .map((relation) => relation.teacher_id)
    );

    return data.teachers.filter((teacher) => teacherIds.has(teacher.id));
  }, [data, selectedClassId]);

  const classStudents = useMemo(() => {
    if (!data || !selectedClassId) return [];

    const studentIds = new Set(
      data.classStudents
        .filter((relation) => relation.class_id === selectedClassId)
        .map((relation) => relation.student_id)
    );

    return data.students.filter((student) => studentIds.has(student.id));
  }, [data, selectedClassId]);

  const teachersAvailableToAdd = useMemo(() => {
    if (!data) return [];

    const existingTeacherIds = new Set(
      classTeachers.map((teacher) => teacher.id)
    );

    const keyword = teacherKeyword.trim().toLowerCase();

    return data.teachers
      .filter((teacher) => teacher.status === "active")
      .filter((teacher) => !existingTeacherIds.has(teacher.id))
      .filter((teacher) => {
        if (!keyword) return true;

        return [teacher.name, teacher.email || "", teacher.status]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
  }, [data, classTeachers, teacherKeyword]);

  const studentsAvailableToAdd = useMemo(() => {
    if (!data) return [];

    const existingStudentIds = new Set(
      classStudents.map((student) => student.id)
    );

    const keyword = studentKeyword.trim().toLowerCase();

    return data.students
      .filter((student) => student.status === "active")
      .filter((student) => !existingStudentIds.has(student.id))
      .filter((student) => {
        if (!keyword) return true;

        return [
          student.name,
          student.username || "",
          student.grade || "",
          student.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
  }, [data, classStudents, studentKeyword]);

  const approvalsByRequestId = useMemo(() => {
    const map = new Map<string, AdminActionApproval[]>();

    (data?.approvals || []).forEach((approval) => {
      const existing = map.get(approval.request_id) || [];
      existing.push(approval);
      map.set(approval.request_id, existing);
    });

    return map;
  }, [data]);

  const pendingRequestsForSelectedClass = useMemo(() => {
    if (!data || !selectedClassId) return [];

    const classTeacherIds = new Set(classTeachers.map((teacher) => teacher.id));
    const classStudentIds = new Set(classStudents.map((student) => student.id));

    return data.requests.filter((request) => {
      const payloadClassId = request.action_payload?.classId;

      if (request.target_type === "class") {
        return request.target_id === selectedClassId;
      }

      if (payloadClassId === selectedClassId) {
        return true;
      }

      if (request.target_type === "teacher") {
        return classTeacherIds.has(request.target_id);
      }

      if (request.target_type === "student") {
        return classStudentIds.has(request.target_id);
      }

      return false;
    });
  }, [data, selectedClassId, classTeachers, classStudents]);

  function handleSelectClass(classItem: MaintenanceClassItem) {
    setSelectedClassId(classItem.id);
    setEditClassName(classItem.name);
    setEditClassSchool(classItem.school || "");
    setMessage("");
    setResetPasswordResult(null);
  }

  async function handleCreateRequest(params: {
    actionType: string;
    targetType: string;
    targetId: string;
    targetName: string;
    note: string;
    actionPayload?: Record<string, any>;
  }) {
    if (!data) return;

    const confirmed = window.confirm(
      `确认创建申请吗？\n\n操作：${getActionLabel(
        params.actionType
      )}\n对象：${params.targetName}\n\n当前 active 管理员人数：${
        data.activeAdminCount
      }。\n申请创建后，需要 ${data.activeAdminCount} 位 active 管理员确认。`
    );

    if (!confirmed) return;

    try {
      const result = await createMaintenanceRequest(params);
      setResetPasswordResult(null);
      setMessage(result.message || "申请已创建。");
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建申请失败。");
    }
  }

  async function handleApproveRequest(requestId: string) {
    const confirmed = window.confirm(
      "确认批准这项申请吗？同一管理员不能重复确认。密码重置申请会在最后一位管理员确认后立即执行。"
    );

    if (!confirmed) return;

    try {
      const result = await approveMaintenanceRequest(requestId);

      if (result.resetPassword) {
        setResetPasswordResult(result.resetPassword as ResetPasswordResult);
      } else {
        setResetPasswordResult(null);
      }

      setMessage(result.message || "已确认。");
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "确认申请失败。");
    }
  }

  async function handleCancelRequest(requestId: string) {
    const confirmed = window.confirm(
      "确认取消这项申请吗？取消后确认记录会被清除。"
    );

    if (!confirmed) return;

    try {
      const result = await cancelMaintenanceRequest(requestId);
      setResetPasswordResult(null);
      setMessage(result.message || "申请已取消。");
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取消申请失败。");
    }
  }

  function handleCreateClassInfoRequest() {
    if (!selectedClass) {
      setMessage("请先选择班级。");
      return;
    }

    const newName = editClassName.trim();

    if (!newName) {
      setMessage("班级名称不能为空。");
      return;
    }

    handleCreateRequest({
      actionType: "update_class_info",
      targetType: "class",
      targetId: selectedClass.id,
      targetName: selectedClass.name,
      note: `申请修改班级基础信息：${selectedClass.name} → ${newName}`,
      actionPayload: {
        classId: selectedClass.id,
        name: newName,
        school: editClassSchool.trim(),
      },
    });
  }

  function handleCreateAddTeacherRequest() {
    if (!selectedClass || !selectedTeacherToAdd) {
      setMessage("请先选择班级和小老师。");
      return;
    }

    const teacher = data?.teachers.find(
      (item) => item.id === selectedTeacherToAdd
    );

    if (!teacher) {
      setMessage("没有找到要添加的小老师。");
      return;
    }

    handleCreateRequest({
      actionType: "add_teacher_to_class",
      targetType: "teacher",
      targetId: teacher.id,
      targetName: teacher.name,
      note: `申请将小老师「${teacher.name}」加入班级「${selectedClass.name}」。`,
      actionPayload: {
        classId: selectedClass.id,
        className: selectedClass.name,
        teacherId: teacher.id,
      },
    });
  }

  function handleCreateRemoveTeacherRequest(teacher: MaintenanceTeacherItem) {
    if (!selectedClass) return;

    handleCreateRequest({
      actionType: "remove_teacher_from_class",
      targetType: "teacher",
      targetId: teacher.id,
      targetName: teacher.name,
      note: `申请将小老师「${teacher.name}」从班级「${selectedClass.name}」移除。不会删除账号或历史记录。`,
      actionPayload: {
        classId: selectedClass.id,
        className: selectedClass.name,
        teacherId: teacher.id,
      },
    });
  }

  function handleCreateResetTeacherPasswordRequest(
    teacher: MaintenanceTeacherItem
  ) {
    handleCreateRequest({
      actionType: "reset_teacher_password",
      targetType: "teacher",
      targetId: teacher.id,
      targetName: teacher.name,
      note: `申请重置小老师「${teacher.name}」的登录密码。旧密码会在申请完成后失效。`,
    });
  }

  function handleCreateAddStudentRequest() {
    if (!selectedClass || !selectedStudentToAdd) {
      setMessage("请先选择班级和学生。");
      return;
    }

    const student = data?.students.find(
      (item) => item.id === selectedStudentToAdd
    );

    if (!student) {
      setMessage("没有找到要添加的学生。");
      return;
    }

    handleCreateRequest({
      actionType: "add_student_to_class",
      targetType: "student",
      targetId: student.id,
      targetName: student.name,
      note: `申请将学生「${student.name}」加入班级「${selectedClass.name}」。`,
      actionPayload: {
        classId: selectedClass.id,
        className: selectedClass.name,
        studentId: student.id,
      },
    });
  }

  function handleCreateRemoveStudentRequest(student: MaintenanceStudentItem) {
    if (!selectedClass) return;

    handleCreateRequest({
      actionType: "remove_student_from_class",
      targetType: "student",
      targetId: student.id,
      targetName: student.name,
      note: `申请将学生「${student.name}」从班级「${selectedClass.name}」移除。不会删除账号或历史记录。`,
      actionPayload: {
        classId: selectedClass.id,
        className: selectedClass.name,
        studentId: student.id,
      },
    });
  }

  function handleCreateResetStudentPasswordRequest(
    student: MaintenanceStudentItem
  ) {
    handleCreateRequest({
      actionType: "reset_student_password",
      targetType: "student",
      targetId: student.id,
      targetName: student.name,
      note: `申请重置学生「${student.name}」的登录密码。旧密码会在申请完成后失效。`,
    });
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-600">正在读取维护中心数据...</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">维护中心数据读取失败。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              Admin / 维护中心
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              管理员维护中心
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              维护中心只显示运行中的班级。所有修改、移除、添加、删除/归档、密码重置操作都会先创建申请，需要所有 active 管理员确认后才会执行。
            </p>
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

        {resetPasswordResult && (
          <section className="mb-6 rounded-[1.75rem] border border-emerald-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">
                  新临时密码
                </h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  请现在复制并私下发给本人。关闭或刷新页面后，这个临时密码不会再次显示。
                </p>
              </div>

              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                只显示一次
              </span>
            </div>

            <div className="mt-5 rounded-2xl bg-[#fffdf4] p-5">
              <p className="text-sm text-stone-500">
                {resetPasswordResult.role === "teacher" ? "小老师" : "学生"}
              </p>

              <p className="mt-1 font-bold text-emerald-950">
                {resetPasswordResult.name}
              </p>

              <p className="mt-3 text-sm text-stone-500">
                账号：{resetPasswordResult.account || "暂无账号信息"}
              </p>

              <p className="mt-4 break-all rounded-2xl bg-white p-4 text-2xl font-bold tracking-wide text-emerald-950">
                {resetPasswordResult.newPassword}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setResetPasswordResult(null)}
              className="mt-4 rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
            >
              我已复制，关闭显示
            </button>
          </section>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Active 管理员</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {data.activeAdminCount}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              新申请需要同等人数确认
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">可维护班级</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {data.classes.length}
            </p>
            <p className="mt-1 text-xs text-stone-500">仅运行中班级</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">小老师 / 学生</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {data.teachers.length} / {data.students.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">待确认申请</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {data.requests.length}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-emerald-950">选择班级</h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              搜索运行中的班级、届别或合作学校。已封存班级不会出现在维护中心。
            </p>

            <input
              value={classKeyword}
              onChange={(event) => setClassKeyword(event.target.value)}
              placeholder="搜索班级 / 届别 / 学校..."
              className="mt-4 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />

            <div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-1">
              {filteredClasses.length === 0 ? (
                <p className="rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-500">
                  没有找到符合条件的运行中班级。
                </p>
              ) : (
                filteredClasses.map((classItem) => {
                  const isSelected = classItem.id === selectedClassId;

                  return (
                    <button
                      key={classItem.id}
                      type="button"
                      onClick={() => handleSelectClass(classItem)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-emerald-100 bg-[#fffdf4] hover:bg-emerald-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-emerald-950">
                            {classItem.name}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-stone-500">
                            {classItem.cohort_name} ·{" "}
                            {classItem.school || "未填写学校"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(
                            classItem.status
                          )}`}
                        >
                          {getStatusLabel(classItem.status)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="space-y-6">
            {!selectedClass ? (
              <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
                <p className="text-sm text-stone-600">
                  请先从左侧选择一个运行中的班级。
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-emerald-950">
                        {selectedClass.name}
                      </h2>

                      <p className="mt-2 text-sm leading-7 text-stone-600">
                        {selectedClass.cohort_name} ·{" "}
                        {selectedClass.school || "未填写学校"} ·{" "}
                        {getStatusLabel(selectedClass.status)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCreateRequest({
                          actionType: "delete_class",
                          targetType: "class",
                          targetId: selectedClass.id,
                          targetName: selectedClass.name,
                          note: "没有历史记录则彻底删除；有课程或目标记录则改为封存。",
                        })
                      }
                      className="w-fit rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      创建班级删除/封存申请
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl bg-[#fffdf4] p-4">
                    <p className="font-semibold text-emerald-950">
                      修改班级基础信息
                    </p>

                    <p className="mt-1 text-xs leading-6 text-stone-500">
                      修改班级名和合作学校也需要管理员确认。同一届别中不能出现重名班级。
                    </p>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <input
                        value={editClassName}
                        onChange={(event) =>
                          setEditClassName(event.target.value)
                        }
                        placeholder="班级名称"
                        className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                      />

                      <input
                        value={editClassSchool}
                        onChange={(event) =>
                          setEditClassSchool(event.target.value)
                        }
                        placeholder="合作学校"
                        className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateClassInfoRequest}
                      className="mt-3 rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
                    >
                      创建修改申请
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
                    <h3 className="text-xl font-bold text-emerald-950">
                      小老师调整
                    </h3>

                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      当前班级共有 {classTeachers.length} 位小老师。添加、移除、删除/归档、重置密码都需要管理员确认。
                    </p>

                    <div className="mt-4 space-y-3">
                      {classTeachers.length === 0 ? (
                        <p className="rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-500">
                          当前班级暂未绑定小老师。
                        </p>
                      ) : (
                        classTeachers.map((teacher) => (
                          <div
                            key={teacher.id}
                            className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                          >
                            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                              <div>
                                <p className="font-bold text-emerald-950">
                                  {teacher.name}
                                </p>

                                <p className="mt-1 text-xs text-stone-500">
                                  {teacher.email || "无邮箱"} ·{" "}
                                  {getStatusLabel(teacher.status)}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCreateResetTeacherPasswordRequest(
                                      teacher
                                    )
                                  }
                                  className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                                >
                                  重置密码申请
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCreateRemoveTeacherRequest(teacher)
                                  }
                                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
                                >
                                  创建移除申请
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCreateRequest({
                                      actionType: "delete_teacher",
                                      targetType: "teacher",
                                      targetId: teacher.id,
                                      targetName: teacher.name,
                                      note: "没有课程记录则彻底删除；有课程记录则归档。",
                                    })
                                  }
                                  className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                                >
                                  删除/归档申请
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4">
                      <p className="font-semibold text-emerald-950">
                        添加小老师到本班
                      </p>

                      <input
                        value={teacherKeyword}
                        onChange={(event) =>
                          setTeacherKeyword(event.target.value)
                        }
                        placeholder="搜索小老师姓名或邮箱..."
                        className="mt-3 w-full rounded-xl border border-emerald-100 bg-[#fffdf4] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />

                      <select
                        value={selectedTeacherToAdd}
                        onChange={(event) =>
                          setSelectedTeacherToAdd(event.target.value)
                        }
                        className="mt-3 w-full rounded-xl border border-emerald-100 bg-[#fffdf4] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      >
                        {teachersAvailableToAdd.length === 0 ? (
                          <option value="">暂无可添加小老师</option>
                        ) : (
                          teachersAvailableToAdd.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.name} · {teacher.email || "无邮箱"} ·{" "}
                              {getStatusLabel(teacher.status)}
                            </option>
                          ))
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={handleCreateAddTeacherRequest}
                        disabled={!selectedTeacherToAdd}
                        className="mt-3 rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        创建加入申请
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
                    <h3 className="text-xl font-bold text-emerald-950">
                      学生调整
                    </h3>

                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      当前班级共有 {classStudents.length} 位学生。添加、移除、删除/归档、重置密码都需要管理员确认。
                    </p>

                    <div className="mt-4 space-y-3">
                      {classStudents.length === 0 ? (
                        <p className="rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-500">
                          当前班级暂未绑定学生。
                        </p>
                      ) : (
                        classStudents.map((student) => (
                          <div
                            key={student.id}
                            className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                          >
                            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                              <div>
                                <p className="font-bold text-emerald-950">
                                  {student.name}
                                </p>

                                <p className="mt-1 text-xs text-stone-500">
                                  {student.username || "无用户名"} ·{" "}
                                  {student.grade || "未填写年级"} ·{" "}
                                  {getStatusLabel(student.status)}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCreateResetStudentPasswordRequest(
                                      student
                                    )
                                  }
                                  className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                                >
                                  重置密码申请
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCreateRemoveStudentRequest(student)
                                  }
                                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
                                >
                                  创建移除申请
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCreateRequest({
                                      actionType: "delete_student",
                                      targetType: "student",
                                      targetId: student.id,
                                      targetName: student.name,
                                      note: "没有留言记录则彻底删除；有留言记录则归档。",
                                    })
                                  }
                                  className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                                >
                                  删除/归档申请
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4">
                      <p className="font-semibold text-emerald-950">
                        添加学生到本班
                      </p>

                      <input
                        value={studentKeyword}
                        onChange={(event) =>
                          setStudentKeyword(event.target.value)
                        }
                        placeholder="搜索学生姓名、用户名或年级..."
                        className="mt-3 w-full rounded-xl border border-emerald-100 bg-[#fffdf4] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />

                      <select
                        value={selectedStudentToAdd}
                        onChange={(event) =>
                          setSelectedStudentToAdd(event.target.value)
                        }
                        className="mt-3 w-full rounded-xl border border-emerald-100 bg-[#fffdf4] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      >
                        {studentsAvailableToAdd.length === 0 ? (
                          <option value="">暂无可添加学生</option>
                        ) : (
                          studentsAvailableToAdd.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name} ·{" "}
                              {student.username || "无用户名"} ·{" "}
                              {student.grade || "未填写年级"} ·{" "}
                              {getStatusLabel(student.status)}
                            </option>
                          ))
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={handleCreateAddStudentRequest}
                        disabled={!selectedStudentToAdd}
                        className="mt-3 rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        创建加入申请
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm md:p-6">
                  <h3 className="text-xl font-bold text-red-800">
                    本班相关待确认申请
                  </h3>

                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    这里显示当前班级本身，以及当前班级成员相关的待确认申请。创建申请时需要{" "}
                    {data.activeAdminCount} 位 active 管理员确认。密码重置申请会在最后一位管理员确认后立即执行，并只显示一次新临时密码。
                  </p>

                  {pendingRequestsForSelectedClass.length === 0 ? (
                    <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                      当前班级暂无相关待确认申请。
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {pendingRequestsForSelectedClass.map((request) => {
                        const approvals =
                          approvalsByRequestId.get(request.id) || [];

                        return (
                          <div
                            key={request.id}
                            className="rounded-2xl border border-red-100 bg-red-50 p-4"
                          >
                            <p className="font-bold text-red-800">
                              {getActionLabel(request.action_type)} ·{" "}
                              {getTargetTypeLabel(request.target_type)}：
                              {request.target_name}
                            </p>

                            <p className="mt-1 text-sm text-red-700">
                              确认进度：{request.approvals_count}/
                              {request.required_approvals}
                            </p>

                            <p className="mt-1 text-xs text-stone-500">
                              已确认管理员：
                              {approvals.length > 0
                                ? approvals
                                    .map((approval) => approval.admin_name)
                                    .join("、")
                                : "暂无"}
                            </p>

                            {request.note && (
                              <p className="mt-2 text-xs text-stone-500">
                                说明：{request.note}
                              </p>
                            )}

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleApproveRequest(request.id)
                                }
                                className="rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                              >
                                确认一次
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCancelRequest(request.id)}
                                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                              >
                                取消申请
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-bold text-red-800">整届封存</h2>

          <p className="mt-2 text-sm leading-7 text-stone-600">
            整届封存仍然作为独立操作保留。它不属于单个班级维护，应只在一届课程真正结束后使用。当前 active 管理员人数为{" "}
            {data.activeAdminCount}。
          </p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={selectedCohortId}
              onChange={(event) => setSelectedCohortId(event.target.value)}
              className="w-full rounded-2xl border border-red-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none focus:border-red-300 md:max-w-sm"
            >
              {data.cohorts
                .filter((cohort) => cohort.status === "active")
                .map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name} - {getStatusLabel(cohort.status)}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const cohort = data.cohorts.find(
                  (item) => item.id === selectedCohortId
                );

                if (!cohort) return;

                handleCreateRequest({
                  actionType: "archive_cohort",
                  targetType: "cohort",
                  targetId: cohort.id,
                  targetName: cohort.name,
                  note: "申请封存整届，并同步归档只属于该届的老师和学生。",
                });
              }}
              className="w-fit rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              创建整届封存申请
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}