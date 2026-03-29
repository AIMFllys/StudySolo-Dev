import { useState, useEffect } from 'react';
import './index.css';

import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Features from './components/Features';
import WorkflowDemo from './components/WorkflowDemo';
import Architecture from './components/Architecture';
import Pricing from './components/Pricing';
import Footer from './components/Footer';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const done = () => setTimeout(() => setIsLoading(false), 400);
    if (document.readyState === 'complete') { done(); }
    else { window.addEventListener('load', done); return () => window.removeEventListener('load', done); }
  }, []);

  const scrollToPricing = () =>
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });

  const openGuide = () =>
    window.open('https://docs.1037solo.com', '_blank');

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Page loader */}
      <div className={`page-loader${!isLoading ? ' loaded' : ''}`}>
        <div className="loader-inner">
          <div style={{ position: 'relative' }}>
            <div className="loader-ring" />
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={`${import.meta.env.BASE_URL}StudySolo.png`}
                alt="StudySolo"
                style={{ width: 22, height: 22, objectFit: 'contain' }}
              />
            </div>
          </div>
          <span className="loader-text">INITIALIZING STUDYSOLO_</span>
        </div>
      </div>

      <Navbar />

      <main>
        <Hero onStart={scrollToPricing} onGuide={openGuide} />
        <HowItWorks />
        <Features />
        <WorkflowDemo />
        <Architecture />
        <div id="pricing">
          <Pricing />
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
