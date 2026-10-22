const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const source=path.join(__dirname,'../ai-review.js');
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function service(storage=store(),fetchImpl=async()=>({ok:true,json:async()=>({valid:true,depth:300,explanation:'Valid answer.'})}),getOpenRouterKey=()=>null){
  assert.ok(fs.existsSync(source),'Persistent AI settings module is missing');
  return require(source).createReviewer({storage,fetchImpl,baseURL:'https://ssolarii.github.io/school/deepdive/',getOpenRouterKey});
}
const question={id:'language',prompt:'Name a programming language.',answers:[['Python',100],['Erlang',600]]};
const freeSettings={url:'https://openrouter.ai/api/v1/chat/completions',format:'openrouter',model:'nvidia/nemotron-3.5-lightning:free'};
const chat=(result={valid:true,depth:600,confidence:'high',explanation:'Erlang is a language.'})=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]})});

test('saved endpoint and format survive creating a fresh game service',()=>{
  const storage=store();
  service(storage).save({url:'https://review.example/api/judge',format:'reviewer',model:'deepseek-chat'});
  assert.equal(service(storage).getSettings().url,'https://review.example/api/judge');
});
test('existing custom endpoint migrates and reset persists',()=>{
  const storage=store();storage.setItem('deep-dive-judge-v1',JSON.stringify('http://127.0.0.1:8765/api/judge'));
  const ai=service(storage);assert.equal(ai.getSettings().url,'http://127.0.0.1:8765/api/judge');
  ai.reset();assert.equal(service(storage).getSettings().url,'');
});
test('unsafe endpoint URLs cannot replace a saved setting',()=>{
  const ai=service();ai.save({url:'https://safe.example/judge',format:'reviewer'});
  for(const url of ['javascript:alert(1)','http://remote.example/judge','//evil.example/judge','/\\evil.example/judge','https://name:password@example.com/judge'])assert.throws(()=>ai.save({url,format:'reviewer'}));
  assert.equal(ai.getSettings().url,'https://safe.example/judge');
});
test('storage failure is reported, never presented as a persistent save',()=>{
  const ai=service({getItem:()=>null,setItem:()=>{throw Error('Blocked')}});
  assert.throws(()=>ai.save({url:'https://review.example/judge',format:'reviewer'}),/storage/i);
});
test('OpenAI format requires its own endpoint rather than the reviewer default',()=>{
  assert.throws(()=>service().save({url:'',format:'openai'}),/URL/i);
});
test('reviewer requests use the saved URL and Deep Dive contract',async()=>{
  let sent;const ai=service(store(),async(url,options)=>{sent={url,options};return {ok:true,json:async()=>({valid:true,depth:600,explanation:'A language.'})};});
  ai.save({url:'http://127.0.0.1:8765/api/judge',format:'reviewer'});
  assert.equal((await ai.review(question,'Erlang')).depth,600);
  assert.equal(sent.url,'http://127.0.0.1:8765/api/judge');
  assert.equal(JSON.parse(sent.options.body).questionId,'language');
  assert.equal(sent.options.credentials,'omit');
  assert.equal(sent.options.targetAddressSpace,'loopback');
});
test('OpenAI-compatible request uses saved model and validates JSON reply',async()=>{
  let sent;const ai=service(store(),async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({valid:true,depth:600,confidence:'high',explanation:'Erlang is a language.'})}}]})};});
  ai.save({url:'https://router.example/v1/chat/completions',format:'openai',model:'deepseek-chat'});
  assert.equal((await ai.review(question,'Erlang')).depth,600);
  assert.equal(sent.model,'deepseek-chat');assert.equal(sent.thinking,false);
  assert.equal(JSON.parse(sent.messages[1].content).visitor_answer,'Erlang');
});
test('uncertain or malformed model output cannot award points',async()=>{
  for(const content of [JSON.stringify({valid:true,depth:1000,confidence:'medium',explanation:'Maybe.'}),JSON.stringify({valid:'true',depth:600,confidence:'high',explanation:'Wrong shape.'}),'not JSON']){
    const ai=service(store(),async()=>({ok:true,json:async()=>({choices:[{message:{content}}]})}));
    ai.save({url:'https://router.example/chat',format:'openai'});
    try{assert.equal((await ai.review(question,'Erlang')).needsReview,true);}catch(error){assert.notEqual(error.code,'ERR_ASSERTION');}
  }
});

test('expired bridge login is reported rather than a generic connection error',async()=>{
  const ai=service(store(),async()=>({ok:false,status:503,json:async()=>({primaryStatus:'login_required',fallbackStatus:'not_configured'})}));
  await assert.rejects(()=>ai.review(question,'Erlang'),/login expired/);
});

