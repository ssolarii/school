// Keep the preload elements alive so Chrome can fetch local clips before selection.
const preloaders = [];

export function preloadMedia(pathways, { videos = false } = {}) {
  for (const pathway of pathways) {
    const poster = new Image();
    poster.src = pathway.image;
    if (!videos || !pathway.video) continue;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = pathway.video;
    video.load();
    preloaders.push(video);
  }
}
