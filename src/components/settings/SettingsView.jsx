'use client';

import { useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { updateActiveAvatar } from '@/lib/session';
import { apiPost, apiPut } from '@/lib/api';
import { validateUsername } from '@/lib/validation';
import ThemeToggle from '@/components/ThemeToggle';
import BrandMark from '@/components/BrandMark';
import { Camera, ImagePlus, Loader2, Lock, Palette, Save, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const MAX_IMAGE_BYTES = 5_000_000;

function sectionClasses() {
  return 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5';
}

function fieldGroup() {
  return 'space-y-1.5';
}

function rowLabel() {
  return 'block text-sm font-medium text-gray-700 dark:text-gray-200';
}

function settingsInput(hasError) {
  return [
    'w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 dark:text-white dark:placeholder-gray-500',
    hasError
      ? 'border-[#EF4444]/70 focus:border-[#EF4444] focus:ring-[#EF4444]/30'
      : 'border-gray-300 focus:border-[#7C3AED] focus:ring-[#7C3AED]/40 dark:border-white/15',
  ].join(' ');
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs font-medium text-[#EF4444]"
    >
      {message}
    </motion.p>
  );
}

function toastClass(color) {
  return color === 'error'
    ? 'rounded-lg bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]'
    : 'rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400';
}

function PrimaryButton({ loading, children, ...rest }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      {...rest}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/30 transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
}

/**
 * Consolidated Settings view — the ONE place for appearance (theme), the
 * profile picture, and account information (display name, username, password).
 *
 * Theme toggles were removed from every other surface; avatar upload was
 * removed from the dashboard; this view owns both, plus account edits guarded
 * by the current password.
 */
export default function SettingsView() {
  const { session, loginWithPayload } = useSession();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState(session?.user?.displayName ?? '');
  const [username, setUsername] = useState(session?.user?.username ?? '');
  const [verifyPassword, setVerifyPassword] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [accountErrors, setAccountErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef(null);

  if (!session) return null;

  const user = session.user;

  function showToast(message, color = 'success') {
    setToast({ message, color });
  }

  function clearToast() {
    setToast(null);
  }

  function refreshSessionUser(updated) {
    loginWithPayload({
      token: session.tokens.accessToken,
      refreshToken: session.tokens.refreshToken,
      user: updated,
    });
  }

  async function handleAvatarFile(file) {
    clearToast();
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('That image is too large. Please pick one under 5 MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      setAvatarBusy(true);
      try {
        const data = await apiPost('/api/users/me/avatar', { avatarUrl: reader.result });
        updateActiveAvatar(data.user);
        refreshSessionUser(data.user);
        showToast('Profile picture updated.');
      } catch (err) {
        showToast(err.message || 'Could not update your profile picture.', 'error');
      } finally {
        setAvatarBusy(false);
      }
    };
    reader.onerror = () => {
      showToast('Could not read that image. Please try another one.', 'error');
    };
    reader.readAsDataURL(file);
  }

  async function handleRemoveAvatar() {
    clearToast();
    setAvatarBusy(true);
    try {
      const data = await apiPost('/api/users/me/avatar', { remove: true });
      updateActiveAvatar(data.user);
      refreshSessionUser(data.user);
      showToast('Profile picture removed.');
    } catch (err) {
      showToast(err.message || 'Could not remove your profile picture.', 'error');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSaveAccount(e) {
    e.preventDefault();
    clearToast();
    setAccountErrors({});

    const errors = {};
    const nameValue = displayName.trim().replace(/\s+/g, ' ');
    if (!nameValue || !/^[a-zA-Z\s-]+$/.test(nameValue)) {
      errors.displayName = 'Name can only contain letters, spaces, and hyphens.';
    }
    const usernameError = validateUsername(username);
    if (usernameError) errors.username = usernameError;
    if (!verifyPassword) {
      errors.verifyPassword = 'Please verify your current password.';
    }
    if (Object.keys(errors).length > 0) {
      setAccountErrors(errors);
      return;
    }

    setSavingAccount(true);
    try {
      const data = await apiPut('/api/users/me', {
        currentPassword: verifyPassword,
        displayName: nameValue,
        username: username.trim().toLowerCase(),
      });
      refreshSessionUser(data.user);
      setVerifyPassword('');
      showToast('Account information updated.');
    } catch (err) {
      setAccountErrors(err.fieldErrors || {});
      showToast(err.message || 'Could not update your account.', 'error');
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    clearToast();
    setPasswordErrors({});

    const errors = {};
    if (newPassword.length < 5) {
      errors.newPassword = 'Password must be at least 5 characters long.';
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!currentPassword) {
      errors.currentPassword = 'Please enter your current password.';
    }
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setSavingPassword(true);
    try {
      await apiPut('/api/users/me/password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated.');
    } catch (err) {
      setPasswordErrors(err.fieldErrors || {});
      showToast(err.message || 'Could not update your password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  const themeOptions = [
    { mode: 'light', label: 'Light' },
    { mode: 'dark', label: 'Dark' },
  ];

  return (
    <div className="min-h-screen bg-[var(--luna-bg)] text-gray-900 dark:text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white pr-4 shadow-sm ring-1 ring-gray-200 dark:bg-white/5 dark:ring-white/10">
            <BrandMark size="sm" />
            <div className="py-2 pr-1">
              <h1 className="text-xl font-bold tracking-tight">Settings</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manage your Luna account</p>
            </div>
          </div>
        </div>

        {toast && (
          <motion.p
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className={`mb-4 ${toastClass(toast.color)}`}
          >
            {toast.message}
          </motion.p>
        )}

        {/* Appearance — the only place a theme toggle lives now */}
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Palette className="h-4 w-4" /> Appearance
          </h2>
          <div className={`${sectionClasses()} flex items-center justify-between gap-4`}>
            <div>
              <p className="font-semibold">Theme</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose how Luna looks on this device.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-black/30">
                {themeOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => setTheme(option.mode)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                      theme === option.mode
                        ? 'bg-[#7C3AED] text-white shadow'
                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <ThemeToggle variant="button" />
            </div>
          </div>
        </section>

        {/* Profile picture */}
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <ImagePlus className="h-4 w-4" /> Profile Picture
          </h2>
          <div className={`${sectionClasses()} flex flex-wrap items-center gap-5`}>
            <AvatarPreview url={user.avatarUrl} name={user.displayName || 'You'} />
            <div className="flex flex-col items-start gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleAvatarFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <PrimaryButton
                  type="button"
                  loading={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" /> Change picture
                </PrimaryButton>
                {user.avatarUrl && (
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:border-[#EF4444]/60 hover:text-[#EF4444] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-gray-300"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                JPEG / PNG, up to 5 MB. Saved to your account on every device.
              </p>
            </div>
          </div>
        </section>

        {/* Account information */}
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Save className="h-4 w-4" /> Account Information
          </h2>
          <form onSubmit={handleSaveAccount} className={`${sectionClasses()} space-y-4`} noValidate>
            <div className={fieldGroup()}>
              <label htmlFor="settings-display-name" className={rowLabel()}>
                Display name
              </label>
              <input
                id="settings-display-name"
                name="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (accountErrors.displayName) {
                    setAccountErrors((prev) => ({ ...prev, displayName: undefined }));
                  }
                }}
                className={settingsInput(accountErrors.displayName)}
              />
              <FieldError message={accountErrors.displayName} />
            </div>

            <div className={fieldGroup()}>
              <label htmlFor="settings-username" className={rowLabel()}>
                Username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  @
                </span>
                <input
                  id="settings-username"
                  name="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (accountErrors.username) {
                      setAccountErrors((prev) => ({ ...prev, username: undefined }));
                    }
                  }}
                  className={`${settingsInput(accountErrors.username)} pl-7`}
                />
              </div>
              <FieldError message={accountErrors.username} />
            </div>

            {user.phoneNumber && (
              <div className={fieldGroup()}>
                <span className={rowLabel()}>Phone number</span>
                <p className="rounded-xl border border-gray-300 bg-gray-100/60 px-3.5 py-2.5 text-sm text-gray-500 dark:border-white/15 dark:bg-black/20 dark:text-gray-400">
                  {user.phoneNumber}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Used for sign-in and SMS account recovery.
                </p>
              </div>
            )}

            <div className={fieldGroup()}>
              <label htmlFor="settings-verify-password" className={rowLabel()}>
                Current password <span className="text-[#EF4444]">*</span>
              </label>
              <input
                id="settings-verify-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={verifyPassword}
                onChange={(e) => {
                  setVerifyPassword(e.target.value);
                  if (accountErrors.verifyPassword) {
                    setAccountErrors((prev) => ({ ...prev, verifyPassword: undefined }));
                  }
                }}
                placeholder="Required to save changes"
                className={settingsInput(accountErrors.verifyPassword)}
              />
              <FieldError message={accountErrors.verifyPassword} />
            </div>

            <PrimaryButton type="submit" loading={savingAccount}>
              Save changes
            </PrimaryButton>
          </form>
        </section>

        {/* Change password */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Lock className="h-4 w-4" /> Change Password
          </h2>
          <form onSubmit={handleSavePassword} className={`${sectionClasses()} space-y-4`} noValidate>
            <div className={fieldGroup()}>
              <label htmlFor="settings-current-password" className={rowLabel()}>
                Current password
              </label>
              <input
                id="settings-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (passwordErrors.currentPassword) {
                    setPasswordErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                }}
                className={settingsInput(passwordErrors.currentPassword)}
              />
              <FieldError message={passwordErrors.currentPassword} />
            </div>

            <div className={fieldGroup()}>
              <label htmlFor="settings-new-password" className={rowLabel()}>
                New password
              </label>
              <input
                id="settings-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={5}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (passwordErrors.newPassword) {
                    setPasswordErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }
                }}
                className={settingsInput(passwordErrors.newPassword)}
              />
              <FieldError message={passwordErrors.newPassword} />
            </div>

            <div className={fieldGroup()}>
              <label htmlFor="settings-confirm-password" className={rowLabel()}>
                Confirm new password
              </label>
              <input
                id="settings-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={5}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordErrors.confirmPassword) {
                    setPasswordErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                className={settingsInput(passwordErrors.confirmPassword)}
              />
              <FieldError message={passwordErrors.confirmPassword} />
            </div>

            <PrimaryButton type="submit" loading={savingPassword}>
              Update password
            </PrimaryButton>
          </form>
        </section>
      </div>
    </div>
  );
}

function AvatarPreview({ url, name }) {
  const initials = (name || '?').charAt(0).toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- user avatar data URL
    return <img src={url} alt={name} className="h-20 w-20 rounded-full object-cover ring-4 ring-[#7C3AED]/20" />;
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-2xl font-bold text-white ring-4 ring-[#7C3AED]/20">
      {initials}
    </div>
  );
}