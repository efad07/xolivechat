import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  isPremium?: boolean;
  adSlot?: string;
  className?: string;
}

export default function AdBanner({ isPremium, adSlot = '1234567890', className = '' }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (isPremium) return;

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, [isPremium]);

  if (isPremium) {
    return null;
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center my-6 overflow-hidden bg-slate-800/20 border border-slate-700/50 rounded-2xl p-2 min-h-[100px] ${className}`}>
      <span className="text-slate-600 text-[10px] uppercase tracking-widest mb-1">Advertisement</span>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', minWidth: '300px', width: '100%', height: '90px' }}
        data-ad-client={import.meta.env.VITE_ADSENSE_PUBLISHER_ID || "ca-pub-XXXXXXXXXXXX"}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}
