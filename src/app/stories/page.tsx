import Link from "next/link";
import { stories } from "@/data/stories";

export default function StoriesPage(){
return(

<main className="min-h-screen bg-[#f6f5e9] text-stone-800">
<section className="mx-auto max-w-6xl px-6 py-20">

<p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
Stories
</p>

<h1 className="mt-5 text-5xl font-bold text-emerald-950">
ORP Stories
</h1>

<p className="mt-6 max-w-3xl text-lg leading-8 text-stone-700">
这里记录 ORP 成员与学生之间真实发生的故事，
分享教学、陪伴和成长过程中的点滴瞬间。
</p>



<div className="mt-12 grid gap-8 md:grid-cols-2">


{stories.map((story)=>(

<Link
key={story.id}
href={`/stories/${story.id}`}
className="rounded-[2rem] bg-white p-8 shadow-sm transition hover:-translate-y-1"
>

<p className="text-sm text-emerald-700">
{story.author}
</p>

<h2 className="mt-4 text-3xl font-bold text-emerald-950">
{story.title}
</h2>

<p className="mt-5 leading-8 text-stone-700">
{story.summary}
</p>

<p className="mt-6 font-semibold text-emerald-800">
阅读全文 →
</p>

</Link>
))}

</div>
</section>
</main>
)
}