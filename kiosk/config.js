/*
  Finished films play once with sound. Sample footage loops muted until
  presentationSeconds; this also acts as a maximum session length.
*/
export const KIOSK_CONFIG = {
  channelName: 'itzat-steam-pathways-kiosk-v1',
  presentationSeconds: 90,
  idleSeconds: 150,
  brand: {
    name: "Itz'at STEAM Academy",
    logo: './assets/itzat-steam-academy-logo-white.png',
  },
  pathways: [
    {
      id: 'science-tech',
      title: 'Health & Sustainable Technologies',
      detail: 'Health science at Itz\'at STEAM Academy.',
      video: './media/healthscience_final.mp4',
      image: './media/healthscience_final.jpg',
      accent: 'violet',
      sample: false,
    },
    {
      id: 'computer-science',
      title: 'Computer Science',
      detail: 'Computer science at Itz\'at STEAM Academy.',
      video: './media/cs_final.mp4',
      image: './media/cs_final.jpg',
      accent: 'amber',
      sample: false,
    },
    {
      id: 'engineering-manufacturing',
      title: 'Engineering & Manufacturing',
      detail: 'Engineering and manufacturing at Itz\'at STEAM Academy.',
      video: './media/engineering_final.mp4',
      image: './media/engineering_final.jpg',
      accent: 'mint',
      sample: false,
    },
  ],
};
