import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f6f5e9] px-6 py-20 text-stone-800">
      {/* 
        临时登录页面：
        现在还没有接入正式登录系统。
        后续需要在这里接入 Supabase Auth，并根据用户角色跳转：
        teacher → /teacher
        student → /student
        admin → /admin
      */}

      <section className="mx-auto max-w-3xl rounded-[2rem] border border-emerald-100 bg-white/85 p-8 text-center shadow-sm md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          ORP System
        </p>

        <h1 className="mt-4 text-4xl font-bold text-emerald-950">
          登录系统开发中
        </h1>

        <p className="mt-5 leading-8 text-stone-600">
          这里之后会接入正式账号登录和角色权限。现在先用临时入口模拟不同身份进入对应页面。
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Link
            href="/teacher"
            className="rounded-2xl border border-emerald-100 bg-[#f6f5e9] px-5 py-6 font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            小老师入口
          </Link>

          <Link
            href="/student"
            className="rounded-2xl border border-emerald-100 bg-[#f6f5e9] px-5 py-6 font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            学生入口
          </Link>

          <Link
            href="/admin"
            className="rounded-2xl border border-emerald-100 bg-[#f6f5e9] px-5 py-6 font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            管理员入口
          </Link>
        </div>
      </section>
    </main>
  );
}