import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Moon, Sun } from 'lucide-react';

interface HeaderProps {
    isDarkMode?: boolean;
    onToggleDarkMode?: () => void;
}

export default function Header({ isDarkMode = true, onToggleDarkMode }: HeaderProps) {
    const [isOpen, setIsOpen] = useState(false);

    const navLinks = [
        { name: 'Home', href: '/', active: true },
        { name: 'Networks', href: '#networks' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'Become Agent', href: '#become-agent' },
    ];

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 border-b ${isDarkMode ? 'bg-[#0f172a] border-slate-700/50' : 'bg-white border-gray-200'
            }`}>
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2">
                    <img src="/logo.png" alt="ByteBeacon" className="h-14 w-auto" />
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.href}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${link.active
                                ? 'bg-emerald-500 text-white'
                                : isDarkMode
                                    ? 'text-slate-300 hover:text-white'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            {link.name}
                        </a>
                    ))}
                </nav>

                {/* Right side actions */}
                <div className="flex items-center gap-3">
                    {/* Desktop Auth & Theme */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link to="/auth">
                            <span className={`text-sm font-medium cursor-pointer transition-colors ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                                }`}>
                                Sign In
                            </span>
                        </Link>
                        <Link to="/auth">
                            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6">
                                Get Started
                            </Button>
                        </Link>
                    </div>

                    {/* Theme Toggle */}
                    <button
                        onClick={onToggleDarkMode}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isDarkMode
                            ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <span className="uppercase text-xs">{isDarkMode ? 'Night' : 'Day'}</span>
                        <div className={`relative w-10 h-5 rounded-full ${isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center ${isDarkMode ? 'right-0.5 bg-purple-500' : 'left-0.5 bg-amber-400'
                                }`}>
                                {isDarkMode ? (
                                    <Moon className="w-2.5 h-2.5 text-white" />
                                ) : (
                                    <Sun className="w-2.5 h-2.5 text-amber-900" />
                                )}
                            </div>
                        </div>
                    </button>

                    {/* Mobile Menu */}
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild className="lg:hidden">
                            <Button variant="ghost" size="icon" className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className={`w-[300px] sm:w-[350px] ${isDarkMode ? 'bg-[#0f172a] border-slate-700' : 'bg-white border-gray-200'
                            }`}>
                            <div className="flex flex-col h-full pt-8">
                                {/* Mobile Logo */}
                                <div className="flex items-center gap-2 mb-8">
                                    <img src="/logo.png" alt="ByteBeacon" className="h-12 w-auto" />
                                </div>

                                {/* Mobile Nav Links */}
                                <nav className="flex flex-col gap-1 flex-1">
                                    {navLinks.map((link) => (
                                        <a
                                            key={link.name}
                                            href={link.href}
                                            className={`px-4 py-3 rounded-lg text-base font-medium transition-colors ${link.active
                                                ? 'bg-emerald-500/10 text-emerald-500'
                                                : isDarkMode
                                                    ? 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                                }`}
                                            onClick={() => setIsOpen(false)}
                                        >
                                            {link.name}
                                        </a>
                                    ))}
                                </nav>

                                {/* Mobile Auth Buttons */}
                                <div className={`flex flex-col gap-3 pt-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                                        <Button variant="outline" className={`w-full font-medium ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                                            }`}>
                                            Sign In
                                        </Button>
                                    </Link>
                                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                                        <Button className="w-full font-medium bg-emerald-500 hover:bg-emerald-600">
                                            Get Started
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
