import React from "react";
 
// Este layout garante que as rotas de admin não sejam afetadas pelo slot do modal.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-900 text-white min-h-screen">
      <main>{children}</main>
    </div>
  );
} 