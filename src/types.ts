export type Vec3 = [number, number, number];

export interface Star {
  id: number;
  text: string;
  pos: Vec3;
  cluster: number;
  neighbors: number[];
  /** The most distinctive term in this sentence, used for quiz questions. */
  term: string;
}

export interface Constellation {
  id: number;
  name: string;
  keywords: string[];
  color: string;
  center: Vec3;
  size: number;
}

export interface Galaxy {
  title: string;
  createdAt: string;
  stars: Star[];
  constellations: Constellation[];
}
