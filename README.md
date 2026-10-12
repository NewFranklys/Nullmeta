# Nullmeta

**Your file. Nothing else.**

Nullmeta is a privacy-first metadata inspector and cleaner that runs entirely in your browser. Drop an image, review the hidden information stored inside it, and create a clean copy before sharing.

## Why Nullmeta?

Images can contain information you did not intentionally share: GPS coordinates, device model, software, timestamps, author fields, and other technical metadata. Nullmeta makes that information visible and helps you remove it without uploading the original file to a server.

## v0.1

- Inspect metadata in JPEG, PNG, and WebP images.
- Highlight potentially sensitive fields such as GPS, identity, device, software, and timestamps.
- Re-encode supported images locally to create a metadata-free copy.
- No account, backend, analytics, or file upload.
- Responsive, dependency-light interface.

> Cleaning an image creates a newly encoded copy. JPEG and WebP files may differ slightly in file size or compression from the original.

## Run locally

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Privacy model

File bytes are processed by browser APIs on the user's device. Nullmeta v0.1 does not send selected files to a server. The app uses [`exifr`](https://github.com/MikeKovarik/exifr) to read image metadata locally.

## Roadmap

- Verify the generated clean copy with a second metadata scan.
- Add HEIC/HEIF support where browser capabilities allow it.
- Add PDF metadata inspection and cleaning.
- Add batch processing.
- Add optional advanced/raw metadata view.
- Publish a public hosted instance.

## License

MIT
