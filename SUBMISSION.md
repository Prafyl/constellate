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
https://constellate.vercel.app

## Link to code
https://github.com/Prafyl/constellate

## Setup instructions
No setup needed for the demo: open the link, then click any star, press **Quiz**, or hit **✦ Map a document** and pick a Wikipedia article (for example *Quantum mechanics*) or drop in a PDF.

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
- **Ask the sky:** type a question in plain English ("Who first climbed Everest?") and the stars that answer it light up, ranked by meaning with a match score. It's real semantic search, running on your device.
- **Constellation panels** show each group's keywords, its share of the sky, and every idea inside it.
- **How it works:** an in-app explainer walks through the ML pipeline using the live numbers of the galaxy you're viewing.
- **Star Quiz** flies you from star to star and blanks out each one's key term. The wrong answers come from the same constellation, so they're genuinely tricky. Every correct answer turns a star gold.
- **Tour** flies through every constellation automatically.
- **Poster** exports a 2400×1350 share-ready image of your galaxy.
- **Map a document:** import a Wikipedia article by link, drop in a PDF / .txt / .md file (lecture notes, papers, book chapters), or paste text. A neural network builds your galaxy **on your device**. There's no sign-up and no API key, and nothing is uploaded. It's built for long reads: *Quantum mechanics* (7,963 words) becomes 14 topics in about 30 seconds, and each idea keeps the section it came from.
- **Study guide export:** downloads a Markdown outline with one chapter per topic, its key terms, and every idea as a checklist (ideas you've mastered in the quiz come pre-ticked).

It ships with five galaxies that load instantly, led by Wikipedia's **Philosophy** article (6,364 words → 13 topics), plus **Nepal** (where I'm from), **Biology**, **World History** and **Machine Learning**.

### How I built it
A fully client-side ML pipeline feeding a custom three.js renderer:

1. **Embeddings.** `all-MiniLM-L6-v2`, quantized to 8-bit, runs in the browser via Hugging Face **Transformers.js** inside a Web Worker. It turns each sentence into a 384-dimensional meaning vector.
2. **UMAP** projects 384-D into 3-D, so ideas that mean similar things end up close in space.
3. **k-means** is run for 3 to 16 topics, and the **silhouette score** keeps the richest clean split, so a short note gets 3 topics and a long article gets 13 to 15. **TF-IDF** (treating each cluster as a document) names each constellation after the words that make it distinctive.
4. **Rendering.** Each constellation's figure is its **minimum spanning tree**, which is why it reads like a real star chart. The stars are a single draw call with a custom GLSL shader (twinkle, glow, a spiral "big bang" as the galaxy forms). Unreal bloom, additive nebula sprites and dust particles complete the look.
5. The demo galaxies are built by the **same pipeline in Node** ahead of time, so the first load is instant.

Stack: TypeScript, Vite, three.js, Transformers.js, umap-js. PDF.js reads PDFs in the browser. It's a static site on Vercel.

### Challenges I ran into
- **Making it fast on first click.** Downloading a model before showing anything would lose people, so I pre-computed the demo skies with the exact same code path in Node. The model loads only when you paste your own text.
- **Naming clusters without an LLM.** Raw word counts gave names like "Cells & Cell". Treating each cluster as a TF-IDF document, stemming and de-duplicating across the sky produced names like *Evolution & Populations* and *Kathmandu & Valley*.
- **Scaling to real documents.** My first version silently kept only the first 260 sentences. Now long texts are grouped into passages so the whole document is covered, Wikipedia's LaTeX and citation marks are stripped, and the topic count is chosen by silhouette score instead of a formula.
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
- Semantic search across *all* your galaxies at once.
- Whole textbooks, with multiple galaxies linked into a universe.
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
- PDF.js by Mozilla (Apache 2.0): PDF text extraction
- Philosophy demo text: Wikipedia, "Philosophy" (CC BY-SA 4.0)
- Fonts: Geist and Geist Mono (Google Fonts, SIL OFL)
- Demo texts written for this project
- AI assistance: Claude Code (Anthropic) was used to help write code and copy. AI tools are allowed under the Hack Atlantic rules.

## Screenshots to upload (in this order)
1. `docs/screenshots/intro.png`: hero
2. `docs/screenshots/galaxy-philosophy.png`: 6,364-word article → 13 topics
3. `docs/screenshots/ask-the-sky.png`
4. `docs/screenshots/star-focus.png`
5. `docs/screenshots/import.png`
6. `docs/screenshots/constellation.png`
7. `docs/screenshots/quiz.png`
8. `docs/screenshots/how-it-works.png`
9. `docs/screenshots/forming.png`
10. `docs/screenshots/mobile.png`
