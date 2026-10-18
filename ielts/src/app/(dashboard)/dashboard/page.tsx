import { getSession, deleteSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getSession();

  // Agar tizimga kirmagan bo'lsa, loginga qaytaramiz
  if (!session) {
    redirect("/login");
  }

  // Foydalanuvchi ma'lumotlarini bazadan olamiz
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      subscriptions: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  async function handleLogout() {
    "use server";
    await deleteSession();
    redirect("/login");
  }

  const activeSubscription = user?.subscriptions[0]?.tier || "FREE";

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Yuqori qism (Header) */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-sm">
              AI
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900 leading-tight">IELTS Prep Platform</h1>
              <p className="text-xs text-zinc-500">Aqlli tayyorgarlik tizimi</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-zinc-900">{user?.name || "O'quvchi"}</p>
              <p className="text-xs text-zinc-500">{user?.email}</p>
            </div>
            <form action={handleLogout}>
              <Button variant="outline" size="sm" type="submit">
                Chiqish
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Asosiy panel */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 rounded-2xl bg-indigo-600 p-8 text-white shadow-sm">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-indigo-500/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-100">
              Obuna: {activeSubscription}
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              Xush kelibsiz, {user?.name || "O'quvchi"}!
            </h2>
            <p className="mt-2 text-indigo-100 text-sm leading-relaxed">
              Bugungi mashg'ulotlarni boshlashga tayyormisiz? Imtihon ko'nikmalarini AI yordamida baholang va xatolaringiz ustida ishlang.
            </p>
          </div>
        </div>

        {/* 4 ta IELTS bo'limi */}
        <h3 className="mb-4 text-xl font-bold text-zinc-900">IELTS Bo'limlari</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Reading */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-3xl mb-3">📖</div>
            <h4 className="text-lg font-bold text-zinc-900">Reading</h4>
            <p className="mt-1 text-sm text-zinc-500">
              Matn tahlili, 13 xil savol turlari va avtomatik tekshiruv.
            </p>
            <div className="mt-6">
              <Button variant="secondary" className="w-full">Boshlash</Button>
            </div>
          </div>

          {/* Listening */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-3xl mb-3">🎧</div>
            <h4 className="text-lg font-bold text-zinc-900">Listening</h4>
            <p className="mt-1 text-sm text-zinc-500">
              Audio yozuvlar, real vaqt sinovlari va transkriptlar.
            </p>
            <div className="mt-6">
              <Button variant="secondary" className="w-full">Boshlash</Button>
            </div>
          </div>

          {/* Writing */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-3xl mb-3">✍️</div>
            <h4 className="text-lg font-bold text-zinc-900">Writing (AI)</h4>
            <p className="mt-1 text-sm text-zinc-500">
              Task 1 va 2 insholarini 4 mezon bo'yicha AI bilan tekshirish.
            </p>
            <div className="mt-6">
				<Link href="/writing">
              		<Button className="w-full">Mashq qilish</Button>
				</Link>
            </div>
          </div>

          {/* Speaking */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-3xl mb-3">🎙️</div>
            <h4 className="text-lg font-bold text-zinc-900">Speaking (AI)</h4>
            <p className="mt-1 text-sm text-zinc-500">
              AI imtihon oluvchi bilan suhbat va talaffuz tahlili.
            </p>
            <div className="mt-6">
              <Button className="w-full">Suhbatni boshlash</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}