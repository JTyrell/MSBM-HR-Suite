import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="lg:pl-64 transition-all duration-300">
        <div className="p-4 md:p-6 lg:p-8 pt-16 lg:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
