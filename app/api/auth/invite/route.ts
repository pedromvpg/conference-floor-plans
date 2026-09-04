import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireEditor();
    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return Response.json({ error: "Valid email required" }, { status: 400 });
    }
    await getStore().addEditor(email);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
