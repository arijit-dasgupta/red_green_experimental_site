// KeyStateLine.js
import React from 'react';

// Calculate scaling factor to keep components at reasonable size
const getScaleFactor = (canvasSize) => {
  const baseSize = 400;
  const maxCanvasDim = Math.max(canvasSize.width, canvasSize.height);
  return Math.min(1, baseSize / maxCanvasDim);
};

const KeyStateLine = ({ recordedKeyStates, canvasSize }) => {
    // Count the occurrences of 'f' (red) and 'j' (green)
    const redCount = recordedKeyStates.current.filter((state) => state.keys.f && !state.keys.j).length;
    const greenCount = recordedKeyStates.current.filter((state) => state.keys.j && !state.keys.f).length;
    const totalCount = recordedKeyStates.current.length; // Total recorded key states
    // const totalCount = redCount + greenCount // Total recorded key states

    // Calculate proportions
    const redProportion = totalCount > 0 ? (redCount / totalCount) * 100 : 0;
    const greenProportion = totalCount > 0 ? (greenCount / totalCount) * 100 : 0;
    const uncertainProportion = totalCount > 0 ? 100 - redProportion - greenProportion : 0;

    // Calculate scaling factor
    const scaleFactor = canvasSize ? getScaleFactor(canvasSize) : 1;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: `${20 * scaleFactor}px`,
                width: '100%',
            }}
        >
            <div
                style={{
                    height: `${40 * scaleFactor}px`,
                    width: '100%',
                    display: 'flex',
                    backgroundColor: '#e0e0e0',
                    borderRadius: `${10 * scaleFactor}px`,
                    overflow: 'hidden',
                    position: 'relative', // Ensure relative positioning for children
                }}
            >
                {/* Red segment */}
                <div
                    style={{
                        width: `${redProportion}%`,
                        backgroundColor: 'red',
                        transition: 'width 0.5s',
                    }}
                />
                {/* Uncertain segment */}
                <div
                    style={{
                        width: `${uncertainProportion}%`,
                        backgroundColor: 'gray',
                        transition: 'width 0.5s',
                        position: 'relative', // Enable positioning for the text
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {uncertainProportion > 40 && ( // Display text only if the segment is large enough
                        <span
                            style={{
                                position: 'absolute',
                                color: 'white',
                                fontSize: `${Math.max(12 * scaleFactor, 16)}px`, // Minimum font size of 10px
                                fontWeight: 'bold',
                            }}
                        >
                            Uncertain
                        </span>
                    )}
                </div>
                {/* Green segment */}
                <div
                    style={{
                        width: `${greenProportion}%`,
                        backgroundColor: 'green',
                        transition: 'width 0.5s',
                    }}
                />
            </div>
        </div>
    );
};

export default KeyStateLine;