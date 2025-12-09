import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Trash2, MapPin, PenTool, RefreshCw } from 'lucide-react';
import { Annotation, Drawing, Point, ToolMode, Clip } from '../types';

interface VideoPlayerProps {
  videoSrc: string | null;
  drawings: Drawing[];
  annotations: Annotation[];
  activeClip: Clip | null;
  toolMode: ToolMode;
  brushColor: string;
  brushSize: number;
  onAddAnnotation: (x: number, y: number, time: number) => void;
  onAddDrawing: (drawing: Drawing) => void;
  onClearAll: () => void;
  onVideoTimeUpdate: (currentTime: number, duration: number, isEnded: boolean) => void;
  externalPlayState: boolean; 
  setExternalPlayState: (playing: boolean) => void;
  playbackRate: number;
  onModeChange: (mode: ToolMode) => void;
  setBrushColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  onReset: () => void;
  seekTimestamp: number | null;
  onSeekComplete: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  drawings,
  annotations,
  activeClip,
  toolMode,
  brushColor,
  brushSize,
  onAddAnnotation,
  onAddDrawing,
  onClearAll,
  onVideoTimeUpdate,
  externalPlayState,
  setExternalPlayState,
  playbackRate,
  onModeChange,
  setBrushColor,
  setBrushSize,
  onReset,
  seekTimestamp,
  onSeekComplete
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPath = useRef<Point[]>([]);

  // Handle Seeking Request from Parent
  useEffect(() => {
    if (seekTimestamp !== null && videoRef.current) {
        videoRef.current.currentTime = seekTimestamp;
        onSeekComplete();
    }
  }, [seekTimestamp, onSeekComplete]);

  // Sync Playback State
  useEffect(() => {
    if (videoRef.current) {
      if (externalPlayState && videoRef.current.paused) {
        videoRef.current.play().catch(e => console.error("Play error", e));
      } else if (!externalPlayState && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [externalPlayState]);

  // Sync Playback Speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handle Video Events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onVideoTimeUpdate(
        videoRef.current.currentTime, 
        videoRef.current.duration,
        videoRef.current.ended
      );
      renderCanvas();
    }
  };

  // Canvas Drawing Logic
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentTime = video.currentTime;
    const tolerance = 0.5; // Show drawings within 0.5s window

    // Draw saved drawings
    drawings.forEach(drawing => {
      if (Math.abs(drawing.time - currentTime) < tolerance) {
        ctx.strokeStyle = drawing.color;
        ctx.lineWidth = drawing.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        let first = true;
        drawing.path.forEach(p => {
            const dx = p.x * canvas.width;
            const dy = p.y * canvas.height;
            if (first || p.isStart) {
                ctx.moveTo(dx, dy);
                first = false;
            } else {
                ctx.lineTo(dx, dy);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(dx, dy);
            }
        });
      }
    });

