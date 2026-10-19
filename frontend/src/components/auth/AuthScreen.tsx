import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  AuthSession,
  Project,
  StoredUserAccount,
  UserRole,
} from '../../types/domain';
import {
  authenticateUserWithApi,
  getKnownPassword,
  registerNewUserWithApi,
} from '../../services/auth-and-store';
import { formatCurrency } from '../../lib/financial-engine';

export const AuthScreen: React.FC<{
  registeredUsers: StoredUserAccount[];
  sessionExpiredNotice?: boolean;
  onAuthSuccess: (
    session: AuthSession,
    updatedUsers?: StoredUserAccount[],
    updatedProjects?: Project[],
    isNewRegistration?: boolean
  ) => void;
}> = ({ registeredUsers, sessionExpiredNotice, onAuthSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('MANAGER');
  const [regTitle, setRegTitle] = useState('');
  const [regHourlyCost, setRegHourlyCost] = useState('125');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  // Only offer click-to-fill for the documented demo seed accounts; the rest of the
  // agency directory is not shown on the unauthenticated login screen
  const displayedRegisteredAccounts = useMemo(() => {
    return registeredUsers.filter((u) => Boolean(getKnownPassword(u.email)));
  }, [registeredUsers]);

  // Check if typed login email matches an existing registered user
  const matchedRegisteredUser = displayedRegisteredAccounts.find(
    (u) => u.email.trim().toLowerCase() === loginEmail.trim().toLowerCase()
  );

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    const emailToUse = loginEmail.trim();
    if (!emailToUse) {
      setLoginError('Please enter your work email address.');
      setIsSubmitting(false);
      return;
    }

    const resolvedPassword =
      loginPassword ||
      (matchedRegisteredUser?.password && matchedRegisteredUser.password !== '••••••••'
        ? matchedRegisteredUser.password
        : '') ||
      getKnownPassword(emailToUse);

    if (!resolvedPassword) {
      setLoginError('Please enter your account password.');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await authenticateUserWithApi(emailToUse, resolvedPassword);

      if (result.ok === false) {
        setLoginError(result.error);
        setIsSubmitting(false);
        return;
      }

      onAuthSuccess(
        result.session,
        result.updatedUsers,
        result.updatedProjects,
        false
      );
    } catch (err: any) {
      setLoginError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErrors({});

    const trimmedName = regFullName.trim();
    if (!trimmedName) {
      setRegErrors({
        full_name: 'Full name is required.',
        root: 'Full name is required.',
      });
      return;
    }

    const trimmedEmail = regEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setRegErrors({
        email: 'Work email is required.',
        root: 'Work email is required.',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setRegErrors({
        email: 'Please enter a valid work email address.',
        root: 'Please enter a valid work email address.',
      });
      return;
    }

    if (!regPassword) {
      setRegErrors({
        password: 'Password is required.',
        root: 'Password is required.',
      });
      return;
    }

    if (regPassword.length < 8) {
      setRegErrors({
        password: 'Password must be at least 8 characters long.',
        root: 'Password must be at least 8 characters long.',
      });
      return;
    }

    if (!regConfirmPassword) {
      setRegErrors({
        confirm_password: 'Confirm password is required.',
        root: 'Confirm password is required.',
      });
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegErrors({
        confirm_password: 'Passwords do not match.',
        root: 'Passwords do not match.',
      });
      return;
    }

    const parsedCost = Number(regHourlyCost);
    if (!regHourlyCost || Number.isNaN(parsedCost) || parsedCost <= 0) {
      setRegErrors({
        default_hourly_cost: 'Please enter a valid hourly rate greater than $0.',
        root: 'Please enter a valid hourly rate greater than $0.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerNewUserWithApi({
        full_name: trimmedName,
        email: trimmedEmail,
        password: regPassword,
        role: regRole,
        title:
          regTitle.trim() ||
          (regRole === 'MANAGER'
            ? 'Agency Delivery Manager'
            : 'Senior Software Engineer'),
        default_hourly_cost: parsedCost,
        assign_to_active_projects: true,
      });

      if (result.ok === false) {
        const field = result.field ?? 'root';
        const newErrors: Record<string, string> = {
          root: result.error,
          [field]: result.error,
        };
        if (result.errors) {
          Object.assign(newErrors, result.errors);
        }
        setRegErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      onAuthSuccess(
        result.session,
        result.updatedUsers,
        result.updatedProjects,
        true
      );
    } catch (err: any) {
      setRegErrors({ root: err?.message || 'Registration failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickFillAccount = (account: StoredUserAccount) => {
    setMode('LOGIN');
    setLoginEmail(account.email);

    // Resolve the real plaintext password for this registered account
    const resolvedPassword =
      (account.password && account.password !== '••••••••' ? account.password : '') ||
      getKnownPassword(account.email) ||
      (account.email.toLowerCase() === 'manager@agency.com'
        ? 'ManagerPass123!'
        : account.email.toLowerCase() === 'dev@agency.com'
        ? 'DevPass123!'
        : '');

    setLoginPassword(resolvedPassword);
    setLoginError(null);
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#202633] flex flex-col justify-between">
      {/* Minimal Institutional Top Bar */}
      <header className="h-14 bg-white border-b border-[#E3E6ED] px-4 sm:px-6 lg:px-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#6558D3] text-white font-display font-bold text-sm flex items-center justify-center shadow-2xs">
            M
          </div>
          <span className="text-lg font-bold tracking-tight text-[#202633] font-display">
            MarginWatch
          </span>
          <span className="hidden sm:inline-block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6558D3] bg-[#F3F1FF] px-2 py-0.5 rounded border border-[#DAD4FC]">
            v2.4 Financial Watchdog
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#4E5666] hidden sm:inline">
            {mode === 'LOGIN'
              ? 'New to the agency workspace?'
              : 'Already have an agency account?'}
          </span>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
              setLoginError(null);
              setRegErrors({});
            }}
            className="px-3.5 py-1.5 text-xs font-medium text-[#202633] bg-white border border-[#CBD0DC] rounded-lg hover:bg-[#F6F7F9] transition-colors"
          >
            {mode === 'LOGIN' ? 'Create Account' : 'Sign In'}
          </button>
        </div>
      </header>

      {/* Main Split Auth Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left 5 Columns: Institutional Product Overview & Role Capabilities */}
        <div className="lg:col-span-5 space-y-6 lg:pt-2">
          <div className="space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6558D3] bg-[#F3F1FF] px-2.5 py-1 rounded-lg border border-[#DAD4FC]">
              B2B Financial Profitability & Budget Watchdog
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#202633] font-display leading-tight">
              Protect agency delivery margins before budgets overrun.
            </h1>
            <p className="text-sm text-[#4E5666] leading-relaxed">
              MarginWatch unifies project delivery budgets, immutable labor cost
              snapshots, manager-gated expense approvals, and deterministic risk
              forecasting with strict role-based access control.
            </p>
          </div>

          {/* Role Architecture Explanation */}
          <div className="bg-white border border-[#E3E6ED] rounded-2xl divide-y divide-[#E3E6ED] shadow-2xs">
            <div className="p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#202633] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#6558D3] shrink-0" />
                  <span>Agency Manager Role (MANAGER)</span>
                </span>
                <span className="text-[11px] font-mono text-[#6558D3] bg-[#F3F1FF] px-2 py-0.5 rounded border border-[#DAD4FC]">
                  Full Financial Authority
                </span>
              </div>
              <p className="text-xs text-[#4E5666] leading-relaxed">
                Creates clients and project budgets, views contract revenue and
                projected margins, approves or rejects team expenses, manages team
                assignments, and runs AI Risk Advisor interventions.
              </p>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#202633] flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#047857] shrink-0" />
                  <span>Team Member Role (TEAM_MEMBER)</span>
                </span>
                <span className="text-[11px] font-mono text-[#047857] bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">
                  Delivery Operations
                </span>
              </div>
              <p className="text-xs text-[#4E5666] leading-relaxed">
                Views assigned active projects, records decimal delivery work hours,
                and submits project expenses while tracking reimbursement approval
                status. Commercial margins and peer hourly rates remain hidden.
              </p>
            </div>
          </div>

          {/* Registered Workspace Accounts for Quick Sign-In */}
          <div className="bg-white border border-[#E3E6ED] rounded-2xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#202633]">
                Registered Workspace Accounts (Click to Fill Credentials)
              </span>
              <span className="text-[11px] text-[#697386] font-mono-tabular">
                {displayedRegisteredAccounts.length}{' '}
                {displayedRegisteredAccounts.length === 1 ? 'account' : 'accounts'}
              </span>
            </div>

            {displayedRegisteredAccounts.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-[#697386] bg-[#F6F7F9] rounded-xl border border-dashed border-[#CBD0DC]">
                No registered accounts found. Switch to the Register tab to create your workspace account.
              </div>
            ) : (
              <div className="divide-y divide-[#E3E6ED]/60 max-h-56 overflow-y-auto pr-0.5">
                {displayedRegisteredAccounts.map((acc) => {
                  const isSelected =
                    loginEmail.trim().toLowerCase() === acc.email.trim().toLowerCase();
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => quickFillAccount(acc)}
                      className={`w-full py-2.5 px-2 text-left rounded-lg flex items-center justify-between gap-2 transition-all group ${
                        isSelected
                          ? 'bg-[#F3F1FF] ring-1 ring-[#6558D3]'
                          : 'hover:bg-[#F6F7F9]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-semibold truncate ${
                            isSelected
                              ? 'text-[#6558D3]'
                              : 'text-[#202633] group-hover:text-[#6558D3]'
                          }`}
                        >
                          {acc.full_name}{' '}
                          <span className="font-normal text-[#697386]">
                            · {acc.title}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#697386] truncate">
                          {acc.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected && (
                          <span className="text-[10px] text-[#6558D3] font-medium hidden sm:inline">
                            Filled ✓
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded border ${
                            acc.role === 'MANAGER'
                              ? 'bg-[#F3F1FF] border-[#DAD4FC] text-[#6558D3]'
                              : 'bg-[#F0F2F6] border-[#CBD0DC] text-[#4E5666]'
                          }`}
                        >
                          {acc.role}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 7 Columns: Sign In / Registration Card */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-[#E3E6ED] rounded-2xl shadow-xs overflow-hidden">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setLoginError(null);
                }}
                className={`py-3.5 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  mode === 'LOGIN'
                    ? 'bg-white border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign In to Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setRegErrors({});
                }}
                className={`py-3.5 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  mode === 'REGISTER'
                    ? 'bg-white border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register New Account</span>
              </button>
            </div>

            {sessionExpiredNotice && mode === 'LOGIN' && (
              <div
                role="status"
                className="mx-6 mt-6 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900"
              >
                You have signed out of your previous session. Sign in or register a
                new account to continue.
              </div>
            )}

            {mode === 'LOGIN' ? (
              /* ==================== SIGN IN FORM ==================== */
              <form
                noValidate
                onSubmit={handleLoginSubmit}
                className="p-6 sm:p-8 space-y-5"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Sign In to MarginWatch
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Sign in with your MarginWatch account. Your workspace
                    navigation, financial visibility, and approval controls are
                    governed by your account role.
                  </p>
                </div>

                {loginError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Work Email Address
                  </label>
                  <input
                    id="login-email"
                    type="text"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Enter registered email (e.g. manager@agency.com)"
                    className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter account password"
                      className="w-full h-10 pl-3 pr-10 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      aria-label={
                        showLoginPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Matched Directory Account Indicator */}
                {matchedRegisteredUser && (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 block">
                          Matched Directory Account
                        </span>
                        <strong className="text-slate-900">
                          {matchedRegisteredUser.full_name} ·{' '}
                          {matchedRegisteredUser.title}
                        </strong>
                      </div>
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        Role: {matchedRegisteredUser.role}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-10 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating with Backend...</span>
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>Need a customized profile with hourly rate?</span>
                  <button
                    type="button"
                    onClick={() => setMode('REGISTER')}
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    Register Account →
                  </button>
                </div>
              </form>
            ) : (
              /* ==================== REGISTRATION FORM ==================== */
              <form
                noValidate
                onSubmit={handleRegisterSubmit}
                className="p-6 sm:p-8 space-y-5"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Create Your MarginWatch Account
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Select your organizational role to configure your permissions and
                    internal delivery rate snapshot.
                  </p>
                </div>

                {regErrors.root && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{regErrors.root}</span>
                  </div>
                )}

                {/* Role Selection Cards */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Select Account Role <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRegRole('MANAGER');
                        if (!regTitle) setRegTitle('Principal Delivery Manager');
                        setRegHourlyCost('135');
                      }}
                      aria-pressed={regRole === 'MANAGER'}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        regRole === 'MANAGER'
                          ? 'bg-blue-50/70 border-blue-700 ring-1 ring-blue-700'
                          : 'bg-white border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Agency Manager
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold">
                          MANAGER
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Manage clients, project budgets, revenue & margins, approve
                        expenses, and run AI Risk Advisor.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRegRole('TEAM_MEMBER');
                        if (!regTitle) setRegTitle('Senior Software Engineer');
                        setRegHourlyCost('115');
                      }}
                      aria-pressed={regRole === 'TEAM_MEMBER'}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        regRole === 'TEAM_MEMBER'
                          ? 'bg-blue-50/70 border-blue-700 ring-1 ring-blue-700'
                          : 'bg-white border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Team Member
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                          TEAM_MEMBER
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Access assigned projects, log decimal work hours, and submit
                        project expenses for approval.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-name"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Full Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Jordan Vance"
                      aria-invalid={Boolean(regErrors.full_name)}
                      className={`w-full h-10 px-3 text-sm rounded-md border ${
                        regErrors.full_name ? 'border-red-600' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                    />
                    {regErrors.full_name && (
                      <p role="alert" className="mt-1 text-xs text-red-600">
                        {regErrors.full_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Work Email <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="jordan.vance@vanguard-agency.io"
                      aria-invalid={Boolean(regErrors.email)}
                      className={`w-full h-10 px-3 text-sm rounded-md border ${
                        regErrors.email ? 'border-red-600' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                    />
                    {regErrors.email && (
                      <p role="alert" className="mt-1 text-xs text-red-600">
                        {regErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-title"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Job Title / Discipline
                    </label>
                    <input
                      id="reg-title"
                      type="text"
                      value={regTitle}
                      onChange={(e) => setRegTitle(e.target.value)}
                      placeholder={
                        regRole === 'MANAGER'
                          ? 'Delivery Director'
                          : 'Senior Full-Stack Engineer'
                      }
                      className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-rate"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Internal Hourly Cost Rate (USD/hr){' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="reg-rate"
                      type="number"
                      step="0.01"
                      min="1"
                      value={regHourlyCost}
                      onChange={(e) => setRegHourlyCost(e.target.value)}
                      aria-invalid={Boolean(regErrors.default_hourly_cost)}
                      className={`w-full h-10 px-3 text-sm font-mono-tabular rounded-md border ${
                        regErrors.default_hourly_cost
                          ? 'border-red-600'
                          : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                    />
                    {regErrors.default_hourly_cost && (
                      <p role="alert" className="mt-1 text-xs text-red-600">
                        {regErrors.default_hourly_cost}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Password (8+ characters) <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        aria-invalid={Boolean(regErrors.password)}
                        className={`w-full h-10 pl-3 pr-10 text-sm rounded-md border ${
                          regErrors.password ? 'border-red-600' : 'border-slate-300'
                        } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((prev) => !prev)}
                        aria-label={
                          showRegPassword ? 'Hide password' : 'Show password'
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                      >
                        {showRegPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {regErrors.password && (
                      <p role="alert" className="mt-1 text-xs text-red-600">
                        {regErrors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-confirm"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Confirm Password <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="reg-confirm"
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      aria-invalid={Boolean(regErrors.confirm_password)}
                      className={`w-full h-10 px-3 text-sm rounded-md border ${
                        regErrors.confirm_password
                          ? 'border-red-600'
                          : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                    />
                    {regErrors.confirm_password && (
                      <p role="alert" className="mt-1 text-xs text-red-600">
                        {regErrors.confirm_password}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  Registering as{' '}
                  <strong className="text-slate-900">
                    {regRole === 'MANAGER'
                      ? 'Agency Manager (MANAGER)'
                      : 'Team Member (TEAM_MEMBER)'}
                  </strong>{' '}
                  with an internal cost snapshot rate of{' '}
                  <strong className="font-mono-tabular text-slate-900">
                    {formatCurrency(Number(regHourlyCost) || 0, 'USD')}/hr
                  </strong>
                  . Active agency projects will be automatically linked to your
                  profile.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-10 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    'Create Account & Enter Workspace'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Clean Institutional Footer */}
      <footer className="py-4 px-6 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>MarginWatch · Project Profitability & Budget Watchdog</span>
        <span>Role-Based Access Control (RBAC) · WCAG 2.2 AA Compliant</span>
      </footer>
    </div>
  );
};
