# HomeTools

PWA personnelle de gestion financière et d'archives documentaires (Vue 3, TypeScript, Vite),
publiée sur GitHub Pages : https://mikel-kel.github.io/HomeTools/

## Stockage

- **Local Drive** : dossier HomeTools du Mac, via la File System Access API (Chrome ou Edge sur macOS).
- **Object Storage** : bucket S3 Hetzner, toujours via le proxy du Mac (Mac et iPad).

## Développement

- `npm run dev` : serveur local sur http://localhost:5173
- `npm run build` : type-check (`vue-tsc`) puis build de production

La configuration du proxy se trouve dans `.env.local` (non versionné). Toute variable `VITE_*` est publiée en clair dans le bundle.
