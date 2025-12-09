import React from 'react';
import { Trash2, Play, Square, Save } from 'lucide-react';
import { Annotation, Clip } from '../types';

interface SidebarProps {
  notes: string;
  setNotes: (notes: string) => void;
  clips: Clip[];
  annotations: Annotation[];
  activeClipId: string | null;
  onPlayClip: (clip: Clip) => void;
  onStopClip: () => void;
  onDeleteClip: (id: string) => void;
  onDeleteAnnotation: (id: string) => void;
  onSaveAnalysis: () => void;
  isVideoLoaded: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  setNotes,
  clips,
  annotations,
  activeClipId,
  onPlayClip,
  onStopClip,
  onDeleteClip,
  onDeleteAnnotation,
  onSaveAnalysis,
  isVideoLoaded
}) => {
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <aside className="lg:w-1/3 space-y-6 flex flex-col h-full">
      <div className="bg-gray-100 rounded-lg h-32 flex items-center justify-center border-2 border-dashed border-gray-300">
        <span className="text-gray-400 font-medium">Space Ad / Branding</span>
      </div>

      <div className="bg-white p-4 rounded-lg shadow flex-1 overflow-hidden flex flex-col">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Analysis Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md text-sm mb-4 focus:ring-blue-500 focus:border-blue-500 resize-none h-32"
          placeholder="Enter biomechanical observations here..."
        />

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {/* Clips Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2 border-t pt-4">Auto Clips (2s)</h2>
            <div className="space-y-2">
              {clips.length === 0 && (
                <p className="text-sm text-gray-500 italic">No clips created yet.</p>
              )}
              {clips.map((clip) => {
                const isPlaying = activeClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    className={`p-2 border rounded-md text-sm transition flex justify-between items-center ${
                      isPlaying ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex-grow">
                      <p className="font-medium text-gray-800">{clip.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatTime(clip.startTime)} - {formatTime(clip.endTime)} (Slow Mo)
                      </p>
                    </div>
                    <button
                      onClick={() => isPlaying ? onStopClip() : onPlayClip(clip)}
                      className={`ml-2 p-1.5 rounded text-white transition ${
                        isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                      title={isPlaying ? "Stop Clip" : "Play Clip (Zoomed)"}
                    >
                      {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>
                    <button
                      onClick={() => onDeleteClip(clip.id)}
                      className="ml-1 p-1.5 bg-gray-300 text-gray-600 rounded hover:bg-gray-400 hover:text-white transition"
                      title="Delete Clip"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Annotations List Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2 border-t pt-4">Annotation Points</h2>
            <div className="space-y-1">
              {annotations.length === 0 && (
                <p className="text-sm text-gray-500 italic">No annotations added.</p>
              )}
              {annotations.map((ann, idx) => (
                <div key={ann.id} className="p-2 border-b last:border-0 text-sm flex justify-between items-center hover:bg-gray-50">
                  <span className="text-gray-700">
                    <span className="font-bold mr-1">{idx + 1}.</span> 
                    {ann.text} <span className="text-xs text-gray-500">({formatTime(ann.time)})</span>
                  </span>
                  <button
                    onClick={() => onDeleteAnnotation(ann.id)}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onSaveAnalysis}
          disabled={!isVideoLoaded}
          className={`mt-4 w-full px-4 py-3 rounded-md text-white font-medium flex items-center justify-center gap-2 transition ${
            isVideoLoaded ? 'bg-green-600 hover:bg-green-700 shadow-md' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          <Save size={18} />
          Save Analysis (.zip)
        </button>
      </div>
    </aside>
  );
};