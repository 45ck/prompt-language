import NavBar from './components/layout/NavBar';
import HeroSection from './components/sections/HeroSection';
import ProofBar from './components/sections/ProofBar';
import FeaturesSection from './components/sections/FeaturesSection';
import HowItWorksSection from './components/sections/HowItWorksSection';
import TestimonialsSection from './components/sections/TestimonialsSection';
import PricingSection from './components/sections/PricingSection';
import IntegrationsSection from './components/sections/IntegrationsSection';
import FAQSection from './components/sections/FAQSection';
import CTAFooterSection from './components/sections/CTAFooterSection';
import Footer from './components/layout/Footer';

export default function Home() {
  return (
    <>
      <NavBar />
      <main id="main-content">
        <HeroSection />
        <ProofBar />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
        <IntegrationsSection />
        <FAQSection />
        <CTAFooterSection />
      </main>
      <Footer />
    </>
  );
}
