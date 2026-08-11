import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import NetworksSection from '@/components/NetworksSection';
import PricingSection from '@/components/PricingSection';
import FeaturesSection from '@/components/FeaturesSection';
import BecomeAgentSection from '@/components/BecomeAgentSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';

export default function Index() {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

  useEffect(() => {
    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      // Default to dark if no preference or dark preference
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
      if (!savedTheme) {
        localStorage.setItem('theme', 'dark');
      }
    }
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

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#0f172a]' : 'bg-gray-50'}`}>
      <Header isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />
      <main>
        <HeroSection isDarkMode={isDarkMode} />
        <NetworksSection isDarkMode={isDarkMode} />
        <PricingSection isDarkMode={isDarkMode} />
        <FeaturesSection isDarkMode={isDarkMode} />
        <BecomeAgentSection />
        <CTASection isDarkMode={isDarkMode} />
      </main>
      <Footer isDarkMode={isDarkMode} />
      <FloatingWhatsApp link="https://chat.whatsapp.com/Jpmtz6kPYbR6bcYV63MiQi" />
    </div>
  );
}