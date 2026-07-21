import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Lock, Eye, FileText, Bell } from 'lucide-react';

export default function PrivacyPolicy() {
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            setIsDarkMode(false);
            document.documentElement.classList.remove('dark');
        } else {
            setIsDarkMode(true);
            document.documentElement.classList.add('dark');
        }
        window.scrollTo(0, 0);
    }, []);

    const toggleDarkMode = () => {
        const newDarkMode = !isDarkMode;
        setIsDarkMode(newDarkMode);
        if (newDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const sections = [
        {
            title: "1. Information We Collect",
            icon: Eye,
            content: "We collect information you provide directly to us when you create an account, make a purchase, or communicate with us. This includes your name, email address, phone number, and any payment information processed through our third-party provider (Paystack)."
        },
        {
            title: "2. How We Use Your Information",
            icon: FileText,
            content: "We use the information we collect to provide, maintain, and improve our services, including processing your data bundle orders, sending transaction receipts, and providing customer support. We may also send you updates about our services or promotional offers."
        },
        {
            title: "3. Data Security",
            icon: Lock,
            content: "We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. All transactions are encrypted and processed through secure gateways."
        },
        {
            title: "4. Third-Party Services",
            icon: Shield,
            content: "We use third-party services like Paystack for payment processing and Supabase for database management. These services have their own privacy policies, and we recommend reading them to understand how they handle your data."
        },
        {
            title: "5. Policy Updates",
            icon: Bell,
            content: "We may update this Privacy Policy from time to time. If we make changes, we will notify you by revising the date at the top of the policy and, in some cases, providing you with additional notice (such as adding a statement to our homepage)."
        }
    ];

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-[#0f172a]' : 'bg-gray-50'}`}>
            <Header isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />

            <main className="pt-28 pb-20 px-4">
                <div className="container mx-auto max-w-4xl">
                    <div className="text-center mb-12">
                        <h1 className={`font-display text-3xl md:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            Privacy Policy
                        </h1>
                        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                            Last Updated: January 2024
                        </p>
                    </div>

                    <div className="space-y-8">
                        {sections.map((section, idx) => (
                            <Card key={idx} className={`${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'} border-2 transition-all hover:shadow-lg`}>
                                <CardContent className="p-6 md:p-8">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                                            <section.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                                {section.title}
                                            </h2>
                                            <p className={`leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                                                {section.content}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        <Card className={`${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'} border-2`}>
                            <CardContent className="p-6 text-center">
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                                    Questions about our Privacy Policy? Contact us via WhatsApp or email at support@bytebeacon.com
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            <Footer isDarkMode={isDarkMode} />
        </div>
    );
}
