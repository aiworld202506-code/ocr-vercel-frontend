# Document OCR frontend

This folder is a complete, standalone source repository for GitHub and Vercel.

It contains:

```text
src/          Frontend HTML, CSS, and JavaScript source
build.mjs     Build script
package.json  Build command
vercel.json   Vercel output and security-header configuration
```

Set this Vercel Production environment variable:

```text
OCR_API_BASE_URL=https://api.xyzcool.xyz
```

Then assign the Vercel project domain:

```text
ocr.xyzcool.xyz
```

Build command:

```text
npm run build
```

Output directory:

```text
dist
```

For GitHub deployment:

1. Extract this package into a new Git repository.
2. Commit and push all files except `dist/`, which is ignored.
3. Import that GitHub repository into Vercel.
4. Set `OCR_API_BASE_URL` in Vercel.
5. Vercel automatically runs `npm run build` for every deployment.
