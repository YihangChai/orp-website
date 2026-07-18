export type MaintenanceActionType =
  | "archive_cohort"
  | "delete_class"
  | "delete_teacher"
  | "delete_student"
  | "update_class_info"
  | "add_teacher_to_class"
  | "remove_teacher_from_class"
  | "add_student_to_class"
  | "remove_student_from_class"
  | "reset_teacher_password"
  | "reset_student_password";

export type MaintenanceTargetType = "cohort" | "class" | "teacher" | "student";

export type AdminActionRequest = {
  id: string;
  action_type: MaintenanceActionType | string;
  target_type: MaintenanceTargetType | string;
  target_id: string;
  target_name: string;
  status: string;
  approvals_count: number;
  required_approvals: number;
  requested_by: string | null;
  note: string | null;
  action_payload: Record<string, any> | null;
  created_at: string;
  updated_at: string | null;
};

export type AdminActionApproval = {
  id: string;
  request_id: string;
  admin_id: string | null;
  admin_name: string;
  created_at: string;
};

export type MaintenanceClassItem = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  cohort_id: string | null;
  cohort_name: string;
};

export type MaintenanceTeacherItem = {
  id: string;
  name: string;
  email: string | null;
  status: string;
};

export type MaintenanceStudentItem = {
  id: string;
  name: string;
  username: string | null;
  status: string;
  grade: string | null;
};

export type MaintenanceCohortItem = {
  id: string;
  name: string;
  status: string;
};