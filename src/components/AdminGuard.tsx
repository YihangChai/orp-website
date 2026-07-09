"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/auth";

/**
 * AdminGuard 的职责：
 * 1. 检查当前登录者是否是管理员。
 * 2. 缓存当前管理员身份，避免 admin 页面之间切换时反复检查身份。
 * 3. 通过 useCurrentAdmin() 把当前管理员信息提供给 admin 页面。
 *
 * 注意：
 * 这里的缓存只是前端体验优化，不是真正的安全边界。
 * 真正的数据权限仍然依赖 Supabase RLS。
 */

/* =========================
   1. 类型定义
   ========================= */

type AdminGuardProps = {
  children: ReactNode;
};

type AdminContextValue = {
  currentAdmin: CurrentAdmin;
};

/* =========================
   2. Context：让 admin 页面可以直接使用 currentAdmin
   ========================= */

const AdminContext = createContext<AdminContextValue | null>(null);

/* =========================
   3. 模块级缓存：避免 AdminGuard 重复检查身份
   ========================= */

let cachedCurrentAdmin: CurrentAdmin | null = null;
let currentAdminRequest: Promise<CurrentAdmin | null> | null = null;

/* =========================
   4. localStorage 读取：只用来辅助判断缓存是否属于同一个管理员
   ========================= */

function readSavedAdminSession() {
  if (typeof window === "undefined") return null;

  const rawSession = localStorage.getItem("orp_admin_session");

  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession) as {
      adminId?: string;
      adminName?: string;
      email?: string | null;
      loggedInAt?: string;
    };
  } catch {
    localStorage.removeItem("orp_admin_session");
    return null;
  }
}

/* =========================
   5. 校验缓存：只有 localStorage 里的 adminId 和内存缓存一致时才复用
   ========================= */

function getValidCachedAdmin() {
  if (typeof window === "undefined") return null;

  const savedSession = readSavedAdminSession();

  if (!savedSession?.adminId) return null;
  if (!cachedCurrentAdmin) return null;

  if (cachedCurrentAdmin.id !== savedSession.adminId) {
    cachedCurrentAdmin = null;
    return null;
  }

  return cachedCurrentAdmin;
}

/* =========================
   6. 保存 session：给之后的页面切换提供缓存依据
   ========================= */

function saveAdminSession(admin: CurrentAdmin) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    "orp_admin_session",
    JSON.stringify({
      adminId: admin.id,
      adminName: admin.name,
      email: admin.email,
      loggedInAt: new Date().toISOString(),
    })
  );
}

/* =========================
   7. 清理缓存：logout 或身份失效时使用
   ========================= */

export function clearCurrentAdminCache() {
  cachedCurrentAdmin = null;
  currentAdminRequest = null;

  if (typeof window !== "undefined") {
    localStorage.removeItem("orp_admin_session");
  }
}

/* =========================
   8. 加载当前管理员：避免同时发出多次 getCurrentAdmin()
   ========================= */

async function loadCurrentAdminOnce() {
  const cachedAdmin = getValidCachedAdmin();

  if (cachedAdmin) {
    return cachedAdmin;
  }

  if (currentAdminRequest) {
    return currentAdminRequest;
  }

  currentAdminRequest = getCurrentAdmin()
    .then((admin) => {
      if (!admin) {
        clearCurrentAdminCache();
        return null;
      }

      cachedCurrentAdmin = admin;
      saveAdminSession(admin);

      return admin;
    })
    .finally(() => {
      currentAdminRequest = null;
    });

  return currentAdminRequest;
}

/* =========================
   9. 页面使用的 hook：admin 页面以后用这个拿当前管理员
   ========================= */

export function useCurrentAdmin() {
  const context = useContext(AdminContext);

  if (!context) {
    throw new Error("useCurrentAdmin must be used inside AdminGuard.");
  }

  return context.currentAdmin;
}

/* =========================
   10. AdminGuard 主组件
   ========================= */

export default function AdminGuard({ children }: AdminGuardProps) {
  const initialCachedAdmin = getValidCachedAdmin();

  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(
    initialCachedAdmin
  );
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(!initialCachedAdmin);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkAdmin() {
      /**
       * 如果当前页面切换时缓存仍然有效，就直接使用缓存。
       * 这样不会每次进入 admin 页面都显示“正在检查管理员身份”。
       */
      const cachedAdmin = getValidCachedAdmin();

      if (cachedAdmin) {
        setCurrentAdmin(cachedAdmin);
        setIsCheckingAdmin(false);
        return;
      }

      setIsCheckingAdmin(true);
      setMessage("");

      const admin = await loadCurrentAdminOnce();

      if (!isMounted) return;

      if (!admin) {
        setCurrentAdmin(null);
        setMessage("请先使用管理员账号登录。");
        setIsCheckingAdmin(false);
        return;
      }

      setCurrentAdmin(admin);
      setIsCheckingAdmin(false);
    }

    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, []);

  /* =========================
     11. 检查中状态
     ========================= */

  if (isCheckingAdmin) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-600">正在检查管理员身份...</p>
        </section>
      </main>
    );
  }

  /* =========================
     12. 非管理员状态
     ========================= */

  if (!currentAdmin) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-emerald-950">
            请先登录管理员账号
          </h1>

          <p className="mt-3 leading-7 text-stone-600">
            {message || "当前账号没有管理员权限。"}
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

  /* =========================
     13. 已确认管理员：把 currentAdmin 提供给子页面
     ========================= */

  return (
    <AdminContext.Provider value={{ currentAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}