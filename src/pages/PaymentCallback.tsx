import { useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const verifyPayment = useCallback(async (reference: string) => {
    try {
      const data = await paymentService.verifyPayment(reference);

      toast({
        title: data.success ? 'Payment Successful!' : 'Payment Failed',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not verify payment. Please contact support.';
      console.error('Payment verification error:', err);
      toast({
        title: 'Verification Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      navigate('/dashboard');
    }
  }, [navigate, toast]);

  useEffect(() => {
    const reference = searchParams.get('reference');
    if (reference) {
      verifyPayment(reference);
    } else {
      navigate('/dashboard');
    }
  }, [searchParams, navigate, verifyPayment]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
      <p className="text-lg font-semibold">Verifying payment...</p>
    </div>
  );
}
