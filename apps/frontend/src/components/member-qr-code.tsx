import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface MemberQRCodeProps {
  memberNumber: string;
  size?: number;
}

export function MemberQRCode({ memberNumber, size = 160 }: MemberQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && memberNumber) {
      QRCode.toCanvas(canvasRef.current, memberNumber, {
        width: size,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(() => {});
    }
  }, [memberNumber, size]);

  if (!memberNumber) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="rounded-lg border border-border" />
      <span className="font-mono text-xs text-muted-foreground">{memberNumber}</span>
    </div>
  );
}
