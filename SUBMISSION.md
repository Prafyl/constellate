# Devpost submission: Hack Atlantic (online)

Copy each block into the matching Devpost field.

---

## Project name
Constellate: Turn any reading into a galaxy of ideas

## Elevator pitch (≤ 200 chars)
Turn a 40-page reading into a 3D galaxy of ideas. AI running in your browser maps every topic, then helps you study it: key ideas, search by meaning, explain-it-back and quizzes.

## Thumbnail (3:2)
`docs/thumbnail.png`

## Teammates
Solo: Prafyl (Nepal)

## Link to demo
https://constellate-black.vercel.app

## Link to code
https://github.com/Prafyl/constellate

## Setup instructions
No setup needed for the demo. Open the link and press **Watch the interactive demo**, or click any star, open **For students**, or press **Map a document** and pick a Wikipedia article (for example *Quantum mechanics*) or drop in a PDF.

To run locally (Node 20+):
```
git clone https://github.com/Prafyl/constellate.git
cd constellate
npm install
npm run dev
```

---

## About the project

## Inspiration

The night before an exam I usually have a 30 or 40 page chapter open and no real plan. Reading it isn't what's hard. What's hard is knowing what the main topics even are, which parts connect to which, and what I should actually spend my time on.

My notes never helped with that because they're just a long list. But the way ideas actually fit together is more like a web. So I wanted a way to look at a whole reading at once and see its shape, and then use that shape to study.

The night sky felt like the right picture for it. People have been grouping stars into constellations to make sense of them for thousands of years. I figured the same thing could work for ideas.

## What it does

You give Constellate a long reading: a Wikipedia article, a PDF of a chapter, or your own lecture notes. It turns that reading into a 3D galaxy you can fly around in.

Each idea in the text becomes a star. Ideas that mean similar things end up close together and form constellations, and each one gets a name based on what it's about. For example, the Philosophy article on Wikipedia is about 6,400 words, and it comes out as 318 ideas in 13 topics. I never told it how many topics to find. It works that out from the text.

From there you can actually study with it:

- Click any star to read that idea and see which section it came from. It also links to the three most similar ideas in the whole document, even if they're far apart in the original.
- Ask a question in normal words, like "how do we know what is true?", and the most relevant ideas light up. It matches by meaning, so the answer doesn't need to use the same words as your question.
- Key ideas shows the one most central idea from each topic. It's basically a one-minute summary of the whole thing.
- Explain it back is my favourite part. You pick a topic, write what you remember in your own words, and it tells you which of the main ideas you got, which ones you only half covered, and which ones you missed and should reread.
- There's a quiz that blanks out key words from real sentences in the text. The wrong options come from the same topic, so you can't just guess. Every idea you get right turns gold, and your progress is saved for next time.
- Each topic also shows which other topics it's connected to, and the ideas that link them. I found this really useful for essays.
- You can download everything as a study guide with a checklist for each topic.

The part I care about most is that it all runs in your browser. Nothing gets uploaded, you don't need an account, and there's no API key.

There's also a page for students with some real situations it helps with, and a guided demo that walks through every feature on the actual app.

## How I built it

The whole thing is a static website. There's no server doing the AI work.

First the text gets cleaned up. That means removing citation numbers, links, and the leftover math code you get from Wikipedia. Then it's split into ideas. Long documents get grouped into short passages so the entire document fits instead of getting cut off.

Each idea is turned into a list of 384 numbers that represents its meaning. This uses a small language model called all-MiniLM-L6-v2, running in the browser with Transformers.js. Two ideas count as similar when their vectors point the same way:

$$\text{similarity}(a,b)=\frac{a\cdot b}{\lVert a\rVert\,\lVert b\rVert}$$

Then UMAP squashes those 384 dimensions down to 3, so I can place the ideas in space and similar ones stay near each other. After that I group them with k-means. I didn't want to hard-code the number of topics, so it tries everything from 3 to 16 and uses the silhouette score to pick the split that's detailed but still clean. Topic names come from TF-IDF, which finds the words that are common in one group but rare in the others.

The key idea for each topic is just the star closest to the middle of that group. The lines that make each constellation are a minimum spanning tree, which is what makes them look like a real star chart and not a tangled mess. The stars themselves are drawn with a custom shader in three.js, with bloom on top for the glow.

The demo galaxies on the site are built ahead of time with the exact same code running in Node, so the page loads instantly and you only download the model when you map your own document.

## Challenges I ran into

The hardest problem was making Explain it back honest. My first version gave 8 out of 8 to everything. Even "ethics is about right and wrong" got full marks. The main ideas in a topic are all pretty similar to each other, so one vague sentence ended up matching all of them. I fixed it by letting each sentence count for at most two ideas, and by tuning the cutoff on real test answers. Now a decent three-sentence answer gets about 3 out of 8, a one-liner gets 2, and something off topic gets 0. That felt a lot more fair.

