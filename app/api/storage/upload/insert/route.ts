import { NextResponse } from "next/server";
import { withTeam } from "@/lib/auth/with-team";
import prisma from "@/db/prisma";
import { upbaseError } from "@/lib/utils/upbase-error";

type InsertObjectRequest = {
  name: string;
  key: string;
  size: number;
  type: string;
};

export const POST = withTeam(async ({ req, team }) => {
  const { name, key, size, type } = (await req.json()) as InsertObjectRequest;

  // break the key into parts and check if subfolders exist
  // if not, create them
  // start at the base and keep adding subfolders
  if (!key.startsWith(`${team.id}/`)) {
    return upbaseError("Invalid base key", 400);
  }
  const parts = key.split("/");
  let currentKey = ``; // should have team id in it already

  for (let i = 0; i < parts.length - 1; i++) {
    currentKey += parts[i] + "/";
    const existingFolder = await prisma.storageObject.findFirst({
      where: {
        key: currentKey,
        teamId: team.id,
        storageType: "folder",
      },
    });

    if (!existingFolder) {
      await prisma.storageObject.create({
        data: {
          name: parts[i],
          key: currentKey,
          team: { connect: { id: team.id } },
          storageType: "folder",
        },
      });
    }
  }

  await prisma.storageObject.upsert({
    where: { key },
    update: { name, size, contentType: type, key },
    create: {
      name,
      size,
      contentType: type,
      key,
      storageType: "file",
      team: { connect: { id: team.id } },
    },
  });

  return NextResponse.json({ message: "ok" }, { status: 200 });
});
