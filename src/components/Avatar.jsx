'use client';

import { useState } from 'react';

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
};

function getInitials(name) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || '')
      .join('') || '?'
  );
}

export default function Avatar({ name, src, size = 'md', className = '' }) {
  const [broken, setBroken] = useState(false);
  const showFallback = !src || broken;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] font-semibold text-white ${
        SIZES[size] || SIZES.md
      } ${className}`}
    >
      {showFallback ? (
        <span aria-hidden="true">{getInitials(name)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- remote user avatars, next/image needs a configured loader
        <img
          src={src}
          alt={`${name || 'User'}'s avatar`}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}