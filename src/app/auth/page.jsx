'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const AuthGateway = dynamic(() => import('@/components/AuthGateway'), {
  ssr: false,
});

function AuthContent() {
  const searchParams = useSearchParams();
  const initialCreate = searchParams.get('mode') === 'create';
  const notice =
    searchParams.get('reset') === 'success'
      ? 'Your password has been reset. Sign in with your new password.'
      : '';

  return <AuthGateway initialCreate={initialCreate} initialNotice={notice} />;
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthContent />
    </Suspense>
  );
}