Long documents were another problem. At first I was only keeping the first 260 sentences without realising it, so most of a big article just vanished. Grouping sentences into passages fixed that. Now the Quantum mechanics article, which is almost 8,000 words, maps into 14 topics in about 30 seconds.

Naming topics without using a chatbot took a lot of trial and error too. My early names were things like "Cells & Cell". TF-IDF plus removing duplicate word forms got it to names that actually make sense.

And I wanted the first impression to be fast. Making someone wait for a model download before they see anything felt like a bad start, which is why the demo galaxies are prebuilt.

## Accomplishments that I'm proud of

I'm proud that real AI runs entirely in the browser. It keeps your documents private, and after the first load it even works offline.

It also works on whatever you give it, not only the examples I picked. And the study features are based on techniques that actually help people learn, like testing yourself and explaining things in your own words.

## What I learned

I learned a lot about how sentence embeddings capture meaning, and how UMAP keeps nearby things together when you throw away most of the dimensions. I also learned how to run a model in the browser without freezing the page, by moving the work into a Web Worker.

The biggest lesson was about AI feedback: if a score praises everything, it's useless. Calibrating it against real answers mattered more than any clever idea.

I also learned that some old, simple algorithms like k-means, TF-IDF and minimum spanning trees are still really powerful when you combine them with a modern language model.

## What's next

- Stars that slowly fade over time until you review them again, like spaced repetition
- Linking several chapters together into one bigger map
- Support for Nepali using a multilingual model
- Shareable links, so a whole class can study the same galaxy

---

## Built with (Devpost tags, 24 of 25)
typescript, javascript, three.js, webgl, glsl, transformers.js, hugging-face, onnx, webgpu, webassembly, web-workers, machine-learning, natural-language-processing, umap, k-means, tf-idf, pdf.js, wikipedia-api, vite, vercel, puppeteer, ffmpeg, html5, css3

## Tools & credits
- three.js (MIT): rendering, UnrealBloomPass, OrbitControls, CSS2DRenderer
- Transformers.js by Hugging Face (Apache 2.0): in-browser inference
- Model: Xenova/all-MiniLM-L6-v2, ONNX port of sentence-transformers/all-MiniLM-L6-v2 (Apache 2.0)
- umap-js by Google PAIR (Apache 2.0)
- PDF.js by Mozilla (Apache 2.0): PDF text extraction
- Vite + TypeScript
- Puppeteer and ffmpeg: gallery images and the demo video
- Philosophy demo text: Wikipedia, "Philosophy" (CC BY-SA 4.0)
- Fonts: Geist and Geist Mono (Google Fonts, SIL OFL)
- Other demo texts written for this project
- AI assistance: Claude Code (Anthropic) was used to help write code and copy. AI tools are allowed under the Hack Atlantic rules.

## Image gallery (upload in this order, 15 of 15)
| File | Caption |
|---|---|
| `docs/gallery/01-intro.png` | Every idea is a star: drop in any long reading and AI on your device maps it. |
| `docs/gallery/02-galaxy.png` | Wikipedia's Philosophy article (6,364 words) as 318 ideas in 13 topics the AI found on its own. |
| `docs/gallery/03-topic.png` | Open a topic: key idea first, key terms, and the topics it connects to. |
| `docs/gallery/04-star.png` | Every star is one idea; threads link it to its closest ideas anywhere in the text. |
| `docs/gallery/05-ask-the-sky.png` | Ask the sky: search by meaning, not keywords. |
| `docs/gallery/06-key-ideas.png` | Key ideas: the most central idea of every topic, the whole document in one minute. |
| `docs/gallery/07-explain-it-back-write.png` | Explain it back: the Feynman technique. Explain a topic from memory. |
| `docs/gallery/08-explain-it-back-result.png` | It shows what you explained, what you touched on, and exactly what to reread. |
| `docs/gallery/09-quiz.png` | Quiz this topic: questions from the text itself; mastered stars burn gold. |
| `docs/gallery/10-connections.png` | Connections: the ideas that bridge two topics, often the argument of an essay. |
| `docs/gallery/11-for-students.png` | For students: real study situations, with a live "Try it" on every feature. |
| `docs/gallery/12-interactive-demo.png` | The interactive demo spotlights the real interface while each feature runs live. |
| `docs/gallery/13-map-a-document.png` | Map any Wikipedia article, PDF or lecture notes. Nothing is uploaded. |
| `docs/gallery/14-new-galaxy.png` | Photosynthesis, mapped live in the browser: 15 topics in seconds, no servers. |
| `docs/gallery/15-mobile.png` | Study anywhere: the layout works on your phone. |

## Video
Record with `npm run video` (dev server on port 4317), then upload `video/constellate-demo.mp4` to YouTube and paste the link into Devpost. It runs 2:25 with no audio, so add music in YouTube Studio if you like.
