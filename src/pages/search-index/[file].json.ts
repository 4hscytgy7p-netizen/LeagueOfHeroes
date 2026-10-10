import type { APIRoute } from 'astro';
import { getSearchCatalog } from '../../data/search/catalog.ts';
export const prerender = true;
export function getStaticPaths() { return ['manifest', 'titles', 'catalog'].map(file => ({ params: { file } })); }
export const GET: APIRoute = async ({ params }) => {
  const index = await getSearchCatalog();
  return new Response(JSON.stringify(index[params.file as keyof typeof index]), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
