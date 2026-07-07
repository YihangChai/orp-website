"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { loginWithAccountAndPassword } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsLoggingIn(true);

    const result = await loginWithAccountAndPassword(account, password);

    setIsLoggingIn(false);

    if (result.role === "none") {
    setMessage("账号或密码不正确，请重新检查。");
    setIsLoading(false);
      return;
    }

    router.push(result.redirectTo);
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-12 text-stone-800"> 
      <section className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回首页
        </Link>

        <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-8">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              ORP
            </p>

            <h1 className="mt-3 text-3xl font-bold text-emerald-950">
              登录
            </h1>

          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-semibold text-stone-700">
                账号
              </label>

              <input
                type="text"
                value={account}
                onChange={(event) => {
                  setAccount(event.target.value);
                  setMessage("");
                }}
                placeholder="请输入账号"
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-700">
                密码
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setMessage("");
                }}
                placeholder="请输入密码"
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            {message && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-7 text-amber-800">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-[#2f5d50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingIn ? "正在登录..." : "登录"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}