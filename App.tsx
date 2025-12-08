import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileVideo, FileArchive } from 'lucide-react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { VideoPlayer } from './components/VideoPlayer';
import { Sidebar } from './components/Sidebar';
import { Annotation, Drawing, Clip, ToolMode, AnalysisData } from './types';

function App() {
  // --- State ---
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  const [toolMode, setToolMode] = useState<ToolMode>('point');
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(5);
  
  const [notes, setNotes] = useState('');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const clipTimeoutRef = useRef<number | null>(null);

  // --- Handlers ---

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadVideoFile(file);
    }
  };

  const loadVideoFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoFileName(file.name);
    setVideoFile(file);
    // Reset analysis data
    setDrawings([]);
    setAnnotations([]);
    setClips([]);
    setNotes('');
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("analysis_data.json");
      
      if (jsonFile) {
        const jsonContent = await jsonFile.async("string");
        const data: AnalysisData = JSON.parse(jsonContent);
        
        setNotes(data.notes);
        setDrawings(data.drawings);
        setAnnotations(data.annotations);
        setClips(data.clips);

        if (data.primaryVideoFileName) {
          const videoBlob = await zip.file(data.primaryVideoFileName)?.async("blob");
          if (videoBlob) {
            const videoFile = new File([videoBlob], data.primaryVideoFileName, { type: videoBlob.type });
            loadVideoFile(videoFile);
          } else {
            alert("Analysis loaded, but the video file was missing in the archive.");
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load analysis file.");
    }
  };

  const saveAnalysis = async () => {
    if (!videoFile) return;

    const zip = new JSZip();
    const data: AnalysisData = {
      notes,
      drawings,
      annotations,
      clips,
      primaryVideoFileName: videoFileName || 'video.mp4'
    };

    zip.file("analysis_data.json", JSON.stringify(data, null, 2));
    zip.file(videoFileName || 'video.mp4', videoFile);

    const content = await zip.generateAsync({ type: "blob" });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    saveAs(content, `Analysis_${timestamp}.zip`);
  };

  const handleAddAnnotation = (x: number, y: number, time: number) => {
    const text = prompt("Annotation Label / Clip Name:", `Point ${annotations.length + 1}`);
    if (!text) return;

    const id = Date.now().toString();
    
    // Add Annotation
    setAnnotations(prev => [...prev, {
      id, x, y, time, text, color: brushColor
    }]);

    // Create Clip (2 seconds starting at point)
    // Assuming clip extends slightly before and mostly after, or simply starts at point.
    // Let's implement start at point for 2s as per original.
    const clipStart = time;
    const clipEnd = Math.min(time + 2, duration);
    
    setClips(prev => [...prev, {
      id,
      name: text,
      startTime: clipStart,
      endTime: clipEnd,
      duration: parseFloat((clipEnd - clipStart).toFixed(2)),
      speed: 0.5,
      x,
      y
    }]);
  };

  // --- Clip Playback Logic ---

  const playClip = (clip: Clip) => {
    // Stop any existing clip logic
    if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current);

    setActiveClipId(clip.id);
    setPlaybackRate(clip.speed);
    
    // We need to set the video time to start time.
    // Since video element is in child, we rely on the fact that when `currentTime` state updates 
    // we might need a way to force the video element.
    // However, the VideoPlayer controls its own time mostly. 
    // To solve this properly, we need to pass a command or expose a ref.
    // For simplicity here, we will hack it slightly by toggling play state in a specific way
    // or adding a specific prop 'seekTo' which is handled in useEffect.
    // Actually, let's keep it simple: We just need to manage `activeClip`.
    
    // The VideoPlayer component will see `activeClip` and set transform. 
    // But we need to SEEK video.
    // To avoid complex ref passing, let's update a key to force re-seek or pass a command prop.
    // BETTER: Use a dedicated event system or ref from App? No, let's just use a side effect inside VideoPlayer
    // But VideoPlayer doesn't know when "playClip" was clicked.
    // Solution: We'll modify the `VideoPlayer` to accept a `seekRequest` timestamp prop.
    
    // Workaround for this architecture: 
    // We will handle the seek logic inside VideoPlayer by passing the start time when clip activates, 
    // BUT we need to distinguish new activation.
    
    // Let's rely on the user manually seeking if needed? No, that's bad UX.
    // We will add a `key` to VideoPlayer to force reset? No.
    // Let's just create a `seekTo` state.
    setSeekTimestamp(clip.startTime);
    setIsPlaying(true);

    const durationMs = ((clip.endTime - clip.startTime) / clip.speed) * 1000;
    
    clipTimeoutRef.current = window.setTimeout(() => {
        stopClip();
    }, durationMs);
  };

  const [seekTimestamp, setSeekTimestamp] = useState<number | null>(null);

  const stopClip = () => {
    if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current);
    setActiveClipId(null);
    setIsPlaying(false);
    setPlaybackRate(1.0);
    // Optional: Return to start of clip? or stay where it ended?
    // Original app went back to pre-clip time. We'll just pause.
  };

  // --- Render ---

  // Seek effect handler for VideoPlayer
  const VideoWrapper = () => {
    const playerRef = useRef<any>(null); // We could use forwardRef but this is faster for now
    
    // We need to inject the logic to seek video when `seekTimestamp` changes
    useEffect(() => {
        if (seekTimestamp !== null) {
            const videoEl = document.querySelector('video');
            if (videoEl) {
                videoEl.currentTime = seekTimestamp;
                setSeekTimestamp(null); // Reset
            }
        }
    }, [seekTimestamp]);

    return (
        <VideoPlayer
            videoSrc={videoSrc}
            drawings={drawings}
            annotations={annotations}
            activeClip={clips.find(c => c.id === activeClipId) || null}
            toolMode={toolMode}
            brushColor={brushColor}
            brushSize={brushSize}
            onAddAnnotation={handleAddAnnotation}
            onAddDrawing={(d) => setDrawings(prev => [...prev, d])}
            onClearAll={() => {
                if (confirm("Clear all annotations?")) {
                    setDrawings([]);
                    setAnnotations([]);
                    setClips([]);
                }
            }}
            onVideoTimeUpdate={(curr, dur) => {
                setCurrentTime(curr);
                setDuration(dur);
            }}
            externalPlayState={isPlaying}
            setExternalPlayState={setIsPlaying}
            playbackRate={playbackRate}
            onModeChange={setToolMode}
            setBrushColor={setBrushColor}
            setBrushSize={setBrushSize}
            onReset={() => window.location.reload()}
        />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8 border-b pb-4 flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">BioMech Analyzer Pro</h1>
                <p className="text-gray-500 text-sm mt-1">Professional Video Analysis Suite</p>
            </div>
        </header>

        {!videoSrc ? (
            <div className="max-w-2xl mx-auto mt-20 p-10 bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300 text-center">
                <div className="mb-6 flex justify-center text-blue-500">
                    <Upload size={64} />
                </div>
                <h2 className="text-2xl font-bold mb-4">Start Analysis</h2>
                <p className="text-gray-500 mb-8">Upload a video file or load a previous analysis zip.</p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <label className="cursor-pointer px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-md">
                        <FileVideo size={20} />
                        Load Video
                        <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                    </label>
                    <label className="cursor-pointer px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-md">
                        <FileArchive size={20} />
                        Load Analysis (.zip)
                        <input type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />
                    </label>
                </div>
            </div>
        ) : (
            <div className="flex flex-col lg:flex-row gap-8">
                <main className="lg:w-2/3">
                    <VideoWrapper />
                    
                    <div className="mt-6 bg-white p-4 rounded-lg shadow-sm flex items-center justify-between border">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-semibold text-gray-500">Playback Speed:</span>
                            <select 
                                value={playbackRate} 
                                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                                disabled={!!activeClipId}
                                className="bg-gray-100 border rounded px-2 py-1 text-sm"
                            >
                                <option value="0.25">0.25x</option>
                                <option value="0.5">0.5x</option>
                                <option value="1.0">1.0x</option>
                                <option value="1.5">1.5x</option>
                                <option value="2.0">2.0x</option>
                            </select>
                        </div>
                        <div className="text-sm text-gray-500">
                             File: <span className="font-medium text-gray-800">{videoFileName}</span>
                        </div>
                    </div>
                </main>

                <Sidebar 
                    notes={notes}
                    setNotes={setNotes}
                    clips={clips}
                    annotations={annotations}
                    activeClipId={activeClipId}
                    onPlayClip={playClip}
                    onStopClip={stopClip}
                    onDeleteClip={(id) => {
                        if(activeClipId === id) stopClip();
                        setClips(prev => prev.filter(c => c.id !== id));
                        // Remove associated annotation? Maybe keep it.
                    }}
                    onDeleteAnnotation={(id) => {
                        setAnnotations(prev => prev.filter(a => a.id !== id));
                    }}
                    onSaveAnalysis={saveAnalysis}
                    isVideoLoaded={!!videoSrc}
                />
            </div>
        )}
        
        <footer className="mt-12 text-center text-gray-400 text-sm py-4 border-t">
            &copy; {new Date().getFullYear()} BioMech Analyzer Pro
        </footer>
      </div>
    </div>
  );
}

export default App;
