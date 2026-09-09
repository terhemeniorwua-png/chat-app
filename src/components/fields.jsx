'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock } from 'lucide-react';

export function inputClass(hasError) {
  return [
    'w-full rounded-xl border bg-gray-800/70 py-2.5 pl-10 pr-10 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:ring-2',
    hasError
      ? 'border-[#EF4444]/70 focus:border-[#EF4444] focus:ring-[#EF4444]/30'
      : 'border-gray-700/80 focus:border-[#7C3AED] focus:ring-[#7C3AED]/40',
  ].join(' ');
}

export function FieldError({ message }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1.5 pl-1 text-xs font-medium text-[#EF4444]"
    >
      {message}
    </motion.p>
  );
}

/**
 * Password input with the show/hide toggle, styled like the auth forms.
 * @param {object} props
 * @param {string} props.name
 * @param {string} [props.placeholder]
 * @param {string} [props.autoComplete]
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.error]
 * @param {boolean} [props.disabled=false]
 */
export function PasswordInput({
  name,
  placeholder,
  autoComplete,
  value,
  onChange,
  error,
  disabled = false,
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <div className="relative">
        <Lock
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
        />
        <input
          type={show ? 'text' : 'password'}
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={5}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!error)}
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}