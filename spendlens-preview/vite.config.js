import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const here = (path) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({base:'./',plugins:[react()],resolve:{alias:[
  {find:'next/link',replacement:here('./preview/router.tsx')},
  {find:'next/navigation',replacement:here('./preview/router.tsx')},
  {find:'@/lib/server/data',replacement:here('./preview/data.ts')},
  {find:'@/lib/server/behavior',replacement:here('./preview/behavior.ts')},
  {find:'@/lib/db/accounts',replacement:here('./preview/data.ts')},
  {find:'@/lib/db/settings',replacement:here('./preview/data.ts')},
  {find:'@/lib/db/repository',replacement:here('./preview/data.ts')},
  {find:'@/lib/db/splits',replacement:here('./preview/data.ts')},
  {find:'@/services/chat/summary',replacement:here('./preview/summary.ts')},
  {find:'@',replacement:here('./src')}
]},build:{outDir:'../assets/spendlens-app',emptyOutDir:true}});
