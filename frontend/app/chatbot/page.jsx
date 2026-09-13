'use client';

// Chatbot page - the full-page version of the shared ChatbotPanel drawer
// (tododesign Phase 6). The panel itself lives in components/ChatbotPanel.jsx
// and is also mounted in the AppShell drawer, reachable from any screen.

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import AppShell from '../../components/AppShell';
import ChatbotPanel from '../../components/ChatbotPanel';
import { EmptyState } from '../../components/ui';

export default function ChatbotPage() {
  return (
    <Suspense fallback={null}>
      <ChatbotContent />
    </Suspense>
  );
}

function ChatbotContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const userIdParam = searchParams.get('userId');
    const roleParam = searchParams.get('role');

    if (userIdParam && roleParam) {
      localStorage.setItem('user_id', userIdParam);
      localStorage.setItem('user_role', roleParam);
      localStorage.setItem('isAuthenticated', 'true');
      setIsAuthenticated(true);
    } else {
      const storedUserId = localStorage.getItem('user_id');
      const storedRole = localStorage.getItem('user_role');
      const storedAuth = localStorage.getItem('isAuthenticated');
      if (storedUserId && storedRole && storedAuth === 'true') {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setTimeout(() => router.push('/auth/login'), 2000);
      }
    }
  }, [searchParams, router]);

  return (
    <AppShell title="Chatbot">
      {isAuthenticated ? (
        <div className="max-w-3xl mx-auto">
          <ChatbotPanel embedded />
        </div>
      ) : (
        <EmptyState
          icon={AlertCircle}
          title="Authentication required"
          hint="Please log in to access the chatbot. Redirecting to login..."
        />
      )}
    </AppShell>
  );
}
