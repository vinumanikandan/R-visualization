// Course settings — the lesson text itself lives in README.md.
window.COURSE = {
  id: "r-visualization",
  title: "R Visualization",
  eyebrow: "Training module · Data visualization in R",
  subtitle: "Publication-quality plots with base R and ggplot2.",
  glyph: "gg",
  lang: "r",
  runnable: true,
  webrUrl: "https://webr.r-wasm.org/v0.4.2/webr.mjs",
  repo: "https://github.com/vinumanikandan/R-visualization",
  readme: "README.md",
  tip: "<b>Try it live:</b> press <b>▶ Run</b> to draw any plot right here with R in your browser. Packages such as <code>ggplot2</code> install automatically the first time (allow ~20 s). Blocks share one R session, so run them in order.",
  quizzes: [
    { after: "Plotting by R base", q: "Which base R function <b>adds</b> a horizontal cut-off line to an existing plot?", options: ["<code>lines(h = 60)</code>", "<code>abline(h = 60)</code>", "<code>plot(h = 60)</code>", "<code>hline(60)</code>"], answer: 1, explain: "<code>abline()</code> draws straight lines: <code>h=</code> horizontal, <code>v=</code> vertical, or a fitted <code>lm()</code> model." },
    { after: "1. ggplot2", q: "In ggplot2, what does <code>aes()</code> define?", options: ["The plot theme", "How data columns map to visual properties (x, y, colour…)", "The output file format", "The geometric shape"], answer: 1, explain: "Aesthetics map variables to position, colour, size and so on; <code>geom_*()</code> layers decide the shape." },
    { after: "Boxplot", q: "Why convert <code>cyl</code> with <code>factor(cyl)</code> before colouring by it?", options: ["It makes the plot faster", "So ggplot treats it as categories with distinct colours, not a continuous scale", "ggplot2 can't read integers", "To sort the data"], answer: 1, explain: "Numeric columns get a continuous colour gradient; factors get one discrete colour per level." }
  ]
};