test('connection probe explicitly bypasses the local model cache',async()=>{
  let sent;const ai=service(store(),async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({valid:true,depth:600,explanation:'A language.'})};});
  await ai.review(question,'Erlang',{probe:true});
  assert.equal(sent.probe,true);
});

test('free staff credentials only go to the canonical OpenRouter URL',async()=>{
  const requests=[];let keyReads=0;
  const ai=service(store(),async(url,options)=>{requests.push({url,options});return chat();},()=>{keyReads++;return 'staff-test-key';});
  ai.save(freeSettings);
  assert.equal((await ai.review(question,'Erlang')).depth,600);
  assert.equal(requests[0].url,freeSettings.url);
  assert.equal(requests[0].options.headers.Authorization,'Bearer staff-test-key');
  assert.equal(requests[0].options.redirect,'error');
  assert.equal(requests[0].options.credentials,'omit');
  for(const url of ['https://openrouter.ai.example/api/v1/chat/completions','https://openrouter.ai/api/v1/chat/completions?key=anything','https://openrouter.ai/api/v1/chat/completions#key','/api/v1/chat/completions']){
    await assert.rejects(()=>ai.review(question,'Erlang',{settings:{...freeSettings,url}}),/official/);
  }
  const keyReadsBeforeCustom=keyReads;
  await ai.review(question,'Erlang',{settings:{url:'https://custom.example/chat',format:'openai',model:'custom-model'}});
  assert.equal(requests[1].options.headers.Authorization,undefined);
  assert.equal(keyReads,keyReadsBeforeCustom);
});

test('free mode fixes both model choices and zero price caps without persisting secrets',async()=>{
  const storage=store();let body;
  const ai=service(storage,async(url,options)=>{body=JSON.parse(options.body);return chat();},()=> 'runtime-only-staff-key');
  ai.save({...freeSettings,apiKey:'do-not-store-key',password:'do-not-store-password'});
  const saved=storage.getItem('deep-dive-ai-settings-v2');
  assert.ok(!saved.includes('do-not-store'));
  assert.ok(!saved.includes('runtime-only-staff-key'));
  assert.throws(()=>ai.save({...freeSettings,model:'openai/paid-model'}),/fixed free model/);
  await ai.review(question,'Erlang');
  assert.deepEqual(body.provider,{require_parameters:true,max_price:{prompt:0,completion:0,request:0,image:0}});
  assert.deepEqual(body.reasoning,{enabled:false});
  assert.deepEqual(body.plugins,[{id:'web',enabled:false}]);
  assert.equal(body.model,freeSettings.model);
  assert.equal(body.max_tokens,512);
  assert.equal(body.response_format,undefined);
  assert.ok(!JSON.stringify(body).includes('runtime-only-staff-key'));
});

test('free review switches provider after failure and validates the backup result',async()=>{
  const models=[];
  const ai=service(store(),async(url,options)=>{
    models.push(JSON.parse(options.body).model);
    return models.length===1?{ok:false,status:429,json:async()=>({error:{message:'Busy'}})}:chat();
  },()=> 'runtime-key');
  ai.save(freeSettings);
  assert.equal((await ai.review(question,'Erlang')).depth,600);
  assert.deepEqual(models,['nvidia/nemotron-3.5-lightning:free','cohere/north-mini-code:free']);
});

test('a low-confidence or uncertain free verdict never triggers another opinion',async()=>{
  for(const result of [{valid:true,depth:600,confidence:'low',explanation:'Not sure.'},{valid:true,depth:1000,confidence:'medium',explanation:'Not sure at that depth.'}]){
    let calls=0;const ai=service(store(),async()=>{calls++;return chat(result);},()=> 'runtime-key');
    ai.save(freeSettings);
    assert.equal((await ai.review(question,'Erlang')).needsReview,true);
    assert.equal(calls,1);
  }
});

test('a medium-confidence rejection asks a guide without retrying another model',async()=>{
  let calls=0;
  const ai=service(store(),async()=>{
    calls++;
    return chat({valid:false,depth:0,confidence:'medium',explanation:'This may not be a programming language.'});
  },()=> 'runtime-key');
  ai.save(freeSettings);
  assert.equal((await ai.review(question,'Erlang')).needsReview,true);
  assert.equal(calls,1);
});

test('an uncertain rejection must still have a valid review schema',async()=>{
  let calls=0;
  const ai=service(store(),async()=>{
    calls++;
    return chat({valid:false,depth:0,confidence:'medium',explanation:null});
  },()=> 'runtime-key');
  ai.save(freeSettings);
  await assert.rejects(()=>ai.review(question,'Erlang'),/invalid review/);
  assert.equal(calls,2);
});

