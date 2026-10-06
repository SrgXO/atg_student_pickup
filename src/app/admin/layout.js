import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">

      <AdminSidebar />

      <div className="min-w-0 flex-1">
        {children}
      </div>

    </div>
  );
}