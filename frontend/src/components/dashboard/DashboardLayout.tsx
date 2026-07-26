'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import {
  LayoutDashboard, Map, ClipboardList, Users,
  FileText, Bell, Settings, LogOut, Activity, Siren,
  ChevronRight, Menu, X
} from 'lucide-react';
import clsx from 'clsx';

const adminLinks = [
  { href: '/dashboard',            icon: LayoutDashboard, label: 'Dashboard'   },
  { href: '/dashboard/map',        icon: Map,             label: 'Live Map'    },
  { href: '/dashboard/tasks',      icon: ClipboardList,   label: 'Tasks'       },
  { href: '/admin/create-task',    icon: ClipboardList,   label: 'Create Task' },
  { href: '/dashboard/reports',    icon: FileText,        label: 'Reports'     },
  { href: '/dashboard/central-reports', icon: Activity,   label: 'Central Report' },
  { href: '/dashboard/volunteers', icon: Users,           label: 'Volunteers'  },
  { href: '/dashboard/sos',        icon: Siren,           label: 'SOS'         },
  { href: '/dashboard/insights',   icon: Activity,        label: 'AI Insights' },
];

const volunteerLinks = [
  { href: '/dashboard',             icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/dashboard/map',         icon: Map,             label: 'Live Map'   },
  { href: '/dashboard/assignments', icon: ClipboardList,   label: 'My Tasks'   },
  { href: '/dashboard/start-task',  icon: Activity,        label: 'Start Task'  },
  { href: '/dashboard/profile',     icon: Settings,        label: 'Profile'    },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, isAuthenticated, hasHydratedAuth, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', 'badge'],
    queryFn: () => notificationsApi.list().then((r) => r.data.data.notifications || []),
    enabled: !!isAuthenticated,
    refetchInterval: 15000,
  });
  const unreadCount = (notifications as any[]).filter((n) => !n.is_read).length;

  useEffect(() => {
    if (hasHydratedAuth && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasHydratedAuth, isAuthenticated, router]);

  // Show spinner while hydrating or if not yet authenticated
  if (!hasHydratedAuth || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-ink-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 dark:text-white/55">Loading…</p>
        </div>
      </div>
    );
  }

  const links = user.role === 'admin' ? adminLinks : volunteerLinks;

  const NavContent = () => (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">TerraSentinel</p>
            <p className="text-xs text-gray-400 dark:text-white/55"> Smart Emergency Resource Allocation System</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.full_name}</p>
            <p className="text-xs text-gray-400 dark:text-white/55 capitalize">{user.role}</p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={clsx('sidebar-link', active && 'active')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-gray-100 dark:border-white/10 space-y-0.5">
        <Link href="/dashboard/notifications" className="sidebar-link">
          <Bell className="w-4 h-4" /> Notifications
          {unreadCount > 0 && (
            <span className="ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] px-1.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <button
          onClick={logout}
          className="sidebar-link w-full text-left text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-ink-950 text-gray-900 dark:text-white">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-56 bg-white/75 dark:bg-white/5 backdrop-blur-lg border-r border-white/20 dark:border-white/10 flex-shrink-0">
        <NavContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-56 bg-white/90 dark:bg-ink-950/90 backdrop-blur-lg shadow-xl z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 p-1 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile top bar */}
        <header className="bg-white/90 dark:bg-ink-950/70 border-b border-white/20 dark:border-white/10 backdrop-blur-xl px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1 text-gray-500">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-brand-600 rounded flex items-center justify-center">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold">TerraSentinel</span>
          </div>
          <div className="ml-auto">
            <Link href="/dashboard/notifications" className="relative p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-red-600 text-white text-[10px] px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 relative">
          <Link
            href="/dashboard/notifications"
            className="hidden lg:inline-flex absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10"
            aria-label="Open notifications"
          >
            <span className="relative inline-flex">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-red-600 text-white text-[10px] px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
          </Link>
          {children}
        </main>
      </div>
    </div>
  );
}
