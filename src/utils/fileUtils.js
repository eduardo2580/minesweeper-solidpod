/** File type detection and formatting utilities */

const EXT_MAP = {
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  svg: 'image', bmp: 'image', ico: 'image', tiff: 'image', avif: 'image',
  // Video
  mp4: 'video', webm: 'video', ogg: 'video', mov: 'video', avi: 'video',
  mkv: 'video', ogv: 'video',
  // Audio
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', oga: 'audio',
  m4a: 'audio', opus: 'audio',
  // Documents
  pdf: 'pdf',
  doc: 'word', docx: 'word',
  xls: 'excel', xlsx: 'excel',
  ppt: 'powerpoint', pptx: 'powerpoint',
  // Text / code
  txt: 'text', md: 'text', rst: 'text', csv: 'text',
  js: 'code', ts: 'code', jsx: 'code', tsx: 'code',
  html: 'code', htm: 'code', css: 'code', json: 'code',
  xml: 'code', ttl: 'code', n3: 'code', rdf: 'code', jsonld: 'code',
  py: 'code', rb: 'code', java: 'code', cpp: 'code', c: 'code',
  sh: 'code', yml: 'code', yaml: 'code', toml: 'code',
  // Archives
  zip: 'archive', tar: 'archive', gz: 'archive', bz2: 'archive', rar: 'archive',
  '7z': 'archive',
};

const TYPE_META = {
  folder:     { label: 'Folder',      color: '#FFB900', bgColor: '#FFF8E1' },
  image:      { label: 'Image',       color: '#0F9D58', bgColor: '#E8F5E9' },
  video:      { label: 'Video',       color: '#DB4437', bgColor: '#FDECEA' },
  audio:      { label: 'Audio',       color: '#9C27B0', bgColor: '#F3E5F5' },
  pdf:        { label: 'PDF',         color: '#DB4437', bgColor: '#FDECEA' },
  word:       { label: 'Document',    color: '#1A73E8', bgColor: '#E8F0FE' },
  excel:      { label: 'Spreadsheet', color: '#0F9D58', bgColor: '#E8F5E9' },
  powerpoint: { label: 'Presentation',color: '#FF6D00', bgColor: '#FFF3E0' },
  text:       { label: 'Text',        color: '#5F6368', bgColor: '#F1F3F4' },
  code:       { label: 'Code',        color: '#1A73E8', bgColor: '#E8F0FE' },
  archive:    { label: 'Archive',     color: '#795548', bgColor: '#EFEBE9' },
  file:       { label: 'File',        color: '#5F6368', bgColor: '#F1F3F4' },
};

// SVG path data for icons
const ICONS = {
  folder: `<path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="currentColor"/>`,
  image: `<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>`,
  video: `<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" fill="currentColor"/>`,
  audio: `<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor"/>`,
  pdf:   `<path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" fill="currentColor"/>`,
  word:  `<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 9h-2v2h2v1h-2v2H9v-2H7v-1h2v-2H7v-1h7v1zm1-7.5L17.5 7H14V3.5z" fill="currentColor"/>`,
  excel: `<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7h3v1h-3v-1zm0 2h3v1h-3v-1zm0 2h3v1h-3v-1zm-5-6h5v2H8V7zm0 3h2v1H8v-1zm0 2h2v1H8v-1zm0 2h2v1H8v-1zm0 2h5v1H8v-1zm6-1.5L17.5 7H14V3.5z" fill="currentColor"/>`,
  text:  `<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>`,
  code:  `<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" fill="currentColor"/>`,
  archive:`<path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.99 16.01 1 13.65 1c-1.3 0-2.48.56-3.33 1.44L10 2.77l-.32-.33C8.83 1.56 7.65 1 6.35 1 3.99 1 2 2.99 2 5.35 2 5.82 2.11 6.26 2.18 6.7H2C.9 6.7 0 7.6 0 8.7v3c.11 1.07.79 1.97 1.74 2.47l-.36.7C1.14 15.3 1 15.78 1 16.3 1 17.97 2.37 19.3 4 19.3h16c1.66 0 3-1.34 3-3 0-.41-.08-.82-.22-1.19l-.36-.7A3.01 3.01 0 0 0 24 11.7v-3c0-1.1-.9-2-2-2zm-9 1l-.97-1C9.72 5.33 10.2 5 10.7 5c.6 0 1.08.36 1.26.86L11 7h-1v-.3c0-.38-.21-.7-.6-.7zM13 7h-1l.96-1.14c.18-.5.66-.86 1.26-.86.5 0 .98.33 1.27.8L14.27 7H13zm7 9H4c-.55 0-1-.45-1-1 0-.33.17-.62.43-.79l.57-.35V13h16v1.5l.55.33c.28.17.45.47.45.8 0 .56-.45 1.02-1 1.02H20V16z" fill="currentColor"/>`,
  file:  `<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" fill="currentColor"/>`,
};

export function getFileType(name, isFolder = false) {
  if (isFolder) return 'folder';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MAP[ext] ?? 'file';
}

export function getFileMeta(name, isFolder = false) {
  const type = getFileType(name, isFolder);
  return { type, ...TYPE_META[type] };
}

export function getIconSvg(type) {
  const path = ICONS[type] ?? ICONS.file;
  return path;
}

export function formatSize(bytes) {
  if (bytes == null) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(date instanceof Date ? date : new Date(date));
}

export function getFileExtension(name) {
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}

export function isPreviewable(name, isFolder = false) {
  if (isFolder) return false;
  const type = getFileType(name);
  return ['image', 'video', 'audio', 'text', 'code', 'pdf'].includes(type);
}

export function isText(name) {
  const type = getFileType(name);
  return type === 'text' || type === 'code';
}

export function sanitizeFolderName(name) {
  return name.trim().replace(/[/\\?%*:|"<>]/g, '_');
}

export function buildFileName(containerUrl, name) {
  const base = containerUrl.endsWith('/') ? containerUrl : containerUrl + '/';
  return base + encodeURIComponent(name);
}

export function buildContainerUrl(parentUrl, name) {
  const base = parentUrl.endsWith('/') ? parentUrl : parentUrl + '/';
  return base + encodeURIComponent(sanitizeFolderName(name)) + '/';
}
