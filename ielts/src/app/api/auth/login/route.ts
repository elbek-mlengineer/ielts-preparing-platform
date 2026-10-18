import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email("Yaroqli email kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsedData = loginSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        { error: parsedData.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsedData.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Email yoki parol noto'g'ri" },
        { status: 401 }
      );
    }

    const passwordsMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordsMatch) {
      return NextResponse.json(
        { error: "Email yoki parol noto'g'ri" },
        { status: 401 }
      );
    }

    await createSession(user.id, user.email, user.role);

    return NextResponse.json({
      message: "Muvaffaqiyatli tizimga kirildi",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN_ERROR:", error);
    return NextResponse.json(
      { error: "Serverda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}