'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Shield,
  Zap,
  Globe,
  Eye,
  Brain,
  Database,
  CheckCircle,
  BarChart3,
  FileCheck,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Play,
  Layers,
  Cloud,
  Lock,
  Code,
  Gauge,
  Activity,
  Cpu
} from 'lucide-react';
import Image from 'next/image';
import Spline from "@splinetool/react-spline";
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Poppins } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";
import React from 'react';

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

gsap.registerPlugin(ScrollTrigger);

const modules = [
  {
    icon: Globe,
    title: 'Web Scraper',
    desc: 'Automated data collection from e-commerce sites'
  },
  {
    icon: Database,
    title: 'Image Storage',
    desc: 'Secure storage & retrieval system'
  },
  {
    icon: Eye,
    title: 'Google Vision OCR',
    desc: 'Multi-language text extraction'
  },
  {
    icon: Brain,
    title: 'Gemini AI Validator',
    desc: 'Intelligent compliance analysis'
  },
  {
    icon: FileCheck,
    title: 'Compliance Engine',
    desc: 'Rule-based validation system'
  },
  {
    icon: Users,
    title: 'Entity Tracker',
    desc: 'Manufacturer & importer monitoring'
  },
  {
    icon: Shield,
    title: 'Pre-Upload Validator',
    desc: 'Real-time seller validation'
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    desc: 'Insights & reporting tools'
  },
  {
    icon: Lock,
    title: 'Security Module',
    desc: 'End-to-end encryption & data protection'
  }
];

const firstColumn = modules.slice(0, 3);
const secondColumn = modules.slice(3, 6);
const thirdColumn = modules.slice(6, 9);

