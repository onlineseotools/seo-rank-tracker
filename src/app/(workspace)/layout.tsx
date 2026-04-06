import { WorkspaceShell } from "@/components/workspace-shell";
import { requireSessionUser } from "@/lib/server/session";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireSessionUser();
  return <WorkspaceShell user={{ username: user.username, role: user.role }}>{children}</WorkspaceShell>;
}
