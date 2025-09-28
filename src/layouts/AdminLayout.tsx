"use client";

import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Settings, Zap, MessageSquare, SlidersHorizontal, 
  MousePointerClick, UserSquare, Users, LogOut, Code, 
  Briefcase, DollarSign, ChevronDown, User 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSession } from '@/contexts/SessionContext';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role } = useSession();

  const navItems = [
    { type: 'link', name: 'Configurações', path: '/admin/settings', icon: Settings },
    { type: 'link', name: 'Clientes', path: '/admin/clients', icon: Users },
    { type: 'link', name: 'Poderes', path: '/admin/powers', icon: Zap },
    { type: 'link', name: 'Poderes do Sistema', path: '/admin/system-powers', icon: SlidersHorizontal },
    { type: 'link', name: 'Ações do Cliente', path: '/admin/client-actions', icon: MousePointerClick },
    { type: 'link', name: 'Campos de Dados', path: '/admin/user-data-fields', icon: UserSquare },
    { type: 'link', name: 'Conversas', path: '/admin/conversations', icon: MessageSquare },
    { type: 'link', name: 'Instalação', path: '/admin/installation', icon: Code },
    { 
      type: 'group', 
      name: 'SaaS', 
      icon: Briefcase,
      paths: ['/admin/saas/users', '/admin/saas/financial'],
      subItems: [
        { name: 'Usuários', path: '/admin/saas/users', icon: Users },
        { name: 'Financeiro', path: '/admin/saas/financial', icon: DollarSign }
      ]
    }
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
            <ul className="space-y-1">
              {navItems.map((item) => {
                if (item.type === 'link') {
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.path}
                        className={cn(
                          "flex items-center p-2 rounded-md text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground hover:bg-sidebar-accent dark:hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:text-sidebar-accent-foreground transition-colors",
                          location.pathname.startsWith(item.path) && "bg-sidebar-accent dark:bg-sidebar-accent text-sidebar-accent-foreground dark:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  );
                }
                if (item.type === 'group' && role === 'admin') {
                  const isActive = item.paths.some(path => location.pathname.startsWith(path));
                  return (
                    <li key={item.name}>
                      <Collapsible defaultOpen={isActive}>
                        <CollapsibleTrigger className="w-full">
                          <div className={cn(
                            "flex items-center justify-between w-full p-2 rounded-md text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground hover:bg-sidebar-accent dark:hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:text-sidebar-accent-foreground transition-colors",
                            isActive && "bg-sidebar-accent dark:bg-sidebar-accent text-sidebar-accent-foreground dark:text-sidebar-accent-foreground"
                          )}>
                            <div className="flex items-center">
                              <item.icon className="mr-3 h-5 w-5" />
                              {item.name}
                            </div>
                            <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="py-1 pl-7 space-y-1">
                          {item.subItems.map(subItem => (
                            <Link
                              key={subItem.name}
                              to={subItem.path}
                              className={cn(
                                "flex items-center p-2 rounded-md text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground hover:bg-sidebar-accent dark:hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:text-sidebar-accent-foreground transition-colors",
                                location.pathname.startsWith(subItem.path) && "bg-sidebar-accent dark:bg-sidebar-accent text-sidebar-accent-foreground dark:text-sidebar-accent-foreground"
                              )}
                            >
                              <subItem.icon className="mr-3 h-5 w-5" />
                              {subItem.name}
                            </Link>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  );
                }
                return null;
              })}
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
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-end p-4 border-b bg-white dark:bg-gray-900">
          {user && (
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
              <User className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
          )}
        </header>
        <div className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;