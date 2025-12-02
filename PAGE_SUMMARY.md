# Page-by-Page Summary: Red-Green Experiment Familiarization Phase

## Page Order and Mapping
- **ftrial_i = 0**: Not used (starts at 1)
- **ftrial_i = 1**: P8
- **ftrial_i = 2**: P9
- **ftrial_i = 3**: P10
- **ftrial_i = 4**: P11
- **ftrial_i = 5**: P12
- **ftrial_i = 6**: P13
- **ftrial_i = 7**: P14
- **ftrial_i = 8**: P15
- **ftrial_i = 9**: P16
- **ftrial_i = 10**: P17
- **ftrial_i = 11**: P18
- **ftrial_i = 12**: P19
- **ftrial_i = 13**: P20
- **ftrial_i = 14**: P21
- **ftrial_i = 15**: P22

---

## P1 (ftrial_i = 0, but handled separately) - Image with Audio

**Type**: Image + Audio (non-interactive demonstration)

**Audio**: 
- `1_elmo.mp3`

**Images**:
- `elmo.png` centered, 30% size

**Sequence**:
- Audio plays automatically
- Image displays during audio
- "Next" button appears after audio finishes
- Manual advance required

---

## P2 (ftrial_i = 0, but handled separately) - Image with Audio

**Type**: Image + Audio (non-interactive demonstration)

**Audio**: 
- `2_elmo_ball.mp3`

**Images**:
- `elmo_ball.png` centered, 30% size

**Sequence**:
- Audio plays automatically
- Image displays during audio
- "Next" button appears after audio finishes
- Manual advance required

---

## P3 (ftrial_i = 0, but handled separately) - Image with Audio

**Type**: Image + Audio (non-interactive demonstration)

**Audio**: 
- `3_kermit.mp3`

**Images**:
- `kermit.png` left center, 30% size

**Sequence**:
- Audio plays automatically
- Image displays during audio
- "Next" button appears after audio finishes
- Manual advance required

---

## P4 (ftrial_i = 0, but handled separately) - Images with Audio

**Type**: Images + Audio (non-interactive demonstration)

**Audio**: 
- `4_kermit_grass.mp3`

**Images**:
- `kermit.png` left center, 30% size
- `grass.png` right center, 30% size

**Sequence**:
- Audio plays automatically
- Images display during audio
- "Next" button appears after audio finishes
- Manual advance required

---

## P5 (ftrial_i = 0, but handled separately) - Image with Audio

**Type**: Image + Audio (non-interactive demonstration)

**Audio**: 
- `5_cookiemonster.mp3`

**Images**:
- `cookiemonster.png` left center, 30% size

**Sequence**:
- Audio plays automatically
- Image displays during audio
- "Next" button appears after audio finishes
- Manual advance required

---

## P6 (ftrial_i = 0, but handled separately) - Images with Audio

**Type**: Images + Audio (non-interactive demonstration)

**Audio**: 
- `6_cookiemonster_lake.mp3`

**Images**:
- `cookiemonster.png` left center, 30% size
- `lake.png` right center, 30% size

**Sequence**:
- Audio plays automatically
- Images display during audio
- "Next" button appears after audio finishes
- Manual advance required

---

## P7 (ftrial_i = 0, but handled separately) - Timed Images with Audio

**Type**: Timed Images + Audio (non-interactive demonstration)

**Audio**: 
- `7_area.mp3`

**Images** (timed sequence):
- `rule_1.png` centered, 90% size (0-13 seconds)
- `rule_2.png` centered, 90% size (13-18 seconds)
- `rule_3.png` centered, 90% size (18 seconds to end)

**Sequence**:
- Audio plays automatically
- Images switch based on audio timeline
- "Next" button appears after audio finishes
- Manual advance required

---

## P8 (ftrial_i = 1) - Canvas Demonstration with Audio

**Type**: Non-interactive canvas demonstration with audio and image overlay

**Audio**: 
- `8_ball_intro.mp3`

**Canvas**: 
- Trial data: `T_ball_still`
- Size: 600x600px
- Border: 20px with barrier texture

**Images**:
- `elmo.png` on left middle of canvas, 25% size (positioned to left of canvas with 20px gap)

**Sequence**:
- Audio and canvas animation start simultaneously
- Auto-advances when both audio and video finish (whichever finishes last)
- 500ms delay before auto-advance

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled (ball, barrier, sensors, occluder)

---

## P9 (ftrial_i = 2) - Canvas Demonstration with Audio

**Type**: Non-interactive canvas demonstration with audio and image overlay

**Audio**: 
- `9_ball_movement.mp3`

**Canvas**: 
- Trial data: `T_ball_move`
- Size: 600x600px
- Border: 20px with barrier texture

**Images**:
- `elmo.png` on left middle of canvas, 25% size (positioned to left of canvas with 20px gap)

