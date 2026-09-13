'use client';

// App shell - frontend/design.md section 1 Layout + section 2 Sidebar nav item.
// Fixed 240px white sidebar with grouped nav, active item as a filled dark
// pill (accent-nav-active); 64px top bar with page title left and the
// context/role switcher + user avatar right.
//
// NOTE (flagged conflict, see tododesign instructions): the backend
// Users.role enum only supports 'customer' | 'seller' - there is no inspector
// role or inspector-specific API. The switcher therefore offers Customer and
// Seller contexts (Seller context navigates to the seller tools, which are
// reachable by any logged-in session). 'Inspector' is intentionally omitted
// rather than faked.

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  FileCheck,
  ShoppingBag,
  Building2,
  MessageSquare,
  ShieldCheck,
  Gift,
  ChevronDown,
  LogOut,
  Menu,
} from 'lucide-react';
import ChatbotPanel from './ChatbotPanel';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const ROLE_CONTEXTS = [
  { value: 'customer', label: 'Customer' },
  { value: 'seller', label: 'Seller' },
];

const NAV_GROUPS = {
  customer: [
    {
      label: 'Overview',
      items: [{ name: 'Dashboard', path: 'dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'Compliance',
      items: [
        { name: 'Check Compliance', path: 'check-compliance', icon: FileCheck },
        { name: 'Products', path: 'products', icon: ShoppingBag },
        { name: 'Sellers & Map', path: 'entities', icon: Building2 },
      ],
    },
    {
      label: 'Assist',
      items: [
        { name: 'Chatbot', path: 'chatbot', icon: MessageSquare },
        { name: 'Rewards', path: 'rewards', icon: Gift },
      ],
    },
  ],
  seller: [
    {
      label: 'Overview',
      items: [{ name: 'Dashboard', path: 'dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'Seller Tools',
      items: [{ name: 'Seller Verification', path: 'seller-verification', icon: ShieldCheck }],
    },
    {
      label: 'Assist',
      items: [
        { name: 'Chatbot', path: 'chatbot', icon: MessageSquare },
        { name: 'Rewards', path: 'rewards', icon: Gift },
      ],
    },
  ],
};

function useQueryParamContext() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');
  const roleParam = searchParams.get('role');

  const buildHref = (path) => {
    if (userId && roleParam) return `/${path}?userId=${userId}&role=${roleParam}`;
    if (userId) return `/${path}?userId=${userId}`;
    return `/${path}`;
  };

  return { userId, roleParam, router, buildHref };
}

function SidebarContent({ context, onNavigate }) {
  const { roleParam, router, buildHref } = useQueryParamContext();
  const pathname = usePathname();
  const groups = NAV_GROUPS[context] || NAV_GROUPS.customer;

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-16 px-6 flex items-center border-b border-default shrink-0">
        <Link
          href="/"
          className="text-lg font-semibold text-primary tracking-tight"
          onClick={onNavigate}
        >
          Legal<span className="text-accent">Guard</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 thin-scrollbar">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === `/${item.path}` || pathname.startsWith(`/${item.path}/`);
                return (
                  <Link
                    key={item.path}
                    href={buildHref(item.path)}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 h-10 px-3 rounded-pill text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-nav-active text-white'
                        : 'text-secondary hover:text-primary hover:bg-page'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-default shrink-0">
        {roleParam ? (
          <p className="px-3 mb-2 text-xs text-muted">
            Signed in as <span className="font-semibold text-secondary capitalize">{roleParam}</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 h-10 px-3 rounded-pill text-sm font-medium text-secondary hover:text-critical hover:bg-page transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Logout
        </button>
        <p className="px-3 pt-2 text-[11px] text-muted">(c) 2025 LegalGuard</p>
      </div>
    </div>
  );
}

function RoleSwitcher({ context, onContextChange, sessionRole }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const active = ROLE_CONTEXTS.find((r) => r.value === context) || ROLE_CONTEXTS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 pl-3 pr-2 rounded-pill border border-default bg-surface text-sm font-medium text-primary hover:border-muted transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={`w-2 h-2 rounded-pill ${
            sessionRole === 'seller'
              ? 'bg-cat-skincare'
              : sessionRole === 'customer'
                ? 'bg-cat-electronics'
                : 'bg-cat-generic'
          }`}
        />
        {active.label}
        <ChevronDown className="w-4 h-4 text-secondary" />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-44 bg-surface border border-default rounded-card shadow-card py-1 z-50"
        >
          {ROLE_CONTEXTS.map((role) => (
            <button
              key={role.value}
              type="button"
              role="option"
              aria-selected={role.value === context}
              onClick={() => {
                onContextChange(role.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 h-9 text-sm font-medium flex items-center justify-between ${
                role.value === context
                  ? 'text-primary bg-page'
                  : 'text-secondary hover:text-primary hover:bg-page'
              }`}
            >
              {role.label}
              {role.value === context ? (
                <span className="w-1.5 h-1.5 rounded-pill bg-accent" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell({ title, children, actions = null, wide = false }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page flex items-center justify-center text-sm text-secondary">
          Loading...
        </div>
      }
    >
      <AppShellContent title={title} actions={actions} wide={wide}>
        {children}
      </AppShellContent>
    </Suspense>
  );
}

function AppShellContent({ title, children, actions = null, wide = false }) {
  const { roleParam, router, buildHref } = useQueryParamContext();
  const pathname = usePathname();

  const [sessionRole, setSessionRole] = useState(roleParam);
  useEffect(() => {
    if (roleParam) {
      setSessionRole(roleParam);
    } else if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('user_role');
      if (stored) setSessionRole(stored);
    }
  }, [roleParam, pathname]);

  const [context, setContext] = useState(roleParam === 'seller' ? 'seller' : 'customer');
  useEffect(() => {
    setContext(roleParam === 'seller' ? 'seller' : 'customer');
  }, [roleParam]);

  const [username, setUsername] = useState(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUsername(window.localStorage.getItem('username'));
    }
  }, []);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const handleContextChange = (next) => {
    setContext(next);
    if (next === 'seller') {
      router.push(buildHref('seller-verification'));
    } else {
      router.push(buildHref('dashboard'));
    }
  };

  const initials =
    ((username || roleParam || 'user')
      .split(/[\s_]+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U') || 'U';

  return (
    <div className="min-h-screen bg-page text-primary">
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-surface border-r border-default z-40">
        <SidebarContent context={context} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-primary/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-surface border-r border-default">
            <SidebarContent context={context} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 h-16 bg-surface border-b border-default flex items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-pill text-secondary hover:bg-page"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="flex-1 min-w-0 truncate text-2xl font-semibold text-primary">
            {title}
          </h1>

          {actions ? (
            <div className="hidden sm:flex items-center gap-2">{actions}</div>
          ) : null}

          <div className="flex items-center gap-3">
            <RoleSwitcher
              context={context}
              onContextChange={handleContextChange}
              sessionRole={sessionRole}
            />
            <Link
              href={buildHref('dashboard')}
              className="w-9 h-9 rounded-pill bg-nav-active text-white text-xs font-bold flex items-center justify-center"
              title={username ? '@' + username : 'Account'}
            >
              {initials}
            </Link>
          </div>
        </header>

        <main className={`flex-1 px-6 py-6 ${wide ? '' : 'max-w-7xl'} w-full`}>
          {children}
        </main>
      </div>

      {/* Chatbot drawer - reachable from any screen (tododesign Phase 6) */}
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-pill bg-accent text-white shadow-card hover:opacity-90 transition-opacity flex items-center justify-center"
        aria-label="Open the LegalGuard assistant"
        title="Ask the compliance assistant"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {chatOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-primary/40"
            onClick={() => setChatOpen(false)}
          />
          <aside className="relative h-full w-full max-w-md bg-surface border-l border-default shadow-card">
            <ChatbotPanel onClose={() => setChatOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
