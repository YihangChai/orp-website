/**
 * ORP 批量导入类型定义
 *
 * 数据流：
 * 1. ParsedImportRow    = 从文本解析出来，一行一个班级
 * 2. PreviewImportRow   = 前端预览用，一行一个班级，补全老师邮箱
 * 3. ExecutionImportRow = 后端执行用，一行一个学生，补全学生登录账号
 *
 * 学科统一存英文，前端显示时再转中文：
 * english -> 英语
 * math    -> 数学
 */
export type SubjectCode = "english" | "math";

/**
 * 从导入文本解析出的原始结构。
 * 一行代表一个班级，studentNames 仍然是数组。
 */
export type ParsedImportRow = {
  rowNumber: number;
  lineNumber: number;

  cohortName: string;
  className: string;
  school: string;

  /**
   * 班级/老师学科。
   * 解析阶段可能先是空字符串或未规范化文本，后续 validate 再检查。
   */
  subject: string;

  teacherName: string;
  teacherEnteringYear: string;

  studentNames: string[];
  studentGrade: string;

  rawLine: string;
};

/**
 * 前端预览结构。
 * 仍然是一行一个班级，但已经生成老师邮箱。
 */
export type PreviewImportRow = ParsedImportRow & {
  teacherEmailPrefix: string;
  teacherEmail: string;
};

/**
 * 后端真正执行导入的结构。
 * route.ts 会把 PreviewImportRow 展开成 ExecutionImportRow：
 * 一个学生一行，方便逐个创建账号和绑定班级。
 */
export type ExecutionImportRow = {
  rowNumber: number;
  lineNumber: number;

  cohortName: string;
  className: string;
  school: string;

  /**
   * 写入 classes.subject 和 teachers.subject。
   * 学生不单独存 subject；学生学科由 class_students -> classes.subject 推导。
   */
  subject: SubjectCode;

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

  /**
   * studentCount = 去重后的学生人数
   * studentSeatCount = 班级座位数，例如同一个学生在英语班和数学班算 2 个 seat
   */
  studentSeatCount: number;
};

export type BulkImportAccountItem = {
  role: "teacher" | "student";
  name: string;
  loginAccount: string;
  initialPassword: string;
  className: string;

  /**
   * 这里显示本次导入涉及的班级学科。
   * teacher 的 subject 会同步写入 teachers.subject。
   * student 的 subject 不写入 students，只用于结果展示。
   */
  subject?: SubjectCode;

  status: "created" | "existing" | "restored" | "failed";
  message?: string;
};

/**
 * 导入前发现 archived 账号时返回给前端确认。
 * 这是未来“封存账号回顾界面”的基础数据结构。
 */
export type BulkImportReuseCandidate = {
  role: "teacher" | "student";
  rowNumber: number;

  /**
   * 未来 review 页面可以用 existingRecordId 直接跳转到账号详情。
   */
  existingRecordId?: string;

  name: string;
  loginAccount: string;
  currentStatus: string;
  className: string;
  subject?: SubjectCode;

  reason: string;

  /**
   * 预留给后续 review UI：
   * - canRestore: 是否允许恢复
   * - needsManualReview: 是否需要管理员人工判断
   */
  canRestore?: boolean;
  needsManualReview?: boolean;
};

/**
 * 未来单独“封存账号回顾界面”可以直接复用这个结构。
 * 它不一定只来自导入，也可以来自后台主动扫描 archived 账号。
 */
export type BulkImportArchivedReviewItem = {
  role: "teacher" | "student";
  recordId: string;
  name: string;
  loginAccount: string;
  currentStatus: string;
  subject?: SubjectCode;
  relatedClassNames?: string[];
  lastSeenAt?: string | null;
  reviewNote?: string | null;
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

  /**
   * 预留：如果后面导入完成后还想展示“本次涉及的封存账号处理记录”，可以放这里。
   */
  archivedReviewItems?: BulkImportArchivedReviewItem[];
};