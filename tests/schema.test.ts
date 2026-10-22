import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operation,suggestion,hashtags } from '../src/lib/schema';
import { toInstant,wallTime } from '../src/lib/dates';
const base={kind:'task',title:'Call Alex',details:'',due_on:null,starts_at:null,ends_at:null,timezone:'America/Edmonton'};
test('reject invalid dates, timezone and reversed events',()=>{
 assert.equal(suggestion.safeParse({...base,due_on:'2026-02-30'}).success,false);
 assert.equal(suggestion.safeParse({...base,timezone:'Not/AZone'}).success,false);
 assert.equal(suggestion.safeParse({...base,kind:'event',starts_at:'2026-10-21T15:00:00-06:00',ends_at:'2026-10-21T14:00:00-06:00'}).success,false);
 assert.equal(suggestion.safeParse({...base,kind:'event'}).success,false);
 assert.equal(suggestion.safeParse({...base,due_on:'2026-10-21'}).success,true);
});
test('capture bounds and Unicode tag normalization',()=>{
 assert.equal(operation.safeParse({op:'capture',id:crypto.randomUUID(),body:' ',timezone:'UTC'}).success,false);
 assert.deepEqual(hashtags('#Home #home #café'),['home','café']);
});
test('calendar uses selected timezone and rejects DST gaps and repeats',()=>{
 assert.equal(toInstant('2026-10-21T14:00','America/Edmonton'),'2026-10-21T20:00:00.000Z');
 assert.equal(wallTime('2026-10-21T20:00:00.000Z','America/Edmonton'),'2026-10-21T14:00');
 assert.throws(()=>toInstant('2026-03-08T02:30','America/Edmonton'));
 assert.throws(()=>toInstant('2026-11-01T01:30','America/Edmonton'));
});
