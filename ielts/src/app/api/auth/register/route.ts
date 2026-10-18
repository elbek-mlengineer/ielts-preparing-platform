import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Yaroqli email kiriting"),
  password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak"),
  name: z.string().min(2, "Ism kamida 2 ta harfdan iborat bo'lishi kerak").optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsedData = registerSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        { error: parsedData.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = parsedData.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu email bilan allaqachon ro'yxatdan o'tilgan" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Foydalanuvchi muvaffaqiyatli yaratildi", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    return NextResponse.json(
      { error: "Ichki server xatoligi yuz berdi" },
      { status: 500 }
    );
  }
}