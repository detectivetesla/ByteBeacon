import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [verifying, setVerifying] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [tokenError, setTokenError] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Verify token on mount
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setTokenError('No reset token provided');
                setVerifying(false);
                return;
            }

            try {
                const result = await authService.verifyResetToken(token);
                if (result.valid) {
                    setTokenValid(true);
                } else {
                    setTokenError(result.message || 'Invalid or expired token');
                }
            } catch (error: any) {
                setTokenError(error.message || 'Failed to verify reset link');
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast({
                title: 'Passwords do not match',
                description: 'Please make sure both passwords are the same.',
                variant: 'destructive',
            });
            return;
        }

        if (newPassword.length < 8) {
            toast({
                title: 'Password too short',
                description: 'Password must be at least 8 characters.',
                variant: 'destructive',
            });
            return;
        }

        setSubmitting(true);

        try {
            await authService.executePasswordReset(token!, newPassword);
            setSuccess(true);
            toast({
                title: 'Password Reset Successful!',
                description: 'You can now log in with your new password.',
            });
        } catch (error: any) {
            toast({
                title: 'Reset Failed',
                description: error.message || 'Failed to reset password. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4"
            style={{
                background: 'radial-gradient(circle at center, #065f46 0%, #022c22 45%, #000000 100%)',
            }}
        >
            <div className="w-full max-w-md">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <img src="/logo.png" alt="ByteBeacon" className="h-14 mx-auto mb-2" />
                        <p className="text-white/60">Reset Your Password</p>
                    </div>

                    {/* Verifying State */}
                    {verifying && (
                        <div className="text-center py-12">
                            <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mx-auto mb-4" />
                            <p className="text-white/70">Verifying secure reset link...</p>
                        </div>
                    )}

                    {/* Invalid Token State */}
                    {!verifying && !tokenValid && !success && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <XCircle className="w-8 h-8 text-red-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Invalid Reset Link</h2>
                            <p className="text-white/60 mb-6">{tokenError || 'This password reset link is invalid or has expired.'}</p>
                            <Link to="/auth">
                                <Button className="gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                    Request New Reset Link
                                </Button>
                            </Link>
                        </div>
                    )}

                    {/* Valid Token - Password Form */}
                    {!verifying && tokenValid && !success && (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Lock className="w-8 h-8 text-emerald-400" />
                                </div>
                                <p className="text-white/60">Enter your new secure password</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-white/80">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        required
                                        minLength={8}
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-white/80">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                    minLength={8}
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                                />
                            </div>

                            {newPassword && newPassword.length < 8 && (
                                <div className="flex items-center gap-2 text-amber-400 text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    Password must be at least 8 characters
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12"
                                disabled={submitting || newPassword.length < 8}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Resetting Password...
                                    </>
                                ) : (
                                    'Reset Password'
                                )}
                            </Button>
                        </form>
                    )}

                    {/* Success State */}
                    {success && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Password Reset Complete!</h2>
                            <p className="text-white/60 mb-6">Your password has been successfully reset. You can now log in with your new password.</p>
                            <Button
                                onClick={() => navigate('/auth')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
                            >
                                Sign In Now
                            </Button>
                        </div>
                    )}

                    {/* Back to Login Link */}
                    {!success && (
                        <div className="mt-6 text-center">
                            <Link to="/auth" className="text-white/60 hover:text-white text-sm flex items-center justify-center gap-1">
                                <ArrowLeft className="w-3 h-3" />
                                Back to Login
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
