const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const source=path.join(__dirname,'../ai-review.js');
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function service(storage=store(),fetchImpl=async()=>({ok:true,json:async()=>({valid:true,depth:300,explanation:'Valid answer.'})})){
  assert.ok(fs.existsSync(source),'Persistent AI settings module is missing');
  return require(source).createReviewer({storage,fetchImpl,baseURL:'https://ssolarii.github.io/school/deepdive/'});
}
const question={id:'language',prompt:'Name a programming language.',answers:[['Python',100],['Erlang',600]]};

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
