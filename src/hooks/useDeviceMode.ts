import { useState, useEffect } from 'react';

export type InterfaceMode = 'mobile' | 'pc';

export function useDeviceMode() {
  // Check user preference or detect from screen width / user agent / standalone mode
  const [preferredMode, setPreferredMode] = useState<'auto' | 'mobile' | 'pc'>(() => {
    try {
      const saved = localStorage.getItem('vigilytics_interface_mode');
      if (saved === 'mobile' || saved === 'pc' || saved === 'auto') return saved;
    } catch {
      // ignore
    }
    return 'auto';
  });

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    // Check standalone PWA installation status
    const checkStandalone = () => {
      const standaloneQuery = window.matchMedia('(display-mode: standalone)').matches;
      const iosStandalone = (window.navigator as any).standalone === true;
      const androidApp = document.referrer.includes('android-app://');
      setIsStandalone(standaloneQuery || iosStandalone || androidApp);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener?.('change', checkStandalone);

    return () => {
      window.removeEventListener('resize', handleResize);
      mediaQuery.removeEventListener?.('change', checkStandalone);
    };
  }, []);

  // Determine active interface mode
  const isMobileScreen = windowWidth < 768;
  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const isMobileUA =
    typeof window !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Auto detection logic:
  // 1. If downloaded/installed on mobile device (standalone + mobile UA/touch): 'mobile'
  // 2. If opened on mobile browser (mobile UA or screen width < 768): 'mobile'
  // 3. If opened or installed on PC (desktop screen and not mobile UA): 'pc'
  const detectedMode: InterfaceMode = (() => {
    if (isStandalone && (isMobileUA || isMobileScreen)) {
      return 'mobile';
    }
    if (isMobileUA || isMobileScreen || (isTouchDevice && windowWidth < 850)) {
      return 'mobile';
    }
    return 'pc';
  })();

  const currentMode: InterfaceMode =
    preferredMode === 'auto' ? detectedMode : preferredMode;

  const setMode = (mode: 'auto' | 'mobile' | 'pc') => {
    setPreferredMode(mode);
    try {
      localStorage.setItem('vigilytics_interface_mode', mode);
    } catch {
      // ignore
    }
  };

  const toggleMode = () => {
    const next = currentMode === 'mobile' ? 'pc' : 'mobile';
    setMode(next);
  };

  return {
    currentMode,
    preferredMode,
    detectedMode,
    isMobileScreen,
    isMobileUA,
    isTouchDevice,
    isStandalone,
    setMode,
    toggleMode,
  };
}
