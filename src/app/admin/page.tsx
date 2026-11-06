import { AdminConsole } from "@/components/counting/AdminConsole";
import { AdminLogin } from "@/components/counting/AdminLogin";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;
  return <AdminConsole authenticated />;
}
