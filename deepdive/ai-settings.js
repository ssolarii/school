(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const ai=window.DeepDiveAI;
  const dialog=$('#table-settings-dialog');
  const form=$('#ai-settings-form');
  const url=$('#ai-endpoint');
  const format=$('#ai-format');
  const model=$('#ai-model');
  const status=$('#ai-settings-status');
  const vault=window.DeepDiveVault;
  const password=$('#ai-vault-password');
  const unlockButton=$('#unlock-ai');
  const lockButton=$('#lock-ai');
  const vaultStatus=$('#ai-vault-status');
  const openRouter={url:'https://openrouter.ai/api/v1/chat/completions',format:'openrouter',model:'nvidia/nemotron-3.5-lightning:free'};
  let pending=null;
  let loadingVault=true,unlocking=false,unlockAttempt=0,vaultLoadError='';
  function cancelTest(){if(pending)pending.abort();pending=null;$('#test-ai').disabled=false;$('#test-ai').textContent='Test connection';}
  function renderVault(){
    const unlocked=Boolean(vault?.isUnlocked());
    password.hidden=unlocked;
    $('label[for="ai-vault-password"]').hidden=unlocked;
    unlockButton.hidden=unlocked;lockButton.hidden=!unlocked;
    unlockButton.disabled=loadingVault||unlocking||!vault?.hasVault();
    password.disabled=loadingVault||unlocking;
    unlockButton.textContent=unlocking?'Unlocking…':'Unlock free AI';
    vaultStatus.textContent=unlocked?'Free AI is unlocked on this screen until you lock it or reload the page.'
      :loadingVault?'Loading staff access…'
      :vaultLoadError||(!vault?.hasVault()?'Staff access has not been configured for this game.':'Locked. Enter the staff password to enable free AI review.');
  }
  function updateFormat(){
    const free=format.value==='openrouter';
    $('#ai-vault-row').hidden=!free;
    $('#ai-endpoint-row').hidden=free;
    $('#ai-model-row').hidden=format.value!=='openai';
    if(free){url.value=openRouter.url;model.value=openRouter.model;}
    renderVault();
  }
  function draft(){return {url:url.value,format:format.value,model:model.value};}
  function populate(){const settings=ai.getSettings();url.value=settings.url;format.value=settings.format;model.value=settings.model;updateFormat();}
  $('#table-settings-button').addEventListener('click',()=>{
    populate();password.value='';
    status.textContent=format.value==='openrouter'?'Free AI settings are saved on this browser.':ai.getSettings().url?'Custom endpoint saved on this browser.':'Using the default local reviewer.';
    dialog.showModal();
    (format.value==='openrouter'&&!vault?.isUnlocked()?password:format.value==='openrouter'?format:url).focus();
  });
  $('#close-table-settings').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{cancelTest();password.value='';if(unlocking){unlockAttempt++;vault?.lock();}});
  form.addEventListener('input',event=>{if(event.target===password)return;cancelTest();updateFormat();status.textContent='Unsaved changes.';});
  form.addEventListener('change',updateFormat);
  form.addEventListener('submit',event=>{
    event.preventDefault();cancelTest();
    try{ai.save(draft());populate();status.textContent='Saved on this browser. This setting will be used for future dives.';}
    catch(error){status.textContent=error.message;}
  });
  $('#reset-ai').addEventListener('click',()=>{
    cancelTest();
    try{vault?.lock();password.value='';ai.reset();populate();status.textContent='Default reviewer restored and saved on this browser.';}
    catch(error){status.textContent=error.message;}
  });
  unlockButton.addEventListener('click',async()=>{
    cancelTest();
    const entered=password.value;password.value='';
    if(!entered){vaultStatus.textContent='Enter the staff password.';password.focus();return;}
    if(!vault){vaultStatus.textContent='Staff access could not load. Refresh and try again.';return;}
    const attempt=++unlockAttempt;unlocking=true;renderVault();
    try{
      await vault.unlock(entered);
      if(attempt!==unlockAttempt){vault.lock();return;}
      ai.save(openRouter);populate();
      status.textContent='Free AI review is ready. Its settings are saved on this browser.';
    }catch(error){
      if(attempt===unlockAttempt){vaultStatus.textContent=error.message||'Could not unlock staff access. Check the password and try again.';password.focus();}
    }finally{
      unlocking=false;
      unlockButton.disabled=loadingVault||!vault?.hasVault();
      password.disabled=loadingVault;
      unlockButton.textContent='Unlock free AI';
      if(vault.isUnlocked())renderVault();
      else if(attempt===unlockAttempt&&dialog.open)password.focus();
    }
  });
  lockButton.addEventListener('click',()=>{
    cancelTest();unlockAttempt++;vault?.lock();password.value='';renderVault();
    status.textContent='Free AI review is locked on this screen.';password.focus();
  });
  password.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(!unlockButton.disabled)unlockButton.click();}});
  $('#test-ai').addEventListener('click',async()=>{
    cancelTest();const controller=new AbortController();pending=controller;
    const timeout=setTimeout(()=>controller.abort(),35000);
    $('#test-ai').disabled=true;$('#test-ai').textContent='Checking…';status.textContent='Checking this endpoint. Nothing is saved until you choose Save settings.';
    try{
      const question=window.DEEP_DIVE_QUESTIONS.find(item=>item.id==='language');
      // This answer is intentionally not seeded, so the test actually calls the model.
      const result=await ai.review(question,'Erlang',{settings:draft(),signal:controller.signal,probe:true});
      if(pending===controller)status.textContent=result.valid?'Connection works. The endpoint returned a valid answer review.':'The endpoint responded but could not confirm the test answer. Check its format and model.';
    }catch(error){
      if(pending===controller)status.textContent=error.name==='AbortError'?'Connection check cancelled. Try again when ready.':`Could not connect: ${error.message}${format.value==='openrouter'?'':' For localhost, allow local-network access if your browser asks.'}`;
    }finally{clearTimeout(timeout);if(pending===controller)cancelTest();}
  });
  (async()=>{
    try{if(vault)await vault.load();else vaultLoadError='Staff access could not load. Refresh and try again.';}
    catch{vaultLoadError='Staff access could not load. Refresh and try again.';}
    finally{loadingVault=false;renderVault();}
  })();
})();
