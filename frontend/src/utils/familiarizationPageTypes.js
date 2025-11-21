/**
 * Maps familiarization trial index (1-based) to page type (p1-p15)
 * @param {number} ftrialIndex - 1-based familiarization trial index
 * @returns {string|null} - Page type (e.g., 'p1', 'p2', etc.) or null if not a special page
 */
export const getFamiliarizationPageType = (ftrialIndex) => {
  if (ftrialIndex >= 1 && ftrialIndex <= 15) {
    return `p${ftrialIndex}`;
  }
  return null;
};

/**
 * Page type specifications for familiarization pages
 */
export const FAMILIARIZATION_PAGE_SPECS = {
  p1: {
    type: 'image_audio',
    images: [
      { src: '/images/elmo.png', position: 'center', size: '30%' }
    ],
    audio: '/audios/1_elmo.mp3',
  },
  p2: {
    type: 'image_audio',
    image: {
      src: '/images/elmo_ball.png',
      position: 'center',
      size: '30%'
    },
    audio: '/audios/2_elmo_ball.mp3',
  },
  p3: {
    type: 'image_audio',
    image: {
      src: '/images/kermit.png',
      position: 'left_center',
      size: '30%'
    },
    audio: '/audios/3_kermit.mp3',
  },
  p4: {
    type: 'image_audio',
    images: [
      {
        src: '/images/kermit.png',
        position: 'left_center',
        size: '30%'
      },
      {
        src: '/images/grass.png',
        position: 'right_center',
        size: '30%'
      }
    ],
    audio: '/audios/4_kermit_grass.mp3',
  },
  p5: {
    type: 'image_audio',
    image: {
      src: '/images/cookiemonster.png',
      position: 'left_center',
      size: '30%'
    },
    audio: '/audios/5_cookiemonster.mp3',
  },
  p6: {
    type: 'image_audio',
    images: [
      {
        src: '/images/cookiemonster.png',
        position: 'left_center',
        size: '30%'
      },
      {
        src: '/images/lake.png',
        position: 'right_center',
        size: '30%'
      }
    ],
    audio: '/audios/6_cookiemonster_lake.mp3',
  },
  p7: {
    type: 'image_audio',
    image: {
      src: '/images/old_machine.png',
      position: 'center',
      size: '80%'
    },
    audio: '/audios/7_area.mp3',
  },
  p8: {
    type: 'canvas_audio_image',
    audio: '/audios/8_ball_intro.mp3',
    image: {
      src: '/images/elmo.png',
      position: 'left_of_canvas',
      size: '20%'
    },
    isDemonstration: true, // No key recording
    waitForSpacebar: false, // Autoplay video
  },
  // Will add p9-p15 as needed
};
