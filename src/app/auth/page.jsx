'use client';

import dynamic from 'next/dynamic';

const AuthGateway = dynamic(() => import('@/components/AuthGateway'), {
  ssr: false,
});

export default function AuthPage() {
  return <AuthGateway initialCreate={false} />;
}