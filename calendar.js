/* RFC 5545 calendar output. UTC instants avoid requiring client time-zone tables.
   Wall-clock scheduling hours remain separate from elapsed DST hours. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./scheduling.js'):root.CuravelaScheduling);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CuravelaCalendar=api;
})(typeof globalThis==='undefined'?this:globalThis,function(R){
  'use strict';
  const formatters=new Map();
  function formatter(zone){
    if(!zone)throw new Error('Choose the care location time zone.');
    if(!formatters.has(zone)){
      if(formatters.size>100)formatters.clear();
      try{formatters.set(zone,new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));}catch{throw new Error('Choose a valid IANA time zone, such as America/Chicago.');}
    }
    return formatters.get(zone);
  }
  function wallAt(ms,zone){const parts={};formatter(zone).formatToParts(ms).forEach(p=>parts[p.type]=p.value);return Date.parse(parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute+':'+parts.second+'Z');}
  function toInstant(day,time,zone){
    const wanted=(R.dateNumber(day)+R.timeNumber(time))*60000;
    if(!Number.isFinite(wanted))throw new Error('A calendar shift has an invalid date or time.');
    // Observe both sides of any DST transition. Ambiguous fall times use the
    // first occurrence; nonexistent spring times use the pre-gap offset (RFC 5545).
    const offsets=[...new Set([-36,-12,0,12,36].map(h=>{const sample=wanted+h*3600000;return wallAt(sample,zone)-sample;}))];
    const matches=offsets.map(offset=>wanted-offset).filter(ms=>wallAt(ms,zone)===wanted).sort((a,b)=>a-b);
    if(matches.length)return matches[0];
    const shifted=offsets.map(offset=>wanted-offset).filter(ms=>wallAt(ms,zone)>wanted).sort((a,b)=>a-b);
    if(!shifted.length)throw new Error('Could not resolve a calendar shift time in '+zone+'.');
    return shifted[0];
  }
  function escape(value){return String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
  function fold(line){
    const result=[];let current='',bytes=0;
    for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>75){result.push(current);current=' ';bytes=1;}current+=char;bytes+=n;}
    result.push(current);return result.join('\r\n');
  }
  function stamp(value){return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}
  function serialize(rows,options){
    formatter(options.timeZone);
    const updated=stamp(options.updatedAt||Date.now()),sequence=Number.isInteger(options.sequence)?options.sequence:0;
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Curavela//Care Schedule//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:'+escape(options.name||'Curavela shifts'),'X-WR-TIMEZONE:'+escape(options.timeZone)];
    rows.forEach(row=>{
      const endDate=row.endTime<=row.startTime?R.addDays(row.dayKey,1):row.dayKey;
      const start=toInstant(row.dayKey,row.startTime,options.timeZone),end=toInstant(endDate,row.endTime,options.timeZone);
      if(end<=start)throw new Error('Check '+row.dayKey+' '+row.shiftName+': its calendar end must follow its start across daylight saving time.');
      lines.push('BEGIN:VEVENT','UID:'+encodeURIComponent((options.scope||'local')+':'+row.key)+'@curavela','DTSTAMP:'+updated,'SEQUENCE:'+sequence,'DTSTART:'+stamp(start),'DTEND:'+stamp(end),'SUMMARY:'+escape(row.shiftName+' · Curavela'),'DESCRIPTION:'+escape('Schedule times: '+options.timeZone+'. Check Curavela for current details and acknowledge schedule updates there.'),'STATUS:'+(row.cancelled?'CANCELLED':'CONFIRMED'),'TRANSP:OPAQUE','END:VEVENT');
    });
    lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
  }
  return {toInstant,serialize};
});
