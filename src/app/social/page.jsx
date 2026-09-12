'use client';

import dynamic from 'next/dynamic';

const SocialHub = dynamic(() => import('@/components/social/SocialHub'), {
  ssr: false,
});

export default function SocialPage() {
  return <SocialHub />;
}