**Sequence**:
- Audio and canvas animation start simultaneously
- Auto-advances when both audio and video finish (whichever finishes last)
- 500ms delay before auto-advance

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P10 (ftrial_i = 3) - Canvas Demonstration with Audio

**Type**: Non-interactive canvas demonstration with audio and image overlay

**Audio**: 
- `10_barrier.mp3`

**Canvas**: 
- Trial data: `T_barrier2complex`
- Size: 600x600px
- Border: 20px with barrier texture

**Images**:
- `elmo.png` on left middle of canvas, 25% size (positioned to left of canvas with 20px gap)

**Sequence**:
- Audio and canvas animation start simultaneously
- Auto-advances when both audio and video finish (whichever finishes last)
- 500ms delay before auto-advance

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P11 (ftrial_i = 4) - Demonstration Page with Video Sequence

**Type**: Non-interactive demonstration with video overlays

**Audio**:
- First: `11_red_green.mp3`
- Second: `12_F_J.mp3` (starts after first audio and canvas finish)

**Canvas**: 
- Trial data: `T_red_green`
- Size: 600x600px
- Border: 20px with barrier texture

**Images**:
- `elmo.png` on left middle of canvas, 25% size
- `kermit.png` on right side, top aligned with canvas top, 20% size
- `cookiemonster.png` on right side, bottom aligned with canvas bottom, 20% size

**Videos** (visual only, muted, centered overlay):
- `Fkey_short.mp4` plays 3 seconds into `12_F_J.mp3`
- `Jkey_short.mp4` plays after `Fkey_short.mp4` finishes

**Sequence**:
- `11_red_green.mp3` plays + canvas animation
- After both finish, `12_F_J.mp3` starts
- 3 seconds into `12_F_J.mp3`, `Fkey_short.mp4` plays (centered overlay)
- After `Fkey_short.mp4` finishes, `Jkey_short.mp4` plays (centered overlay)
- Auto-advances when `12_F_J.mp3` finishes

**Setup**: Canvas 600x600px, 20px border with barrier texture

---

## P12 (ftrial_i = 5) - Canvas Demonstration with Audio

**Type**: Non-interactive canvas demonstration with audio

**Audio**: 
- `13_press_keys.mp3`

**Canvas**: 
- Trial data: `T_red_green`
- Size: 600x600px
- Border: 20px with barrier texture

**Sequence**:
- Audio and canvas animation start simultaneously
- Auto-advances when both audio and video finish (whichever finishes last)
- 500ms delay before auto-advance

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P13 (ftrial_i = 6) - [Page Details To Be Added]

**Type**: [To be determined]

**Note**: P13 component details need to be added. This page comes after P12 and before P14.

---

## P14 (ftrial_i = 7) - Interactive Practice Trial

**Type**: Interactive canvas page (practice trial with key recording)

**Canvas**: 
- Trial data: `T_greeneasy`
- Size: 600x600px
- Border: 20px with barrier texture

**Interaction**:
- Auto-starts without spacebar
- Shows key press indicators (F for red, J for green)
- Records key states during playback
- Shows congratulations message after completion
- Auto-advances when finished

**Sequence**:
- Canvas animation starts automatically
- Participant can press F (red) or J (green) keys during playback
- Key states recorded frame-by-frame
- Congratulations shown after video finishes
- Auto-advances after congratulations display

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P15 (ftrial_i = 8) - Interactive Practice Trial

**Type**: Interactive canvas page (practice trial with key recording)

**Canvas**: 
- Trial data: `T_redeasy`
- Size: 600x600px
- Border: 20px with barrier texture

**Interaction**:
- Auto-starts without spacebar
- Shows key press indicators (F for red, J for green)
- Records key states during playback
- Shows congratulations message after completion
- Auto-advances when finished

**Sequence**:
- Canvas animation starts automatically
- Participant can press F (red) or J (green) keys during playback
- Key states recorded frame-by-frame
- Congratulations shown after video finishes
- Auto-advances after congratulations display

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P16 (ftrial_i = 9) - Interactive Practice Trial (Swapped Keys)

**Type**: Interactive canvas page (practice trial with key recording, keys swapped)

**Canvas**: 
- Trial data: `T_greenmid`
- Size: 600x600px
- Border: 20px with barrier texture

**Interaction**:
- Auto-starts without spacebar
- Shows key press indicators (F for green, J for red) - **KEYS SWAPPED**
- Records key states during playback
- Shows congratulations message after completion
- Auto-advances when finished

**Sequence**:
- Canvas animation starts automatically
- Participant can press F (green) or J (red) keys during playback
- Key states recorded frame-by-frame
- Congratulations shown after video finishes
- Auto-advances after congratulations display

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P17 (ftrial_i = 10) - Interactive Practice Trial (Swapped Keys)

**Type**: Interactive canvas page (practice trial with key recording, keys swapped)

**Canvas**: 
- Trial data: `T_redmid`
- Size: 600x600px
- Border: 20px with barrier texture

