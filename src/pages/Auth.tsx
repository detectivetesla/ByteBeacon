import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff, Loader2, ArrowLeft, ExternalLink, DollarSign, Check, Wifi, Store, ShieldCheck, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import { agentStoreService } from '@/services/agentStore.service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const signUpSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(9, 'Phone number must be at least 9 digits').max(15),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signInSchema = z.object({
  emailOrPhone: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function Auth() {
  const location = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const isAgentRoute = location.pathname.includes('/agent') || urlParams.get('type') === 'agent' || urlParams.get('agent') === 'true';

  const [isAgentPortal, setIsAgentPortal] = useState(isAgentRoute);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    emailOrPhone: '',
    phone: '',
    countryCode: '+233',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const { signUp, signIn, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check URL params for signup mode & reset stale auth context
  useEffect(() => {
    if (urlParams.get('signup') === 'true') {
      setIsSignUp(true);
    }
    if (!isAgentRoute) {
      sessionStorage.removeItem('auth_context');
    }
  }, [isAgentRoute]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  const handleSuccessfulAuth = async (user: any) => {
    const role = user?.role;
    if (role === 'admin') {
      toast({
        title: 'Admin Access Granted',
        description: 'Redirecting to Admin Console...',
      });
      navigate('/admin');
      return;
    }

    // Is the user logging in explicitly via the Agent Store Portal interface?
    const storedContext = sessionStorage.getItem('auth_context');
    sessionStorage.removeItem('auth_context');

    const isAgentFlow = isAgentPortal || storedContext === 'agent';

    if (isAgentFlow) {
      // AGENT STORE AUTHENTICATION ENTRY POINT
      // Gate: Only agent, superagent, or admin roles may enter the Agent Store Portal
      if (role !== 'agent' && role !== 'superagent' && role !== 'admin') {
        toast({
          title: 'Agent Access Denied',
          description: 'Your account is not an approved Agent or SuperAgent. Apply for agency first, then wait for admin approval.',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      try {
        const storeRes = await agentStoreService.getMyStore();
        if (storeRes.success && storeRes.hasStore && storeRes.store) {
          const store = storeRes.store;
          if (store.effective_status === 'ACTIVE') {
            toast({
              title: `Store Verified: ${store.store_name}`,
              description: 'Health Status: Operational & Active. Opening store console...',
            });
            navigate('/agent-store');
            return;
          } else {
            toast({
              title: `Store Status: ${store.effective_status.replace(/_/g, ' ')}`,
              description: 'Opening store registration/activation console.',
            });
            navigate('/dashboard/agent-store');
            return;
          }
        } else {
          toast({
            title: 'No Active Agent Store Found',
            description: 'Complete store creation or activation to open reseller console.',
          });
          navigate('/dashboard/agent-store');
          return;
        }
      } catch (err) {
        console.error('Error verifying agent store status during agent sign-in:', err);
        navigate('/dashboard/agent-store');
        return;
      }
    }

    // STANDARD BYTEBEACON AUTHENTICATION ENTRY POINT
    // Standard sign-in ALWAYS enters ByteBeacon Dashboard (/dashboard).
    // Having an active Agent Store NEVER overrides standard ByteBeacon authentication redirects!
    toast({
      title: 'Welcome back!',
      description: 'You have successfully signed in to ByteBeacon.',
    });
    navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (isSignUp) {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0].toString()] = err.message;
            }
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        if (!agreedToTerms) {
          toast({
            title: 'Terms required',
            description: 'Please agree to the Terms & Conditions to continue.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const fullName = `${formData.firstName} ${formData.lastName}`;
        const fullPhone = `${formData.countryCode}${formData.phone}`;

        const { error } = await signUp(formData.email, formData.password, fullName, fullPhone);
        if (error) {
          toast({
            title: 'Sign up failed',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Account created!',
            description: 'Registration successful! Please sign in with your credentials.',
          });
          setIsSignUp(false);
          setFormData(prev => ({
            ...prev,
            emailOrPhone: formData.email,
            password: ''
          }));
        }
      } else {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0].toString()] = err.message;
            }
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { user, error } = await signIn(formData.emailOrPhone, formData.password);
        if (error) {
          toast({
            title: 'Sign in failed',
            description: error.message,
            variant: 'destructive',
          });
        } else if (user) {
          handleSuccessfulAuth(user);
        }
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Persist authentication entry point context prior to OAuth trigger
    sessionStorage.setItem('auth_context', isAgentPortal ? 'agent' : 'bytebeacon');
    setLoading(true);
    try {
      const { user, error } = await signInWithGoogle();
      if (error) {
        toast({
          title: 'Google Sign-In Failed',
          description: error.message,
          variant: 'destructive',
        });
      } else if (user) {
        handleSuccessfulAuth(user);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Something went wrong with Google sign-in.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotPasswordEmail) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const { data, error } = await resetPassword(forgotPasswordEmail);
      if (error) {
        toast({
          title: 'Reset Failed',
          description: (error as any).response?.data?.debug || error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Reset Email Status',
          description: (data as any)?.debug ? `Status: ${(data as any).debug}` : 'Check your email for password reset instructions.',
        });
        if (!(data as any)?.debug?.includes('Error')) {
          setShowForgotPassword(false);
          setForgotPasswordEmail('');
        }
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      emailOrPhone: '',
      phone: '',
      countryCode: '+233',
      password: '',
    });
  };

  // Left panel features based on mode
  const signUpFeatures = [
    { icon: ExternalLink, label: 'Free to Join' },
    { icon: DollarSign, label: 'Save 30%' },
    { icon: Check, label: 'Reliable' },
  ];

  const signInFeatures = [
    { icon: DollarSign, label: 'Save 30%' },
    { icon: Check, label: 'Reliable' },
    { icon: Wifi, label: 'All Networks' },
  ];

  const features = isSignUp ? signUpFeatures : signInFeatures;

  // Minimal Agent Store Sign-In layout
  if (isAgentPortal) {
    return (
      <div className="min-h-screen bg-[#141518] text-white font-sans flex flex-col justify-between selection:bg-[#a3e635] selection:text-black">
        {/* Top Minimal Store Header */}
        <header className="bg-[#202227] border-b border-white/5 py-4 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635]">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Agent Store Portal</h1>
              <p className="text-[11px] text-slate-400">Reseller Agent Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsAgentPortal(false);
                sessionStorage.setItem('auth_context', 'bytebeacon');
              }}
              className="text-xs text-slate-400 hover:text-white transition-colors border border-white/10 px-3.5 py-1.5 rounded-xl bg-[#18191c]"
            >
              Standard Sign In
            </button>
            <Link
              to="/"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Home
            </Link>
          </div>
        </header>

        {/* Main Sign-In Card */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-[#202227] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#a3e635]/10 border border-[#a3e635]/30 text-[#a3e635] text-xs font-bold">
                <ShieldCheck className="w-4 h-4" /> Approved Agent Sign In
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Sign In to Your Agent Store</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in with your approved account email/phone or Gmail to access your reseller store dashboard, bundle pricing, and customer orders.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Approved Email or Phone</Label>
                <Input
                  type="text"
                  placeholder="Enter approved email or phone"
                  value={formData.emailOrPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, emailOrPhone: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                  required
                />
                {errors.emailOrPhone && (
                  <p className="text-xs text-destructive">{errors.emailOrPhone}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-slate-300">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.emailOrPhone && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailOrPhone)) {
                        setForgotPasswordEmail(formData.emailOrPhone);
                      }
                      setShowForgotPassword(true);
                    }}
                    className="text-xs text-[#a3e635] hover:underline font-semibold"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635] pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl shadow-lg shadow-[#a3e635]/20 text-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Accessing Store...
                  </>
                ) : (
                  <>
                    Access Agent Store <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#202227] px-3 text-[11px] text-slate-500 font-semibold">or sign in with</span>
              </div>
            </div>

            <div id="google-signin-button" className="hidden"></div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 bg-[#18191c] hover:bg-[#26282e] text-white font-bold rounded-xl border border-white/10 text-xs flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Connecting Google...' : 'Continue with Gmail'}
            </Button>

            <div className="pt-2 text-center text-xs text-slate-400 space-y-1">
              <p>Not an approved agent yet? <Link to="/dashboard/apply-agent" className="text-[#a3e635] font-bold hover:underline">Apply for Agency</Link></p>
            </div>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-white/5 py-4 text-center text-[11px] text-slate-600">
          © {new Date().getFullYear()} Reseller Agent Store Portal. All rights reserved.
        </footer>

        {/* Forgot Password Modal */}
        <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
          <DialogContent className="bg-[#202227] border-white/10 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white">Reset Agent Password</DialogTitle>
              <DialogDescription className="text-slate-400">
                Enter your approved agent email address to receive password reset instructions.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="forgotEmail" className="text-slate-300">Email Address</Label>
                <Input
                  id="forgotEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  className="bg-[#18191c] border-white/10 text-white"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 border-white/10 bg-[#18191c] text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={forgotPasswordLoading}
                  className="flex-1 bg-[#a3e635] text-black font-bold hover:bg-[#b5f73c]"
                >
                  {forgotPasswordLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Custom Background Image */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden bg-emerald-950"
        style={{
          backgroundImage: 'url("/auth-welcome-bg.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none"></div>

        <div className="relative z-10 text-center max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center mb-10">
            <img
              src="/logo.png"
              alt="ByteBeacon"
              className="h-28 w-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
            />
          </div>

          {/* Headline */}
          <h1 className="text-white font-display text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">
            {isSignUp ? 'Start Saving Today' : 'Welcome Back!'}
          </h1>

          {/* Description */}
          <p className="text-white/90 text-lg mb-10 drop-shadow-md">
            {isSignUp
              ? 'Create a free account and get data bundles at up to 30% cheaper than direct.'
              : 'Sign in to access your account and continue saving on data bundles.'}
          </p>

          {/* Features */}
          <div className="flex justify-center gap-8">
            {features.map((feature, index) => (
              <div key={index} className="flex flex-col items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <feature.icon className="w-6 h-6 text-white drop-shadow" />
                <span className="text-white text-sm font-medium drop-shadow">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-background">
        {/* Mobile Header with background image */}
        <div
          className="lg:hidden p-8 text-center relative bg-emerald-950 transition-all duration-500 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.5)]"
          style={{
            backgroundImage: 'url("/auth-welcome-bg.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center mb-6">
              <img
                src="/logo.png"
                alt="ByteBeacon"
                className="h-20 w-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]"
              />
            </div>
            <h2 className="text-white font-display text-2xl font-bold drop-shadow-lg">
              {isSignUp ? 'Start Saving Today' : 'Welcome Back!'}
            </h2>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center p-6 sm:p-8 lg:p-12 max-w-md mx-auto w-full">
          {/* Header with toggles */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isSignUp ? 'Join in under a minute' : 'Access your account'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${isDarkMode
                  ? 'bg-purple-600 text-white'
                  : 'bg-amber-400 text-amber-900'
                  }`}
              >
                {isDarkMode ? 'NIGHT' : 'DAY'}
                <span className="ml-1">●</span>
              </button>
              {/* Home Button */}
              <Link
                to="/"
                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Home
              </Link>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp ? (
              <>
                {/* First Name & Last Name Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className={`bg-muted/50 border-border ${errors.firstName ? 'border-destructive' : ''}`}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">{errors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className={`bg-muted/50 border-border ${errors.lastName ? 'border-destructive' : ''}`}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-destructive">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Phone Number with Country Code */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <div className="flex gap-2">
                    <Select value={formData.countryCode} onValueChange={(value) => setFormData(prev => ({ ...prev, countryCode: value }))}>
                      <SelectTrigger className="w-24 bg-muted/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="+233" className="hover:bg-accent focus:bg-accent">+233</SelectItem>
                        <SelectItem value="+234" className="hover:bg-accent focus:bg-accent">+234</SelectItem>
                        <SelectItem value="+254" className="hover:bg-accent focus:bg-accent">+254</SelectItem>
                        <SelectItem value="+1" className="hover:bg-accent focus:bg-accent">+1</SelectItem>
                        <SelectItem value="+44" className="hover:bg-accent focus:bg-accent">+44</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="241234567"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className={`flex-1 bg-muted/50 border-border ${errors.phone ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={`bg-muted/50 border-border ${errors.email ? 'border-destructive' : ''}`}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Email or Phone for Sign In */}
                <div className="space-y-2">
                  <Label htmlFor="emailOrPhone" className="text-sm font-medium">Email or Phone</Label>
                  <Input
                    id="emailOrPhone"
                    placeholder="Enter email or phone"
                    value={formData.emailOrPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emailOrPhone: e.target.value }))}
                    className={`bg-muted/50 border-border ${errors.emailOrPhone ? 'border-destructive' : ''}`}
                  />
                  {errors.emailOrPhone && (
                    <p className="text-xs text-destructive">{errors.emailOrPhone}</p>
                  )}
                </div>
              </>
            )}

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isSignUp ? 'Min 6 characters' : 'Enter password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={`bg-muted/50 border-border pr-10 ${errors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            {/* Terms (Sign Up) or Remember Me (Sign In) */}
            {isSignUp ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                  I agree to{' '}
                  <Link to="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>
                </Label>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const input = formData.emailOrPhone;
                    if (!input) {
                      setErrors({ emailOrPhone: 'Please enter your email or phone first' });
                      toast({
                        title: 'Email or Phone required',
                        description: 'Please enter your email or phone to reset your password.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
                    if (isEmail) {
                      setForgotPasswordEmail(input);
                    }
                    setShowForgotPassword(true);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full py-6 text-base font-semibold"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-4 text-sm text-muted-foreground">or</span>
            </div>
          </div>

          {/* Google Sign In */}
          <div id="google-signin-button" className="hidden"></div>

          <Button
            type="button"
            variant="outline"
            className="w-full py-6 text-base font-medium gap-2"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </Button>

          {/* Switch Mode Link */}
          <p className="text-center mt-6 text-sm text-muted-foreground">
            {isSignUp ? 'Have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={switchMode}
              className="text-primary font-semibold hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Create one'}
            </button>
          </p>

          {/* Agent Store Dedicated Sign In Banner */}
          <div className="mt-8 pt-6 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setIsAgentPortal(true);
                sessionStorage.setItem('auth_context', 'agent');
              }}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 font-bold text-xs transition-all flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-extrabold text-foreground text-xs">Reseller Agent Store Portal</p>
                  <p className="text-[11px] text-muted-foreground font-medium">Approved Agent? Sign in to your store console</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-2" />
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="forgotEmail">Email Address</Label>
              <Input
                id="forgotEmail"
                type="email"
                placeholder="you@example.com"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                readOnly
                className="bg-muted/50 cursor-not-allowed opacity-80"
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
