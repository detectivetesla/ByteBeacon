import { useState, useEffect, useRef } from 'react';
import { Clock, Truck, X } from 'lucide-react';

interface FloatingWhatsAppProps {
    link: string;
}

export default function FloatingWhatsApp({ link }: FloatingWhatsAppProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isWithinWorkingHours, setIsWithinWorkingHours] = useState(false);
    const [position, setPosition] = useState({ x: 24, y: 24 }); // bottom-right offset
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Check if current time is within working hours (7am - 9pm)
    useEffect(() => {
        const checkWorkingHours = () => {
            const now = new Date();
            const hour = now.getHours();
            setIsWithinWorkingHours(hour >= 7 && hour < 22);
        };

        checkWorkingHours();
        const interval = setInterval(checkWorkingHours, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    // Handle drag start
    const handleDragStart = (clientX: number, clientY: number) => {
        setIsDragging(true);
        setDragStart({
            x: clientX + position.x,
            y: clientY + position.y,
        });
    };

    // Handle drag move
    const handleDragMove = (clientX: number, clientY: number) => {
        if (!isDragging) return;

        const newX = dragStart.x - clientX;
        const newY = dragStart.y - clientY;

        // Clamp to viewport bounds
        const maxX = window.innerWidth - 70;
        const maxY = window.innerHeight - 70;

        setPosition({
            x: Math.max(10, Math.min(newX, maxX)),
            y: Math.max(10, Math.min(newY, maxY)),
        });
    };

    // Handle drag end
    const handleDragEnd = () => {
        setIsDragging(false);
    };

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
    };

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
    };

    // Global mouse/touch move and end handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        const handleMouseUp = () => handleDragEnd();
        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            handleDragMove(touch.clientX, touch.clientY);
        };
        const handleTouchEnd = () => handleDragEnd();

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, dragStart]);

    const handleButtonClick = () => {
        if (!isDragging) {
            setIsOpen(!isOpen);
        }
    };

    return (
        <div
            ref={containerRef}
            className="fixed z-50 flex flex-col items-end gap-3"
            style={{
                right: `${position.x}px`,
                bottom: `${position.y}px`,
            }}
        >
            {/* Info Panel */}
            {isOpen && (
                <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-72 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center">
                                <svg
                                    className="w-5 h-5 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">ByteBeacon Support</p>
                                <p className="text-xs text-muted-foreground">We're here to help!</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-muted rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Info Cards */}
                    <div className="space-y-2 mb-4">
                        {/* Working Hours */}
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${isWithinWorkingHours
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-amber-500/10 border border-amber-500/30'
                            }`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isWithinWorkingHours
                                ? 'bg-emerald-500/20 text-emerald-500'
                                : 'bg-amber-500/20 text-amber-500'
                                }`}>
                                <Clock className="w-4 h-4" />
                            </div>
                            <div>
                                <p className={`text-sm font-medium ${isWithinWorkingHours ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {isWithinWorkingHours ? 'We are online!' : 'Currently offline'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Working hours: 7:00 AM - 10:00 PM
                                </p>
                            </div>
                        </div>

                        {/* Delivery Time */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-500">
                                <Truck className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                    Fast Delivery
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Data delivered in 10 min - 2 hours
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-3 px-4 bg-[#25D366] hover:bg-[#20BD5A] text-white text-center font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#25D366]/30"
                    >
                        Start Chat
                    </a>
                </div>
            )}

            {/* Floating Button - Draggable */}
            <button
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={handleButtonClick}
                className={`
                    relative flex items-center justify-center w-14 h-14 
                    bg-[#25D366] text-white rounded-full 
                    shadow-lg transition-all duration-300
                    hover:scale-110 hover:shadow-xl hover:shadow-[#25D366]/40
                    ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}
                    ${isOpen ? 'rotate-0' : !isDragging ? 'animate-bounce-subtle' : ''}
                `}
                style={{
                    boxShadow: isOpen
                        ? '0 10px 25px -5px rgba(37, 211, 102, 0.4)'
                        : '0 4px 14px 0 rgba(37, 211, 102, 0.39)',
                    touchAction: 'none',
                }}
                aria-label="Chat on WhatsApp"
            >
                {/* Glow ring animation */}
                <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-25"></span>
                <span className="absolute inset-0 rounded-full bg-[#25D366]/20 animate-pulse"></span>

                {/* Icon */}
                <svg
                    className="w-7 h-7 relative z-10"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>

                {/* Online indicator */}
                {isWithinWorkingHours && (
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-white dark:border-card rounded-full"></span>
                )}
            </button>

            {/* CSS for subtle bounce animation */}
            <style>{`
                @keyframes bounce-subtle {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-5px);
                    }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
