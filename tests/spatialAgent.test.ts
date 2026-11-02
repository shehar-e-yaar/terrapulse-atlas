import {describe,it,expect,vi} from 'vitest';
import {places} from '../src/data/lahoreSpatialData';
import {planQuery,runSpatialAgent} from '../src/services/spatialThinkingAgent';
import {calculateRoute,distance,nearestGreen} from '../src/services/awsLocationService';
describe('real-place dataset',()=>{
it('has traceable real coordinates and explicitly modeled environmental values',()=>{expect(places.length).toBeGreaterThan(50);expect(new Set(places.map(p=>p.id)).size).toBe(places.length);for(const p of places){expect(p.coordinates[0]).toBeGreaterThan(74);expect(p.coordinates[0]).toBeLessThan(75);expect(p.coordinates[1]).toBeGreaterThan(31);expect(p.coordinates[1]).toBeLessThan(32);expect(p.source_url).toMatch(/^https:\/\/www.openstreetmap.org/);expect(p.heat_kind).toBe('modeled');expect(p.observed_at).toBeNull();}});
});
describe('six diverse natural language queries',()=>{
it('finds Shahdara and routing intent',()=>{const p=planQuery('Find a cooler place near Shahdara',places);expect(p.target?.name).toContain('Shahdara');expect(p.routing).toBe(true);expect(p.matches.length).toBeGreaterThan(0);});
it('selects industrial and canal comparison',()=>{expect(planQuery('Compare industrial and canal temperatures',places).compare).toBe(true);});
it('filters canopy strictly below 10%',()=>{const p=planQuery('Show places with less than 10% canopy',places);expect(p.matches.length).toBeGreaterThan(0);expect(p.matches.every(r=>r.canopy_pct<10)).toBe(true);});
it('finds UVAS campus',()=>{expect(planQuery('Explore UVAS campus',places).target?.name).toBe('UVAS Campus');});
it('filters temperature above 43',()=>{const p=planQuery('Show temperature above 43°C',places);expect(p.matches.length).toBeGreaterThan(0);expect(p.matches.every(r=>r.temp_c>43)).toBe(true);});
it('filters temperatures below 38',()=>{const p=planQuery('Show temperatures below 38',places);expect(p.matches.length).toBeGreaterThan(0);expect(p.matches.every(r=>r.temp_c<38)).toBe(true);});
it('preserves no-match results',()=>{expect(planQuery('Temperature above 100',places).matches).toHaveLength(0);});
it('handles unsupported requests honestly',()=>{expect(planQuery('Write me a love poem',places).recognized).toBe(false);});
});
describe('spatial orchestration',()=>{
it('ranks nearest park by geographic distance and labels fallback',async()=>{const from=places.find(p=>p.name==='UVAS Campus')!,to=nearestGreen(from,places)!;expect(to.kind).toBe('park');for(const p of places.filter(p=>p.kind==='park'))expect(distance(from.coordinates,to.coordinates)).toBeLessThanOrEqual(distance(from.coordinates,p.coordinates)+1e-9);const r=await calculateRoute(from,to);expect(r.provider).toBe('Straight-line estimate');expect(r.durationMin).toBeNull();expect(r.coordinates).toEqual([from.coordinates,to.coordinates]);});
it('executes four operations, filters and controls the map',async()=>{const actions={fly:vi.fn(),filter:vi.fn(),layers:vi.fn(),route:vi.fn()},steps=vi.fn();const r=await runSpatialAgent('Find a cooler place near Shahdara',places,actions,steps);expect(actions.fly).toHaveBeenCalled();expect(actions.filter).toHaveBeenCalled();expect(actions.route).toHaveBeenCalledOnce();expect(r.citations).toHaveLength(2);expect(r.answer).toContain('straight line');expect(steps.mock.calls.at(-1)?.[0]).toHaveLength(4);expect(steps.mock.calls.at(-1)?.[0].every((s:{status:string})=>s.status==='done')).toBe(true);});
it('returns numerical comparison grounded in records',async()=>{const r=await runSpatialAgent('Compare industrial and canal temperatures',places,{fly:vi.fn(),filter:vi.fn(),layers:vi.fn(),route:vi.fn()},()=>{});expect(r.answer).toContain('average');expect(r.citations).toHaveLength(2);expect(r.answer).toContain('illustrative');});
it('cancels before map side effects',async()=>{const c=new AbortController();c.abort();const a={fly:vi.fn(),filter:vi.fn(),layers:vi.fn(),route:vi.fn()};await expect(runSpatialAgent('Explore UVAS',places,a,()=>{},c.signal)).rejects.toThrow('Cancelled');expect(a.fly).not.toHaveBeenCalled();});
});
