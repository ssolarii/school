const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

test('saving a completed run sends a Firestore resource name, not an HTTP URL',async()=>{
  const nodes={};
  const node=selector=>nodes[selector]||=( {value:'Booth check',textContent:'',disabled:false,hidden:false,setCustomValidity(){},reportValidity(){},addEventListener(){},append(){},appendChild(){}} );
  const run={timed:true,depth:600,answers:Array.from({length:6},()=>({question:'Name an organ.',answer:'heart',depth:100}))};
  let commit;
  const context={console,AbortController,setTimeout,clearTimeout,sessionStorage:{getItem(){return null},setItem(){}},window:{DEEP_DIVE_FIREBASE:{enabled:true,projectId:'deepdive-test',apiKey:'public-test-key'},crypto:webcrypto,setTimeout,clearTimeout},fetch:async(url,options)=>{
    if(url.includes('identitytoolkit'))return {ok:true,json:async()=>({localId:'anonymous-user',idToken:'test-token',expiresIn:'3600'})};
    if(options.method==='GET')return {ok:false,status:404,json:async()=>({error:{message:'NOT_FOUND'}})};
    if(url.endsWith(':commit')){
      commit=JSON.parse(options.body);
      const valid=commit.writes[0].update.name.startsWith('projects/');
      return {ok:valid,status:valid?200:400,json:async()=>valid?{}:{error:{message:'Document name lacks projects at index 0'}}};
    }
    return {ok:true,json:async()=>[]};
  }};
  context.fixture={run,node};
  context.document={createElement:()=>node('retry')};
  let source=fs.readFileSync(require('node:path').join(__dirname,'../leaderboard.js'),'utf8');
  source=source.replace('  init();',`pendingRun=fixture.run;dialog={querySelector:fixture.node};statusNode=fixture.node('status');saveButton=fixture.node('save');listNode={replaceChildren(){}};window.testSave=saveScore;`);
  vm.runInNewContext(source,context);
  await context.window.testSave();
  assert.equal(node('status').textContent,'Score saved. Thanks for joining the leaderboard.');
  assert.match(commit.writes[0].update.name,/^projects\/deepdive-test\/databases\/\(default\)\/documents\/deepDiveScores\/[a-z0-9-]+$/);
  assert.equal(commit.writes[0].currentDocument.exists,false);
  assert.deepEqual(commit.writes[0].updateTransforms,[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]);
});
