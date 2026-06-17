'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Store, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { saveToken, isAuthenticated } from '@/lib/auth';
import type { LoginResponse } from '@/types';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setApiError('');
    try {
      const isPin = /^\d{6}$/.test(data.password);
      const body = isPin
        ? { username: data.username, pin: data.password }
        : { username: data.username, password: data.password };
      const res = await api.post<LoginResponse>('/auth/login', body);
      saveToken(res.data.access_token, res.data.user);
      toast.success(`Welcome, ${res.data.user.fullName}!`);
      router.replace(res.data.user.role === 'CASHIER' ? '/dashboard/pos' : '/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid username or password/PIN';
      setApiError(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1B4F8A] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <Store className="w-6 h-6 text-[#1B4F8A]" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">Srivani Stores</p>
            <p className="text-blue-300 text-sm">ERP System</p>
          </div>
        </div>

        <div>
          <h2 className="text-white text-4xl font-bold mb-4 leading-tight">
            Manage your store<br />with confidence.
          </h2>
          <p className="text-blue-200 text-base">
            Point of Sale · Inventory · GST Billing · Reports
          </p>
        </div>

        <div className="flex gap-6 text-blue-300 text-sm">
          <span>Telangana, India</span>
          <span>GST Compliant</span>
          <span>Offline Ready</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-[#1B4F8A] rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-800">Srivani Stores ERP</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h1>
          <p className="text-gray-500 text-sm mb-8">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                {...register('username')}
                autoComplete="username"
                placeholder="admin"
                onInput={() => setApiError('')}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors bg-white
                  ${errors.username
                    ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-300 focus:border-[#1B4F8A] focus:ring-2 focus:ring-blue-100'}`}
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>
              )}
            </div>

            {/* Password / PIN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password / PIN
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter password or 6-digit PIN"
                  onInput={() => setApiError('')}
                  className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm outline-none transition-colors bg-white
                    ${errors.password
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-gray-300 focus:border-[#1B4F8A] focus:ring-2 focus:ring-blue-100'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-[#1B4F8A] hover:bg-[#163f70] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>

            {apiError && (
              <p className="text-red-500 text-sm mt-2 text-center">{apiError}</p>
            )}
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Srivani Stores ERP · © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
