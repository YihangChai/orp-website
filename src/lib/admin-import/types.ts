export type ParsedImportRow = {
  rowNumber: number;
  lineNumber: number;

  cohortName: string;
  className: string;
  school: string;

  teacherName: string;
  teacherEnteringYear: string;

  studentNames: string[];
  studentGrade: string;

  rawLine: string;
};

export type PreviewImportRow = ParsedImportRow & {
  teacherEmailPrefix: string;
  teacherEmail: string;
};

export type ExecutionImportRow = {
  rowNumber: number;
  lineNumber: number;

  cohortName: string;
  className: string;
  school: string;

  teacherName: string;
  teacherEnteringYear: string;
  teacherEmailPrefix: string;
  teacherEmail: string;

  studentName: string;
  studentNames: string[];
  studentGrade: string;
  studentUsername: string;
  studentAuthEmail: string;

  rawLine: string;
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
  studentSeatCount: number;
};

export type BulkImportAccountItem = {
  role: "teacher" | "student";
  name: string;
  loginAccount: string;
  initialPassword: string;
  className: string;
  status: "created" | "existing" | "restored" | "failed";
  message?: string;
};

export type BulkImportReuseCandidate = {
  role: "teacher" | "student";
  rowNumber: number;
  name: string;
  loginAccount: string;
  currentStatus: string;
  className: string;
  reason: string;
};

export type BulkImportResult = {
  createdClasses: number;
  createdTeachers: number;
  createdStudents: number;
  teacherBindings: number;
  studentBindings: number;
  skippedExisting: number;
  restoredAccounts: number;
  failed: number;
  accounts: BulkImportAccountItem[];
  errors: ImportValidationError[];
};