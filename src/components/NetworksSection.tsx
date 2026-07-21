import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Wifi } from 'lucide-react';

interface NetworksSectionProps {
    isDarkMode?: boolean;
}

export default function NetworksSection({ isDarkMode = true }: NetworksSectionProps) {
    const networks = [
        {
            name: 'MTN Ghana',
            savings: 'Save up to 25%',
            bgColor: 'bg-[#FFCC00]',
            textColor: 'text-black',
            badgeBg: 'bg-black/10',
            badgeText: 'text-black',
            logoImage: '/mtn-logo.png',
        },
        {
            name: 'Telecel Ghana',
            savings: 'Save up to 20%',
            bgColor: 'bg-[#FF0000]',
            textColor: 'text-white',
            badgeBg: 'bg-white/20',
            badgeText: 'text-white',
            logoImage: '/telecel-logo.png',
        },
        {
            name: 'AirtelTigo',
            savings: 'Save up to 15%',
            bgColor: 'bg-gradient-to-b from-[#1a365d] via-[#1a365d] to-[#e53e3e]',
            textColor: 'text-white',
            badgeBg: 'bg-white/20',
            badgeText: 'text-white',
            logoImage: '/airteltigo-logo.png',
        },
    ];

    return (
        <section id="networks" className={`py-16 md:py-24 px-4 ${isDarkMode ? 'bg-[#0f172a]' : 'bg-gray-50'}`}>
            <div className="container mx-auto text-center">
                {/* Section Header */}
                <div className="inline-flex items-center gap-2 text-emerald-500 text-sm font-medium mb-4">
                    <Wifi className="w-4 h-4" />
                    <span className="uppercase tracking-wider">Networks</span>
                </div>
                <h2 className={`font-display text-3xl md:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    All Major Networks, Better Prices
                </h2>
                <p className={`max-w-2xl mx-auto mb-12 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                    Official data bundles at discounted wholesale rates
                </p>

                {/* Network Cards */}
                <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
                    {networks.map((network, index) => (
                        <div
                            key={index}
                            className={`${network.bgColor} rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group`}
                        >
                            {/* Logo */}
                            <div className="h-24 flex items-center justify-center mb-6">
                                <img
                                    src={network.logoImage}
                                    alt={network.name}
                                    className="w-20 h-20 rounded-full object-cover shadow-lg"
                                />
                            </div>

                            {/* Network Name */}
                            <h3 className={`font-display text-xl font-bold ${network.textColor} mb-3`}>
                                {network.name}
                            </h3>

                            {/* Savings Badge */}
                            <div className={`inline-block ${network.badgeBg} ${network.badgeText} px-4 py-1.5 rounded-full text-sm font-medium`}>
                                {network.savings}
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA Button */}
                <Link to="/auth">
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 font-semibold px-8">
                        Browse All Bundles
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
            </div>
        </section>
    );
}
