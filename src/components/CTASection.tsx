import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface CTASectionProps {
    isDarkMode?: boolean;
}

export default function CTASection({ isDarkMode = true }: CTASectionProps) {
    return (
        <section className={`py-16 md:py-20 px-4 ${isDarkMode ? 'bg-[#0f172a]' : 'bg-gray-50'}`}>
            <div className="container mx-auto">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-3xl p-8 md:p-12 lg:p-16 text-center relative overflow-hidden">
                    {/* Background decorations */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                    </div>

                    <div className="relative z-10">
                        <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                            Ready to Save on Data?
                        </h2>
                        <p className="text-white/90 max-w-xl mx-auto mb-8 text-lg">
                            Join thousands of Ghanaians paying less for the same bundles.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/auth">
                                <Button
                                    size="lg"
                                    className="bg-white text-emerald-600 hover:bg-white/90 font-semibold w-full sm:w-auto border-2 border-white"
                                >
                                    Create Free Account
                                </Button>
                            </Link>
                            <a href="#pricing">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="border-2 border-white text-white hover:bg-white/10 font-semibold w-full sm:w-auto bg-transparent"
                                >
                                    Browse Bundles
                                </Button>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
