// Configuration file for app settings
// Paths are relative to the public folder

export const config = {
  // Ball texture path relative to public folder (e.g., '/ball.png' or '/ball_uniform.png')
  // Set to null or empty string to disable texture and use default blue fill
  ballTexturePath: '/ball.png',
  // Ball texture rotation rate in degrees per second (animation time)
  ballRotationRate: 90, // Set to 0 to disable rotation, or a positive/negative value for rotation speed
  // Barrier texture path relative to public folder
  // Set to null or empty string to disable texture and use default black fill
  barrierTexturePath: '/barrier.png',
  // Red sensor texture path relative to public folder
  // Set to null or empty string to disable texture and use default red fill
  redSensorTexturePath: '/blueS.png',
  // Green sensor texture path relative to public folder
  // Set to null or empty string to disable texture and use default green fill
  greenSensorTexturePath: '/green.png',
  // Occluder texture path relative to public folder
  // Set to null or empty string to disable texture and use default gray fill
  occluderTexturePath: '',
  // Starting audio file path relative to public folder (e.g., '/beginning_audio.wav')
  // Set to null or empty string to use default sine wave tone (1000Hz, 50ms)
  startingAudioPath: '/beginning_audio.wav',
  // Ending audio file path relative to public folder (e.g., '/ending_audio.mp3')
  // Set to null or empty string to use default sine wave tone (500Hz, 50ms)
  endingAudioPath: '/ending_audio.mp3',
};

