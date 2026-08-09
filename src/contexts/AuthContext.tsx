import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, getToken, type User } from '@/services';

type AppRole = 'admin' | 'customer' | 'agent';

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: Error | null }>;
  signInWithGoogle: () => Promise<{ user: User | null; error: Error | null }>;
  resetPassword: (email: string) => Promise<{ data: any; error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing auth on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();

      if (token) {
        try {
          const userData = await authService.getMe();
          setUser(userData);
          setRole(userData.role as AppRole);
        } catch (error) {
          console.error('Auth init error:', error);
          // Token invalid, remove it
          await authService.logout();
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    try {
      await authService.register({ email, password, fullName, phone });
      // Removed setUser and setRole to force manual login
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      setUser(response.user);
      setRole(response.user.role as AppRole);
      return { user: response.user, error: null };
    } catch (err) {
      return { user: null, error: err as Error };
    }
  };

  const signInWithGoogle = async (): Promise<{ user: User | null; error: Error | null }> => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      return { user: null, error: new Error('Google Client ID not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file.') };
    }

    // @ts-ignore - Google Identity Services types
    if (typeof google === 'undefined' || !google.accounts) {
      return {
        user: null,
        error: new Error('Google Sign-In script failed to load. This might be due to an ad-blocker or network restriction. Please disable any ad-blockers and refresh the page.')
      };
    }

    return new Promise<{ user: User | null; error: Error | null }>((resolve) => {
      try {
        // @ts-ignore
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              try {
                const result = await authService.googleLogin(response.credential);
                setUser(result.user);
                setRole(result.user.role as AppRole);
                resolve({ user: result.user, error: null });
              } catch (err: any) {
                console.error('Google backend login error:', err);
                resolve({ user: null, error: new Error(err.response?.data?.error || 'Failed to authenticate with Google via our backend.') });
              }
            } else {
              resolve({ user: null, error: new Error('No credential received from Google.') });
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          context: 'signin',
          ux_mode: 'popup'
        });

        // Render a button in a temporary container and click it
        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer) {
          // @ts-ignore
          google.accounts.id.renderButton(buttonContainer, {
            type: 'standard',
            theme: 'filled_blue',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 300,
          });

          // Trigger click on the rendered button after a short delay
          // This simulates a user click since GSI required a user gesture for some flows
          setTimeout(() => {
            const googleBtn = buttonContainer?.querySelector('div[role="button"]') as HTMLElement;
            if (googleBtn) {
              googleBtn.click();
            } else {
              // Fallback to prompt if button rendering fails visually
              // @ts-ignore
              google.accounts.id.prompt();
            }
          }, 200);
        } else {
          // No button container, try One Tap prompt
          // @ts-ignore
          google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed()) {
              resolve({ user: null, error: new Error('Google Sign-In prompt could not be displayed. Try refreshing the page.') });
            }
          });
        }
      } catch (err) {
        resolve({ user: null, error: err as Error });
      }
    });
  };

  const resetPassword = async (email: string) => {
    try {
      const response = await authService.requestPasswordReset(email);
      return { data: response, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  };

  const signOut = async () => {
    await authService.logout();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signUp, signIn, signInWithGoogle, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
