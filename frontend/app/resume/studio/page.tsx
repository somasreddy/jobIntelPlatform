import { redirect } from "next/navigation";

export default function ResumeStudioPage() {
  redirect("/profile?tab=match");
}
