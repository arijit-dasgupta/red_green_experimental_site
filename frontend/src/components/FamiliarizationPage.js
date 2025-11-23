import React, { useEffect, useRef } from 'react';
import { FAMILIARIZATION_PAGE_SPECS } from '../utils/familiarizationPageTypes';

/**
 * Component for rendering special familiarization pages (p1-p15)
 * These pages have custom layouts with images, audio, and optionally canvas
 */
const FamiliarizationPage = ({ 
  pageType, 
  trialInfo, 
  fetchNextScene,
  setdisableCountdownTrigger 
}) => {
  const audioRef = useRef(null);
  const [audioPlayed, setAudioPlayed] = React.useState(false);
  const [audioFinished, setAudioFinished] = React.useState(false);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);

  // Reset state when pageType changes (new page loaded)
  useEffect(() => {
    console.log("FamiliarizationPage: pageType changed to", pageType);
    setAudioPlayed(false);
    setAudioFinished(false);
    setCurrentImageIndex(0);
    // Reset audio if it exists
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
  }, [pageType]);

  useEffect(() => {
    // Auto-play audio when page loads
    if (audioRef.current && !audioPlayed) {
      console.log("FamiliarizationPage: Attempting to play audio");
      audioRef.current.play().catch(error => {
        console.log("Audio autoplay prevented:", error);
        // If autoplay fails, show button immediately
        setAudioFinished(true);
      });
      setAudioPlayed(true);
    }
  }, [audioPlayed]);

  // Listen for audio end event
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioEnd = () => {
      setAudioFinished(true);
    };

    audio.addEventListener('ended', handleAudioEnd);
    return () => {
      audio.removeEventListener('ended', handleAudioEnd);
    };
  }, [audioPlayed]);

  // Handle timed image switching for timed_images_audio type
  useEffect(() => {
    const pageSpec = FAMILIARIZATION_PAGE_SPECS[pageType];
    if (!pageSpec || pageSpec.type !== 'timed_images_audio' || !pageSpec.timedImages) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      const timedImages = pageSpec.timedImages;
      
      // Find the correct image index based on current time
      for (let i = timedImages.length - 1; i >= 0; i--) {
        const img = timedImages[i];
        if (currentTime >= img.startTime && (img.endTime === null || currentTime < img.endTime)) {
          setCurrentImageIndex(prevIndex => {
            if (prevIndex !== i) {
              return i;
            }
            return prevIndex;
          });
          break;
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [pageType, audioPlayed]);

  const handleNext = () => {
    console.log("FamiliarizationPage: Next button clicked, calling fetchNextScene");
    console.log("FamiliarizationPage: fetchNextScene function:", fetchNextScene);
    console.log("FamiliarizationPage: setdisableCountdownTrigger function:", setdisableCountdownTrigger);
    console.log("FamiliarizationPage: Current trialInfo:", trialInfo);
    fetchNextScene(setdisableCountdownTrigger);
  };

  // Add keyboard shortcuts for testing: Press 'Q' or 'Shift+S' to skip to next page
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Press 'Q' or 'q' or 'Shift+S' to skip to next page (for testing)
      if (e.key === 'Q' || e.key === 'q' || (e.shiftKey && (e.key === 'S' || e.key === 's'))) {
        console.log("SKIP KEY PRESSED: Skip key detected in FamiliarizationPage, skipping to next page");
        e.preventDefault();
        e.stopPropagation();
        fetchNextScene(setdisableCountdownTrigger);
        return false;
      }
    };
    
    // Use document with capture phase for higher priority
    document.addEventListener('keydown', handleKeyPress, true);
    return () => {
      document.removeEventListener('keydown', handleKeyPress, true);
    };
  }, [fetchNextScene, setdisableCountdownTrigger]);

  // Get page specification
  const pageSpec = FAMILIARIZATION_PAGE_SPECS[pageType];
  if (!pageSpec) {
    return <div>Page type {pageType} not found</div>;
  }

  // Render based on page type
  if (pageSpec.type === 'timed_images_audio') {
    const timedImages = pageSpec.timedImages || [];
    const currentImage = timedImages[currentImageIndex] || timedImages[0];
    
    if (!currentImage) {
      return <div>No images configured for {pageType}</div>;
    }

    let imageStyle = {
      width: currentImage.size || "30%",
      height: "auto",
      maxWidth: "100%",
      objectFit: "contain",
      position: "absolute",
    };

    // Handle positioning
    if (currentImage.position === 'center') {
      imageStyle.left = "50%";
      imageStyle.top = "50%";
      imageStyle.transform = "translate(-50%, -50%)";
    } else if (currentImage.position === 'left_center') {
      imageStyle.left = "25%";
      imageStyle.top = "50%";
      imageStyle.transform = "translate(-50%, -50%)";
    } else if (currentImage.position === 'right_center') {
      imageStyle.left = "75%";
      imageStyle.top = "50%";
      imageStyle.transform = "translate(-50%, -50%)";
    }

    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#ffffff",
        padding: "20px",
        position: "relative",
      }}>
        <audio
          ref={audioRef}
          src={pageSpec.audio}
          preload="auto"
        />

        {/* Display current image based on audio time */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          position: "relative",
        }}>
          <img 
            key={currentImageIndex} 
            src={currentImage.src} 
            alt="" 
            style={imageStyle}
          />
        </div>

        {/* Next button appears after audio finishes */}
        {audioFinished && (
          <div style={{
            position: "absolute",
            bottom: "50px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
          }}>
            <button 
              onClick={handleNext}
              style={{
                padding: "15px 30px",
                fontSize: "1.2rem",
                color: "white",
                backgroundColor: "#007bff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
              }}
            >
              Next
            </button>
          </div>
        )}

        {/* Audio playing indicator */}
        {!audioFinished && (
          <div style={{
            position: "absolute",
            bottom: "50px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "1.2rem",
            color: "#666",
            fontStyle: "italic",
          }}>
            Playing audio...
          </div>
        )}
      </div>
    );
  }

  if (pageSpec.type === 'image_audio') {
    const images = pageSpec.images || (pageSpec.image ? [pageSpec.image] : []);
    
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#ffffff", // White background
        padding: "20px",
        position: "relative",
      }}>
        <audio
          ref={audioRef}
          src={pageSpec.audio}
          preload="auto"
        />

        {/* Image display container */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          position: "relative",
        }}>
          {images.map((img, index) => {
            let imageStyle = {
              width: img.size || "30%", // Default to 30%
              height: "auto",
              maxWidth: "100%",
              objectFit: "contain",
              position: "absolute",
            };

            // Handle positioning based on position type
            if (img.position === 'center') {
              imageStyle.left = "50%";
              imageStyle.top = "50%";
              imageStyle.transform = "translate(-50%, -50%)";
            } else if (img.position === 'left_center') {
              imageStyle.left = "25%";
              imageStyle.top = "50%";
              imageStyle.transform = "translate(-50%, -50%)";
            } else if (img.position === 'right_center') {
              imageStyle.left = "75%";
              imageStyle.top = "50%";
              imageStyle.transform = "translate(-50%, -50%)";
            } else if (img.position === 'above_center' && img.offset) {
              imageStyle.top = `calc(50vh - ${img.offset})`;
              imageStyle.left = "50%";
              imageStyle.transform = "translate(-50%, -100%)";
              imageStyle.zIndex = 10;
            }
            
            return (
              <img key={index} src={img.src} alt="" style={imageStyle} />
            );
          })}
        </div>

        {/* Next button appears after audio finishes */}
        {audioFinished && (
          <div style={{
            position: "absolute",
            bottom: "50px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
          }}>
            <button 
              onClick={handleNext}
              style={{
                padding: "15px 30px",
                fontSize: "1.2rem",
                color: "white",
                backgroundColor: "#007bff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
              }}
            >
              Next
            </button>
          </div>
        )}

        {/* Audio playing indicator */}
        {!audioFinished && (
          <div style={{
            position: "absolute",
            bottom: "50px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "1.2rem",
            color: "#666",
            fontStyle: "italic",
          }}>
            Playing audio...
          </div>
        )}
      </div>
    );
  }

  return <div>Unsupported page type: {pageSpec.type}</div>;
};

export default FamiliarizationPage;
