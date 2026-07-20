"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

/**
 * admin/teachers 页面原则：
 * 1. AdminGuard 负责确认当前用户是否是管理员。
 * 2. 本页面只负责小老师统计、查询和详情入口。
 * 3. 小老师账号创建、密码重置、班级调整、删除/归档等维护操作，
 *    统一放到 /admin/maintenance。
 * 4. 本页面不再展示账号绑定判断，不再处理删除申请或高风险操作。
 * 5. 管理员在这里主要观察小老师学科、负责班级、学生数量、
 *    课程次数、近 30 天上课次数、近 4 周活跃情况。
 * 6. “待维护”包含：状态异常、缺少学科，或者 active 但未分配班级。
 *
 * 展示原则：
 * - 首页必须显示老师学科。
 * - 负责班级栏只显示“班级名称 · 届别”，不重复学校、班级状态、班级学科。
 * - 最近上课日期不在列表页显示，避免表格过宽；详情页再看完整记录。
 */

type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
  subject: string | null;
  status: string;
  created_at: string;
};

type TeacherTableItem = {
  id: string;
  name: string;
  email: string | null;
  subject: string | null;
  status: string;

  classNames: string[];
  classDescriptions: string[];
  classIds: string[];
  cohortIds: string[];

  studentCount: number;
  lessonCount: number;
  recentThirtyDaysLessonCount: number;
  totalMinutes: number;
  recentFourWeeksCount: number;
};

type RelatedCohort = {
  id: string;
  name: string;
  status?: string;
};

type RelatedClass = {
  id: string;
  name: string;
  status: string;
  cohorts: RelatedCohort | RelatedCohort[] | null;
};

