import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Gavel, CreditCard, Send, AlertTriangle, UserCheck } from 'lucide-react';

export default function TermsOfService() {
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
            title: "1. Acceptance of Terms",
            icon: Gavel,
            content: "By accessing or using ByteBeacon, you agree to comply with and be bound by these Terms of Service. If you do not agree, please do not use our services. These terms apply to all visitors, users, and others who access the service."
        },
        {
            title: "2. Data Bundle Purchases",
            icon: Send,
            content: "Users are responsible for providing the correct recipient phone number. Once a data bundle is processed and delivered to the provided number, the transaction is final. Due to the nature of digital goods, we cannot offer refunds for data sent to the wrong number."
        },
        {
            title: "3. Payments and Fees",
            icon: CreditCard,
            content: "All payments are processed through Paystack. You agree to pay the fees for any services you purchase. Prices are subject to change based on network provider adjustments, but we will always show the current price before you confirm your purchase."
        },
        {
            title: "4. Service Delivery",
            icon: AlertTriangle,
            content: "While we aim for instant delivery, some orders may take longer during peak hours or network downtimes. Typical delivery time is between 1 minute and 2 hours. Orders placed outside working hours (7 AM - 9 PM) may be processed the next business day."
        },
        {
            title: "5. User Conduct",
            icon: UserCheck,
            content: "You agree not to use the service for any illegal or unauthorized purpose. You must not attempt to hack, disrupt, or interfere with our servers or security protocols. Accounts found violating these terms may be suspended without notice."
        }
    ];

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-[#0f172a]' : 'bg-gray-50'}`}>
            <Header isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />

            <main className="pt-28 pb-20 px-4">
                <div className="container mx-auto max-w-4xl">
                    <div className="text-center mb-12">
                        <h1 className={`font-display text-3xl md:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            Terms of Service
                        </h1>
                        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                            Effective Date: January 2024
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

                        <Card className={`${isDarkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100'} border-2`}>
                            <CardContent className="p-6 flex items-center gap-4">
                                <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                                    IMPORTANT: Always double-check the recipient phone number before confirming payment. ByteBeacon is not liable for data sent to incorrect numbers provided by users.
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