test('a definite rejection is not retried, while malformed JSON cannot award a depth',async()=>{
  let calls=0;
  const rejecting=service(store(),async()=>{calls++;return chat({valid:false,depth:0,confidence:'high',explanation:'Not a programming language.'});},()=> 'runtime-key');
  rejecting.save(freeSettings);
  assert.equal((await rejecting.review(question,'nonsense')).valid,false);
  assert.equal(calls,1);
  const malformed=service(store(),async()=>chat({valid:'yes',depth:600,confidence:'high',explanation:'Wrong shape.'}),()=> 'runtime-key');
  malformed.save(freeSettings);
  await assert.rejects(()=>malformed.review(question,'nonsense'),/invalid review/);
});

test('locked staff access stops before any network call',async()=>{
  let calls=0;
  const ai=service(store(),async()=>{calls++;return chat();});
  ai.save(freeSettings);
  await assert.rejects(()=>ai.review(question,'Erlang'),/Table settings.*staff password/);
  assert.equal(calls,0);
});

test('locking or replacing staff access during a failed request prevents the backup request',async()=>{
  for(const changedKey of [null,'replacement-test-key']){
    let key='runtime-test-key',calls=0;
    const ai=service(store(),async()=>{
      calls++;
      if(calls===1){key=changedKey;return {ok:false,status:429,json:async()=>({error:{message:'Busy'}})};}
      return chat();
    },()=>key);
    ai.save(freeSettings);
    await assert.rejects(()=>ai.review(question,'Erlang'),/locked|staff access changed/i);
    assert.equal(calls,1);
  }
});

test('a pending valid response cannot award a verdict after staff access is locked or replaced',async()=>{
  for(const changedKey of [null,'replacement-test-key']){
    let key='runtime-test-key',finishRequest,calls=0;
    const ai=service(store(),async()=>{calls++;return new Promise(resolve=>{finishRequest=resolve;});},()=>key);
    ai.save(freeSettings);
    const result=ai.review(question,'Erlang');
    key=changedKey;finishRequest(chat());
    await assert.rejects(result,/locked|staff access changed/i);
    assert.equal(calls,1);
  }
});

test('outer cancellation interrupts a hanging response body without calling the backup',async()=>{
  const controller=new AbortController();let calls=0;
  const ai=service(store(),async()=>{calls++;return {ok:true,json:()=>new Promise(()=>{})};},()=> 'runtime-key');
  ai.save(freeSettings);
  const result=ai.review(question,'Erlang',{signal:controller.signal});
  controller.abort(new DOMException('Cancelled by staff.','AbortError'));
  await assert.rejects(result,{name:'AbortError'});
  assert.equal(calls,1);
});

test('the eight-second deadline includes a stalled response body',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const requests=[];
  const ai=service(store(),async(url,options)=>{
    requests.push(options);
    return requests.length===1?{ok:true,json:()=>new Promise(()=>{})}:chat();
  },()=> 'runtime-key');
  ai.save(freeSettings);
  const result=ai.review(question,'Erlang');
  await Promise.resolve();
  t.mock.timers.tick(7999);
  await Promise.resolve();assert.equal(requests.length,1);
  t.mock.timers.tick(1);
  assert.equal((await result).depth,600);
  assert.equal(requests[0].signal.aborted,true);
  assert.equal(requests.length,2);
});

test('reviewer and custom OpenAI requests allow the existing local fallback budget',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  for(const format of ['reviewer','openai']){
    let requestSignal;
    const ai=service(store(),async(url,options)=>{
      requestSignal=options.signal;
      return {ok:true,json:()=>new Promise(resolve=>setTimeout(()=>resolve(format==='openai'
        ?{choices:[{message:{content:JSON.stringify({valid:true,depth:600,confidence:'high',explanation:'Erlang is a language.'})}}]}
        :{valid:true,depth:600,explanation:'Erlang is a language.'}),22000))};
    });
    ai.save({url:'http://127.0.0.1:8765/api/judge',format,model:'deepseek-chat'});
    const result=ai.review(question,'Erlang').catch(error=>error);
    await Promise.resolve();
    t.mock.timers.tick(8000);
    assert.equal(requestSignal.aborted,false,`${format} must allow the local backend to finish fallback`);
    t.mock.timers.tick(14000);
    assert.equal((await result).depth,600);
  }
});

test('reviewer requests still stop at the existing thirty-five-second ceiling',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let requestSignal;
  const ai=service(store(),async(url,options)=>{requestSignal=options.signal;return {ok:true,json:()=>new Promise(()=>{})};});
  const result=ai.review(question,'Erlang').catch(error=>error);
  t.mock.timers.tick(34999);
  assert.equal(requestSignal.aborted,false);
  t.mock.timers.tick(1);
  assert.equal((await result).name,'TimeoutError');
});
