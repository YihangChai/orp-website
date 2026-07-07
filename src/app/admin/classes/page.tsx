"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

type ImportClassRow = {
  cohort: string;
  className: string;
  school: string;
  teacherName: string;
  studentNames: string[];
  note: string;
};

type ParseError = {
  lineNumber: number;
  message: string;
};

type ClassTableItem = {
  id: string;
  name: string;
  school: string | null;
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

type CreateClassRequestPayload = {
  cohortName: string;
  normalizedCohortName: string;
  className: string;
  normalizedClassName: string;
  school: string;
  teacherName: string;
  studentNames: string[];
  note: string;
};

const TOTAL_ADMIN_COUNT = 4;
const DELETE_CLASS_REQUIRED_APPROVALS = 2;
const CREATE_CLASS_REQUIRED_APPROVALS = TOTAL_ADMIN_COUNT;

const sampleText = `届别	班级名称	合作学校	小老师	学生名单	备注
2027暑期	秋叶班	河北某小学	Ethan	学生A、学生B、学生C	阅读基础较弱，适合从故事类内容开始
2027暑期	蓝天班	河北某小学	Mario	学生D、学生E、学生F	学生比较活跃，可以加入历史地理拓展`;

function splitNames(text: string) {
  const names = text
    .split(/、|,|，|;|；|\//)
    .map((name) => name.trim())
    .filter(Boolean);

  return Array.from(new Set(names));
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

function readCreateClassPayload(note: string | null) {
  if (!note) return null;

  try {
    return JSON.parse(note) as CreateClassRequestPayload;
  } catch {
    return null;
  }
}

function parseImportText(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: ImportClassRow[] = [];
  const errors: ParseError[] = [];

  if (lines.length === 0) {
    return {
      rows,
      errors: [{ lineNumber: 0, message: "请先粘贴分班表内容。" }],
    };
  }

  const firstLine = lines[0];
  const hasHeader =
    firstLine.includes("届别") ||
    firstLine.includes("班级") ||
    firstLine.includes("学生");

  const dataLines = hasHeader ? lines.slice(1) : lines;

  dataLines.forEach((line, index) => {
    const lineNumber = hasHeader ? index + 2 : index + 1;
    const columns = line.split(/\t|,/).map((column) => column.trim());

    const [cohort, className, school, teacherName, studentText, note] = columns;

    if (!cohort) errors.push({ lineNumber, message: "缺少届别 / 学期。" });
    if (!className) errors.push({ lineNumber, message: "缺少班级名称。" });
    if (!teacherName) errors.push({ lineNumber, message: "缺少小老师姓名。" });
    if (!studentText) errors.push({ lineNumber, message: "缺少学生名单。" });

    const studentNames = splitNames(studentText || "");

    if (studentText && studentNames.length === 0) {
      errors.push({
        lineNumber,
        message: "学生名单格式无法识别，请用顿号、逗号或分号分隔学生。",
      });
    }

    if (!cohort || !className || !teacherName || studentNames.length === 0) {
      return;
    }

    rows.push({
      cohort,
      className,
      school: school || "",
      teacherName,
      studentNames,
      note: note || "",
    });
  });

  const seenClassKeys = new Set<string>();

  rows.forEach((row, index) => {
    const key = `${normalizeName(row.cohort)}-${normalizeName(row.className)}`;

    if (seenClassKeys.has(key)) {
      errors.push({
        lineNumber: index + 2,
        message: `发现重复班级：${row.cohort} / ${row.className}。一行应该对应一个班级。`,
      });
    }

    seenClassKeys.add(key);
  });

  return { rows, errors };
}

function getStatusLabel(status: string) {
  if (status === "active") return "运行中";
  if (status === "archived") return "已封存";
  if (status === "delete_requested") return "删除申请中";
  return status;
}

function getStatusClassName(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  return "bg-stone-100 text-stone-500";
}

async function getOrCreateCohort(cohortName: string) {
  const trimmedName = cohortName.trim();
  const normalizedName = normalizeName(trimmedName);

  const { data: existingCohort, error: existingError } = await supabase
    .from("cohorts")
    .select("id, name")
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existingCohort) return existingCohort;

  const { data: newCohort, error } = await supabase
    .from("cohorts")
    .insert({
      name: trimmedName,
      normalized_name: normalizedName,
      status: "active",
    })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);

  return newCohort;
}

async function getOrCreateClass(
  cohortId: string,
  className: string,
  school: string
) {
  const trimmedClassName = className.trim();
  const normalizedClassName = normalizeName(trimmedClassName);

  const { data: existingClass, error: existingError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("cohort_id", cohortId)
    .eq("normalized_name", normalizedClassName)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existingClass) return existingClass;

  const { data: newClass, error } = await supabase
    .from("classes")
    .insert({
      cohort_id: cohortId,
      name: trimmedClassName,
      normalized_name: normalizedClassName,
      school: school || null,
      status: "active",
    })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);

  return newClass;
}

async function getOrCreateTeacher(teacherName: string) {
  const { data: existingTeacher } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("name", teacherName)
    .maybeSingle();

  if (existingTeacher) return existingTeacher;

  const { data: newTeacher, error } = await supabase
    .from("teachers")
    .insert({
      name: teacherName,
      status: "active",
    })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);

  return newTeacher;
}

