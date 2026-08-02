import { stories } from "@/data/stories";
import Link from "next/link";
import { notFound } from "next/navigation";


type StoryDetailPageProps = {
  params: Promise<{
    storyId: string;
  }>;
};


export default async function StoryDetailPage({
  params,
}: StoryDetailPageProps) {

  const { storyId } = await params;


  const story = stories.find(
    (item) => item.id === storyId
  );


  if (!story) {
    notFound();
  }


  return (
    <main className="min-h-screen bg-[#f6f5e9] text-stone-800">
      <article className="mx-auto max-w-3xl px-6 py-20">
        <Link
          href="/stories"
          className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← 返回 ORP Stories
        </Link>

        <h1 className="mt-8 text-4xl font-bold text-emerald-950 md:text-5xl">
          {story.title}
        </h1>

        <p className="mt-4 text-stone-600">作者：{story.author}</p>

        <div className="mt-12 space-y-12">
          {story.content.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-bold text-emerald-950">
                {section.heading}
              </h2>

              <div className="mt-5 space-y-5">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-lg leading-9 text-stone-700">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
