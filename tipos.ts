export interface Point {
  x: number;
  y: number;
  isStart?: boolean;
}

export interface Drawing {
  id: string;
  time: number;
  color: string;
  size: number;
  path: Point[];
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  time: number;
  text: string;
  color: string;
}

export interface Clip {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  speed: number;
  x: number; // Center X for zoom
  y: number; // Center Y for zoom
}

export interface AnalysisData {
  notes: string;
  drawings: Drawing[];
  annotations: Annotation[];
  clips: Clip[];
  primaryVideoFileName?: string;
}

export type ToolMode = 'point' | 'pen';