async function getOrCreateStudent(studentName: string, note?: string) {
  const { data: existingStudents } = await supabase
    .from("students")
    .select("id, name")
    .eq("name", studentName)
    .limit(1);

  if (existingStudents && existingStudents.length > 0) {
    return existingStudents[0];
  }

  const { data: newStudent, error } = await supabase
    .from("students")
    .insert({
      name: studentName,
      note: note || null,
      status: "active",
    })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);

  return newStudent;
}

export default function AdminClassesPage() {
  const [importText, setImportText] = useState("");
  const [hasParsed, setHasParsed] = useState(false);

  const [classes, setClasses] = useState<ClassTableItem[]>([]);
  const [cohorts, setCohorts] = useState<CohortItem[]>([]);
  const [requests, setRequests] = useState<AdminActionRequest[]>([]);

  const [message, setMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(true);
  const [isClassListOpen, setIsClassListOpen] = useState(true);

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editTeacherNames, setEditTeacherNames] = useState("");
  const [editStudentNames, setEditStudentNames] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [selectedArchiveCohortId, setSelectedArchiveCohortId] = useState("");
  const [isArchivingCohort, setIsArchivingCohort] = useState(false);
  const [selectedClassView, setSelectedClassView] = useState("active");
  const [currentAdminName, setCurrentAdminName] = useState("");

  const [isApprovingAllCreateRequests, setIsApprovingAllCreateRequests] =
  useState(false);

  const { rows, errors } = useMemo(() => {
    if (!hasParsed) return { rows: [], errors: [] };
    return parseImportText(importText);
  }, [hasParsed, importText]);

  const totalStudents = rows.reduce(
    (sum, row) => sum + row.studentNames.length,
    0
  );

  const totalTeachers = new Set(rows.map((row) => row.teacherName)).size;

  const activeClasses = classes.filter(
    (classItem) => classItem.status === "active"
  );

  const archivedClasses = classes.filter(
    (classItem) => classItem.status === "archived"
  );

  const deleteRequestedClasses = classes.filter(
    (classItem) => classItem.status === "delete_requested"
  );

  const filteredClasses = classes.filter((classItem) => {
    if (selectedClassView === "active") {
      return (
        classItem.status === "active" ||
        classItem.status === "delete_requested"
      );
    }

    return classItem.cohortId === selectedClassView;
  });

  function getClassDeleteRequest(classId: string) {
    return requests.find(
      (request) =>
        request.action_type === "delete_class" &&
        request.target_type === "class" &&
        request.target_id === classId &&
        request.status === "pending"
    );
  }

  async function fetchCohorts() {
    const { data, error } = await supabase
      .from("cohorts")
      .select("id, name, status")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`读取届别失败：${error.message}`);
      return;
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
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`读取操作申请失败：${error.message}`);
      return;
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
      setMessage(`读取班级失败：${error.message}`);
      return;
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
        status: classItem.status,
        cohortId: classItem.cohort_id,
        cohortName: classItem.cohorts?.name || "未设置届别",
        teacherNames,
        studentNames,
      };
    });

    setClasses(formattedClasses);

    if (formattedClasses.length > 0) {
      setShowImportPanel(false);
    }
  }

  async function refreshData() {
    await fetchCohorts();
    await fetchRequests();
    await fetchClasses();
  }

  async function registerApproval(request: AdminActionRequest) {
    const trimmedAdminName = currentAdminName.trim();

    if (!trimmedAdminName) {
      setMessage("请先填写当前管理员姓名。");
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

  useEffect(() => {
    refreshData();
  }, []);

  function handleParse() {
    setHasParsed(true);
    setMessage("");
  }

  function handleClear() {
    setImportText("");
    setHasParsed(false);
    setMessage("");
  }

  function handleUseSample() {
    setImportText(sampleText);
    setHasParsed(false);
    setMessage("");
  }

  async function handleImport() {
    setMessage("");

    const parsed = parseImportText(importText);

    if (parsed.errors.length > 0) {
      setHasParsed(true);
      setMessage("提交失败：请先修正表格中的格式问题。");
      return;
    }

    if (parsed.rows.length === 0) {
      setMessage("提交失败：没有可以提交的班级。");
      return;
    }

    const parsedStudentCount = parsed.rows.reduce(
      (sum, row) => sum + row.studentNames.length,
      0
    );

    const confirmed = window.confirm(
      `确认提交 ${parsed.rows.length} 个班级创建申请、${parsedStudentCount} 名学生信息吗？\n\n这一步不会直接创建班级，需要管理员确认后才会正式写入系统。`
    );

    if (!confirmed) return;

    setIsImporting(true);

    try {
      let requestedClassCount = 0;
      let skippedExistingClassCount = 0;
      let skippedPendingRequestCount = 0;

      const { data: pendingRequestsData, error: pendingRequestsError } =
        await supabase
          .from("admin_action_requests")
          .select("id, note")
          .eq("action_type", "create_class")
          .eq("target_type", "class")
          .eq("status", "pending");

      if (pendingRequestsError) {
        throw new Error(pendingRequestsError.message);
      }

      const pendingPayloads = (pendingRequestsData || [])
        .map((request) => readCreateClassPayload(request.note))
        .filter(Boolean) as CreateClassRequestPayload[];

      for (const row of parsed.rows) {
        const cohortName = row.cohort.trim();
        const className = row.className.trim();
        const normalizedCohortName = normalizeName(cohortName);
        const normalizedClassName = normalizeName(className);

        const { data: existingCohort, error: existingCohortError } =
          await supabase
            .from("cohorts")
            .select("id, name")
            .eq("normalized_name", normalizedCohortName)
            .maybeSingle();

        if (existingCohortError) {
          throw new Error(existingCohortError.message);
        }

        if (existingCohort) {
          const { data: existingClass, error: existingClassError } =
            await supabase
              .from("classes")
              .select("id")
              .eq("cohort_id", existingCohort.id)
              .eq("normalized_name", normalizedClassName)
              .maybeSingle();

          if (existingClassError) {
            throw new Error(existingClassError.message);
          }

          if (existingClass) {
            skippedExistingClassCount += 1;
            continue;
          }
        }

        const hasPendingRequest = pendingPayloads.some((payload) => {
          return (
            payload.normalizedCohortName === normalizedCohortName &&
            payload.normalizedClassName === normalizedClassName
          );
        });

        if (hasPendingRequest) {
          skippedPendingRequestCount += 1;
          continue;
        }

        const payload: CreateClassRequestPayload = {
          cohortName,
          normalizedCohortName,
          className,
          normalizedClassName,
          school: row.school.trim(),
          teacherName: row.teacherName.trim(),
          studentNames: row.studentNames,
          note: row.note.trim(),
        };

        const { error: requestError } = await supabase
          .from("admin_action_requests")
          .insert({
            action_type: "create_class",
            target_type: "class",
            target_id: crypto.randomUUID(),
            target_name: `${cohortName} / ${className}`,
            status: "pending",
            approvals_count: 0,
            required_approvals: CREATE_CLASS_REQUIRED_APPROVALS,
            requested_by: currentAdminName.trim() || "当前管理员",
            note: JSON.stringify(payload),
          });

        if (requestError) {
          throw new Error(requestError.message);
        }

        requestedClassCount += 1;
      }

      setMessage(
        `已提交 ${requestedClassCount} 个班级创建申请。跳过 ${skippedExistingClassCount} 个已存在班级，跳过 ${skippedPendingRequestCount} 个已有待确认申请。`
      );

      setHasParsed(false);
      setShowImportPanel(false);
      await refreshData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `提交失败：${error.message}`
          : "提交失败：未知错误。"
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function executeCreateClassRequest(
    request: AdminActionRequest,
    approvalCount: number
  ) {
    const payload = readCreateClassPayload(request.note);

    if (!payload) {
      setMessage("创建班级申请内容无法解析。");
      return;
    }

    try {
      const cohort = await getOrCreateCohort(payload.cohortName);

      const { data: existingClass, error: existingClassError } = await supabase
        .from("classes")
        .select("id")
        .eq("cohort_id", cohort.id)
        .eq("normalized_name", payload.normalizedClassName)
        .maybeSingle();

      if (existingClassError) {
        throw new Error(existingClassError.message);
      }

      if (existingClass) {
        await supabase
          .from("admin_action_requests")
          .update({
            approvals_count: approvalCount,
            status: "completed",
            note: `${request.note}\n\n系统执行结果：该班级已经存在，因此没有重复创建。`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);

        setMessage("这个班级已经存在，系统没有重复创建。申请已标记为完成。");
        await refreshData();
        return;
      }

      const classItem = await getOrCreateClass(
        cohort.id,
        payload.className,
        payload.school
      );

      const teacher = await getOrCreateTeacher(payload.teacherName);

      const { error: teacherRelationError } = await supabase
        .from("class_teachers")
        .upsert(
          {
            class_id: classItem.id,
            teacher_id: teacher.id,
          },
          {
            onConflict: "class_id,teacher_id",
          }
        );

      if (teacherRelationError) {
        throw new Error(teacherRelationError.message);
      }

      for (const studentName of payload.studentNames) {
        const student = await getOrCreateStudent(studentName, payload.note);

        const { error: studentRelationError } = await supabase
          .from("class_students")
          .upsert(
            {
              class_id: classItem.id,
              student_id: student.id,
            },
            {
              onConflict: "class_id,student_id",
            }
          );

        if (studentRelationError) {
          throw new Error(studentRelationError.message);
        }
      }

      const { error: requestError } = await supabase
        .from("admin_action_requests")
        .update({
          approvals_count: approvalCount,
          status: "completed",
          note: `${request.note}\n\n系统执行结果：班级已正式创建。`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (requestError) {
        throw new Error(requestError.message);
      }

      setMessage(
        `班级创建成功：${payload.cohortName} / ${payload.className}。届别已自动复用或创建。`
      );

      await refreshData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `创建班级失败：${error.message}`
          : "创建班级失败：未知错误。"
      );
    }
  }

  async function approveCreateClassRequest(request: AdminActionRequest) {
    const payload = readCreateClassPayload(request.note);

    const confirmed = window.confirm(
      `确认批准创建班级吗？\n\n届别：${
        payload?.cohortName || "无法读取"
      }\n班级：${payload?.className || request.target_name}\n小老师：${
        payload?.teacherName || "无法读取"
      }\n学生数：${payload?.studentNames.length || 0}\n\n当前确认数：${
        request.approvals_count
      }/${request.required_approvals}\n\n同一管理员不能重复确认。`
    );

    if (!confirmed) return;

    const approvalCount = await registerApproval(request);

    if (approvalCount === null) return;

    if (approvalCount < request.required_approvals) {
      setMessage(
        `已记录一次确认。创建班级还需要 ${
          request.required_approvals - approvalCount
        } 次确认。`
      );

      await refreshData();
      return;
    }

    await executeCreateClassRequest(request, approvalCount);
  }

  async function approveAllCreateClassRequests() {
    const trimmedAdminName = currentAdminName.trim();

    if (!trimmedAdminName) {
      setMessage("请先填写当前管理员姓名。");
      return;
    }

    if (createClassRequests.length === 0) {
      setMessage("目前没有待确认的班级创建申请。");
      return;
    }

    const confirmed = window.confirm(
      `确认以管理员「${trimmedAdminName}」的身份，统一确认全部 ${createClassRequests.length} 个班级创建申请吗？\n\n同一管理员对同一个申请只能确认一次。已经确认过的申请会自动跳过。达到确认人数的申请会立即创建班级。`
    );

    if (!confirmed) return;

    setIsApprovingAllCreateRequests(true);
    setMessage("");

    try {
      let approvedCount = 0;
      let skippedDuplicateCount = 0;
      let completedCount = 0;
      let failedCount = 0;

      for (const request of createClassRequests) {
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
            skippedDuplicateCount += 1;
            continue;
          }

          failedCount += 1;
          continue;
        }

        approvedCount += 1;

        const { count, error: countError } = await supabase
          .from("admin_action_approvals")
          .select("id", { count: "exact", head: true })
          .eq("request_id", request.id);

        if (countError) {
          failedCount += 1;
          continue;
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
          failedCount += 1;
          continue;
        }

        if (approvalCount >= request.required_approvals) {
          await executeCreateClassRequest(request, approvalCount);
          completedCount += 1;
        }
      }

      setMessage(
        `统一确认完成：新增确认 ${approvedCount} 条，跳过已确认 ${skippedDuplicateCount} 条，正式创建 ${completedCount} 个班级，失败 ${failedCount} 条。`
      );

      await refreshData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `统一确认失败：${error.message}`
          : "统一确认失败：未知错误。"
      );
    } finally {
      setIsApprovingAllCreateRequests(false);
    }
  }

  async function cancelCreateClassRequest(request: AdminActionRequest) {
    const confirmed = window.confirm(
      `确认取消创建班级申请吗？\n\n申请：${request.target_name}\n\n取消后，这个班级不会被创建。`
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
        note: `${request.note || ""}\n\n创建申请已取消。`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      setMessage(`取消创建申请失败：${error.message}`);
      return;
    }

    setMessage(`${request.target_name} 的创建申请已取消。`);
    await refreshData();
  }

  function startEditingClass(classItem: ClassTableItem) {
    setEditingClassId(classItem.id);
    setEditClassName(classItem.name);
    setEditSchool(classItem.school || "");
    setEditTeacherNames(classItem.teacherNames.join("、"));
    setEditStudentNames(classItem.studentNames.join("、"));
    setMessage("");
  }

  function cancelEditingClass() {
    setEditingClassId(null);
    setEditClassName("");
    setEditSchool("");
    setEditTeacherNames("");
    setEditStudentNames("");
    setMessage("");
  }

  async function saveClassEdit(classId: string) {
    const newClassName = editClassName.trim();
    const newSchool = editSchool.trim();
    const newTeacherNames = splitNames(editTeacherNames);
    const newStudentNames = splitNames(editStudentNames);

    if (!newClassName) {
      setMessage("保存失败：班级名称不能为空。");
      return;
    }

    if (newTeacherNames.length === 0) {
      setMessage("保存失败：至少需要填写一位小老师。");
      return;
    }

    if (newStudentNames.length === 0) {
      setMessage("保存失败：至少需要填写一名学生。");
      return;
    }

    const confirmed = window.confirm(
      "确认保存修改吗？这不会删除历史课程记录，只会更新班级信息和当前成员名单。"
    );

    if (!confirmed) return;

    setIsSavingEdit(true);
    setMessage("");

    try {
      const { error: classError } = await supabase
        .from("classes")
        .update({
          name: newClassName,
          normalized_name: normalizeName(newClassName),
          school: newSchool || null,
        })
        .eq("id", classId);

      if (classError) throw new Error(classError.message);

      const { error: deleteTeachersError } = await supabase
        .from("class_teachers")
        .delete()
        .eq("class_id", classId);

      if (deleteTeachersError) throw new Error(deleteTeachersError.message);

      for (const teacherName of newTeacherNames) {
        const teacher = await getOrCreateTeacher(teacherName);

        const { error: teacherRelationError } = await supabase
          .from("class_teachers")
          .upsert(
            {
              class_id: classId,
              teacher_id: teacher.id,
            },
            {
              onConflict: "class_id,teacher_id",
            }
          );

        if (teacherRelationError) {
          throw new Error(teacherRelationError.message);
        }
      }

      const { error: deleteStudentsError } = await supabase
        .from("class_students")
        .delete()
        .eq("class_id", classId);

      if (deleteStudentsError) throw new Error(deleteStudentsError.message);

      for (const studentName of newStudentNames) {
        const student = await getOrCreateStudent(studentName);

        const { error: studentRelationError } = await supabase
          .from("class_students")
          .upsert(
            {
              class_id: classId,
              student_id: student.id,
            },
            {
              onConflict: "class_id,student_id",
            }
          );

        if (studentRelationError) {
          throw new Error(studentRelationError.message);
        }
      }

      setMessage("班级修改成功。历史课程记录没有被删除。");
      cancelEditingClass();
      await refreshData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `保存失败：${error.message}`
          : "保存失败：未知错误。"
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function requestDeleteClass(classId: string, className: string) {
    const confirmed = window.confirm(
      `确认提交删除申请吗？\n\n班级：${className}\n\n这一步不会真正删除班级，只会把它标记为“删除申请中”。正式删除需要两位管理员确认。`
    );

    if (!confirmed) return;

    const { error: requestError } = await supabase
      .from("admin_action_requests")
      .insert({
        action_type: "delete_class",
        target_type: "class",
        target_id: classId,
        target_name: className,
        status: "pending",
        approvals_count: 0,
        required_approvals: DELETE_CLASS_REQUIRED_APPROVALS,
        requested_by: currentAdminName.trim() || "当前管理员",
        note: "申请删除错建班级",
      });

    if (requestError) {
      setMessage(`提交删除申请失败：${requestError.message}`);
      return;
    }

    const { error: classError } = await supabase
      .from("classes")
      .update({
        status: "delete_requested",
      })
      .eq("id", classId);

    if (classError) {
      setMessage(`更新班级状态失败：${classError.message}`);
      return;
    }

    setMessage("删除申请已提交。班级和历史数据暂时都没有被删除。");
    await refreshData();
  }

  async function cancelDeleteRequest(classId: string, className: string) {
    const confirmed = window.confirm(
      `确认撤回删除申请吗？\n\n班级：${className}\n\n撤回后，这个班级会恢复为运行中。`
    );

    if (!confirmed) return;

    const request = getClassDeleteRequest(classId);

    if (request) {
      const { error: approvalError } = await supabase
        .from("admin_action_approvals")
        .delete()
        .eq("request_id", request.id);

      if (approvalError) {
        setMessage(`清除确认记录失败：${approvalError.message}`);
        return;
      }

      const { error: requestError } = await supabase
        .from("admin_action_requests")
        .update({
          status: "canceled",
          approvals_count: 0,
          note: "删除申请已撤回。",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (requestError) {
        setMessage(`撤回删除申请失败：${requestError.message}`);
        return;
      }
    }

    const { error: classError } = await supabase
      .from("classes")
      .update({
        status: "active",
      })
      .eq("id", classId);

    if (classError) {
      setMessage(`恢复班级状态失败：${classError.message}`);
      return;
    }

    setMessage("删除申请已撤回，班级恢复为运行中。");
    await refreshData();
  }

  async function approveDeleteClass(classItem: ClassTableItem) {
    const request = getClassDeleteRequest(classItem.id);

    if (!request) {
      setMessage("没有找到这个班级的删除申请。");
      return;
    }

    const confirmed = window.confirm(
      `确认批准删除申请吗？\n\n班级：${classItem.name}\n当前确认数：${request.approvals_count}/${request.required_approvals}`
    );

    if (!confirmed) return;

    const approvalCount = await registerApproval(request);

    if (approvalCount === null) return;

    if (approvalCount < request.required_approvals) {
      setMessage(
        `已记录一次确认。删除申请还需要 ${
          request.required_approvals - approvalCount
        } 次确认。`
      );

      await refreshData();
      return;
    }

    const { count: lessonCount, error: lessonError } = await supabase
      .from("lesson_records")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classItem.id);

    if (lessonError) {
      setMessage(
        `删除前检查失败：${lessonError.message}。为了保护历史记录，系统没有删除班级。`
      );
      return;
    }

    if ((lessonCount || 0) > 0) {
      const { error: archiveError } = await supabase
        .from("classes")
        .update({
          status: "archived",
        })
        .eq("id", classItem.id);

      if (archiveError) {
        setMessage(`班级有课程记录，转为封存失败：${archiveError.message}`);
        return;
      }

      await supabase
        .from("admin_action_requests")
        .update({
          approvals_count: approvalCount,
          status: "completed",
          note: "班级已有课程记录，系统未真删除，已改为封存。",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      setMessage(
        "这个班级已有课程记录，系统没有真正删除，而是改为封存。历史课程记录仍然保留。"
      );

      await refreshData();
      return;
    }

    await supabase.from("class_teachers").delete().eq("class_id", classItem.id);
    await supabase.from("class_students").delete().eq("class_id", classItem.id);

    const { error: deleteClassError } = await supabase
      .from("classes")
      .delete()
      .eq("id", classItem.id);

    if (deleteClassError) {
      setMessage(`正式删除失败：${deleteClassError.message}`);
      return;
    }

    await supabase
      .from("admin_action_requests")
      .update({
        approvals_count: approvalCount,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    setMessage("班级已正式删除。这个删除只适用于没有课程记录的错建班级。");
    await refreshData();
  }

  async function archiveSelectedCohort() {
    const cohort = cohorts.find(
      (cohortItem) => cohortItem.id === selectedArchiveCohortId
    );

    if (!cohort) {
      setMessage("请先选择要封存的届别。");
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
      const { data: existingRequest } = await supabase
        .from("admin_action_requests")
        .select("id")
        .eq("action_type", "archive_cohort")
        .eq("target_type", "cohort")
        .eq("target_id", cohort.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        setMessage("这个届别已经有封存申请，不需要重复提交。");
        setIsArchivingCohort(false);
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
          requested_by: currentAdminName.trim() || "当前管理员",
          note: "学年结束，申请封存整届班级，并同步归档只属于该届的老师和学生。",
        });

      if (requestError) throw new Error(requestError.message);

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

  const archiveRequests = requests.filter(
    (request) =>
      request.action_type === "archive_cohort" &&
      request.target_type === "cohort"
  );

  const createClassRequests = requests.filter(
    (request) =>
      request.action_type === "create_class" &&
      request.target_type === "class"
  );

  return (
    <AdminGuard>
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="mt-2 text-3xl font-bold text-emerald-950">
                班级与分班管理
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                这里用于批量提交分班创建申请、修改班级信息、处理删除申请和封存旧届别。新增班级需要管理员确认后才会正式写入系统。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {showImportPanel ? (
                <button
                  type="button"
                  onClick={() => setShowImportPanel(false)}
                  className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                >
                  返回班级管理
                </button>
              ) : (
                <Link
                  href="/admin"
                  className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                >
                  返回管理员主页
                </Link>
              )}
            </div>
          </div>

          <section className="mb-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <p className="font-semibold text-emerald-900">当前确认管理员</p>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              现在还没有正式登录系统，所以先用管理员姓名模拟。所有创建、删除和封存确认都会记录这个名字，同一管理员不能重复确认同一个申请。
            </p>

            <input
              value={currentAdminName}
              onChange={(event) => setCurrentAdminName(event.target.value)}
              placeholder="填写当前管理员姓名，例如 Ethan"
              className="mt-3 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none focus:border-emerald-500 md:max-w-sm"
            />
          </section>

          {message && (
            <div className="mb-6 rounded-2xl border border-emerald-100 bg-white p-4 text-sm font-semibold text-emerald-800 shadow-sm">
              {message}
            </div>
          )}

          {createClassRequests.length > 0 && (
            <section className="mb-6 rounded-[1.75rem] border border-amber-100 bg-amber-50 p-5 shadow-sm md:p-6">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h2 className="text-xl font-bold text-amber-900">
                    待确认班级创建申请
                  </h2>

                  <p className="mt-2 text-sm leading-7 text-amber-800">
                    创建班级属于高影响操作。只有管理员确认数达到要求后，系统才会真正创建届别、班级、小老师和学生关系。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={approveAllCreateClassRequests}
                  disabled={
                    isApprovingAllCreateRequests || createClassRequests.length === 0
                  }
                  className="w-fit rounded-full bg-amber-100 px-5 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApprovingAllCreateRequests
                    ? "正在统一确认..."
                    : `统一确认全部 ${createClassRequests.length} 个申请`}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {createClassRequests.map((request) => {
                  const payload = readCreateClassPayload(request.note);

                  return (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-amber-100 bg-white p-4"
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div>
                          <p className="text-sm font-bold text-amber-900">
                            {payload
                              ? `${payload.cohortName} / ${payload.className}`
                              : request.target_name}
                          </p>

                          {payload && (
                            <div className="mt-2 space-y-1 text-sm text-stone-600">
                              <p>合作学校：{payload.school || "未填写"}</p>
                              <p>小老师：{payload.teacherName}</p>
                              <p>学生：{payload.studentNames.join("、")}</p>
                              {payload.note && <p>备注：{payload.note}</p>}
                            </div>
                          )}

                          <p className="mt-2 text-sm font-semibold text-amber-800">
                            当前确认数：{request.approvals_count}/
                            {request.required_approvals}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => approveCreateClassRequest(request)}
                            className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
                          >
                            确认创建
                          </button>

                          <button
                            type="button"
                            onClick={() => cancelCreateClassRequest(request)}
                            className="rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                          >
                            取消申请
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {showImportPanel ? (
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-7">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <h2 className="text-2xl font-bold text-emerald-950">
                    批量提交分班创建申请
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                    从 Excel 或 Google Sheets 复制表格后粘贴到这里。推荐列顺序：
                    <span className="font-semibold text-emerald-800">
                      {" "}
                      届别、班级名称、合作学校、小老师、学生名单、备注
                    </span>
                    。学生名单可以用顿号、逗号、分号分隔。提交后不会直接创建班级，需要管理员确认。
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleUseSample}
                    className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                  >
                    使用示例
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                  >
                    清空
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-[#fffdf4] p-4 text-sm leading-7 text-stone-600">
                <p className="font-semibold text-emerald-900">示例格式：</p>
                <p className="mt-2 overflow-x-auto whitespace-pre text-xs leading-6">
                  届别	班级名称	合作学校	小老师	学生名单	备注
                  {"\n"}
                  2026 暑期	秋叶班	河北某小学	Ethan	学生A、学生B、学生C	阅读基础较弱
                  {"\n"}
                  2026 暑期	蓝天班	河北某小学	Cindy	学生D、学生E、学生F	喜欢历史
                </p>
              </div>

              <textarea
                value={importText}
                onChange={(event) => {
                  setImportText(event.target.value);
                  setHasParsed(false);
                  setMessage("");
                }}
                rows={12}
                placeholder="从 Excel 或 Google Sheets 复制分班表，然后粘贴到这里。"
                className="mt-5 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 font-mono text-sm leading-7 outline-none transition focus:border-emerald-500 focus:bg-white"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleParse}
                  className="rounded-full bg-[#2f5d50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
                >
                  预览
                </button>

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isImporting || importText.trim().length === 0}
                  className="rounded-full border border-emerald-700 px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting ? "正在提交..." : "提交创建申请"}
                </button>
              </div>

              {hasParsed && (
                <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5">
                  <h3 className="text-xl font-bold text-emerald-950">
                    导入预览
                  </h3>

                  {errors.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
                      <p className="text-sm font-semibold text-red-700">
                        发现 {errors.length} 个格式问题
                      </p>

                      <div className="mt-3 space-y-2">
                        {errors.map((error, index) => (
                          <p key={index} className="text-sm text-red-700">
                            第 {error.lineNumber} 行：{error.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {rows.length > 0 && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-[#fffdf4] p-4">
                        <p className="text-sm text-stone-500">班级数量</p>
                        <p className="mt-1 text-3xl font-bold text-emerald-950">
                          {rows.length}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-[#fffdf4] p-4">
                        <p className="text-sm text-stone-500">学生数量</p>
                        <p className="mt-1 text-3xl font-bold text-emerald-950">
                          {totalStudents}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-[#fffdf4] p-4">
                        <p className="text-sm text-stone-500">小老师数量</p>
                        <p className="mt-1 text-3xl font-bold text-emerald-950">
                          {totalTeachers}
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </section>
          ) : (
            <section className="mb-6 rounded-[1.75rem] border border-dashed border-emerald-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-bold text-emerald-950">
                    班级日常管理
                  </h2>

                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    创建和换届通常一年只做一次。日常管理主要是查看班级详情、核对成员、查看课程记录和教学进展。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowImportPanel(true)}
                  className="w-fit rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
                >
                  补充导入
                </button>
              </div>
            </section>
          )}

          <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">
                  已导入班级
                </h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  默认只显示运行中的班级。已封存的历史届别不会出现在默认列表里，但可以通过筛选查看。
                </p>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex flex-col gap-2 md:flex-row">
                  <select
                    value={selectedClassView}
                    onChange={(event) => setSelectedClassView(event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-2.5 text-sm outline-none focus:border-emerald-500 md:w-64"
                  >
                    <option value="active">当前运行中 / 待处理班级</option>

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

                  <span className="w-fit rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                    删除申请 {deleteRequestedClasses.length}
                  </span>

                  <span className="w-fit rounded-full bg-[#fffdf4] px-3 py-1.5 text-xs font-semibold text-stone-600">
                    当前显示 {filteredClasses.length}
                  </span>
                </div>
              </div>
            </div>

            {!isClassListOpen ? (
              <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                班级列表已收起。当前筛选条件下共有 {filteredClasses.length} 个班级。
              </p>
            ) : filteredClasses.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                当前筛选条件下没有班级。你可以切换届别筛选，或者使用补充导入添加新班级。
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-2xl border border-emerald-100">
                <table className="w-full min-w-[1250px] border-collapse bg-white text-left text-sm">
                  <thead className="bg-[#fffdf4] text-stone-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">届别</th>
                      <th className="px-4 py-3 font-semibold">班级</th>
                      <th className="px-4 py-3 font-semibold">合作学校</th>
                      <th className="px-4 py-3 font-semibold">小老师</th>
                      <th className="px-4 py-3 font-semibold">学生名单</th>
                      <th className="px-4 py-3 font-semibold">人数</th>
                      <th className="px-4 py-3 font-semibold">状态</th>
                      <th className="px-4 py-3 font-semibold">删除流程</th>
                      <th className="px-4 py-3 font-semibold">操作</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClasses.map((classItem) => {
                      const deleteRequest = getClassDeleteRequest(classItem.id);

                      return (
                        <tr
                          key={classItem.id}
                          className="border-t border-emerald-50"
                        >
                          {editingClassId === classItem.id ? (
                            <>
                              <td className="px-4 py-4 align-top text-stone-600">
                                {classItem.cohortName}
                              </td>

                              <td className="px-4 py-4 align-top">
                                <input
                                  value={editClassName}
                                  onChange={(event) =>
                                    setEditClassName(event.target.value)
                                  }
                                  className="w-full rounded-xl border border-emerald-100 bg-[#fffdf4] px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
                                />
                              </td>

                              <td className="px-4 py-4 align-top">
                                <input
                                  value={editSchool}
                                  onChange={(event) =>
                                    setEditSchool(event.target.value)
                                  }
                                  className="w-full rounded-xl border border-emerald-100 bg-[#fffdf4] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                                  placeholder="合作学校"
                                />
                              </td>

                              <td className="px-4 py-4 align-top">
                                <input
                                  value={editTeacherNames}
                                  onChange={(event) =>
                                    setEditTeacherNames(event.target.value)
                                  }
                                  className="w-full rounded-xl border border-emerald-100 bg-[#fffdf4] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                                  placeholder="多位小老师用顿号分隔"
                                />
                              </td>

                              <td className="px-4 py-4 align-top">
                                <textarea
                                  value={editStudentNames}
                                  onChange={(event) =>
                                    setEditStudentNames(event.target.value)
                                  }
                                  rows={3}
                                  className="w-full rounded-xl border border-emerald-100 bg-[#fffdf4] px-3 py-2 text-sm leading-6 outline-none focus:border-emerald-500"
                                  placeholder="学生A、学生B、学生C"
                                />
                              </td>

                              <td className="px-4 py-4 align-top font-semibold text-stone-700">
                                {splitNames(editStudentNames).length}
                              </td>

                              <td className="px-4 py-4 align-top">
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                  编辑中
                                </span>
                              </td>

                              <td className="px-4 py-4 align-top text-stone-400">
                                暂停操作
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => saveClassEdit(classItem.id)}
                                    disabled={isSavingEdit}
                                    className="rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isSavingEdit ? "保存中" : "保存"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={cancelEditingClass}
                                    className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                                  >
                                    取消
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-4 align-top text-stone-600">
                                {classItem.cohortName}
                              </td>

                              <td className="px-4 py-4 align-top font-bold text-emerald-950">
                                {classItem.name}
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
                                    classItem.studentNames.map((studentName) => (
                                      <span
                                        key={studentName}
                                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                      >
                                        {studentName}
                                      </span>
                                    ))
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
                                {deleteRequest ? (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-red-700">
                                      {deleteRequest.approvals_count}/
                                      {deleteRequest.required_approvals} 已确认
                                    </p>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        approveDeleteClass(classItem)
                                      }
                                      className="rounded-full border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                    >
                                      确认删除
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        cancelDeleteRequest(
                                          classItem.id,
                                          classItem.name
                                        )
                                      }
                                      className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
                                    >
                                      撤回申请
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-stone-400">
                                    无申请
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className="flex flex-col gap-2">
                                  <Link
                                    href={`/admin/classes/${classItem.id}`}
                                    className="rounded-full bg-[#2f5d50] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-900"
                                  >
                                    查看详情
                                  </Link>

                                  {classItem.status !== "archived" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEditingClass(classItem)
                                      }
                                      className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                                    >
                                      编辑
                                    </button>
                                  )}

                                  {!deleteRequest &&
                                    classItem.status !== "archived" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          requestDeleteClass(
                                            classItem.id,
                                            classItem.name
                                          )
                                        }
                                        className="rounded-full border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                                      >
                                        申请删除
                                      </button>
                                    )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {!showImportPanel && (
            <section
              id="danger-zone"
              className="mt-8 rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm md:p-6"
            >
              <h2 className="text-xl font-bold text-red-800">
                学年结束与整届封存
              </h2>

              <p className="mt-2 text-sm leading-7 text-stone-600">
                这个区域只在一届课程真正结束后使用。封存会把这一届所有班级改为已封存，并同步归档只属于这一届的老师和学生。封存需要所有管理员确认，目前系统临时设定为 {TOTAL_ADMIN_COUNT} 位管理员。
              </p>

              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
                <select
                  value={selectedArchiveCohortId}
                  onChange={(event) =>
                    setSelectedArchiveCohortId(event.target.value)
                  }
                  className="w-full rounded-2xl border border-red-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none focus:border-red-300 md:max-w-xs"
                >
                  {cohorts.length === 0 ? (
                    <option value="">暂无届别</option>
                  ) : (
                    cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name} -{" "}
                        {cohort.status === "active" ? "运行中" : "已封存"}
                      </option>
                    ))
                  )}
                </select>

                <button
                  type="button"
                  onClick={archiveSelectedCohort}
                  disabled={isArchivingCohort || !selectedArchiveCohortId}
                  className="w-fit rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isArchivingCohort ? "正在提交..." : "提交整届封存申请"}
                </button>
              </div>

              {archiveRequests.length > 0 && (
                <div className="mt-5 space-y-3">
                  {archiveRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-red-100 bg-red-50 p-4"
                    >
                      <p className="text-sm font-bold text-red-800">
                        {request.target_name} 封存申请
                      </p>

                      <p className="mt-1 text-sm text-red-700">
                        当前确认数：{request.approvals_count}/
                        {request.required_approvals}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => approveArchiveCohort(request)}
                          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          确认封存
                        </button>

                        <button
                          type="button"
                          onClick={() => cancelArchiveCohortRequest(request)}
                          className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          取消申请
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>
      </main>
    </AdminGuard>
  );
}