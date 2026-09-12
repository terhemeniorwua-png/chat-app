'use client';

import dynamic from 'next/dynamic';

const NewsFeed = dynamic(() => import('@/components/feed/NewsFeed'), {
  ssr: false,
});

export default function HomePage() {
  return <NewsFeed />;
}