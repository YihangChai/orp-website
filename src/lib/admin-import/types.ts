export type ParsedImportRow = {
  rowNumber: number;
  cohortName: string;
  className: string;
  school: string;
  teacherName: string;
  studentName: string;
  studentGrade: string;
};

export type PreviewImportRow = ParsedImportRow & {
  teacherEmailPrefix: string;
  teacherEmail: string;
  studentUsername: string;
  studentAuthEmail: string;
};

export type ImportValidationError = {
  rowNumber: number;
  field: string;
  message: string;
};

export type ImportPreviewSummary = {
  classCount: number;
  teacherCount: number;
  studentCount: number;
};

export type BulkImportAccountItem = {
  role: "teacher" | "student";
  name: string;
  loginAccount: string;
  initialPassword: string;
  className: string;
  status: "created" | "existing" | "failed";
  message?: string;
};

export type BulkImportResult = {
  createdClasses: number;
  createdTeachers: number;
  createdStudents: number;
  teacherBindings: number;
  studentBindings: number;
  skippedExisting: number;
  failed: number;
  accounts: BulkImportAccountItem[];
  errors: ImportValidationError[];
};