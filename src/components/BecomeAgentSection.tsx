import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Users, ArrowRight } from 'lucide-react';

export default function BecomeAgentSection() {
    const benefits = [
        'Earn 5% commission on every sale',
        'No startup capital required',
        'Free training and support',
        'Weekly Mobile Money payouts',
    ];

    return (
        <section className="py-16 md:py-24 px-4 bg-[#0f172a]" id="become-agent">
            <div className="container mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <div>
                        {/* Partnership Badge */}
                        <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-medium mb-6">
                            <Users className="w-4 h-4" />
                            <span className="uppercase tracking-wider">Partnership</span>
                        </div>

                        {/* Heading */}
                        <h2 className="text-white font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                            Become a{' '}
                            <span className="text-emerald-400">Byte Beacon</span> Agent
                        </h2>

                        {/* Description */}
                        <p className="text-slate-400 text-lg mb-8 max-w-lg">
                            Turn your phone into a profitable business. Join our network of agents and
                            earn commissions on every sale.
                        </p>

                        {/* Benefits List */}
                        <ul className="space-y-4 mb-8">
                            {benefits.map((benefit, index) => (
                                <li key={index} className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-emerald-400" />
                                    </div>
                                    <span className="text-slate-300">{benefit}</span>
                                </li>
                            ))}
                        </ul>

                        {/* CTA Button */}
                        <Link to="/auth">
                            <Button
                                size="lg"
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8"
                            >
                                Apply Now
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>

                    {/* Right - Illustration */}
                    <div className="hidden lg:flex justify-center">
                        <div className="relative w-full max-w-md">
                            {/* Background shape */}
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-3xl transform rotate-3"></div>

                            {/* Image container */}
                            <div className="relative bg-slate-100 rounded-2xl overflow-hidden shadow-2xl">
                                <img
                                    src="/agent-illustration.png"
                                    alt="Become an Agent"
                                    className="w-full h-auto"
                                    onError={(e) => {
                                        // Fallback to a placeholder if image doesn't load
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement!.innerHTML = `
                                            <div class="w-full h-80 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                                                <div class="text-center p-8">
                                                    <img src="/logo.png" alt="ByteBeacon" class="h-20 mx-auto mb-4" />
                                                    <p class="text-slate-600 font-medium">Join 500+ Agents</p>
                                                    <p class="text-slate-500 text-sm">Earning with ByteBeacon</p>
                                                </div>
                                            </div>
                                        `;
                                    }}
                                />
                            </div>

                            {/* Decorative floating elements */}
                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center shadow-lg animate-bounce">
                                <span className="text-yellow-900 font-bold text-lg">$</span>
                            </div>
                            <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-white text-xs font-bold">5%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
