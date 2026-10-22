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
  let pending=null;
  function cancelTest(){if(pending)pending.abort();pending=null;$('#test-ai').disabled=false;$('#test-ai').textContent='Test connection';}
  function updateFormat(){$('#ai-model-row').hidden=format.value!=='openai';}
  function draft(){return {url:url.value,format:format.value,model:model.value};}
  function populate(){const settings=ai.getSettings();url.value=settings.url;format.value=settings.format;model.value=settings.model;updateFormat();}
  $('#table-settings-button').addEventListener('click',()=>{
    populate();status.textContent=ai.getSettings().url?'Custom endpoint saved on this browser.':'Using the default local reviewer.';
    dialog.showModal();url.focus();
  });
  $('#close-table-settings').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',cancelTest);
  form.addEventListener('input',()=>{cancelTest();updateFormat();status.textContent='Unsaved changes.';});
  form.addEventListener('change',updateFormat);
  form.addEventListener('submit',event=>{
    event.preventDefault();cancelTest();
    try{ai.save(draft());populate();status.textContent='Saved on this browser. This setting will be used for future dives.';}
    catch(error){status.textContent=error.message;}
  });
  $('#reset-ai').addEventListener('click',()=>{
    cancelTest();
    try{ai.reset();populate();status.textContent='Default reviewer restored and saved on this browser.';}
    catch(error){status.textContent=error.message;}
  });
  $('#test-ai').addEventListener('click',async()=>{
    cancelTest();const controller=new AbortController();pending=controller;
    const timeout=setTimeout(()=>controller.abort(),35000);
    $('#test-ai').disabled=true;$('#test-ai').textContent='Checking…';status.textContent='Checking this endpoint. Nothing is saved until you choose Save settings.';
    try{
      const question=window.DEEP_DIVE_QUESTIONS.find(item=>item.id==='language');
      const result=await ai.review(question,'Python',{settings:draft(),signal:controller.signal});
      if(pending===controller)status.textContent=result.valid?'Connection works. The endpoint returned a valid answer review.':'The endpoint responded but could not confirm the test answer. Check its format and model.';
    }catch(error){
      if(pending===controller)status.textContent=error.name==='AbortError'?'Connection timed out. Start the AI server, check the URL, and allow local-network access if your browser asks.':`Could not connect: ${error.message} For localhost, allow local-network access if your browser asks.`;
    }finally{clearTimeout(timeout);if(pending===controller)cancelTest();}
  });
})();
