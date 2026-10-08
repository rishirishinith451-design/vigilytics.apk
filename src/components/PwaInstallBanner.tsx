import React, { useState } from 'react';
import { Download, Smartphone, X, Share2, PlusSquare, CheckCircle2 } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { showToast } from '../utils/toast';

interface PwaInstallBannerProps {
  variant?: 'banner' | 'pill' | 'modal';
  onDismiss?: () => void;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  variant = 'banner',
  onDismiss,
}) => {
  const { isInstallable, isInstalled, isIOS, isStandalone, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running standalone as an installed app, don't show prompt
  if (isStandalone || isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }

    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else {
      // In case beforeinstallprompt hasn't fired yet or browser requires manual action
      showToast(
        'To install Vigilytics:\n• Chrome/Edge: Click install icon in the URL address bar or browser menu.\n• Safari/iOS: Tap Share then "Add to Home Screen".',
        'info'
      );
    }
  };

  const handleClose = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  if (variant === 'pill') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-full text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
          title="Install Vigilytics App"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        {showIosGuide && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                  <span className="font-bold text-slate-900 text-sm">Install on iPhone / iPad</span>
                </div>
                <button onClick={() => setShowIosGuide(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <p>Install Vigilytics for offline pharmacovigilance screening without browser bars:</p>
                <div className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    Tap the <strong>Share</strong> button <Share2 className="inline w-3.5 h-3.5 text-indigo-600 mx-0.5" /> at the bottom of Safari.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="inline w-3.5 h-3.5 text-indigo-600 mx-0.5" />.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div>
                    Tap <strong>Add</strong> in the top right to complete installation.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIosGuide(false)}
                className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs border-b border-indigo-700/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/30 flex items-center justify-center shrink-0 border border-indigo-400/30">
            <Smartphone className="w-4 h-4 text-amber-300" />
          </div>
          <div className="truncate">
            <span className="font-bold text-white">Install Vigilytics App: </span>
            <span className="text-slate-300 hidden sm:inline">
              Download as a native mobile app on your phone or desktop app on PC. Works offline with instant access.
            </span>
            <span className="text-slate-300 sm:hidden">
              Install for instant mobile access & offline use.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isIOS ? 'Install (iOS)' : 'Install App'}</span>
          </button>

          <button
            onClick={handleClose}
            className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-slate-900 text-sm">Install on iPhone / iPad</span>
              </div>
              <button onClick={() => setShowIosGuide(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>Install Vigilytics as a native app on iOS:</p>
              <div className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  Tap the <strong>Share</strong> button <Share2 className="inline w-3.5 h-3.5 text-indigo-600 mx-0.5" /> at the bottom of Safari.
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="inline w-3.5 h-3.5 text-indigo-600 mx-0.5" />.
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  Tap <strong>Add</strong> in the top right. The app will appear on your home screen!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
