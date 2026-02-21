import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, Loader2, AlertTriangle } from 'lucide-react';

interface CameraModalProps {
  staffName: string;
  action: 'CHECK IN' | 'CHECK OUT';
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
}

type ModalState = 'starting' | 'preview' | 'captured' | 'error';

function formatWatermarkTime(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${day} ${month} ${year}  ${hh}:${mm}:${ss}`;
}

function drawWatermark(
  canvas: HTMLCanvasElement,
  staffName: string,
  action: string,
  timestamp: Date,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const pad = Math.round(w * 0.025);
  const barH = Math.round(h * 0.12);

  // Semi-transparent dark bar at bottom
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fillRect(0, h - barH, w, barH);

  // Action label — centered, large
  const actionSize = Math.round(barH * 0.38);
  ctx.font = `700 ${actionSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = action === 'CHECK IN' ? '#4ade80' : '#f87171';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(action, w / 2, h - barH + barH * 0.38);

  // Staff name — left, smaller
  const metaSize = Math.round(barH * 0.24);
  ctx.font = `500 ${metaSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(staffName, pad, h - Math.round(barH * 0.1));

  // Timestamp — right
  ctx.textAlign = 'right';
  ctx.fillText(formatWatermarkTime(timestamp), w - pad, h - Math.round(barH * 0.1));
}

export function CameraModal({ staffName, action, onConfirm, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<ModalState>('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setState('preview');
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(
            err?.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera access and try again.'
              : 'Could not start camera. Your device may not support this feature.',
          );
          setState('error');
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally (selfie camera is already mirrored in preview)
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    drawWatermark(canvas, staffName, action, new Date());

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedDataUrl(canvas.toDataURL('image/jpeg', 0.8));
        stopStream();
        setState('captured');
      },
      'image/jpeg',
      0.8,
    );
  }

  function handleRetake() {
    setCapturedBlob(null);
    setCapturedDataUrl(null);
    setState('starting');

    // Restart camera
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setState('preview');
      })
      .catch(() => {
        setErrorMsg('Could not restart camera.');
        setState('error');
      });
  }

  function handleConfirm() {
    if (capturedBlob) {
      onConfirm(capturedBlob);
    }
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-md rounded-card border border-border bg-card shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {action === 'CHECK IN' ? 'Check In' : 'Check Out'} — Take Photo
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Camera area */}
        <div className="relative bg-black aspect-video">
          {/* Live preview */}
          {(state === 'starting' || state === 'preview') && (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              muted
              playsInline
            />
          )}

          {/* Captured still */}
          {state === 'captured' && capturedDataUrl && (
            <img
              src={capturedDataUrl}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          )}

          {/* Loading overlay */}
          {state === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Starting camera…</p>
            </div>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Watermark preview overlay (visible during live preview) */}
          {state === 'preview' && (
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-black/60 px-3 py-2">
              <span className="text-[11px] text-white/80">{staffName}</span>
              <span
                className={`text-[11px] font-bold tracking-widest ${
                  action === 'CHECK IN' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {action}
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
          {state === 'preview' && (
            <>
              <button
                onClick={handleClose}
                className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCapture}
                className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Camera className="h-4 w-4" />
                Capture
              </button>
            </>
          )}

          {state === 'captured' && (
            <>
              <button
                onClick={handleRetake}
                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retake
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Check className="h-4 w-4" />
                Confirm
              </button>
            </>
          )}

          {state === 'error' && (
            <>
              <button
                onClick={handleClose}
                className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(new Blob())}
                className="rounded-md bg-muted px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors"
              >
                Continue without photo
              </button>
            </>
          )}

          {state === 'starting' && (
            <button
              onClick={handleClose}
              className="ml-auto rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
