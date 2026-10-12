import './styles.css';
import { cleanImageMetadata, inspectMetadata, type InspectionResult, type MetadataEntry } from './metadata';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

let currentFile: File | null = null;
let currentInspection: InspectionResult | null = null;
let cleanedUrl: string | null = null;

app.innerHTML = `
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Nullmeta home">
        <span class="brand-mark" aria-hidden="true"><span></span></span>
        <span>Nullmeta</span>
      </a>
      <nav class="topnav" aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="https://github.com/NewFranklys/Nullmeta" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>

    <main>
      <section class="hero">
        <div class="eyebrow"><span class="status-dot"></span> Runs entirely on your device</div>
        <h1>Your file.<br /><span>Nothing else.</span></h1>
        <p class="hero-copy">
          Inspect hidden image metadata, understand what it can reveal, and remove it before you share.
          No upload. No account. No tracking.
        </p>

        <div class="drop-card" id="drop-card">
          <input id="file-input" type="file" accept="image/jpeg,image/png,image/webp" hidden />
          <button class="drop-zone" id="drop-zone" type="button">
            <span class="upload-icon" aria-hidden="true">↑</span>
            <strong>Drop an image here</strong>
            <span>or click to choose a file</span>
            <small>JPEG, PNG or WebP · processed locally</small>
          </button>
        </div>

        <p class="privacy-line">
          <span aria-hidden="true">◉</span>
          Your file never leaves this browser tab.
        </p>
      </section>

      <section class="workspace hidden" id="workspace" aria-live="polite">
        <div class="file-card">
          <div class="file-preview-wrap">
            <img id="file-preview" class="file-preview" alt="Selected image preview" />
          </div>
          <div class="file-info">
            <span class="section-label">Selected file</span>
            <h2 id="file-name"></h2>
            <p id="file-details"></p>
          </div>
          <button class="secondary-button" id="choose-another" type="button">Choose another</button>
        </div>

        <div class="scan-state" id="scan-state">
          <span class="spinner" aria-hidden="true"></span>
          <div>
            <strong>Inspecting metadata…</strong>
            <span>Nothing is being uploaded.</span>
          </div>
        </div>

        <div class="results hidden" id="results">
          <div class="result-summary">
            <div>
              <span class="section-label">Privacy scan</span>
              <h2 id="summary-title"></h2>
              <p id="summary-copy"></p>
            </div>
            <div class="risk-counts" id="risk-counts"></div>
          </div>

          <div class="metadata-panel">
            <div class="panel-heading">
              <div>
                <span class="section-label">Inside this file</span>
                <h3>Metadata found</h3>
              </div>
              <span class="metadata-total" id="metadata-total"></span>
            </div>
            <div class="metadata-list" id="metadata-list"></div>
          </div>

          <div class="clean-panel">
            <div>
              <span class="section-label">Ready to share?</span>
              <h3>Make a clean copy.</h3>
              <p>Nullmeta re-encodes the image locally, removing embedded metadata from the new copy.</p>
            </div>
            <button class="primary-button" id="clean-button" type="button">
              Remove metadata
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div class="success-panel hidden" id="success-panel">
            <div class="success-icon" aria-hidden="true">✓</div>
            <div>
              <span class="section-label">Clean copy ready</span>
              <h3>Metadata removed.</h3>
              <p id="success-copy"></p>
            </div>
            <a class="primary-button download-button" id="download-button" href="#" download>
              Download clean file
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>

        <div class="error-panel hidden" id="error-panel"></div>
      </section>

      <section class="principles" id="how-it-works">
        <article>
          <span>01</span>
          <h3>Inspect</h3>
          <p>See hidden information such as GPS coordinates, device details, software and timestamps.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Understand</h3>
          <p>Nullmeta highlights fields that may reveal where, when, or with what a file was created.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Clean</h3>
          <p>Create a fresh copy in your browser without sending the original file to a server.</p>
        </article>
      </section>
    </main>

    <footer>
      <span>Nullmeta v0.1</span>
      <span>Open source · MIT</span>
    </footer>
  </div>
`;

