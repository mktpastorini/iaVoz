"use client";

import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Settings, Zap, MessageSquare, SlidersHorizontal, MousePointerClick, UserSquare, Users, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Configurações', path: '/admin/settings', icon: Settings },
    { name: 'Clientes', path: '/admin/clients', icon: Users },
    { name: 'Poderes', path: '/admin/powers', icon: Zap },
    { name: 'Poderes do Sistema', path: '/admin/system-powers', icon: SlidersHorizontal },
    { name: 'Ações do Cliente', path: '/admin/client-actions', icon: MousePointerClick },
    { name: 'Campos de Dados do Usuário', path: '/admin/user-data-fields', icon: UserSquare },
    { name: 'Conversas', path: '/admin/conversations', icon: MessageSquare },
  ];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError("Erro ao tentar sair.");
      console.error("Logout error:", error);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="w-64 bg-sidebar dark:bg-sidebar-background text-sidebar-foreground dark:text-sidebar-foreground border-r border-sidebar-border dark:border-sidebar-border p-4 flex flex-col">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-6 text-sidebar-primary dark:text-sidebar-primary-foreground">Admin Panel</h2>
          <nav>
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center p-2 rounded-md text-sidebar-foreground dark:text-sidebar-foreground hover:bg-sidebar-accent dark:hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:text-sidebar-accent-foreground transition-colors",
                      location.pathname.startsWith(item.path) && "bg-sidebar-accent dark:bg-sidebar-accent text-sidebar-accent-foreground dark:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-auto">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground dark:text-sidebar-foreground hover:bg-sidebar-accent dark:hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:text-sidebar-accent-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;