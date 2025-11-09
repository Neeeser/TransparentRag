'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bot, FolderTree, Home, MessageSquare } from 'lucide-react';

import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navLinks = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/collections', label: 'Collections', icon: FolderTree },
  { href: '/chat', label: 'Chat Studio', icon: MessageSquare },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [loading, user, router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Preparing your workspace…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 px-4 py-6 text-slate-100 lg:flex-row lg:px-10 lg:py-8">
      <aside className="glass-panel hidden min-h-[calc(100vh-4rem)] w-[280px] flex-shrink-0 flex-col justify-between rounded-[2rem] px-6 py-8 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">TransparentRAG</p>
            <p className="text-lg font-semibold text-white">Control Room</p>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                  isActive
                    ? 'bg-white/10 text-white shadow-lg shadow-violet-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white',
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Operator</p>
          <div>
            <p className="text-base font-semibold text-white">{user.full_name || user.email}</p>
            <p className="text-sm text-slate-400">{user.email}</p>
          </div>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 space-y-6">
        <div className="glass-panel flex flex-col gap-3 rounded-3xl px-5 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">TransparentRAG</p>
              <p className="text-lg font-semibold">Operator Console</p>
            </div>
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm',
                    isActive ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
