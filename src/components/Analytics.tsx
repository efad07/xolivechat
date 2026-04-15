import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function Analytics() {
  const location = useLocation();

  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!measurementId || measurementId === 'G-XXXXXXXXXX') return;

    // @ts-ignore
    if (window.gtag) {
      // @ts-ignore
      window.gtag('config', measurementId, {
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);

  return null;
}
