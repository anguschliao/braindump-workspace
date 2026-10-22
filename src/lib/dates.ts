export function wallTime(iso:string|null,zone:string){
 if(!iso)return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
 const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function toInstant(local:string,zone:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new Error('Choose a date and time.');
 const naive=Date.parse(`${local}:00Z`);if(!Number.isFinite(naive))throw new Error('Choose a valid date and time.');
 // Sample offsets on both sides of possible DST changes; reject nonexistent/repeated wall times.
 const offsets=new Set<number>();for(const delta of [-86400000,0,86400000]){const instant=naive+delta;const displayed=wallTime(new Date(instant).toISOString(),zone);offsets.add(Date.parse(`${displayed}:00Z`)-instant);}
 const candidates=[...offsets].map(o=>new Date(naive-o).toISOString()).filter(i=>wallTime(i,zone)===local);
 if(candidates.length!==1)throw new Error(candidates.length?'This time occurs twice during a clock change. Choose a time outside that repeated hour.':'This time does not exist in that timezone. Choose another time.');
 return candidates[0];
}
