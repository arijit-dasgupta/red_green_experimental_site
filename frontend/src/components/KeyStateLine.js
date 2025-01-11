// KeyStateLine.js
import React from 'react';

const KeyStateLine = ({ recordedKeyStates }) => {
    // Count the occurrences of 'f' (red) and 'j' (green)
    const redCount = recordedKeyStates.current.filter((state) => state.keys.f && !state.keys.j).length;
    const greenCount = recordedKeyStates.current.filter((state) => state.keys.j && !state.keys.f).length;
    const totalCount = recordedKeyStates.current.length; // Total recorded key states
    // const totalCount = redCount + greenCount // Total recorded key states

    // Calculate proportions
    const redProportion = totalCount > 0 ? (redCount / totalCount) * 100 : 0;
    const greenProportion = totalCount > 0 ? (greenCount / totalCount) * 100 : 0;
    const uncertainProportion = totalCount > 0 ? 100 - redProportion - greenProportion : 0;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '20px',
                width: '100%',
            }}
        >
            <div
                style={{
                    height: '40px',
                    width: '100%',
                    display: 'flex',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '10px',
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
                                fontSize: '12px',
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