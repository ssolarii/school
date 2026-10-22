const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('../vault-crypto.js');
const {createVault}=require('../ai-vault.js');
const sampleKey='sk-or-v1-'+ 'a'.repeat(64);
const password='A test passphrase with enough length';

test('password-derived encryption round trips and uses fresh salts and IVs',async()=>{
  const first=await crypto.encryptKey(sampleKey,password);
  const second=await crypto.encryptKey(sampleKey,password);
  assert.equal(await crypto.decryptKey(first,password),sampleKey);
  assert.notEqual(first.kdf.salt,second.kdf.salt);
  assert.notEqual(first.cipher.iv,second.cipher.iv);
  assert(!JSON.stringify(first).includes(sampleKey));
  assert(!JSON.stringify(first).includes(password));
});

test('wrong passwords, tampering and weakened derivation cannot unlock a key',async()=>{
  const vault=await crypto.encryptKey(sampleKey,password);
  await assert.rejects(()=>crypto.decryptKey(vault,'The wrong staff password'),/password is incorrect/);
  const changed=structuredClone(vault);changed.ciphertext=(changed.ciphertext[0]==='A'?'B':'A')+changed.ciphertext.slice(1);
  await assert.rejects(()=>crypto.decryptKey(changed,password),/password is incorrect/);
  const weakened=structuredClone(vault);weakened.kdf.iterations=1;
  await assert.rejects(()=>crypto.decryptKey(weakened,password),/Unsupported/);
  await assert.rejects(()=>crypto.encryptKey(sampleKey,'short'),/14 characters/);
});

test('vault session stores the decoded key only in memory and locking cancels pending unlock',async()=>{
  const encrypted=await crypto.encryptKey(sampleKey,password);
  let release;
  const service=createVault({fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(encrypted)}),cryptoImpl:{...crypto,decryptKey:()=>new Promise(resolve=>{release=resolve;})},url:'https://game.example/ai-key.vault.json'});
  await service.load();
  const pending=service.unlock(password);
  service.lock();release(sampleKey);
  await assert.rejects(()=>pending,/cancelled/);
  assert.equal(service.getKey(),null);
  const normal=createVault({fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(encrypted)}),cryptoImpl:crypto,url:'https://game.example/ai-key.vault.json'});
  await normal.unlock(password);assert.equal(normal.getKey(),sampleKey);
  normal.lock();assert.equal(normal.getKey(),null);
});

const loadFixture={version:1,testFixture:true};
const loadedResponse=()=>({ok:true,text:async()=>JSON.stringify(loadFixture)});
function loadingSession(fetchImpl){
  return createVault({fetchImpl,cryptoImpl:{validateVault(){},decryptKey:async()=>sampleKey},url:'https://game.example/ai-key.vault.json'});
}
async function flushPromises(){for(let i=0;i<12;i++)await Promise.resolve();}

test('a missing vault clears unlocked access and permits a later load',async()=>{
  let calls=0;
  const service=loadingSession(async()=>++calls===2?{status:404}:loadedResponse());
  await service.unlock(password);
  assert.equal(service.isUnlocked(),true);
  assert.equal(await service.load(),false);
  assert.equal(service.hasVault(),false);
  assert.equal(service.getKey(),null);
  assert.equal(await service.load(),true);
  assert.equal(service.isUnlocked(),false);
});

test('failed vault fetches clear unlocked access and release the load for retry',async()=>{
  for(const failure of [()=>{throw Error('Offline');},()=>Promise.reject(Error('Offline'))]){
    let calls=0;
    const service=loadingSession(()=>++calls===2?failure():loadedResponse());
    await service.unlock(password);
    await assert.rejects(()=>service.load(),/Offline/);
    assert.equal(service.hasVault(),false);
    assert.equal(service.getKey(),null);
    assert.equal(await service.load(),true);
    assert.equal(service.isUnlocked(),false);
  }
});

test('a stalled vault fetch stops at eight seconds and a later load can recover',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let calls=0,requestSignal,outcome;
  const service=loadingSession((url,options)=>{
    if(++calls===2){requestSignal=options.signal;return new Promise(()=>{});}
    return loadedResponse();
  });
  await service.unlock(password);
  const loading=service.load().then(value=>{outcome={value};},error=>{outcome={error};});
  await flushPromises();
  t.mock.timers.tick(7999);await flushPromises();
  assert.equal(outcome,undefined);
  t.mock.timers.tick(1);await flushPromises();
  assert.equal(outcome?.error?.name,'TimeoutError');
  await loading;
  assert.equal(requestSignal.aborted,true);
  assert.equal(service.hasVault(),false);
  assert.equal(service.getKey(),null);
  assert.equal(await service.load(),true);
  assert.equal(service.isUnlocked(),false);
});

test('the eight-second vault deadline includes its body and ignores late data',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let calls=0,requestSignal,releaseBody,outcome;
  const service=loadingSession((url,options)=>{
    if(++calls===2){
      requestSignal=options.signal;
      return new Promise(resolve=>setTimeout(()=>resolve({ok:true,text:()=>new Promise(release=>{releaseBody=release;})}),3000));
    }
    return loadedResponse();
  });
  await service.unlock(password);
  const loading=service.load().then(value=>{outcome={value};},error=>{outcome={error};});
  await flushPromises();
  t.mock.timers.tick(3000);await flushPromises();
  assert.equal(typeof releaseBody,'function');
  t.mock.timers.tick(4999);await flushPromises();
  assert.equal(outcome,undefined);
  t.mock.timers.tick(1);await flushPromises();
  assert.equal(outcome?.error?.name,'TimeoutError');
  await loading;
  assert.equal(requestSignal.aborted,true);
  assert.equal(service.hasVault(),false);
  assert.equal(service.getKey(),null);
  releaseBody(JSON.stringify(loadFixture));await flushPromises();
  assert.equal(service.hasVault(),false);
  assert.equal(await service.load(),true);
  assert.equal(service.isUnlocked(),false);
});
