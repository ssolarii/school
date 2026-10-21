// Keep the preload elements alive so Chrome can fetch local clips before selection.
const preloaders = [];

export function preloadMedia(pathways) {
  for (const pathway of pathways) {
    if (!pathway.video) continue;
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = pathway.video;
    video.load();
    preloaders.push(video);
  }
}
