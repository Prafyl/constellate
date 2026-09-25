<div align="center">

# ✦ Constellate

### Turn any text into a galaxy of ideas you can explore.

Paste your notes, an essay or a textbook chapter. A neural network running **entirely in your browser** reads every idea, maps it by meaning, and lights it up as a star. Related ideas pull together into named constellations. Fly through them, then quiz yourself until every star burns gold.

**[✦ Launch the live demo](https://prafyl.github.io/constellate/)** · no sign-up · no API key · nothing leaves your device

<img src="docs/screenshots/galaxy-nepal.png" alt="The Nepal galaxy in Constellate: five glowing constellations of ideas" width="100%" />

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-000000?logo=threedotjs&logoColor=white)
![Transformers.js](https://img.shields.io/badge/🤗_Transformers.js-FFD21E?logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Runs offline](https://img.shields.io/badge/AI-100%25_on--device-8affc1)

</div>

---

## Why

Notes are a flat list, but knowledge is a web. When you study, the hard part isn't reading each sentence. It's seeing **how the ideas connect**: which ones belong together, and which one leads to the next.

Constellate makes that structure visible. It turns a wall of text into a sky you can literally fly through, then helps you commit it to memory one star at a time.

## What it does

| | |
|---|---|
| <img src="docs/screenshots/star-focus.png" alt="A focused star with its closest ideas" /> | **✦ Every idea is a star.** Click one to fly to it and read it. Glowing threads reach out to its three closest ideas *by meaning*, not by where they happened to sit in the text. |
| <img src="docs/screenshots/quiz.png" alt="Quiz mode" /> | **◎ Star Quiz.** The camera flies to a star and blanks out its key term. Wrong answers are drawn from the same constellation, so they're plausible. Answer right and the star turns gold. |
| <img src="docs/screenshots/forming.png" alt="The on-device model at work" /> | **🧠 Your own text, on your device.** Paste anything. A 23 MB sentence-embedding model downloads once, runs in a Web Worker, and builds your galaxy in seconds. Your words never touch a server. |
| <img src="docs/screenshots/poster-nepal.png" alt="Exported poster" /> | **⤓ Poster export.** One click turns your galaxy into a share-ready 2400×1350 poster. |

Plus: an auto-**Tour** that flies through every constellation, four hand-written demo galaxies (**Nepal**, **Biology**, **World History**, **Machine Learning**) that load instantly, and a layout that works on phones.

## How it works

```mermaid
flowchart LR
  A[📄 Your text] --> B[Split into<br/>idea-sized chunks]
  B --> C[🤗 MiniLM-L6-v2<br/>384-D sentence embeddings]
  C --> D[UMAP<br/>384-D → 3-D]
  D --> E[k-means<br/>constellations]
  E --> F[TF-IDF<br/>constellation names]
  C --> G[Cosine similarity<br/>nearest ideas]
  F & G --> H[✦ three.js galaxy<br/>bloom · nebulae · MST figures]
```

1. **Chunk.** The text is split into sentences, and fragments are merged so each star holds one complete idea.
2. **Embed.** [`all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2) (quantized to 8-bit) turns each idea into a 384-dimensional vector that captures its *meaning*. It runs in the browser via [Transformers.js](https://github.com/huggingface/transformers.js), inside a Web Worker so the UI never freezes.
3. **Project.** [UMAP](https://github.com/PAIR-code/umap-js) squeezes 384 dimensions into 3 while keeping similar ideas close. That's why related sentences end up as neighbors in space.
4. **Cluster.** k-means groups nearby stars into constellations, and the number of groups scales with the size of the text.
5. **Name.** Each constellation is named by TF-IDF, treating every cluster as one document. The top words are the ones that make *this* group different from the rest of the sky.
6. **Draw.** Each constellation's figure is its **minimum spanning tree**, the same trick that makes it read like a real star chart. The stars use a custom GLSL shader (twinkle, glow, a spiral "big bang" on load), with unreal bloom, additive nebula sprites and dust particles.

The demo galaxies are built by the **same pipeline** ahead of time (`npm run demos`), so the landing page renders instantly with zero model download.

See [`docs/architecture.md`](docs/architecture.md) for the full breakdown.

## Run it locally

Requires **Node 20+**.

```bash
git clone https://github.com/Prafyl/constellate.git
cd constellate
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run demos` | Rebuild the demo galaxies from `demos/*.txt` (runs the ML pipeline in Node) |

Hosted on [Vercel](https://vercel.com): every push to `main` redeploys automatically.

## Project structure

```
constellate/
├── demos/                 # source texts for the demo galaxies
├── docs/                  # architecture notes + screenshots
├── public/
│   ├── demos/             # pre-computed galaxies (JSON)
│   └── samples/           # the "Try a sample" text
├── scripts/
│   ├── build-demos.ts     # runs the ML pipeline in Node
│   └── screenshots.ts     # captures docs/screenshots with headless Chrome
└── src/
    ├── galaxy/            # three.js: scene, star shader, nebulae, constellation lines
    ├── ml/                # chunking, embeddings worker, UMAP, k-means, TF-IDF
    ├── quiz/              # cloze question generator
    ├── ui/                # poster export
    ├── styles/            # the whole look
    └── main.ts            # app shell & interactions
```

## Built with & credits

- [three.js](https://threejs.org/): 3D rendering, `UnrealBloomPass`, `OrbitControls`, `CSS2DRenderer`
- [Transformers.js](https://github.com/huggingface/transformers.js) by Hugging Face: in-browser inference
- [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2): ONNX port of [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) (Apache 2.0)
- [umap-js](https://github.com/PAIR-code/umap-js) by Google PAIR: dimensionality reduction
- [Vite](https://vitejs.dev/) + TypeScript: build tooling
- Fonts: [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) and [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (Google Fonts, OFL)
- Demo texts were written for this project.
- Built with help from [Claude Code](https://claude.com/claude-code) (AI tools are allowed under the Hack Atlantic rules).

## License

[MIT](LICENSE)

<div align="center"><sub>Made in Nepal 🇳🇵 for Hack Atlantic 2026</sub></div>
