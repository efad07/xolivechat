import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  isPremium?: boolean;
  adSlot?: string;
  className?: string;
}

export default function AdBanner({ isPremium, adSlot, className = '' }: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPremium || !adRef.current) return;

    // Clear previous ad if any
    adRef.current.innerHTML = '';
    
    // Create script element for Monetag
    const script = document.createElement('script');
    script.src = 'https://fpyf8.com/88/tag.min.js';
    script.dataset.zone = 'YOUR_MONETAG_ZONE_ID';
    script.async = true;
    script.dataset.cfasync = 'false';
    
    adRef.current.appendChild(script);
    
    return () => {
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, [isPremium]);

  if (isPremium) {
    return null;
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center my-6 overflow-hidden bg-slate-800/20 border border-slate-700/50 rounded-2xl p-2 min-h-[100px] ${className}`}>
      <span className="text-slate-600 text-[10px] uppercase tracking-widest mb-1">Advertisement</span>
      <div ref={adRef} className="w-full flex justify-center min-w-[300px] min-h-[90px]"></div>
    </div>
  );
}

