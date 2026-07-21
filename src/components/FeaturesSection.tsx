import { DollarSign, Check, Shield, Smartphone, Clock, BadgeCheck, Star } from 'lucide-react';

interface FeaturesSectionProps {
    isDarkMode?: boolean;
}

export default function FeaturesSection({ isDarkMode = true }: FeaturesSectionProps) {
    const features = [
        {
            icon: DollarSign,
            title: 'Up To 30% Savings',
            description: 'Wholesale rates mean you always pay less.',
        },
        {
            icon: Check,
            title: 'Reliable Delivery',
            description: 'Data delivered directly to your phone.',
        },
        {
            icon: Shield,
            title: 'Secure Payments',
            description: 'Pay safely via Mobile Money or card.',
        },
        {
            icon: Smartphone,
            title: 'All Networks',
            description: 'MTN and Telecel networks supported.',
        },
        {
            icon: Clock,
            title: '24/7 Available',
            description: 'Buy data anytime, day or night.',
        },
        {
            icon: BadgeCheck,
            title: 'No Hidden Fees',
            description: 'Price you see is price you pay.',
        },
    ];

    return (
        <section id="how-to-use" className={`py-16 md:py-24 px-4 ${isDarkMode ? 'bg-[#0f172a]' : 'bg-gray-50'}`}>
            <div className="container mx-auto text-center">
                {/* Section Header */}
                <div className="inline-flex items-center gap-2 text-emerald-500 text-sm font-medium mb-4">
                    <Star className="w-4 h-4" />
                    <span className="uppercase tracking-wider">Benefits</span>
                </div>
                <h2 className={`font-display text-3xl md:text-4xl font-bold mb-12 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Why Choose Byte Beacon?
                </h2>

                {/* Features Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={`rounded-xl p-6 border transition-all duration-300 hover:-translate-y-1 text-center ${isDarkMode
                                ? 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/50'
                                : 'bg-white border-gray-200 hover:border-emerald-500/50 shadow-sm'
                                }`}
                        >
                            {/* Icon */}
                            <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${isDarkMode
                                ? 'bg-slate-700/50 border border-emerald-500/30'
                                : 'bg-emerald-50 border border-emerald-200'
                                }`}>
                                <feature.icon className="w-6 h-6 text-emerald-500" />
                            </div>

                            {/* Title */}
                            <h3 className={`font-display text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {feature.title}
                            </h3>

                            {/* Description */}
                            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