    // Draw current path being drawn
    if (isDrawing && currentPath.current.length > 0) {
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      
      let first = true;
      currentPath.current.forEach(p => {
          const dx = p.x * canvas.width;
          const dy = p.y * canvas.height;
          if (first) {
            ctx.moveTo(dx, dy);
            first = false;
          } else {
            ctx.lineTo(dx, dy);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(dx, dy);
          }
      });
    }

  }, [drawings, brushColor, brushSize, isDrawing]);


  // Resize Observer
  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current && videoRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        renderCanvas();
      }
    };

    window.addEventListener('resize', resizeCanvas);
    const to = setTimeout(resizeCanvas, 100);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearTimeout(to);
    };
  }, [renderCanvas]);

  const getNormalizedPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeClip) return;
    if (!videoRef.current) return;

    if (toolMode === 'point') {
      const pos = getNormalizedPos(e);
      onAddAnnotation(pos.x, pos.y, videoRef.current.currentTime);
    } else {
      setIsDrawing(true);
      const pos = getNormalizedPos(e);
      currentPath.current = [{ ...pos, isStart: true }];
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || toolMode !== 'pen' || activeClip) return;
    if ('touches' in e) e.preventDefault(); 
    
    const pos = getNormalizedPos(e);
    currentPath.current.push({ ...pos, isStart: false });
    renderCanvas();
  };

  const handleEnd = () => {
    if (isDrawing && toolMode === 'pen') {
      setIsDrawing(false);
      if (currentPath.current.length > 1 && videoRef.current) {
        onAddDrawing({
          id: Date.now().toString(),
          time: videoRef.current.currentTime,
          color: brushColor,
          size: brushSize,
          path: [...currentPath.current]
        });
      }
      currentPath.current = [];
    }
  };

  const transformStyle = activeClip
    ? {
        transform: 'scale(2.0)',
        transformOrigin: `${activeClip.x * 100}% ${activeClip.y * 100}%`,
        transition: 'transform 0.3s ease-out, transform-origin 0.3s ease-out',
      }
    : {
        transform: 'scale(1)',
        transformOrigin: 'center center',
        transition: 'transform 0.3s ease-out',
      };

  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
      <div 
        ref={containerRef}
        className="relative w-full aspect-video bg-black overflow-hidden group"
      >
        {!videoSrc && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            No video loaded
          </div>
        )}
        
        <div 
          className="w-full h-full relative"
          style={transformStyle}
        >
          <video
            ref={videoRef}
            src={videoSrc || undefined}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setExternalPlayState(false)}
            playsInline
            muted={!!activeClip}
          />
          
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full z-10 ${
              activeClip ? 'pointer-events-none' : 'cursor-crosshair'
            }`}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />

          {videoRef.current && annotations.map(ann => {
             const timeDiff = Math.abs(ann.time - videoRef.current!.currentTime);
             if (timeDiff > 0.5) return null;
             
             return (
               <div
                 key={ann.id}
                 className="absolute w-4 h-4 rounded-full border-2 border-white shadow-sm z-20 transform -translate-x-1/2 -translate-y-1/2 group pointer-events-none"
                 style={{ 
                    left: `${ann.x * 100}%`, 
                    top: `${ann.y * 100}%`,
                    backgroundColor: ann.color 
                 }}
               >
                 <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                   {ann.text}
                 </div>
               </div>
             );
          })}
        </div>
        
        {activeClip && (
           <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow animate-pulse z-30">
             ZOOM 200%
           </div>
        )}
      </div>

      <div className="p-4 border-t bg-gray-50 flex flex-wrap items-center gap-4">
        <button
          onClick={() => setExternalPlayState(!externalPlayState)}
          className={`p-2 rounded-full text-white transition shadow-md ${
             activeClip ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          disabled={!videoSrc}
        >
          {externalPlayState ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} />}
        </button>
        
        <div className="flex flex-col text-xs font-mono text-gray-600">
           {videoRef.current ? (
             <>
                <span>{videoRef.current.currentTime.toFixed(2)}s</span>
                <span className="text-gray-400">/ {videoRef.current.duration.toFixed(2)}s</span>
             </>
           ) : <span>00.00 / 00.00</span>}
        </div>

        <div className="h-8 w-px bg-gray-300 mx-2 hidden sm:block"></div>
        
        <div className="flex items-center gap-2">
           <button
             onClick={() => onModeChange('point')}
             className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition ${
               toolMode === 'point' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
             }`}
           >
             <MapPin size={16} /> <span className="hidden md:inline">Point</span>
           </button>
           <button
             onClick={() => onModeChange('pen')}
             className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition ${
               toolMode === 'pen' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
             }`}
           >
             <PenTool size={16} /> <span className="hidden md:inline">Draw</span>
           </button>
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="color" 
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
            title="Color"
          />
          <input 
            type="number"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            min={1} max={20}
            className="w-14 p-1 border rounded text-sm text-center"
            title="Brush Size"
          />
        </div>

        <div className="flex-grow"></div>

        <button 
           onClick={onClearAll}
           className="text-red-600 hover:bg-red-50 p-2 rounded-md flex items-center gap-1 text-sm transition"
        >
           <Trash2 size={16} /> <span className="hidden sm:inline">Clear</span>
        </button>
        <button 
           onClick={onReset}
           className="text-gray-600 hover:bg-gray-100 p-2 rounded-md flex items-center gap-1 text-sm transition"
        >
           <RefreshCw size={16} /> <span className="hidden sm:inline">New</span>
        </button>
      </div>
    </div>
  );
};