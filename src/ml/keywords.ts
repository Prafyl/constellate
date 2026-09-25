const STOP = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just like made make many may me more most much must my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours one two three first new used use using called known often become became within without around among across however thus since while every another each part way ways many first second found make makes made take takes carry carries built build builds lie lies include includes including help helps helped still even well less small large great good best long later still today year years people world based point points percent roughly nearly about more than half end ended began begin begins brought bring home often times time million billion thousand hundred meters happens happen earliest trained sits lets let`
    .split(/\s+/),
);

const stem = (w: string) => w.replace(/(ies|es|s|ed|ing)$/, '');

export const tokenize = (s: string) =>
  (s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).map((w) => w.replace(/'s$/, '')).filter((w) => !STOP.has(w));

/**
 * TF-IDF over clusters: each cluster is a "document", so the top terms are the
 * words that make that constellation different from the rest of the sky.
 */
export function extractKeywords(docs: string[]) {
  const tfs = docs.map((d) => {
    const tf = new Map<string, number>();
    for (const w of tokenize(d)) tf.set(w, (tf.get(w) ?? 0) + 1);
    return tf;
  });
  const df = new Map<string, number>();
  for (const tf of tfs) for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);

  const score = (ci: number, w: string) => (tfs[ci].get(w) ?? 0) * Math.log(1 + docs.length / (df.get(w) ?? 1));

  const used = new Set<string>();
  const clusterKeywords = tfs.map((tf, ci) => {
    const ranked = [...tf.keys()].sort((a, b) => score(ci, b) - score(ci, a));
    const seen = new Set<string>();
    const picks = ranked.filter((w) => {
      const st = stem(w);
      if (used.has(st) || seen.has(st)) return false;
      seen.add(st);
      return true;
    }).slice(0, 6);
    picks.slice(0, 2).forEach((w) => used.add(stem(w))); // keep constellation names unique
    return picks;
  });

  const bestTermIn = (sentence: string, ci: number) => {
    const words = tokenize(sentence).filter((w) => w.length > 3);
    return words.sort((a, b) => score(ci, b) - score(ci, a))[0] ?? words[0] ?? '';
  };

  return { clusterKeywords, bestTermIn };
}
