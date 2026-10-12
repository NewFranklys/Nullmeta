import { parse } from 'exifr';

export type RiskLevel = 'high' | 'medium' | 'low';

export interface MetadataEntry {
  key: string;
  label: string;
  value: string;
  risk: RiskLevel;
  reason: string;
}

export interface InspectionResult {
  entries: MetadataEntry[];
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

const HIGH_RISK_KEYS = [
  'latitude',
  'longitude',
  'gpslatitude',
  'gpslongitude',
  'gpsposition',
  'location',
  'ownername',
  'artist',
  'author',
  'creator',
  'copyright',
];

const MEDIUM_RISK_KEYS = [
  'make',
  'model',
  'lensmodel',
  'lensmake',
  'software',
  'datetimeoriginal',
  'createdate',
  'modifydate',
  'datetime',
  'serialnumber',
  'bodyserialnumber',
  'lensserialnumber',
  'hostname',
];

const FRIENDLY_LABELS: Record<string, string> = {
  latitude: 'GPS latitude',
  longitude: 'GPS longitude',
  make: 'Device manufacturer',
  model: 'Device model',
  lensmodel: 'Lens model',
  software: 'Software',
  datetimeoriginal: 'Date taken',
  createdate: 'Created',
  modifydate: 'Modified',
  artist: 'Artist / author',
  author: 'Author',
  creator: 'Creator',
  copyright: 'Copyright',
  orientation: 'Orientation',
  width: 'Width',
  height: 'Height',
  imagewidth: 'Image width',
  imageheight: 'Image height',
  exposuretime: 'Exposure time',
  fnumber: 'Aperture',
  iso: 'ISO',
  focallength: 'Focal length',
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function humanizeKey(key: string): string {
  const normalized = normalizeKey(key);
  if (FRIENDLY_LABELS[normalized]) return FRIENDLY_LABELS[normalized];

  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function classifyRisk(key: string): Pick<MetadataEntry, 'risk' | 'reason'> {
  const normalized = normalizeKey(key);

  if (HIGH_RISK_KEYS.some((candidate) => normalized.includes(candidate))) {
    return {
      risk: 'high',
      reason: normalized.includes('gps') || normalized.includes('latitude') || normalized.includes('longitude')
        ? 'Can reveal where the file was created.'
        : 'Can reveal personal identity information.',
    };
  }

  if (MEDIUM_RISK_KEYS.some((candidate) => normalized.includes(candidate))) {
    return {
      risk: 'medium',
      reason: 'Can reveal device, software, time, or hardware details.',
    };
  }

  return {
    risk: 'low',
    reason: 'Technical metadata stored inside the file.',
  };
}

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toLocaleString();
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const output = String(value).trim();
    return output.length > 240 ? `${output.slice(0, 237)}…` : output;
  }

  if (Array.isArray(value)) {
    if (value.length > 20) return `[${value.length} values]`;
    const values = value.map(stringifyValue).filter((entry): entry is string => Boolean(entry));
    return values.length ? values.join(', ') : null;
  }

  if (typeof value === 'object') {
    try {
      const output = JSON.stringify(value);
      return output.length > 240 ? `${output.slice(0, 237)}…` : output;
    } catch {
      return null;
    }
  }

  return null;
}

export async function inspectMetadata(file: File): Promise<InspectionResult> {
  const raw = await parse(file, {
    tiff: true,
    exif: true,
    gps: true,
    xmp: true,
    iptc: true,
    icc: true,
  });

  const entries = Object.entries((raw ?? {}) as Record<string, unknown>)
    .map(([key, rawValue]): MetadataEntry | null => {
      const value = stringifyValue(rawValue);
      if (!value) return null;

      const classification = classifyRisk(key);
      return {
        key,
        label: humanizeKey(key),
        value,
        ...classification,
      };
    })
    .filter((entry): entry is MetadataEntry => entry !== null)
    .sort((a, b) => {
      const score = { high: 0, medium: 1, low: 2 } as const;
      return score[a.risk] - score[b.risk] || a.label.localeCompare(b.label);
    });

  return {
    entries,
    highRiskCount: entries.filter((entry) => entry.risk === 'high').length,
    mediumRiskCount: entries.filter((entry) => entry.risk === 'medium').length,
    lowRiskCount: entries.filter((entry) => entry.risk === 'low').length,
  };
}

function cleanedFilename(name: string, mimeType: string): string {
  const extensionByMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const extension = extensionByMime[mimeType] ?? (dotIndex > 0 ? name.slice(dotIndex + 1) : 'image');
  return `${base}-clean.${extension}`;
}

export async function cleanImageMetadata(file: File): Promise<{ blob: Blob; filename: string }> {
  const supported = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supported.includes(file.type)) {
    throw new Error('Cleaning currently supports JPEG, PNG, and WebP images.');
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Your browser could not create a local image canvas.');
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const quality = file.type === 'image/jpeg' || file.type === 'image/webp' ? 0.96 : undefined;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('Could not create the cleaned image.')),
      file.type,
      quality,
    );
  });

  return {
    blob,
    filename: cleanedFilename(file.name, file.type),
  };
}
