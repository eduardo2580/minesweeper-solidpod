// Captures console errors/warnings and unhandled exceptions into a ring buffer.
// Install as early as possible (main.jsx) so nothing is missed.

const MAX_ENTRIES = 50;
const entries = [];

function push(level, message) {
  const ts = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  entries.push(`[${ts}] ${level}: ${message}`);
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function installErrorLog() {
  // console.error
  const origError = console.error.bind(console);
  console.error = (...args) => {
    push('ERROR', args.map(String).join(' '));
    origError(...args);
  };

  // console.warn
  const origWarn = console.warn.bind(console);
  console.warn = (...args) => {
    push('WARN', args.map(String).join(' '));
    origWarn(...args);
  };

  // Uncaught exceptions
  window.addEventListener('error', (e) => {
    push('UNCAUGHT', `${e.message} (${e.filename}:${e.lineno}:${e.colno})`);
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    push('UNHANDLED_REJECTION', String(e.reason));
  });
}

export function getErrorLog() {
  return entries.length > 0 ? entries.join('\n') : '(none)';
}
