"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

/**
 * admin/classes 页面原则：
 * 1. AdminGuard 负责确认当前用户是否是管理员。
 * 2. 本页面只负责班级统计、查询和详情入口。
 * 3. 批量导入、账号创建、初始密码生成、老师学生绑定，统一放在 /admin/import。
 * 4. 班级基础信息修改、人员调整、删除/恢复等维护操作，统一放到 /admin/maintenance。
 * 5. 本页面不直接执行高风险维护操作，避免查询页和操作页混在一起。
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

type ClassQueryRow = {
  id: string;
  name: string;
  school: string | null;
  subject: string | null;
  status: string;
  cohort_id: string | null;
  cohorts: {
    name: string;
  } | null;
  class_teachers:
    | {
        teachers: {
          name: string;
        } | null;
      }[]
    | null;
  class_students:
    | {
        students: {
          name: string;
        } | null;
      }[]
    | null;
};

function getStatusLabel(status: string) {
  if (status === "active") return "运行中";
  if (status === "archived") return "已封存";
  if (status === "delete_requested") return "待维护";

  return status;
}

function getStatusClassName(status: string) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "archived") {
    return "bg-stone-100 text-stone-500";
  }

  if (status === "delete_requested") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-stone-100 text-stone-500";
}

function getSubjectLabel(subject: string | null | undefined) {
  if (subject === "english") return "英语";
  if (subject === "math") return "数学";

  return "未设置";
}

function getSubjectClassName(subject: string | null | undefined) {
  if (subject === "english") {
    return "bg-sky-50 text-sky-700";
  }

  if (subject === "math") {
    return "bg-violet-50 text-violet-700";
  }

  return "bg-stone-100 text-stone-500";
}

async function fetchCohorts(): Promise<CohortItem[]> {
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`读取届别失败：${error.message}`);
  }

  return (data ?? []) as CohortItem[];
}

async function fetchClasses(): Promise<ClassTableItem[]> {
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

  const classRows = (data ?? []) as unknown as ClassQueryRow[];

  return classRows.map((classItem) => {
    const teacherNames =
      classItem.class_teachers
        ?.map((item) => item.teachers?.name)
        .filter((name): name is string => Boolean(name)) ?? [];

    const studentNames =
      classItem.class_students
        ?.map((item) => item.students?.name)
        .filter((name): name is string => Boolean(name)) ?? [];

    return {
      id: classItem.id,
      name: classItem.name,
      school: classItem.school,
      subject: classItem.subject,
      status: classItem.status,
      cohortId: classItem.cohort_id,
      cohortName: classItem.cohorts?.name ?? "未设置届别",
      teacherNames,
      studentNames,
    };
  });
}

export default function AdminClassesPage() {
  return (
    <AdminGuard>
      <AdminClassesContent />
    </AdminGuard>
  );
}

function AdminClassesContent() {
  const [classes, setClasses] = useState<ClassTableItem[]>([]);
  const [cohorts, setCohorts] = useState<CohortItem[]>([]);

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isClassListOpen, setIsClassListOpen] = useState(true);
  const [selectedClassView, setSelectedClassView] = useState("active");

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

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const [cohortData, classData] = await Promise.all([
          fetchCohorts(),
          fetchClasses(),
        ]);

        if (isCancelled) {
          return;
        }

        setCohorts(cohortData);
        setClasses(classData);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "读取班级管理数据失败。";

        setMessage(errorMessage);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-600">
            正在读取班级管理数据...
          </p>
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
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              导入账号
            </Link>

            <Link
              href="/admin/maintenance"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              进入维护中心
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
                  onChange={(event) =>
                    setSelectedClassView(event.target.value)
                  }
                  className="w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-2.5 text-sm outline-none focus:border-emerald-500 md:w-64"
                >
                  <option value="active">当前运行中班级</option>
                  <option value="needs_maintenance">
                    待维护状态班级
                  </option>

                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name} -{" "}
                      {cohort.status === "active" ? "运行中" : "已封存"}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsClassListOpen((previous) => !previous)}
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
              班级列表已收起。当前筛选条件下共有{" "}
              {filteredClasses.length} 个班级。
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
                            classItem.studentNames.map(
                              (studentName, index) => (
                                <span
                                  key={`${classItem.id}-${studentName}-${index}`}
                                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                >
                                  {studentName}
                                </span>
                              )
                            )
                          ) : (
                            <span className="text-stone-400">
                              暂无学生
                            </span>
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