(function(root){
  'use strict';
  const LOAD_TIMEOUT=8000;
  function createVault({fetchImpl,cryptoImpl,url}){
    let encrypted=null,key=null,loading=null,generation=0;
    function lock(){key=null;generation++;}
    async function load(){
      if(loading)return loading;
      loading=(async()=>{
        const controller=new AbortController();
        let timer;
        const expired=new Promise((resolve,reject)=>{
          timer=setTimeout(()=>{
            const error=new DOMException('Staff access took too long to load. Refresh and try again.','TimeoutError');
            controller.abort(error);reject(error);
          },LOAD_TIMEOUT);
        });
        try{
          const candidate=await Promise.race([expired,Promise.resolve().then(async()=>{
            const response=await fetchImpl(url,{credentials:'omit',cache:'no-store',signal:controller.signal});
            if(response.status===404)return null;
            if(!response.ok)throw Error('The encrypted key could not be loaded.');
            const text=await response.text();
            if(text.length>4096)throw Error('Invalid encrypted key file.');
            const value=JSON.parse(text);cryptoImpl.validateVault(value);
            return value;
          })]);
          if(candidate===null){encrypted=null;lock();return false;}
          if(encrypted&&JSON.stringify(candidate)!==JSON.stringify(encrypted))lock();
          encrypted=candidate;return true;
        }catch(error){encrypted=null;lock();throw error;}
        finally{clearTimeout(timer);loading=null;}
      })();
      return loading;
    }
    async function unlock(password){
      if(!encrypted)await load();
      if(!encrypted)throw Error('The staff key has not been configured yet.');
      const attempt=++generation;
      key=null;
      const unlocked=await cryptoImpl.decryptKey(encrypted,password);
      if(attempt!==generation)throw Error('Unlock was cancelled.');
      key=unlocked;
    }
    return {load,unlock,lock,getKey:()=>key,isUnlocked:()=>Boolean(key),hasVault:()=>Boolean(encrypted)};
  }
  if(typeof module==='object'&&module.exports)module.exports={createVault};
  else{
    const script=document.currentScript.src;
    root.DeepDiveVault=createVault({fetchImpl:root.fetch.bind(root),cryptoImpl:root.DeepDiveVaultCrypto,url:new URL('ai-key.vault.json',script).href});
    root.addEventListener('pagehide',()=>root.DeepDiveVault.lock());
  }
})(globalThis);
