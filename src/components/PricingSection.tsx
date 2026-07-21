import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, DollarSign } from 'lucide-react';

interface PricingSectionProps {
    isDarkMode?: boolean;
}

export default function PricingSection({ isDarkMode = true }: PricingSectionProps) {
    const plans = [
        {
            name: '5GB',
            network: 'Telecel',
            duration: '30 Days',
            price: 'GH₵ 25.00',
            savings: 'Save GH₵ 5.00',
            popular: false,
            badgeColor: 'bg-red-600 text-white',
        },
        {
            name: '1GB',
            network: 'MTN',
            duration: '30 Days',
            price: 'GH₵ 5.00',
            savings: 'Save GH₵ 1.00',
            popular: true,
            badgeColor: 'bg-yellow-400 text-black',
        },
        {
            name: '3GB',
            network: 'AirtelTigo',
            duration: '30 Days',
            price: 'GH₵ 15.00',
            savings: 'Save GH₵ 3.00',
            popular: false,
            badgeColor: 'bg-gradient-to-r from-[#1a365d] to-[#e53e3e] text-white',
        },
    ];

    return (
        <section id="pricing" className={`py-16 md:py-24 px-4 ${isDarkMode ? 'bg-[#0f172a]' : 'bg-white'}`}>
            <div className="container mx-auto text-center">
                {/* Section Header */}
                <div className="inline-flex items-center gap-2 text-emerald-500 text-sm font-medium mb-4">
                    <DollarSign className="w-4 h-4" />
                    <span className="uppercase tracking-wider">Pricing</span>
                </div>
                <h2 className={`font-display text-3xl md:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Compare & Save
                </h2>
                <p className={`max-w-2xl mx-auto mb-12 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                    Same data, lower prices — see how much you save
                </p>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
                    {plans.map((plan, index) => (
                        <div
                            key={index}
                            className={`relative rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 ${isDarkMode
                                ? `bg-slate-800/50 ${plan.popular ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-700/50 hover:border-slate-600'}`
                                : `bg-white shadow-lg ${plan.popular ? 'border-emerald-500 shadow-emerald-500/20' : 'border-gray-200 hover:border-gray-300'}`
                                }`}
                        >
                            {/* Popular Badge */}
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="bg-yellow-500 text-yellow-900 text-xs font-bold px-4 py-1 rounded-full uppercase">
                                        Popular
                                    </span>
                                </div>
                            )}

                            {/* Network Badge */}
                            <div className="flex justify-center mb-4 pt-2">
                                <span className={`${plan.badgeColor} text-xs font-bold px-3 py-1 rounded`}>
                                    {plan.network}
                                </span>
                            </div>

                            {/* Data Amount */}
                            <div className={`font-display text-4xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {plan.name}
                            </div>
                            <div className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                {plan.duration}
                            </div>

                            {/* Price */}
                            <div className="mb-4">
                                <span className="font-display text-3xl font-bold text-emerald-500">
                                    {plan.price}
                                </span>
                            </div>

                        </div>
                    ))}
                </div>

                {/* See All Button */}
                <Link to="/auth">
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 font-semibold px-8">
                        See All Bundles
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
            </div>
        </section>
    );
}