const fileInput = document.querySelector<HTMLInputElement>('#file-input')!;
const dropZone = document.querySelector<HTMLButtonElement>('#drop-zone')!;
const workspace = document.querySelector<HTMLElement>('#workspace')!;
const preview = document.querySelector<HTMLImageElement>('#file-preview')!;
const fileName = document.querySelector<HTMLElement>('#file-name')!;
const fileDetails = document.querySelector<HTMLElement>('#file-details')!;
const chooseAnother = document.querySelector<HTMLButtonElement>('#choose-another')!;
const scanState = document.querySelector<HTMLElement>('#scan-state')!;
const results = document.querySelector<HTMLElement>('#results')!;
const summaryTitle = document.querySelector<HTMLElement>('#summary-title')!;
const summaryCopy = document.querySelector<HTMLElement>('#summary-copy')!;
const riskCounts = document.querySelector<HTMLElement>('#risk-counts')!;
const metadataTotal = document.querySelector<HTMLElement>('#metadata-total')!;
const metadataList = document.querySelector<HTMLElement>('#metadata-list')!;
const cleanButton = document.querySelector<HTMLButtonElement>('#clean-button')!;
const successPanel = document.querySelector<HTMLElement>('#success-panel')!;
const successCopy = document.querySelector<HTMLElement>('#success-copy')!;
const downloadButton = document.querySelector<HTMLAnchorElement>('#download-button')!;
const errorPanel = document.querySelector<HTMLElement>('#error-panel')!;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function riskBadge(entry: MetadataEntry): string {
  const labels = { high: 'Sensitive', medium: 'Private detail', low: 'Technical' };
  return `<span class="risk-badge risk-${entry.risk}">${labels[entry.risk]}</span>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;',
    };
    return entities[character];
  });
}

function renderInspection(inspection: InspectionResult): void {
  currentInspection = inspection;
  const total = inspection.entries.length;
  const sensitive = inspection.highRiskCount;

  if (total === 0) {
    summaryTitle.textContent = 'No readable metadata found.';
    summaryCopy.textContent = 'This image appears to contain no metadata that Nullmeta can currently read.';
  } else if (sensitive > 0) {
    summaryTitle.textContent = `${sensitive} sensitive ${sensitive === 1 ? 'detail' : 'details'} found.`;
    summaryCopy.textContent = 'Review the highlighted fields before sharing this image publicly.';
  } else {
    summaryTitle.textContent = `${total} metadata ${total === 1 ? 'field' : 'fields'} found.`;
    summaryCopy.textContent = 'No high-risk field was detected, but the file still contains embedded technical details.';
  }

  riskCounts.innerHTML = `
    <span class="count-pill risk-high"><strong>${inspection.highRiskCount}</strong> sensitive</span>
    <span class="count-pill risk-medium"><strong>${inspection.mediumRiskCount}</strong> private</span>
    <span class="count-pill risk-low"><strong>${inspection.lowRiskCount}</strong> technical</span>
  `;

  metadataTotal.textContent = `${total} ${total === 1 ? 'field' : 'fields'}`;
  metadataList.innerHTML = total
    ? inspection.entries.map((entry) => `
        <div class="metadata-row">
          <div class="metadata-main">
            <div class="metadata-name">
              <strong>${escapeHtml(entry.label)}</strong>
              ${riskBadge(entry)}
            </div>
            <span class="metadata-value">${escapeHtml(entry.value)}</span>
          </div>
          <p>${escapeHtml(entry.reason)}</p>
        </div>
      `).join('')
    : `<div class="empty-state">Nothing readable to show.</div>`;

  scanState.classList.add('hidden');
  results.classList.remove('hidden');
}

function showError(message: string): void {
  scanState.classList.add('hidden');
  results.classList.add('hidden');
  errorPanel.textContent = message;
  errorPanel.classList.remove('hidden');
}

function resetDownload(): void {
  if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
  cleanedUrl = null;
  successPanel.classList.add('hidden');
  downloadButton.removeAttribute('href');
}

async function selectFile(file: File): Promise<void> {
  const supported = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supported.includes(file.type)) {
    workspace.classList.remove('hidden');
    showError('Nullmeta v0.1 currently supports JPEG, PNG, and WebP images.');
    return;
  }

  currentFile = file;
  currentInspection = null;
  resetDownload();
  errorPanel.classList.add('hidden');
  results.classList.add('hidden');
  scanState.classList.remove('hidden');
  workspace.classList.remove('hidden');

  fileName.textContent = file.name;
  fileDetails.textContent = `${file.type.replace('image/', '').toUpperCase()} · ${formatBytes(file.size)}`;

  const previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.onload = () => {
    fileDetails.textContent = `${file.type.replace('image/', '').toUpperCase()} · ${preview.naturalWidth} × ${preview.naturalHeight} · ${formatBytes(file.size)}`;
    URL.revokeObjectURL(previewUrl);
  };

  workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const inspection = await inspectMetadata(file);
    renderInspection(inspection);
  } catch (error) {
    console.error(error);
    showError('Nullmeta could not inspect this image. The file may be damaged or use unsupported metadata.');
  }
}

async function makeCleanCopy(): Promise<void> {
  if (!currentFile) return;

  cleanButton.disabled = true;
  cleanButton.innerHTML = '<span class="button-spinner"></span> Cleaning locally…';

  try {
    const { blob, filename } = await cleanImageMetadata(currentFile);
    resetDownload();
    cleanedUrl = URL.createObjectURL(blob);
    downloadButton.href = cleanedUrl;
    downloadButton.download = filename;
    successCopy.textContent = `${filename} · ${formatBytes(blob.size)} · ready to download`;
    successPanel.classList.remove('hidden');
    successPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error(error);
    showError(error instanceof Error ? error.message : 'Could not create the clean copy.');
  } finally {
    cleanButton.disabled = false;
    cleanButton.innerHTML = 'Remove metadata <span aria-hidden="true">→</span>';
  }
}

dropZone.addEventListener('click', () => fileInput.click());
chooseAnother.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const [file] = Array.from(fileInput.files ?? []);
  if (file) void selectFile(file);
  fileInput.value = '';
});

for (const eventName of ['dragenter', 'dragover']) {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
  });
}

window.addEventListener('drop', (event) => {
  const [file] = Array.from(event.dataTransfer?.files ?? []);
  if (file) void selectFile(file);
});

cleanButton.addEventListener('click', () => void makeCleanCopy());

window.addEventListener('beforeunload', () => {
  if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
});
