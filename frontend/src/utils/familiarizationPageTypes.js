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
    type: 'timed_images_audio',
    audio: '/audios/11_rules.mp3',
    timedImages: [
      { src: '/images/rule_1.png', startTime: 0, endTime: 13, position: 'center', size: '90%' },
      { src: '/images/rule_2.png', startTime: 13, endTime: 18, position: 'center', size: '90%' },
      { src: '/images/rule_3.png', startTime: 18, endTime: null, position: 'center', size: '90%' }, // null means until end
    ],
  },
  p8: {
    type: 'canvas_audio_image',
    audio: '/audios/8_ball_intro.mp3',
    image: {
      src: '/images/elmo.png',
      position: 'left_middle_canvas',
      size: '10%'
    },
    trialFolder: 'T_ball_still', // Specific trial folder for p8
    isDemonstration: true, // No key recording
    waitForSpacebar: false, // Autoplay video
  },
  p9: {
    type: 'canvas_audio_image',
    audio: '/audios/9_ball_movement.mp3',
    image: {
      src: '/images/elmo.png',
      position: 'left_middle_canvas',
      size: '25%'
    },
    trialFolder: 'T_ball_move', // Specific trial folder for p9
    isDemonstration: true, // No key recording
    waitForSpacebar: false, // Autoplay video
  },
  // Will add p10-p15 as needed
};
