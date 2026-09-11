import { Notice } from "@/components/admin/Notice";
import { SignIn } from "@/components/admin/SignIn";
import { Editor } from "@/components/editor/Editor";
import { hasAdminCookie } from "@/lib/auth";
import { loadDiary, type LoadResult } from "@/lib/diary/repo";
import { errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

// The whole site is private: nothing renders without the admin cookie.
export default async function Home() {
  if (!(await hasAdminCookie())) return <SignIn />;

  const result: LoadResult | { status: "error"; message: string } = await loadDiary().catch((error) => ({
    status: "error" as const,
    message: errorMessage(error, "unknown error"),
  }));

  if (result.status === "error") {
    return <Notice title="Can’t reach the database" detail={result.message} adminLink />;
  }
  if (result.status === "setup-needed" || result.pages.length === 0) {
    return (
      <Notice
        title="The diary isn’t set up yet"
        detail="Open admin and press “Set up database” to create the tables and the first pages."
        adminLink
      />
    );
  }
  return <Editor diary={result.diary} initialPages={result.pages} />;
}
