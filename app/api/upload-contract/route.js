import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAuthenticated } from "../../../lib/auth";

const uploadDir = path.join(process.cwd(), "public", "uploads");

export async function POST(request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  await fs.mkdir(uploadDir, { recursive: true });

  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const fullPath = path.join(uploadDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(fullPath, buffer);

  return NextResponse.json({
    fileName: file.name,
    filePath: `/uploads/${safeName}`,
    extension,
  });
}
