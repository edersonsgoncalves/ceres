import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Buscar por supabaseId primeiro
  let dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });

  if (dbUser) return dbUser;

  // Fallback: buscar por email e vincular supabaseId
  dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
  });

  if (dbUser) {
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { supabaseId: user.id },
    });
    return dbUser;
  }

  // Auto-provisionamento: criar usuário local
  dbUser = await prisma.user.create({
    data: {
      supabaseId: user.id,
      name: user.user_metadata?.name || user.email!.split("@")[0],
      email: user.email!,
    },
  });

  return dbUser;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
