import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, RotateCcw, Check, RefreshCw, SwitchCamera, ShieldAlert, Upload, HelpCircle } from 'lucide-react';

interface DocumentCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, previewUrl: string) => void;
  title?: string;
}

export const DocumentCameraModal: React.FC<DocumentCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Scan Medical Document / ADR Report',
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  // Stop any active stream tracks
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
  }, []);

  // Check available video devices
  useEffect(() => {
    if (!isOpen) return;
    if (navigator?.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevs = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoDevs.length > 1);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Start Camera Stream
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setIsInitializing(true);
    setError(null);
    setPermissionDenied(false);
    setCapturedImage(null);
    stopTracks();

    // Check mediaDevices support
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError(
        'Camera API is not supported in this browser context. You can use the instant camera file selector below to snap a picture.'
      );
      setIsInitializing(false);
      return;
    }

    try {
      let activeStream: MediaStream | null = null;

      // 1. Attempt ideal constraints with specified facing mode
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
        });
      } catch (errConstraint) {
        console.warn('Initial high-res constraint failed, retrying with basic video constraint...', errConstraint);
        // 2. Fallback: basic video request without strict resolution
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      if (!activeStream) {
        throw new Error('No video stream received from device');
      }

      streamRef.current = activeStream;
      setStream(activeStream);

      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => {
            console.error('Video play failed:', playErr);
          });
          setIsInitializing(false);
        };
      } else {
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      const isPermission =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.toLowerCase().includes('permission denied');

      if (isPermission) {
        setPermissionDenied(true);
        setError(
          'Camera permission was blocked or not granted by the browser. You can click "Take Photo via Device Camera" below to use your native camera, or click the camera/lock icon in your browser address bar to allow camera access.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera device detected on this workstation. Please attach a camera or use mobile device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another tab or app. Please close other applications using the webcam and retry.');
      } else {
        setError(`Camera error: ${err.message || 'Could not start video stream'}`);
      }
      setIsInitializing(false);
    }
  }, [stopTracks]);

  // Open camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopTracks();
      setCapturedImage(null);
      setError(null);
      setPermissionDenied(false);
    }

    return () => {
      stopTracks();
    };
  }, [isOpen, facingMode, startCamera, stopTracks]);

  // Capture snapshot from live video canvas
  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get high-quality JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);

    // Pause video
    video.pause();
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    if (videoRef.current && streamRef.current) {
      videoRef.current.play().catch(() => {});
    } else {
      startCamera(facingMode);
    }
  };

  // Flip camera (rear/front)
  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Native device camera fallback input (works seamlessly across mobile & desktop even if getUserMedia permissions are blocked in iframe)
  const handleFallbackCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const previewUrl = reader.result as string;
      setCapturedImage(previewUrl);
      setError(null);
      setPermissionDenied(false);
    };
    reader.readAsDataURL(file);
  };

  // Confirm photo and convert to File
  const handleConfirm = () => {
    if (!capturedImage) return;

    try {
      const byteString = atob(capturedImage.split(',')[1]);
      const mimeString = capturedImage.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `medical_document_${timestamp}.jpg`;
      const file = new File([blob], filename, { type: mimeString, lastModified: Date.now() });

      stopTracks();
      onCapture(file, capturedImage);
      onClose();
    } catch (err: any) {
      setError(`Failed to process captured image: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Hidden Native Camera File Input (Seamless OS Camera trigger fallback) */}
        <input
          ref={fallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFallbackCapture}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold tracking-tight">{title}</h3>
              <p className="text-[10px] text-slate-400">Position paper record, discharge card, or medicine label inside frame</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasMultipleCameras && !capturedImage && !error && (
              <button
                type="button"
                onClick={handleToggleCamera}
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Switch Camera (Front / Rear)"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-medium">Flip</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopTracks();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 bg-black min-h-[320px] sm:min-h-[420px] flex items-center justify-center overflow-hidden">
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${capturedImage || error ? 'hidden' : 'block'}`}
          />

          {/* Captured Still Preview */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured Document"
              className="w-full h-full object-contain"
            />
          )}

          {/* Hidden Canvas for capture processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Document Framing Overlay (Guides user to frame document) */}
          {!capturedImage && !error && !isInitializing && (
            <div className="absolute inset-4 sm:inset-8 pointer-events-none border-2 border-dashed border-indigo-400/70 rounded-xl flex flex-col justify-between p-3">
              <div className="flex justify-between items-start">
                <span className="w-5 h-5 border-t-2 border-l-2 border-indigo-400 rounded-tl-md"></span>
                <span className="text-[10px] bg-slate-900/80 backdrop-blur-xs text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Document Target Area
                </span>
                <span className="w-5 h-5 border-t-2 border-r-2 border-indigo-400 rounded-tr-md"></span>
              </div>
              <div className="text-center">
                <span className="text-[11px] text-white/90 font-medium bg-black/60 px-2.5 py-1 rounded-full shadow-sm">
                  Align prescription, discharge summary, or lab sheet & click Capture
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="w-5 h-5 border-b-2 border-l-2 border-indigo-400 rounded-bl-md"></span>
                <span className="w-5 h-5 border-b-2 border-r-2 border-indigo-400 rounded-br-md"></span>
              </div>
            </div>
          )}

          {/* Initializing Spinner */}
          {isInitializing && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-3 p-4">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="text-xs font-bold">Requesting Camera Access...</div>
              <div className="text-[11px] text-slate-400 text-center max-w-xs">
                Requesting live camera feed. If your browser asks, please click <strong>"Allow"</strong>.
              </div>
            </div>
          )}

          {/* Error Message Screen with Instant Native Device Camera Fallback */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="font-bold text-sm text-amber-200">
                {permissionDenied ? 'Camera Permission Required' : 'Camera Access Issue'}
              </div>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed">{error}</p>

              {/* Seamless Action Choices */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                {/* 1. Direct native camera trigger */}
                <button
                  type="button"
                  onClick={() => fallbackInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Take Photo via Device Camera</span>
                </button>

                {/* 2. Retry live stream */}
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Live Camera</span>
                </button>

                {/* 3. Close */}
                <button
                  type="button"
                  onClick={() => {
                    stopTracks();
                    onClose();
                  }}
                  className="px-3 py-2 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {permissionDenied && (
                <div className="text-[10px] text-slate-400 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 max-w-md mt-2 flex items-start gap-1.5 text-left">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Tip:</strong> In Chrome/Edge/Safari, click the camera or lock icon on the left side of the address bar, change Camera to "Allow", then click "Retry Live Camera".
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Controls Footer */}
        <div className="p-3 sm:p-4 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            {capturedImage ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Document captured successfully
              </span>
            ) : (
              <span>High-resolution OCR photo mode active</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            {capturedImage ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use This Document</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    stopTracks();
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => fallbackInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Snap photo directly with your device's native camera app"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Device Camera</span>
                </button>
                <button
                  type="button"
                  onClick={handleSnap}
                  disabled={isInitializing || Boolean(error)}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Live</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
