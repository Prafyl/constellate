export type Vec3 = [number, number, number];

export interface Star {
  id: number;
  text: string;
  /** Heading of the document section this idea came from. */
  section?: string;
  pos: Vec3;
  cluster: number;
  neighbors: number[];
  /** Cosine similarity (0–1) to each neighbor, same order. */
  scores: number[];
  /** Sentence embedding, used for semantic search. */
  vec: number[];
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
  /** Where the text came from (URL or file name). */
  source?: string;
  words: number;
  createdAt: string;
  stars: Star[];
  constellations: Constellation[];
}
