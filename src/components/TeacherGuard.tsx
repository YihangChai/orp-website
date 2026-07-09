"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getCurrentTeacher, type CurrentTeacher } from "@/lib/auth";

type TeacherGuardProps = {
  children: ReactNode;
};

type TeacherContextValue = {
  currentTeacher: CurrentTeacher;
};

const TeacherContext = createContext<TeacherContextValue | null>(null);

let cachedCurrentTeacher: CurrentTeacher | null = null;
let currentTeacherRequest: Promise<CurrentTeacher | null> | null = null;

function readSavedTeacherSession() {
  if (typeof window === "undefined") return null;

  const rawSession = localStorage.getItem("orp_teacher_session");

  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession) as {
      teacherId?: string;
      teacherName?: string;
      email?: string | null;
      loggedInAt?: string;
    };
  } catch {
    localStorage.removeItem("orp_teacher_session");
    return null;
  }
}

function getValidCachedTeacher() {
  if (typeof window === "undefined") return null;

  const savedSession = readSavedTeacherSession();

  if (!savedSession?.teacherId) return null;
  if (!cachedCurrentTeacher) return null;

  if (cachedCurrentTeacher.id !== savedSession.teacherId) {
    cachedCurrentTeacher = null;
    return null;
  }

  return cachedCurrentTeacher;
}

function saveTeacherSession(teacher: CurrentTeacher) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    "orp_teacher_session",
    JSON.stringify({
      teacherId: teacher.id,
      teacherName: teacher.name,
      email: teacher.email,
      loggedInAt: new Date().toISOString(),
    })
  );
}

export function clearCurrentTeacherCache() {
  cachedCurrentTeacher = null;
  currentTeacherRequest = null;

  if (typeof window !== "undefined") {
    localStorage.removeItem("orp_teacher_session");
  }
}

async function loadCurrentTeacherOnce() {
  const cachedTeacher = getValidCachedTeacher();

  if (cachedTeacher) {
    return cachedTeacher;
  }

  if (currentTeacherRequest) {
    return currentTeacherRequest;
  }

  currentTeacherRequest = getCurrentTeacher()
    .then((teacher) => {
      if (!teacher) {
        clearCurrentTeacherCache();
        return null;
      }

      cachedCurrentTeacher = teacher;
      saveTeacherSession(teacher);

      return teacher;
    })
    .finally(() => {
      currentTeacherRequest = null;
    });

  return currentTeacherRequest;
}

export function useCurrentTeacher() {
  const context = useContext(TeacherContext);

  if (!context) {
    throw new Error("useCurrentTeacher must be used inside TeacherGuard.");
  }

  return context.currentTeacher;
}

export default function TeacherGuard({ children }: TeacherGuardProps) {
  const initialCachedTeacher = getValidCachedTeacher();

  const [currentTeacher, setCurrentTeacher] = useState<CurrentTeacher | null>(
    initialCachedTeacher
  );
  const [isCheckingTeacher, setIsCheckingTeacher] = useState(
    !initialCachedTeacher
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkTeacher() {
      const cachedTeacher = getValidCachedTeacher();

      if (cachedTeacher) {
        setCurrentTeacher(cachedTeacher);
        setIsCheckingTeacher(false);
        return;
      }

      setIsCheckingTeacher(true);
      setMessage("");

      const teacher = await loadCurrentTeacherOnce();

      if (!isMounted) return;

      if (!teacher) {
        setCurrentTeacher(null);
        setMessage("请先使用小老师账号登录。");
        setIsCheckingTeacher(false);
        return;
      }

      setCurrentTeacher(teacher);
      setIsCheckingTeacher(false);
    }

    checkTeacher();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isCheckingTeacher) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-600">正在检查小老师身份...</p>
        </section>
      </main>
    );
  }

  if (!currentTeacher) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-emerald-950">
            请先登录小老师账号
          </h1>

          <p className="mt-3 leading-7 text-stone-600">
            {message || "当前账号没有小老师权限。"}
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
    <TeacherContext.Provider value={{ currentTeacher }}>
      {children}
    </TeacherContext.Provider>
  );
}