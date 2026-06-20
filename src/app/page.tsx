import Link from "next/link";
export default function HomePage() {
  return (
    <main>
      <h1>ORP</h1>
      <p>Online Reading Partner</p>
      <nav>
        <Link href="/teacher">进入小老师页面</Link>
        <br />
        <Link href="/student">进入学生页面</Link>
        <br />
        <Link href="/admin">进入管理员页面</Link>
        <br />
        <Link href="/courses">进入课程目标页面</Link>
      </nav>
    </main>
  );
}