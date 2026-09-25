# Devpost submission: Hack Atlantic (online)

Copy each block into the matching Devpost field.

---

## Project name
Constellate

## Tagline / short description (≤ 200 chars)
Paste any text and watch an AI running entirely in your browser turn its ideas into a 3D galaxy you can fly through, then quiz yourself until every star burns gold.

## Teammates
Solo: Prafyl (Nepal)

## Link to demo
https://prafyl.github.io/constellate/

## Link to code
https://github.com/Prafyl/constellate

## Setup instructions
No setup needed for the demo: open the link, then click any star, press **Quiz**, or hit **✦ Map your own text → Try a sample**.

To run locally (Node 20+):
```
git clone https://github.com/Prafyl/constellate.git
cd constellate
npm install
npm run dev
```

---

## About the project (Devpost "story")

### Inspiration
Notes are a flat list, but knowledge is a web. When I study, the hard part isn't reading each sentence. It's seeing how the ideas connect: which ones belong together, and which one leads to the next. I wanted to *see* the shape of what I'm learning, and to make revising it feel like exploring rather than rereading.

### What it does
Constellate turns any text into a galaxy of ideas.

- **Every idea becomes a star.** Related ideas pull together into glowing, automatically named **constellations**.
- **Click a star** to fly to it. Threads of light connect it to its three closest ideas *by meaning*, not by where they sat in the text.
- **Star Quiz** flies you from star to star and blanks out each one's key term. The wrong answers come from the same constellation, so they're genuinely tricky. Every correct answer turns a star gold.
- **Tour** flies through every constellation automatically.
- **Poster** exports a 2400×1350 share-ready image of your galaxy.
- **Map your own text:** paste notes, an essay or a Wikipedia article, and a neural network builds your galaxy **on your device**. There's no sign-up and no API key, and nothing is uploaded.

It ships with four galaxies that load instantly: **Nepal** (where I'm from), **Biology**, **World History** and **Machine Learning**.

### How I built it
A fully client-side ML pipeline feeding a custom three.js renderer:

1. **Embeddings.** `all-MiniLM-L6-v2`, quantized to 8-bit, runs in the browser via Hugging Face **Transformers.js** inside a Web Worker. It turns each sentence into a 384-dimensional meaning vector.
2. **UMAP** projects 384-D into 3-D, so ideas that mean similar things end up close in space.
3. **k-means** groups them into constellations, and **TF-IDF** (treating each cluster as a document) names each constellation after the words that make it distinctive.
4. **Rendering.** Each constellation's figure is its **minimum spanning tree**, which is why it reads like a real star chart. The stars are a single draw call with a custom GLSL shader (twinkle, glow, a spiral "big bang" as the galaxy forms). Unreal bloom, additive nebula sprites and dust particles complete the look.
5. The demo galaxies are built by the **same pipeline in Node** ahead of time, so the first load is instant.

Stack: TypeScript, Vite, three.js, Transformers.js, umap-js. It's a static site on GitHub Pages.

### Challenges I ran into
- **Making it fast on first click.** Downloading a model before showing anything would lose people, so I pre-computed the demo skies with the exact same code path in Node. The model loads only when you paste your own text.
- **Naming clusters without an LLM.** Raw word counts gave names like "Cells & Cell". Treating each cluster as a TF-IDF document, stemming and de-duplicating across the sky produced names like *Evolution & Populations* and *Kathmandu & Valley*.
- **Making it look like a star chart, not a scatter plot.** Connecting every star to its neighbors was a tangle. The minimum spanning tree per cluster gave clean, recognizable figures.
- **Rendering details.** Stars turned into squares up close (plain points have no shape), and the bloom washed out everything until I rebalanced it.

### Accomplishments I'm proud of
- Real ML running **100% in the browser**, private by design, and working offline after the first load.
- It works on **any** text you give it, not just the demos.
- It looks like something you'd want to screenshot, and it has a button that does exactly that.

### What I learned
- How sentence embeddings actually encode meaning, and how UMAP preserves neighborhoods when crushing dimensions.
- Running transformer models client-side with ONNX/WASM, and keeping the UI smooth with Web Workers.
- Writing custom GLSL shaders and a post-processing pipeline in three.js.
- That simple classic algorithms (k-means, TF-IDF, Prim's MST) combined with a modern embedding model go a very long way.

### What's next
- Upload PDFs and whole textbooks, with multiple galaxies linked into a universe.
- Spaced repetition, so stars fade over time until you review them.
- Nepali-language support with a multilingual embedding model.
- Shareable galaxy links.

---

## Built with (Devpost tags)
typescript, three.js, webgl, glsl, transformers.js, hugging-face, onnx, umap, machine-learning, vite, github-pages

## Tools & credits
- three.js (MIT): rendering, UnrealBloomPass, OrbitControls, CSS2DRenderer
- Transformers.js by Hugging Face (Apache 2.0): in-browser inference
- Model: Xenova/all-MiniLM-L6-v2, ONNX port of sentence-transformers/all-MiniLM-L6-v2 (Apache 2.0)
- umap-js by Google PAIR (Apache 2.0)
- Vite + TypeScript
- Fonts: Instrument Serif and Space Grotesk (Google Fonts, SIL OFL)
- Demo texts written for this project
- AI assistance: Claude Code (Anthropic) was used to help write code and copy. AI tools are allowed under the Hack Atlantic rules.

## Screenshots to upload (in this order)
1. `docs/screenshots/galaxy-nepal.png`: hero
2. `docs/screenshots/star-focus.png`
3. `docs/screenshots/quiz.png`
4. `docs/screenshots/forming.png`
5. `docs/screenshots/your-galaxy.png`
6. `docs/screenshots/poster-nepal.png`
7. `docs/screenshots/galaxy-machine-learning.png`
8. `docs/screenshots/mobile.png`
