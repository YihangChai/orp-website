"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/auth";

type AdminGuardProps = {
  children: React.ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkAdmin() {
      setIsCheckingAdmin(true);
      setMessage("");

      const admin = await getCurrentAdmin();

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
  }, []);

  if (isCheckingAdmin) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-600">正在检查管理员身份...</p>
        </section>
      </main>
    );
  }

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

  return <>{children}</>;
}