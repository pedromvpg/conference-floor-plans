import { setSessionEmail } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { hashPassword, isUsablePassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; email?: string; password?: string };
    const token = body.token?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!token || !email.includes("@")) {
      return Response.json({ error: "Email and invite token required" }, { status: 400 });
    }
    if (!isUsablePassword(password)) {
      return Response.json({ error: "Choose a password of at least 8 characters." }, { status: 400 });
    }
    const user = await getStore().consumeInvite(token, email, await hashPassword(password));
    await setSessionEmail(user.email);
    return Response.json({ ok: true, email: user.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
