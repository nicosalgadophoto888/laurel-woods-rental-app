import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAuthenticated } from "../../../lib/auth";
import { getSupabaseServerClient } from "../../../lib/supabase";

const uploadDir = path.join(process.cwd(), "public", "uploads");
const bucketName = "lease-documents";

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
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(safeName, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (error) {
      return NextResponse.json(
        {
          error:
            "Supabase Storage upload failed. Create the `lease-documents` bucket from `supabase/schema.sql` and add a server key to Vercel.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(safeName);

    return NextResponse.json({
      fileName: file.name,
      filePath: data.publicUrl,
      extension,
    });
  }

  const fullPath = path.join(uploadDir, safeName);
  await fs.writeFile(fullPath, buffer);

  return NextResponse.json({
    fileName: file.name,
    filePath: `/uploads/${safeName}`,
    extension,
  });
}
