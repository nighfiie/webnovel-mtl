import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/public-catalog.functions', () => ({ readPublicCatalog: vi.fn() }));
import { rankNovels, catalogLabels } from '@/lib/public-catalog';
const novels = [
  {title:'Alpha', weekly_views:50,view_count:500,rating:4.2},
  {title:'Beta', weekly_views:100,view_count:200,rating:4.8},
];
describe('discovery data',()=>{
  it('ranks by weekly views',()=>expect(rankNovels(novels,'weekly').map(n=>n.title)).toEqual(['Beta','Alpha']));
  it('ranks all-time views separately',()=>expect(rankNovels(novels,'popular').map(n=>n.title)).toEqual(['Alpha','Beta']));
  it('ranks ratings',()=>expect(rankNovels(novels,'rating').map(n=>n.title)).toEqual(['Beta','Alpha']));
  it('counts each novel once per genre even when category repeats it',()=>{
    expect(catalogLabels([{category:'Fantasy',genres:['Fantasy','Action']},{category:'Fantasy',genres:['Fantasy']}])).toEqual([{label:'Fantasy',count:2},{label:'Action',count:1}]);
  });
});