type ClassTeacherRow = {
  teacher_id: string;
  class_id: string;
  classes: RelatedClass | RelatedClass[] | null;
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

type TeachersPageData = {
  teachers: TeacherTableItem[];
  cohorts: CohortRow[];
};

/**
 * Supabase 嵌套关系有时可能是一个对象，也可能被推断成数组。
 * 这个辅助函数统一取出一个对象。
 */
function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isCurrentTeacher(teacher: TeacherTableItem) {
  return teacher.status === "active" && teacher.classIds.length > 0;
}

function isMaintenanceTeacher(teacher: TeacherTableItem) {
  return (
    (teacher.status !== "active" && teacher.status !== "archived") ||
    (teacher.status === "active" && teacher.classIds.length === 0) ||
    (teacher.status === "active" && !teacher.subject)
  );
}

function getTeacherStatusLabel(status: string) {
  if (status === "active") return "当前";
  if (status === "archived") return "已归档";
  if (status === "withdrawn") return "已退出";
  if (status === "delete_requested") return "待维护";
  return status;
}

function getTeacherStatusClassName(status: string) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "archived") {
    return "bg-stone-100 text-stone-500";
  }

  if (status === "withdrawn") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "delete_requested") {
    return "bg-red-50 text-red-700";
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

function getAttentionLabel(teacher: TeacherTableItem) {
  if (teacher.status === "archived") {
    return {
      text: "已归档",
      className: "bg-stone-100 text-stone-500",
    };
  }

  if (teacher.status !== "active") {
    return {
      text: "待维护：状态异常",
      className: "bg-red-50 text-red-700",
    };
  }

  if (!teacher.subject) {
    return {
      text: "待维护：缺少学科",
      className: "bg-red-50 text-red-700",
    };
  }

  if (teacher.classIds.length === 0) {
    return {
      text: "待维护：未分配班级",
      className: "bg-red-50 text-red-700",
    };
  }

  if (teacher.lessonCount === 0) {
    return {
      text: "暂无课程",
      className: "bg-stone-100 text-stone-500",
    };
  }

  if (teacher.recentThirtyDaysLessonCount === 0) {
    return {
      text: "近 30 天无课",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (teacher.recentFourWeeksCount < 2) {
    return {
      text: "频率偏低",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    text: "正常",
    className: "bg-emerald-50 text-emerald-700",
  };
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
  fourWeeksAgo.setHours(0, 0, 0, 0);

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

function isWithinRecentThirtyDays(dateString: string) {
  const lessonDate = new Date(dateString);
  const today = new Date();
  const thirtyDaysAgo = new Date();

  thirtyDaysAgo.setDate(today.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  return lessonDate >= thirtyDaysAgo && lessonDate <= today;
}

function formatHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * 读取并整理小老师列表页需要的数据。
 *
 * 这个函数只负责：
 * 1. 查询 Supabase
 * 2. 检查查询错误
 * 3. 整理成页面需要的数据
 * 4. 返回结果
 *
 * 它不直接调用 setState，因此不会在 useEffect 开始时同步触发渲染。
 */
async function fetchTeachersPageData(): Promise<TeachersPageData> {
  const [
    teacherResult,
    classTeacherResult,
    classStudentResult,
    lessonResult,
    cohortResult,
  ] = await Promise.all([
    supabase
      .from("teachers")
      .select("id, name, email, subject, status, created_at")
      .order("created_at", { ascending: false }),

    supabase.from("class_teachers").select(
      `
        teacher_id,
        class_id,
        classes (
          id,
          name,
          status,
          cohorts (
            id,
            name,
            status
          )
        )
      `
    ),

    supabase
      .from("class_students")
      .select("class_id, student_id"),

    supabase
      .from("lesson_records")
      .select(
        "id, teacher_id, class_id, lesson_date, duration_minutes"
      )
      .order("lesson_date", { ascending: false }),

    supabase
      .from("cohorts")
      .select("id, name, status")
      .order("created_at", { ascending: false }),
  ]);

  if (teacherResult.error) {
    throw new Error(
      `读取小老师失败：${teacherResult.error.message}`
    );
  }

  if (classTeacherResult.error) {
    throw new Error(
      `读取小老师班级关系失败：${classTeacherResult.error.message}`
    );
  }

  if (classStudentResult.error) {
    throw new Error(
      `读取班级学生关系失败：${classStudentResult.error.message}`
    );
  }

  if (lessonResult.error) {
    throw new Error(
      `读取课程记录失败：${lessonResult.error.message}`
    );
  }

  if (cohortResult.error) {
    throw new Error(
      `读取届别失败：${cohortResult.error.message}`
    );
  }

  const teacherRows = (teacherResult.data ?? []) as TeacherRow[];

  const classTeacherRows =
    (classTeacherResult.data ?? []) as unknown as ClassTeacherRow[];

  const classStudentRows =
    (classStudentResult.data ?? []) as ClassStudentRow[];

  const lessonRows =
    (lessonResult.data ?? []) as LessonRecordRow[];

  const cohorts = (cohortResult.data ?? []) as CohortRow[];

  const formattedTeachers: TeacherTableItem[] = teacherRows.map(
    (teacher) => {
      const teacherClassRelations = classTeacherRows.filter(
        (relation) => relation.teacher_id === teacher.id
      );

      const classIds = uniqueStrings(
        teacherClassRelations.map(
          (relation) => relation.class_id
        )
      );

      const relatedClasses = teacherClassRelations
        .map((relation) => ({
          relation,
          classItem: getOne(relation.classes),
        }))
        .filter(
          (
            item
          ): item is {
            relation: ClassTeacherRow;
            classItem: RelatedClass;
          } => item.classItem !== null
        );

      const classNames = uniqueStrings(
        relatedClasses.map(
          ({ classItem }) => classItem.name
        )
      );

      const cohortIds = uniqueStrings(
        relatedClasses.map(({ classItem }) => {
          const cohort = getOne(classItem.cohorts);
          return cohort?.id ?? "";
        })
      );

      const classDescriptions = uniqueStrings(
        relatedClasses.map(({ classItem }) => {
          const cohort = getOne(classItem.cohorts);
          const cohortName = cohort?.name ?? "未设置届别";

          return `${classItem.name} · ${cohortName}`;
        })
      );

      const studentIds = new Set<string>();

      classStudentRows.forEach((relation) => {
        if (classIds.includes(relation.class_id)) {
          studentIds.add(relation.student_id);
        }
      });

      const teacherLessons = lessonRows.filter(
        (lesson) => lesson.teacher_id === teacher.id
      );

      const recentThirtyDaysLessonCount =
        teacherLessons.filter((lesson) =>
          isWithinRecentThirtyDays(lesson.lesson_date)
        ).length;

      const totalMinutes = teacherLessons.reduce(
        (sum, lesson) =>
          sum + (lesson.duration_minutes || 0),
        0
      );

      return {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        subject: teacher.subject,
        status: teacher.status || "active",

        classNames,
        classDescriptions,
        classIds,
        cohortIds,

        studentCount: studentIds.size,
        lessonCount: teacherLessons.length,
        recentThirtyDaysLessonCount,
        totalMinutes,
        recentFourWeeksCount:
          getRecentFourWeeksCount(teacherLessons),
      };
    }
  );

  return {
    teachers: formattedTeachers,
    cohorts,
  };
}

export default function AdminTeachersPage() {
  return (
    <AdminGuard>
      <AdminTeachersContent />
    </AdminGuard>
  );
}

function AdminTeachersContent() {
  const [teachers, setTeachers] =
    useState<TeacherTableItem[]>([]);

  const [cohorts, setCohorts] =
    useState<CohortRow[]>([]);

  const [keyword, setKeyword] = useState("");

  const [selectedTeacherView, setSelectedTeacherView] =
    useState("current");

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  /**
   * 首次进入页面时读取数据。
   *
   * isLoading 初始值已经是 true，
   * message 初始值已经是空字符串，
   * 所以这里不再重复调用：
   *
   * setIsLoading(true)
   * setMessage("")
   */
  useEffect(() => {
    let isCancelled = false;

    async function loadTeachers() {
      try {
        const loadedData =
          await fetchTeachersPageData();

        if (isCancelled) {
          return;
        }

        setTeachers(loadedData.teachers);
        setCohorts(loadedData.cohorts);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "读取小老师数据失败。"
        );
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTeachers();

    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredTeachers = useMemo(() => {
    const searchText = keyword.trim().toLowerCase();

    let result = teachers;

    if (selectedTeacherView === "current") {
      result = result.filter(isCurrentTeacher);
    }

    if (selectedTeacherView === "needs_maintenance") {
      result = result.filter(isMaintenanceTeacher);
    }

    if (selectedTeacherView === "archived") {
      result = result.filter(
        (teacher) => teacher.status === "archived"
      );
    }

    const isCohortFilter =
      selectedTeacherView !== "current" &&
      selectedTeacherView !== "needs_maintenance" &&
      selectedTeacherView !== "archived";

    if (isCohortFilter) {
      result = result.filter((teacher) =>
        teacher.cohortIds.includes(selectedTeacherView)
      );
    }

    if (searchText) {
      result = result.filter((teacher) => {
        const searchableText = [
          teacher.name,
          teacher.email || "",
          getSubjectLabel(teacher.subject),
          teacher.classNames.join(" "),
          teacher.classDescriptions.join(" "),
          getTeacherStatusLabel(teacher.status),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchText);
      });
    }

    return result;
  }, [keyword, selectedTeacherView, teachers]);

  const currentTeacherCount = useMemo(() => {
    return teachers.filter(isCurrentTeacher).length;
  }, [teachers]);

  const needsMaintenanceTeacherCount = useMemo(() => {
    return teachers.filter(isMaintenanceTeacher).length;
  }, [teachers]);

  const archivedTeacherCount = useMemo(() => {
    return teachers.filter(
      (teacher) => teacher.status === "archived"
    ).length;
  }, [teachers]);

  const totalLessonCount = useMemo(() => {
    return teachers.reduce(
      (sum, teacher) => sum + teacher.lessonCount,
      0
    );
  }, [teachers]);

  const totalRecentThirtyDaysLessonCount = useMemo(() => {
    return teachers.reduce(
      (sum, teacher) =>
        sum + teacher.recentThirtyDaysLessonCount,
      0
    );
  }, [teachers]);

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              Admin / 小老师查询
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              小老师查询
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
            <p className="text-sm text-stone-500">
              当前小老师
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {currentTeacherCount}
            </p>

            <p className="mt-1 text-xs text-stone-500">
              当前且已分配班级
            </p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">
              待维护
            </p>

            <p className="mt-2 text-3xl font-bold text-red-700">
              {needsMaintenanceTeacherCount}
            </p>

            <p className="mt-1 text-xs text-stone-500">
              状态异常、缺少学科或未分配班级
            </p>
          </div>

          <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">
              已归档小老师
            </p>

            <p className="mt-2 text-3xl font-bold text-stone-600">
              {archivedTeacherCount}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">
              近 30 天课程
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {totalRecentThirtyDaysLessonCount}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">
              全部课程记录
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {totalLessonCount}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold text-emerald-950">
                小老师列表
              </h2>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <select
                value={selectedTeacherView}
                onChange={(event) =>
                  setSelectedTeacherView(event.target.value)
                }
                className="w-full rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none transition focus:border-emerald-500 focus:bg-white md:w-64"
              >
                <option value="current">
                  当前小老师
                </option>

                <option value="needs_maintenance">
                  待维护
                </option>

                <option value="archived">
                  已归档小老师
                </option>

                {cohorts.map((cohort) => (
                  <option
                    key={cohort.id}
                    value={cohort.id}
                  >
                    {cohort.name} -{" "}
                    {cohort.status === "active"
                      ? "运行中"
                      : "已封存"}
                  </option>
                ))}
              </select>

              <input
                value={keyword}
                onChange={(event) =>
                  setKeyword(event.target.value)
                }
                placeholder="搜索小老师、学科、班级、邮箱..."
                className="w-full rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none transition focus:border-emerald-500 focus:bg-white md:w-80"
              />
            </div>
          </div>

          {isLoading ? (
            <p className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
              正在读取小老师数据...
            </p>
          ) : filteredTeachers.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
              暂时没有找到符合条件的小老师。
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-emerald-100">
              <table className="w-full min-w-[1040px] border-collapse bg-white text-left text-sm">
                <thead className="bg-[#fffdf4] text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      小老师
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      学科
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      负责班级
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      学生
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      近 30 天
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      近 4 周
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      全部课程
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      关注状态
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      状态
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      详情
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-emerald-50">
                  {filteredTeachers.map((teacher) => {
                    const attention =
                      getAttentionLabel(teacher);

                    return (
                      <tr
                        key={teacher.id}
                        className="align-top"
                      >
                        <td className="px-4 py-4">
                          <p className="font-bold text-emerald-950">
                            {teacher.name}
                          </p>

                          <p className="mt-1 text-xs text-stone-500">
                            {teacher.email ||
                              "暂未填写邮箱"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getSubjectClassName(
                              teacher.subject
                            )}`}
                          >
                            {getSubjectLabel(
                              teacher.subject
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {teacher.classDescriptions
                            .length === 0 ? (
                            <p className="text-sm text-red-500">
                              暂未分配班级
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {teacher.classDescriptions.map(
                                (description, index) => (
                                  <p
                                    key={`${teacher.id}-${description}-${index}`}
                                    className="rounded-full bg-[#fffdf4] px-3 py-1 text-xs text-stone-600"
                                  >
                                    {description}
                                  </p>
                                )
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-emerald-950">
                            {teacher.studentCount}
                          </p>

                          <p className="mt-1 text-xs text-stone-500">
                            名学生
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-2xl font-bold text-emerald-950">
                            {
                              teacher.recentThirtyDaysLessonCount
                            }
                          </p>

                          <p className="mt-1 text-xs text-stone-500">
                            次课程
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-emerald-950">
                            {teacher.recentFourWeeksCount}/4 周
                          </p>

                          <p className="mt-1 text-xs text-stone-500">
                            活跃周数
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-emerald-950">
                            {teacher.lessonCount}
                          </p>

                          <p className="mt-1 text-xs text-stone-500">
                            {formatHours(
                              teacher.totalMinutes
                            )}{" "}
                            小时
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
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getTeacherStatusClassName(
                              teacher.status
                            )}`}
                          >
                            {getTeacherStatusLabel(
                              teacher.status
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/admin/teachers/${teacher.id}`}
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