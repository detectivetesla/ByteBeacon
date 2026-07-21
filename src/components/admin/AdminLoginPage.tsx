import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Lock, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminLoginPage() {
    const navigate = useNavigate();
    const { signIn, role, signOut } = useAuth();
    const { resolvedTheme, setTheme } = useTheme();
    const { toast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast({
                title: 'Error',
                description: 'Please fill in all fields',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        try {
            const result = await signIn(email, password);

            if (result.error) {
                toast({
                    title: 'Login Failed',
                    description: 'Invalid credentials',
                    variant: 'destructive',
                });
                setLoading(false);
                return;
            }

            // Check if user is admin
            if (result.user?.role === 'admin') {
                navigate('/admin');
            } else {
                toast({
                    title: 'Access Denied',
                    description: 'You do not have admin privileges',
                    variant: 'destructive',
                });
                await signOut();
                setLoading(false);
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: 'An unexpected error occurred',
                variant: 'destructive',
            });
            setLoading(false);
        }
    };

    const toggleTheme = () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 p-4">
            {/* Login Card */}
            <div className="w-full max-w-md">
                <div className="bg-[#0f172a] rounded-2xl p-8 shadow-2xl border border-slate-700/50">
                    {/* Logo */}
                    <div className="flex items-center justify-center mb-2">
                        <img src="/logo.png" alt="ByteBeacon" className="h-14 w-auto" />
                    </div>

                    {/* Title */}
                    <h1 className="text-center text-2xl font-bold text-white mb-1">
                        Admin Login
                    </h1>
                    <p className="text-center text-slate-400 text-sm mb-8">
                        Sign in to access the admin dashboard
                    </p>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-300">
                                Email Address
                            </Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@bytebeacon.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-300">
                                Password
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                    </form>

                    {/* Theme Toggle */}
                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
                        >
                            {resolvedTheme === 'dark' ? (
                                <Sun className="w-5 h-5 text-yellow-400" />
                            ) : (
                                <Moon className="w-5 h-5 text-slate-400" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Back to site link */}
                <p className="text-center mt-6 text-white/70 text-sm">
                    <a href="/" className="hover:text-white underline">
                        ← Back to Website
                    </a>
                </p>
            </div>
        </div>
    );
}
