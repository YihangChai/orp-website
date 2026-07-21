"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getCurrentStudent, type CurrentStudent } from "@/lib/auth";

type StudentGuardProps = {
  children: ReactNode;
};

type StudentContextValue = {
  currentStudent: CurrentStudent;
};

const StudentContext = createContext<StudentContextValue | null>(null);

let cachedCurrentStudent: CurrentStudent | null = null;
let currentStudentRequest: Promise<CurrentStudent | null> | null = null;

function readSavedStudentSession() {
  if (typeof window === "undefined") return null;

  const rawSession = localStorage.getItem("orp_student_session");

  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession) as {
      studentId?: string;
      studentName?: string;
      username?: string | null;
      loggedInAt?: string;
    };
  } catch {
    localStorage.removeItem("orp_student_session");
    return null;
  }
}

function getValidCachedStudent() {
  if (typeof window === "undefined") return null;

  const savedSession = readSavedStudentSession();

  if (!savedSession?.studentId) return null;
  if (!cachedCurrentStudent) return null;

  if (cachedCurrentStudent.id !== savedSession.studentId) {
    cachedCurrentStudent = null;
    return null;
  }

  return cachedCurrentStudent;
}

function saveStudentSession(student: CurrentStudent) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    "orp_student_session",
    JSON.stringify({
      studentId: student.id,
      studentName: student.name,
      username: student.username,
      loggedInAt: new Date().toISOString(),
    })
  );
}

export function clearCurrentStudentCache() {
  cachedCurrentStudent = null;
  currentStudentRequest = null;

  if (typeof window !== "undefined") {
    localStorage.removeItem("orp_student_session");
  }
}

async function loadCurrentStudentOnce() {
  const cachedStudent = getValidCachedStudent();

  if (cachedStudent) {
    return cachedStudent;
  }

  if (currentStudentRequest) {
    return currentStudentRequest;
  }

  currentStudentRequest = getCurrentStudent()
    .then((student) => {
      if (!student) {
        clearCurrentStudentCache();
        return null;
      }

      cachedCurrentStudent = student;
      saveStudentSession(student);

      return student;
    })
    .finally(() => {
      currentStudentRequest = null;
    });

  return currentStudentRequest;
}

export function useCurrentStudent() {
  const context = useContext(StudentContext);

  if (!context) {
    throw new Error("useCurrentStudent must be used inside StudentGuard.");
  }

  return context.currentStudent;
}

export default function StudentGuard({ children }: StudentGuardProps) {
  const initialCachedStudent = getValidCachedStudent();

  const [currentStudent, setCurrentStudent] = useState<CurrentStudent | null>(
    initialCachedStudent
  );
  const [isCheckingStudent, setIsCheckingStudent] = useState(
    !initialCachedStudent
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkStudent() {
      if (getValidCachedStudent()) {
        setIsCheckingStudent(false);
        return;
      }

      setIsCheckingStudent(true);
      setMessage("");

      const student = await loadCurrentStudentOnce();

      if (!isMounted) return;

      if (!student) {
        setCurrentStudent(null);
        setMessage("请先使用学生账号登录。");
        setIsCheckingStudent(false);
        return;
      }

      setCurrentStudent(student);
      setIsCheckingStudent(false);
    }

    checkStudent();

    return () => {
      isMounted = false;
    };
  }, []);


  if (isCheckingStudent) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-600">正在检查学生身份...</p>
        </section>
      </main>
    );
  }

  if (!currentStudent) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-emerald-950">
            请先登录学生账号
          </h1>

          <p className="mt-3 leading-7 text-stone-600">
            {message || "当前账号没有学生权限。"}
          </p>

          <Link
            href="/login"
            className="mt-5 inline-block rounded-full bg-[#2f5d50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            前往登录
          </Link>
        </section>
      </main>
    );
  }

  return (
    <StudentContext.Provider value={{ currentStudent }}>
      {children}
    </StudentContext.Provider>
  );
}