// Configure PDF.js worker (needed for PDF parsing)
if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
