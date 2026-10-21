const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('offline cache handles only approved GET app assets and bypasses private/API requests',async()=>{
 const events={},network=[],cached=[];
 const scope={location:{href:'https://example.test/curavela/sw.js'},addEventListener:(type,fn)=>events[type]=fn};
 const context=vm.createContext({self:scope,URL,Set,Promise,fetch:async request=>{network.push(request.url);return 'network';},caches:{open:async()=>({match:async request=>{cached.push(request.url);return 'static';},addAll:async()=>{}}),keys:async()=>[]}});
 vm.runInContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),context);
 for(const [method,path] of [['GET','api/session'],['GET','api/calendar/private.ics'],['PUT','api/draft'],['GET','index.html?invite=secret'],['POST','script.js'],['GET','https://other.test/script.js']]){
  let intercepted=false;events.fetch({request:{method,url:new URL(path,'https://example.test/curavela/').href},respondWith(){intercepted=true;}});assert.equal(intercepted,false,path);
 }
 let pending;events.fetch({request:{method:'GET',url:'https://example.test/curavela/script.js'},respondWith(value){pending=value;}});assert.equal(await pending,'static');assert.equal(cached.length,1);assert.equal(network.length,0);
 assert.equal(typeof scope.skipWaiting,'undefined');
});
