import React, {useSyncExternalStore, useMemo} from 'react';
let revision=0;
const listeners=new Set<()=>void>();
const notify=()=>{revision++;listeners.forEach(fn=>fn())};
window.addEventListener('hashchange',notify);
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn)};
export function useLocation(){useSyncExternalStore(subscribe,()=>location.hash+'|'+revision);return location.hash.slice(1)||'/'}
export function useRouteRevision(){return useSyncExternalStore(subscribe,()=>revision)}
export function usePathname(){return useLocation().split('?')[0]}
export function useSearchParams(){const loc=useLocation();return useMemo(()=>new URLSearchParams(loc.split('?')[1]||''),[loc])}
export function navigate(href:string,replace=false){if(replace){history.replaceState(null,'','#'+href);notify()}else location.hash=href;window.scrollTo(0,0)}
const router={push:(href:string)=>navigate(href),replace:(href:string)=>navigate(href,true),refresh:notify,back:()=>history.back()};
export function useRouter(){return router}
export default function Link({href,children,onClick,prefetch,replace,scroll,...props}:any){const internal=typeof href==='string'&&href.startsWith('/');return <a {...props} href={internal?'#'+href:href} onClick={e=>{onClick?.(e);if(internal&&!e.defaultPrevented&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href,replace)}}}>{children}</a>}
