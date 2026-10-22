(function(root){
  'use strict';
  const ITERATIONS=600000;
  const AAD=new TextEncoder().encode('Deep Dive OpenRouter key vault v1');
  const keyPattern=/^sk-or-v1-[A-Za-z0-9_-]{32,256}$/;
  const encode=bytes=>btoa(String.fromCharCode(...bytes));
  function decode(value){
    if(typeof value!=='string'||value.length>2048||!(/^[A-Za-z0-9+/]*={0,2}$/.test(value)))throw Error('Invalid encrypted key file.');
    try{return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{throw Error('Invalid encrypted key file.');}
  }
  function validateVault(vault){
    if(vault?.version!==1||vault.kdf?.name!=='PBKDF2'||vault.kdf.hash!=='SHA-256'||vault.kdf.iterations!==ITERATIONS||vault.cipher?.name!=='AES-GCM')throw Error('Unsupported encrypted key format.');
    const salt=decode(vault.kdf.salt),iv=decode(vault.cipher.iv),ciphertext=decode(vault.ciphertext);
    if(salt.length!==16||iv.length!==12||ciphertext.length<48||ciphertext.length>1024)throw Error('Invalid encrypted key file.');
    return {salt,iv,ciphertext};
  }
  async function derive(password,salt,usage){
    if(!root.crypto?.subtle)throw Error('Key unlocking requires HTTPS or localhost in a modern browser.');
    if(typeof password!=='string'||password.length>256)throw Error('Enter the staff password.');
    const bytes=new TextEncoder().encode(password);
    try{
      const material=await root.crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);
      return await root.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,[usage]);
    }finally{bytes.fill(0);}
  }
  async function encryptKey(apiKey,password){
    if(!keyPattern.test(apiKey))throw Error('The local OpenRouter key has an invalid format.');
    if(typeof password!=='string'||password.length<14||password.length>256)throw Error('Choose a staff password of at least 14 characters.');
    const salt=root.crypto.getRandomValues(new Uint8Array(16)),iv=root.crypto.getRandomValues(new Uint8Array(12));
    const key=await derive(password,salt,'encrypt');
    const bytes=new TextEncoder().encode(apiKey);
    try{
      const ciphertext=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},key,bytes);
      return {version:1,kdf:{name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt:encode(salt)},cipher:{name:'AES-GCM',iv:encode(iv)},ciphertext:encode(new Uint8Array(ciphertext))};
    }finally{bytes.fill(0);}
  }
  async function decryptKey(vault,password){
    const {salt,iv,ciphertext}=validateVault(vault);
    const key=await derive(password,salt,'decrypt');
    let bytes;
    try{
      bytes=new Uint8Array(await root.crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},key,ciphertext));
      const apiKey=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      if(!keyPattern.test(apiKey))throw Error('Invalid key.');
      return apiKey;
    }catch{throw Error('The password is incorrect or the encrypted key was changed.');}
    finally{bytes?.fill(0);}
  }
  const api={encryptKey,decryptKey,validateVault};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DeepDiveVaultCrypto=api;
})(globalThis);
