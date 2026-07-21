import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin } from 'lucide-react';

interface HeroSectionProps {
    isDarkMode?: boolean;
}

export default function HeroSection({ isDarkMode = true }: HeroSectionProps) {
    const stats = [
        { value: '50K+', label: 'Happy Customers' },
        { value: '₵2M+', label: 'Saved by Users' },
        { value: '30%', label: 'Average Savings' },
    ];

    return (
        <section className={`pt-24 pb-16 md:pt-32 md:pb-24 px-4 min-h-screen relative overflow-hidden ${isDarkMode ? 'bg-[#0f172a]' : 'bg-gray-50'
            }`}>
            {/* Background decorations */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-500/20'
                    }`} />
                <div className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl ${isDarkMode ? 'bg-emerald-500/5' : 'bg-emerald-500/10'
                    }`} />
            </div>

            <div className="container mx-auto relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <div className="text-left">
                        {/* Badge */}
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 ${isDarkMode ? 'bg-slate-700/50' : 'bg-white shadow-md'
                            }`}>
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            <span className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>Ghana's Trusted Data Source</span>
                            <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded">Save 30%</span>
                        </div>

                        {/* Headline */}
                        <h1 className={`font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            Data Bundles At{' '}
                            <span className="text-emerald-500">Unbeatable Prices</span>
                        </h1>

                        {/* Description */}
                        <p className={`text-lg mb-8 max-w-lg ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                            Stop overpaying for mobile data. Byte Beacon offers MTN
                            and Telecel bundles at wholesale prices — saving
                            you money on every purchase.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-10">
                            <Link to="/auth?signup=true">
                                <Button size="lg" className="w-full sm:w-auto gap-2 font-semibold bg-emerald-500 hover:bg-emerald-600 text-white">
                                    Get Started
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </Link>
                            <a href="#pricing">
                                <Button size="lg" variant="outline" className={`w-full sm:w-auto font-semibold ${isDarkMode
                                    ? 'border-slate-600 text-white hover:bg-slate-700/50'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                                    }`}>
                                    View Prices
                                </Button>
                            </a>
                        </div>

                        {/* Stats */}
                        <div className={`flex flex-wrap gap-8 pt-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                            {stats.map((stat, index) => (
                                <div key={index} className="text-left">
                                    <div className={`font-display text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {stat.value}
                                    </div>
                                    <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                        {stat.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Content - Dashboard Screenshot */}
                    <div className="relative hidden lg:block">
                        <div className="relative">
                            {/* Dashboard image */}
                            <div className={`rounded-2xl overflow-hidden shadow-2xl ${isDarkMode ? 'border border-slate-700/50' : 'border border-gray-200'}`}>
                                <img
                                    src="/hero-dashboard.png"
                                    alt="ByteBeacon Dashboard"
                                    className="w-full h-auto"
                                />
                            </div>

                            {/* Floating elements */}
                            <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-500/20 rounded-full blur-xl"></div>
                            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-emerald-500/20 rounded-full blur-xl"></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