const ModulesColumn = (props) => {
  return (
    <div className={props.className}>
      <motion.div
        animate={{
          translateY: '-50%',
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-4 md:gap-6 pb-4 md:pb-6"
      >
        {[...new Array(2)].fill(0).map((_, index) => (
          <React.Fragment key={index}>
            {props.modules.map((module, cardIndex) => {
              const IconComponent = module.icon;
              return (
                <div 
                  key={`${module.title}-${cardIndex}-${index}`} 
                  className="bg-black/40 border border-purple-500/30 rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300"
                >
                  <div className="bg-gradient-to-br from-purple-600 to-cyan-600 w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4 shadow-lg">
                    <IconComponent className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <h3 className="font-bold mb-2 text-white text-sm md:text-base">{module.title}</h3>
                  <p className={`text-xs md:text-sm text-gray-400 ${poppins.className}`}>{module.desc}</p>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};

// Door Panel Opening Animation Component - PERFECT VERSION (Fixed Flash)
// Door Panel Opening Animation Component - PERFECTLY SYNCED VERSION
const DoorPanelIntro = ({ onComplete }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [showDoors, setShowDoors] = useState(true);
  const [showLastWord, setShowLastWord] = useState(true);
  
  const words = ['Compliance', 'Verification', 'Integrity', 'Introducing'];
  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    setShowDoors(true);
    
    // Timing constants for perfect synchronization
    const DOOR_OPEN_DELAY = 400;
    const DOOR_ANIMATION_DURATION = 6100;
    const FIRST_WORD_DELAY = 800;
    const WORD_DISPLAY_DURATION = 2000;
    const LAST_WORD_EXIT_DURATION = 700; // Duration of exit animation
    
    const lastWordStartTime = FIRST_WORD_DELAY + (WORD_DISPLAY_DURATION * (words.length - 1));
    
    // Start first word
    const firstWordTimer = setTimeout(() => {
      setCurrentWordIndex(0);
    }, FIRST_WORD_DELAY);

    // Cycle through words (except the last one)
    const wordTimer = setInterval(() => {
      setCurrentWordIndex((prev) => {
        if (prev < words.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, WORD_DISPLAY_DURATION);

    // Stop word cycling after all words shown
    const stopWordTimer = setTimeout(() => {
      clearInterval(wordTimer);
    }, lastWordStartTime);

    // Trigger last word exit animation
    const triggerLastWordExit = setTimeout(() => {
      setShowLastWord(false);
    }, lastWordStartTime + WORD_DISPLAY_DURATION);

    return () => {
      clearTimeout(firstWordTimer);
      clearTimeout(stopWordTimer);
      clearTimeout(triggerLastWordExit);
      clearInterval(wordTimer);
      document.body.style.overflow = 'unset';
    };
  }, [onComplete]);

  // Called when the last word's exit animation completes
  const handleLastWordExitComplete = () => {
    document.body.style.overflow = 'unset';
    onComplete(); // Load landing page
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ 
        duration: 0.8, 
        ease: [0.33, 1, 0.68, 1]
      }}
      className="fixed inset-0 z-[100] bg-black overflow-hidden"
      style={{
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        WebkitFontSmoothing: 'antialiased'
      }}
    >
      {/* Top Door Panel */}
      <motion.div
        initial={{ height: '47.5%' }}
        animate={{ height: showDoors ? '0%' : '47.5%' }}
        transition={{ 
          duration: 6.1,
          ease: [0.25, 0.1, 0.25, 1],
          delay: 0.4
        }}
        className="absolute top-0 left-0 right-0 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #A855F7 0%, #E879F9 30%, #F472B6 60%, #EC4899 100%)',
          boxShadow: '0 2px 12px rgba(168, 85, 247, 0.3)',
          willChange: 'height',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
      />

      {/* Bottom Door Panel */}
      <motion.div
        initial={{ height: '47.5%' }}
        animate={{ height: showDoors ? '0%' : '47.5%' }}
        transition={{ 
          duration: 6.1,
          ease: [0.25, 0.1, 0.25, 1],
          delay: 0.4
        }}
        className="absolute bottom-0 left-0 right-0 overflow-hidden"
        style={{
          background: 'linear-gradient(0deg, #A855F7 0%, #E879F9 30%, #F472B6 60%, #EC4899 100%)',
          boxShadow: '0 -2px 12px rgba(168, 85, 247, 0.3)',
          willChange: 'height',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
      />

      {/* Animated Words */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <AnimatePresence 
          mode="wait"
          onExitComplete={() => {
            // Only trigger complete when it's the last word exiting
            if (currentWordIndex === words.length - 1 && !showLastWord) {
              handleLastWordExitComplete();
            }
          }}
        >
          {currentWordIndex >= 0 && showLastWord && (
            <motion.div
              key={currentWordIndex}
              initial={{ opacity: 0, y: 80, filter: 'blur(15px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -80, filter: 'blur(15px)' }}
              transition={{ 
                duration: 0.7, 
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-bold"
              style={{
                lineHeight: '1.2',
                paddingBottom: '0.1em',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                WebkitFontSmoothing: 'antialiased',
                willChange: 'transform, opacity, filter'
              }}
            >
              <div 
                className="flex" 
                style={{ 
                  letterSpacing: '-0.02em',
                  overflow: 'visible'
                }}
              >
                {words[currentWordIndex].split('').map((letter, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                      duration: 0.5,
                      delay: 0.1 + (index * 0.08),
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #A855F7 0%, #E879F9 25%, #F472B6 50%, #EC4899 75%, #A855F7 100%)',
                      backgroundSize: '200% 200%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      animation: 'gradientShift 3s ease infinite',
                      willChange: 'transform, opacity, filter',
                      display: 'inline-block',
                      verticalAlign: 'baseline',
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      WebkitFontSmoothing: 'antialiased'
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </motion.div>
  );
};






export default function LegalGuardLanding() {
  const router = useRouter();
  const [scrollY, setScrollY] = useState(0);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Custom scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar {
        width: 6px;
      }
      
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(168, 85, 247, 0.3), rgba(6, 182, 212, 0.3));
        border-radius: 10px;
        transition: all 0.3s ease;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, rgba(168, 85, 247, 0.6), rgba(6, 182, 212, 0.6));
      }

      * {
        scrollbar-width: thin;
        scrollbar-color: rgba(168, 85, 247, 0.3) transparent;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // GSAP Animations
  useEffect(() => {
    if (showIntro) return;

    gsap.fromTo(".hero-headline", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, delay: 0.5, ease: "power4.out" });
    gsap.fromTo(".hero-subheadline", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, delay: 0.7, ease: "power4.out" });
    gsap.fromTo(".hero-description", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, delay: 0.9, ease: "power4.out" });
    gsap.fromTo(".cta-buttons", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, delay: 1.1, ease: "power4.out" });

    const pipelineItems = gsap.utils.toArray(".pipeline-item");
    pipelineItems.forEach((item, i) => {
      gsap.fromTo(item, { opacity: 0, y: 80, scale: 0.9 }, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: item,
          start: "top 85%",
          toggleActions: "play none none reverse",
        }
      });
    });

    const archNodes = gsap.utils.toArray(".arch-node");
    archNodes.forEach((node, i) => {
      gsap.fromTo(node, { opacity: 0, scale: 0.8 }, {
        opacity: 1,
        scale: 1,
        duration: 1.5,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: node,
          start: "top 85%",
          toggleActions: "play none none reverse",
          delay: i * 0.1
        }
      });
    });

    gsap.to(".dashboard-image", {
      y: -80,
      ease: "none",
      scrollTrigger: {
        trigger: ".dashboard-section",
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
      }
    });

    gsap.fromTo(".final-cta-panel", { opacity: 0, scale: 0.9 }, {
      opacity: 1,
      scale: 1,
      duration: 1.2,
      ease: "elastic.out(1.2, 0.4)",
      scrollTrigger: {
        trigger: ".final-cta-panel",
        start: "top 80%",
        toggleActions: "play none none reverse",
      }
    });
  }, [showIntro]);

  useEffect(() => {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = 1.25;
    }
  }, []);

  return (
    <>
      <AnimatePresence>
        {showIntro && (
          <DoorPanelIntro onComplete={() => setShowIntro(false)} />
        )}
      </AnimatePresence>

      <div className="bg-black text-white min-h-screen overflow-x-hidden font-sans">
        {/* BACKGROUND VIDEO */}
        <div className="fixed inset-0 z-0" style={{ background: 'linear-gradient(135deg,#1f2937 0%,#111827 100%)' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{
              filter: 'blur(0px)',
              transform: 'scale(1.1)',
            }}
          >
            <source src="/backgroundvideo4.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* 3D MODEL LAYER - Hidden on mobile for performance */}
        <div className="hidden lg:block fixed inset-0 z-[1]">
          <Spline
            scene="https://prod.spline.design/PeG2RT1ZxPqwIkgx/scene.splinecode"
            className="w-full h-full scale-[1.3]"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        <div className="relative z-10">
          {/* All sections remain exactly the same - HERO, PROJECT OVERVIEW, etc. */}
          <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
            <div className="relative container mx-auto text-center max-w-6xl">
              <div
                className={`${poppins.className} inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 mb-6 md:mb-8 rounded-full relative overflow-hidden`}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  backdropFilter: "blur(25px) saturate(180%)",
                  WebkitBackdropFilter: "blur(25px) saturate(180%)",
                  boxShadow: "inset 0 0 20px rgba(255,255,255,0.05), 0 0 30px rgba(0,0,0,0.25)",
                }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.2) 40%, transparent 80%)",
                    transform: "translateX(-100%)",
                    animation: "lightSweep 8s ease-in-out infinite",
                    mixBlendMode: "screen",
                    opacity: 0.6,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.08), transparent 60%)",
                    mixBlendMode: "overlay",
                    opacity: 0.6,
                  }}
                />
                <span className="text-gray-100 tracking-wider uppercase text-[10px] md:text-[13px] relative z-10">
                  AI POWERED COMPLIANCE TECHNOLOGY
                </span>
                <style jsx>{`
                  @keyframes lightSweep {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(100%); }
                    100% { transform: translateX(100%); }
                  }
                `}</style>
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-bold mb-4 md:mb-6 leading-tight hero-headline">
                <span className="block">
                  <Image
                    src="/legalguardlogo.png"
                    alt="LegalGuard Logo"
                    width={780}
                    height={200}
                    className="mx-auto object-contain w-full max-w-[300px] sm:max-w-[500px] md:max-w-[650px] lg:max-w-[780px]"
                    priority
                  />
                </span>
              </h1>

              <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-white/90 mb-3 md:mb-4 hero-subheadline px-4">
                AI-Powered Legal Metrology
              </h2>
              <h3 className="text-lg sm:text-xl md:text-3xl lg:text-4xl font-semibold mb-6 md:mb-8 hero-subheadline px-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r font-bold from-cyan-400 to-blue-400">
                  Compliance for E-commerce
                </span>
              </h3>

              <p className="text-gray-300 mb-8 md:mb-12 max-w-4xl mx-auto leading-relaxed hero-description text-sm sm:text-base md:text-lg lg:text-[20px] px-4">
                Ensuring every product listing complies with{' '}
                <span className="text-white font-bold">India&apos;s Packaged Commodities Rules, 2011</span>
                {' '}— protecting consumers and empowering regulators.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center cta-buttons px-4">
                
                  <button 
  onClick={() => router.push('/auth/login')}
  className="w-full sm:w-auto group px-6 md:px-10 py-4 md:py-5 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl text-base md:text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(168,85,247,0.6)]"
>
  <span className="flex items-center justify-center gap-2 tracking-wider">
    Get Started <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
  </span>
</button>
                

                <button className="w-full sm:w-auto group px-6 md:px-10 py-4 md:py-5 border-2 border-purple-500/50 bg-black/20 rounded-xl text-base md:text-lg backdrop-blur-sm hover:bg-purple-500/10 transition-all duration-300 hover:border-cyan-400 tracking-wider">
                  <span className="flex items-center justify-center gap-2">
                    <Play className="w-4 h-4 md:w-5 md:h-5" /> View Demo
                  </span>
                </button>
              </div>
            </div>
          </section>
         
          
          {/* PROJECT OVERVIEW */}
          <section className="py-16 md:py-32 px-4 relative bg-black/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12 md:mb-20">
                <div className={`${poppins.className} inline-block mb-6 md:mb-8 px-4 md:px-5 py-2 bg-purple-600/10 border border-purple-500/30 rounded-full`}>
                  <span className={`text-cyan-400 text-xs md:text-sm font-semibold uppercase tracking-wider ${poppins.className}`}>How It Works</span>
                </div>
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4 px-4">
                  How <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">LegalGuard</span> Works
                </h2>
                <p className={`text-base md:text-xl text-gray-400 max-w-2xl mx-auto px-4`}>
                  End-to-end automated compliance checking powered by cutting-edge AI
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 relative">
                {[
                  { 
                    icon: Globe, 
                    title: 'Web Scraping', 
                    desc: 'Extract product data from e-commerce platforms',
                    color: 'from-purple-600 to-pink-600'
                  },
                  { 
                    icon: Eye, 
                    title: 'OCR Analysis', 
                    desc: 'Computer vision reads product labels & packaging',
                    color: 'from-pink-600 to-cyan-600'
                  },
                  { 
                    icon: Brain, 
                    title: 'AI Validation', 
                    desc: 'Gemini AI validates compliance requirements',
                    color: 'from-cyan-600 to-blue-600'
                  },
                  { 
                    icon: BarChart3, 
                    title: 'Compliance Score', 
                    desc: 'Generate detailed reports & validate metrology compliance rules',
                    color: 'from-blue-600 to-purple-600'
                  },
                ].map((step, i) => (
                  <div key={i} className="relative z-10 group pipeline-item">
                    <div className="bg-black/60 border border-purple-500/30 rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 hover:scale-105">
                      <div className={`bg-gradient-to-br ${step.color} w-12 h-12 md:w-16 md:h-16 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4 shadow-lg`}>
                        <step.icon className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                      <div className={`text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2 ${poppins.className}`}>Step {i + 1}</div>
                      <h3 className="text-base md:text-xl font-bold mb-2">{step.title}</h3>
                      <p className={`text-gray-400 text-xs md:text-sm ${poppins.className}`}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-8 md:mt-10">
                {[
                  { icon: Cpu, label: 'AI-Powered Engine', desc: 'Google Gemini & Cloud Vision' },
                  { icon: Gauge, label: 'Real-Time Processing', desc: 'Sub-2 second validation' },
                  { icon: Activity, label: 'Continuous Learning', desc: 'ML model improvements' }
                ].map((feature, i) => (
                  <div key={i} className="bg-black/40 border border-purple-500/20 rounded-xl p-4 md:p-6 backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-300">
                    <feature.icon className="w-8 h-8 md:w-10 md:h-10 text-cyan-400 mb-3" />
                    <h4 className="text-base md:text-lg font-bold mb-2">{feature.label}</h4>
                    <p className={`text-gray-400 text-xs md:text-sm ${poppins.className}`}>{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SYSTEM ARCHITECTURE */}
          <section className="py-16 md:py-32 px-4 bg-gradient-to-b from-black/80 via-purple-950/10 to-black/80 relative">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{ 
                backgroundImage: 'repeating-linear-gradient(0deg, #8b5cf6 0px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, #8b5cf6 0px, transparent 1px, transparent 60px)',
              }} />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
              <div className="text-center mb-12 md:mb-20">
                <div className="inline-block mb-4 px-4 py-2 bg-cyan-600/10 border border-cyan-500/30 rounded-full">
                  <span className={`text-cyan-400 text-xs md:text-sm font-semibold uppercase tracking-wider ${poppins.className}`}>Infrastructure</span>
                </div>
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4 mt-4 px-4">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                    System Architecture
                  </span>
                </h2>
                <p className={`text-base md:text-xl text-gray-400 max-w-2xl mx-auto px-4`}>
                  Enterprise-grade, scalable infrastructure
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[
                  { icon: Layers, title: 'Presentation Layer', desc: 'Flask REST API with secure endpoints', gradient: 'from-purple-600 to-pink-600' },
                  { icon: Code, title: 'Business Logic', desc: 'Python orchestration services', gradient: 'from-pink-600 to-red-600' },
                  { icon: Database, title: 'Data Layer', desc: 'MySQL structured storage', gradient: 'from-red-600 to-orange-600' },
                  { icon: Brain, title: 'AI Integration', desc: 'Google Cloud Vision & Gemini', gradient: 'from-orange-600 to-cyan-600' },
                  { icon: Cloud, title: 'Storage Layer', desc: 'Hybrid cloud infrastructure', gradient: 'from-cyan-600 to-blue-600' },
                  { icon: Lock, title: 'Security', desc: 'End-to-end encryption', gradient: 'from-blue-600 to-purple-600' }
                ].map((layer, i) => (
                  <div key={i} className="bg-black/40 border border-purple-500/30 rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 arch-node">
                    <div className={`bg-gradient-to-br ${layer.gradient} w-12 h-12 md:w-14 md:h-14 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4 shadow-lg`}>
                      <layer.icon className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <h3 className="text-base md:text-lg font-bold mb-2">{layer.title}</h3>
                    <p className={`text-gray-400 text-xs md:text-sm ${poppins.className}`}>{layer.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* MODULES SECTION */}
          <section className="py-16 md:py-32 px-4 relative bg-black/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12 md:mb-20">
                <div className="inline-block mb-4 px-4 py-2 bg-purple-600/10 border border-purple-500/30 rounded-full">
                  <span className={`text-purple-400 text-xs md:text-sm font-semibold uppercase tracking-wider mt-4 ${poppins.className}`}>Core Modules</span>
                </div>
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4 px-4">
                  Powerful <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Modules</span>
                </h2>
                <p className={`text-base md:text-xl text-gray-400 max-w-2xl mx-auto px-4`}>
                  Comprehensive suite of compliance tools
                </p>
              </div>

              <div className="flex justify-center gap-4 md:gap-6 max-h-[500px] md:max-h-[738px] [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] mt-10 overflow-hidden">
                <ModulesColumn modules={firstColumn} duration={15} />
                <ModulesColumn
                  modules={secondColumn}
                  duration={19}
                  className="hidden md:block"
                />
                <ModulesColumn
                  modules={thirdColumn}
                  className="hidden lg:block"
                  duration={17}
                />
              </div>
            </div>
          </section>

          {/* DASHBOARD PREVIEW */}
          <section className="py-16 md:py-32 px-4 bg-gradient-to-b from-black/80 to-purple-950/20 dashboard-section">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12 md:mb-16">
                <div className="inline-block mb-4 px-4 py-2 bg-cyan-600/10 border border-cyan-500/30 rounded-full">
                  <span className={`text-cyan-400 text-xs md:text-sm font-semibold uppercase tracking-wider ${poppins.className}`}>Interface</span>
                </div>
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4 px-4">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                    Dashboard Preview
                  </span>
                </h2>
                <p className={`text-base md:text-xl text-gray-400 px-4`}>Real-time insights and compliance analytics</p>
              </div>

              <div className="relative group my-8 md:my-12 max-w-3xl mx-auto">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/30 via-cyan-600/30 to-purple-600/30 
                              rounded-2xl md:rounded-3xl blur-2xl md:blur-3xl opacity-50 group-hover:opacity-75 transition-all duration-500" />
                
                <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border-2 border-purple-500/30 
                              group-hover:border-cyan-400/50 transition-all duration-300 shadow-[0_0_30px_rgba(168,85,247,0.3)] md:shadow-[0_0_50px_rgba(168,85,247,0.3)] dashboard-image">
                  <Image 
                    src="/Dashboard.png" 
                    alt="LegalGuard Dashboard Interface"
                    width={900} 
                    height={600} 
                    className="w-full h-full block"
                    priority
                  />
                </div>
              </div>
            </div>
          </section>

          {/* WHY LEGALGUARD */}
          <section className="py-16 md:py-32 px-4 relative bg-black/80 backdrop-blur-xl bg-gradient-to-b from-black/80 via-purple-950/10 to-black/80">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{ 
                backgroundImage: 'repeating-linear-gradient(0deg, #8b5cf6 0px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, #8b5cf6 0px, transparent 1px, transparent 60px)',
              }} />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
              <div className="text-center mb-12 md:mb-20">
                <div className="inline-block mb-4 px-4 py-2 bg-purple-600/10 border border-purple-500/30 rounded-full">
                  <span className={`text-purple-400 text-xs md:text-sm font-semibold uppercase tracking-wider ${poppins.className}`}>Unique Value</span>
                </div>
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4 px-4">
                  Why <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">LegalGuard</span>?
                </h2>
                <p className={`text-base md:text-xl text-gray-400 max-w-2xl mx-auto px-4`}>
                  The future of regulatory compliance
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                {[
                  { icon: Zap, title: 'Automated Real-Time', desc: 'Instant compliance validation as products are listed', color: 'from-yellow-600 to-orange-600' },
                  { icon: Globe, title: 'Multi-Language OCR', desc: 'Support for English and Hindi labels', color: 'from-blue-600 to-cyan-600' },
                  { icon: BarChart3, title: 'AI-Driven Scoring', desc: 'Grade compliance from A+ to F with detailed explanations', color: 'from-purple-600 to-pink-600' },
                  { icon: Shield, title: 'Pre-Upload Validation', desc: 'Enable sellers to validate products before listing', color: 'from-green-600 to-emerald-600' },
                  { icon: Cloud, title: 'Cloud-Ready & Scalable', desc: 'Built to handle millions of products', color: 'from-cyan-600 to-blue-600' },
                  { icon: Lock, title: 'Secure & Compliant', desc: 'Enterprise-grade security with data encryption', color: 'from-red-600 to-purple-600' }
                ].map((feature, i) => (
                  <div key={i} className="bg-black/40 border border-purple-500/30 rounded-xl md:rounded-2xl p-6 md:p-8 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300">
                    <div className={`bg-gradient-to-br ${feature.color} w-12 h-12 md:w-16 md:h-16 rounded-lg md:rounded-xl flex items-center justify-center mb-4 md:mb-6 shadow-lg`}>
                      <feature.icon className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3">{feature.title}</h3>
                    <p className={`text-gray-400 leading-relaxed text-sm md:text-base ${poppins.className}`}>{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FUTURE ROADMAP */}
          <section className="py-16 md:py-32 px-4 relative bg-black/80 backdrop-blur-xl">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12 md:mb-20">
                <div className="inline-block mb-4 px-4 py-2 bg-cyan-600/10 border border-cyan-500/30 rounded-full">
                  <span className={`text-cyan-400 text-xs md:text-sm font-semibold uppercase tracking-wider ${poppins.className}`}>Roadmap</span>
                </div>
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4 px-4">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                    Future Prospects
                  </span>
                </h2>
                <p className={`text-base md:text-xl text-gray-400 px-4`}>The next evolution of compliance technology</p>
              </div>

              <div className="space-y-6 md:space-y-8">
                {[
                  { phase: 'Phase 1', icon: Globe, title: 'Government Portal Integration', desc: 'Direct integration with regulatory and consumer protection portals', color: 'from-purple-600 to-pink-600' },
                  { phase: 'Phase 2', icon: Layers, title: 'E-Commerce API Plugins', desc: 'Native plugins for major e-commerce platforms for seamless compliance', color: 'from-pink-600 to-cyan-600' },
                  { phase: 'Phase 3', icon: Shield, title: 'Mobile Inspector Apps', desc: 'Field inspection apps for on-ground regulatory officers', color: 'from-cyan-600 to-blue-600' }
                ].map((phase, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-4 md:gap-6 group">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br ${phase.color} flex items-center justify-center shadow-lg`}>
                        <phase.icon className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                    </div>
                    <div className="flex-1 bg-black/40 border border-purple-500/30 rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300">
                      <div className={`text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2 ${poppins.className}`}>{phase.phase}</div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">{phase.title}</h3>
                      <p className={`text-gray-400 text-sm md:text-base ${poppins.className}`}>{phase.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="border-t border-purple-500/30 py-12 md:py-16 px-4 bg-black/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-8 md:mb-12">
                <div className="sm:col-span-2">
                  <h3 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-3 md:mb-4">
                    LegalGuard
                  </h3>
                  <p className="text-gray-400 leading-relaxed mb-4 md:mb-6 text-sm md:text-base font-poppins">
                    AI-Powered Legal Metrology Compliance for E-commerce. 
                    Ensuring consumer protection and regulatory empowerment.
                  </p>
                </div>

                <div>
                  <h4 className="text-base md:text-lg font-bold mb-3 md:mb-4">Product</h4>
                  <ul className="space-y-2 md:space-y-3 font-poppins text-sm md:text-base">
                    <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Features</a></li>
                    <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Pricing</a></li>
                    <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Documentation</a></li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-base md:text-lg font-bold mb-3 md:mb-4">Company</h4>
                  <ul className="space-y-2 md:space-y-3 font-poppins text-sm md:text-base">
                    <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">About</a></li>
                    <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Contact</a></li>
                    <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Privacy</a></li>
                  </ul>
                </div>
              </div>

              <div className="pt-6 md:pt-8 border-t border-purple-500/30 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-gray-400 text-xs md:text-sm font-poppins text-center md:text-left">
                  © 2025 LegalGuard. By - Team De-bug.
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs md:text-sm text-gray-400 font-poppins">All systems operational</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
