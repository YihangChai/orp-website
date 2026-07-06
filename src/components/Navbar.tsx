import Link from "next/link";
import StudentAccountMenu from "@/components/StudentAccountMenu";

export default function Navbar() {
  return (
    <header className="navbar">
      <Link href="/" className="logo">
        ORP
      </Link>

      <nav className="navLinks">
        <Link href="/">首页</Link>
        <Link href="/about">关于我们</Link>
        <Link href="/departments">部门介绍</Link>
        <Link href="/stories">我和 ORP 的故事</Link>
        <Link href="/resources">免费资源</Link>
        <Link href="/join">加入我们</Link>
        <Link href="/donation">资助我们</Link>
      </nav>
      
      <Link href="/login">登录</Link>

    </header>
  );
}