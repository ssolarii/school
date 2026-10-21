/*
  Replace the sample MP4s with school footage when the approved films are ready.
  presentationSeconds is the total time a selection remains on the TV; a shorter
  MP4 loops during that interval.
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
      title: 'Science + Tech',
      detail: 'Sample microscope footage.',
      video: './media/science-tech-sample.mp4',
      image: './media/science-tech-sample.jpg',
      accent: 'violet',
      sample: true,
    },
    {
      id: 'computer-science',
      title: 'Computer Science',
      detail: 'Sample programming footage.',
      video: './media/computer-science-sample.mp4',
      image: './media/computer-science-sample.jpg',
      accent: 'amber',
      sample: true,
    },
    {
      id: 'engineering-manufacturing',
      title: 'Engineering & Manufacturing',
      detail: 'Sample manufacturing footage.',
      video: './media/engineering-manufacturing-sample.mp4',
      image: './media/engineering-manufacturing-sample.jpg',
      accent: 'mint',
      sample: true,
    },
  ],
};
