"use client";

import { LandingNav } from '@/components/landing/LandingNav';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatureGrid } from '@/components/landing/LandingFeatureGrid';
import { LandingScenarios } from '@/components/landing/LandingScenarios';
import { LandingTechStack } from '@/components/landing/LandingTechStack';
import { LandingCta } from '@/components/landing/LandingCta';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-[#fcfbf9] text-slate-800 selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden antialiased font-sans">

      {/* 网格背景 */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.6]">
        <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)', backgroundSize: '1.5rem 1.5rem' }} />
      </div>

      {/* 红线装饰 */}
      <div className="fixed top-0 bottom-0 left-6 md:left-12 w-[2px] bg-red-400/20 z-0" />
      <div className="fixed top-0 bottom-0 left-[28px] md:left-[52px] w-px bg-red-400/20 z-0" />

      <LandingNav />
      <LandingHero />
      <LandingFeatureGrid />
      <LandingScenarios />
      <LandingTechStack />
      <LandingCta />
      <LandingFooter />
    </main>
  );
}