**Interaction**:
- Auto-starts without spacebar
- Shows key press indicators (F for green, J for red) - **KEYS SWAPPED**
- Records key states during playback
- Shows congratulations message after completion
- Auto-advances when finished

**Sequence**:
- Canvas animation starts automatically
- Participant can press F (green) or J (red) keys during playback
- Key states recorded frame-by-frame
- Congratulations shown after video finishes
- Auto-advances after congratulations display

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P18 (ftrial_i = 11) - Canvas Demonstration with Audio

**Type**: Non-interactive canvas demonstration with audio

**Audio**: 
- `14_switchkeys_onekey.mp3`

**Canvas**: 
- Trial data: `T_blank`
- Size: 600x600px
- Border: 20px with barrier texture

**Sequence**:
- Audio and canvas animation start simultaneously
- Auto-advances when both audio and video finish (whichever finishes last)
- 500ms delay before auto-advance

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P19 (ftrial_i = 12) - Interactive Practice Trial (Swapped Keys)

**Type**: Interactive canvas page (practice trial with key recording, keys swapped)

**Canvas**: 
- Trial data: `T_switch_keys_easy`
- Size: 600x600px
- Border: 20px with barrier texture

**Interaction**:
- Auto-starts without spacebar
- Shows key press indicators (F for green, J for red) - **KEYS SWAPPED**
- Records key states during playback
- Shows congratulations message after completion
- Auto-advances when finished

**Sequence**:
- Canvas animation starts automatically
- Participant can press F (green) or J (red) keys during playback
- Key states recorded frame-by-frame
- Congratulations shown after video finishes
- Auto-advances after congratulations display

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P20 (ftrial_i = 13) - Interactive Practice Trial (Swapped Keys)

**Type**: Interactive canvas page (practice trial with key recording, keys swapped)

**Canvas**: 
- Trial data: `T_switch_keys_hard`
- Size: 600x600px
- Border: 20px with barrier texture

**Interaction**:
- Auto-starts without spacebar
- Shows key press indicators (F for green, J for red) - **KEYS SWAPPED**
- Records key states during playback
- Shows congratulations message after completion
- Auto-advances when finished

**Sequence**:
- Canvas animation starts automatically
- Participant can press F (green) or J (red) keys during playback
- Key states recorded frame-by-frame
- Congratulations shown after video finishes
- Auto-advances after congratulations display

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P21 (ftrial_i = 14) - Canvas Demonstration with Audio

**Type**: Non-interactive canvas demonstration with audio

**Audio**: 
- `18_occluder_trimmed.mp3`

**Canvas**: 
- Trial data: `T_occluder_intro`
- Size: 600x600px
- Border: 20px with barrier texture

**Sequence**:
- Audio and canvas animation start simultaneously
- Auto-advances when both audio and video finish (whichever finishes last)
- 500ms delay before auto-advance

**Setup**: Canvas 600x600px, 20px border with barrier texture, all textures enabled

---

## P22 (ftrial_i = 15) - Video with Audio and Video Overlays

**Type**: Non-interactive video demonstration with audio and video overlays

**Audio**: 
- `19_final_reminder.mp3` (starts immediately)

**Main Video**: 
- `final_reminder.mp4` (appears immediately, starts playing at 22 seconds into audio)

**Videos** (visual only, muted, centered overlay, 70% size):
- `Fkey_short.mp4` plays 47 seconds into `19_final_reminder.mp3`
- `Jkey_short.mp4` plays 52 seconds into `19_final_reminder.mp3`

**Sequence**:
- `19_final_reminder.mp3` starts immediately
- `final_reminder.mp4` appears immediately but starts playing at 22 seconds into audio
- 47 seconds into `19_final_reminder.mp3`, `Fkey_short.mp4` plays (centered overlay)
- 52 seconds into `19_final_reminder.mp3`, `Jkey_short.mp4` plays (centered overlay)
- Auto-advances when `19_final_reminder.mp3` finishes

**Setup**: Main video displayed, overlay videos centered and muted

---

## General Setup Notes

**Canvas Configuration** (for all canvas pages):
- Size: 600x600 pixels
- Border: 20px thickness with barrier texture
- Textures enabled:
  - Ball texture: `/ball.png`
  - Barrier texture: `/barrier.png`
  - Red sensor texture: `/blueS.png`
  - Green sensor texture: `/green.png`
  - Occluder texture: `/cloud.jpg`
- Ball rotation: 180 degrees per second

**Key Mapping**:
- **Normal mode**: F = Red, J = Green
- **Swapped mode** (P16, P17, P19, P20): F = Green, J = Red

**Auto-advance Behavior**:
- Most pages auto-advance after audio/video completion
- Practice pages (P14-P15, P16-P17, P19-P20) show congratulations before advancing
- 500ms delay before auto-advance for smooth transitions

**Note**: P13 details are to be added. The page sequence now includes P13 between P12 and P14.

**Skip Shortcut**: 
- Press `Shift+S` or `Q` to skip to next page (for testing/debugging)

