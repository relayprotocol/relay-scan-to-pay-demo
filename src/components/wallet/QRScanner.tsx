"use client";

/**
 * QR Code Scanner Component
 *
 * Uses html5-qrcode to scan EIP-681 payment URIs from QR codes.
 * Handles camera permissions and provides a clean scanning UX.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function QRScanner({ onScan, onError, className }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  const scannerId = "qr-scanner-container";

  // Get available cameras
  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Prefer back camera on mobile
        const backCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        );
        setSelectedCamera(backCamera?.id || devices[0].id);
        setHasPermission(true);
        return true;
      } else {
        setErrorMessage("No cameras found on this device");
        setHasPermission(false);
        return false;
      }
    } catch (err) {
      console.error("Failed to get cameras:", err);
      setErrorMessage("Camera access denied. Please allow camera permissions.");
      setHasPermission(false);
      onError?.("Camera access denied");
      return false;
    }
  }, [onError]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
    setIsScanning(false);
  }, []);

  // Start scanning
  const startScanning = useCallback(async () => {
    if (!selectedCamera || isScanning) return;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
      }

      const scanner = scannerRef.current;

      if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        return;
      }

      await scanner.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanning();
        },
        () => {
          // QR code not detected - called frequently, ignore
        }
      );

      setIsScanning(true);
      setErrorMessage(null);
    } catch (err) {
      console.error("Failed to start scanner:", err);
      setErrorMessage("Failed to start camera. Please try again.");
      setIsScanning(false);
    }
  }, [selectedCamera, isScanning, onScan, stopScanning]);

  // Request camera permission and get cameras on mount
  useEffect(() => {
    getCameras();

    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING) {
            scannerRef.current.stop().catch(console.error);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [getCameras]);

  // Retry camera access
  const handleRetry = async () => {
    setErrorMessage(null);
    const success = await getCameras();
    if (success && selectedCamera) {
      startScanning();
    }
  };

  // Switch camera
  const handleSwitchCamera = async () => {
    if (cameras.length < 2) return;

    await stopScanning();

    const currentIndex = cameras.findIndex((c) => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCamera(cameras[nextIndex].id);
  };

  // Auto-start when camera is selected
  useEffect(() => {
    if (selectedCamera && hasPermission && !isScanning) {
      startScanning();
    }
  }, [selectedCamera, hasPermission, isScanning, startScanning]);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {/* Force the library-injected video to fill the square container */}
      <style>{`#${scannerId} video { width: 100% !important; height: 100% !important; object-fit: cover !important; }`}</style>
      {/* Scanner container */}
      <div
        id={scannerId}
        className="w-full aspect-square bg-black/10 rounded-lg overflow-hidden"
      />

      {/* Overlay with viewfinder */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner markers */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 relative">
              {/* Top-left corner */}
              <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
              {/* Top-right corner */}
              <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
              {/* Bottom-left corner */}
              <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-lg" />
              {/* Bottom-right corner */}
              <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 rounded-lg">
          <CameraOff className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground text-center px-4 mb-4">
            {errorMessage}
          </p>
          <Button onClick={handleRetry} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}

      {/* Loading state */}
      {hasPermission === null && !errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
          <div className="text-center">
            <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-sm text-muted-foreground">
              Requesting camera access...
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      {isScanning && cameras.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            onClick={handleSwitchCamera}
            variant="secondary"
            size="sm"
            className="bg-background/80 backdrop-blur-sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Switch Camera
          </Button>
        </div>
      )}

      {/* Scanning indicator */}
      {isScanning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Scanning...
          </div>
        </div>
      )}
    </div>
  );
}

export default QRScanner;
