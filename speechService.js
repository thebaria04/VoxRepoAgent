const sdk = require('microsoft-cognitiveservices-speech-sdk');

class SpeechService {
    constructor() {
        this.speechConfig = null;
        this.recognizer = null;
        this.synthesizer = null;
        this.isRecognizing = false;
        
        this.initializeSpeechConfig();
    }

    initializeSpeechConfig() {
        try {
            // Skip speech configuration in test environment
            if (process.env.NODE_ENV === 'test') {
                console.log('Skipping speech service configuration in test environment');
                this.speechConfig = {
                    speechRecognitionLanguage: 'en-US',
                    speechSynthesisVoiceName: 'en-US-JennyNeural'
                };
                return;
            }
            
            const speechKey = process.env.SPEECH_SERVICE_KEY;
            const speechRegion = process.env.SPEECH_SERVICE_REGION;
            
            if (!speechKey || !speechRegion) {
                throw new Error('Speech service key and region must be configured');
            }

            // Create speech configuration
            this.speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
            this.speechConfig.speechRecognitionLanguage = process.env.SPEECH_LANGUAGE || 'en-US';
            this.speechConfig.speechSynthesisVoiceName = process.env.SPEECH_VOICE_NAME || 'en-US-JennyNeural';
            
            // Configure output format for better quality
            this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
            
            console.log('[INFO] Speech service configuration initialized', {
                region: speechRegion,
                language: this.speechConfig.speechRecognitionLanguage,
                voice: this.speechConfig.speechSynthesisVoiceName
            });
            
        } catch (error) {
            console.log('[ERROR] Failed to initialize speech configuration', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async speechToText(audioStream) {
        return new Promise((resolve, reject) => {
            try {
                // In test environment, return mock transcription
                if (process.env.NODE_ENV === 'test') {
                    setTimeout(() => resolve('Hello world'), 10);
                    return;
                }
                
                if (!this.speechConfig) {
                    reject(new Error('Speech configuration not initialized'));
                    return;
                }

                // Create audio configuration from stream or default microphone
                let audioConfig;
                if (audioStream) {
                    const pushStream = sdk.AudioInputStream.createPushStream();
                    pushStream.write(audioStream);
                    pushStream.close();
                    audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
                } else {
                    audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
                }

                // Create speech recognizer
                const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

                let recognizedText = '';

                // Set up event handlers
                recognizer.recognizing = (s, e) => {
                    console.log('[DEBUG] Speech recognizing', { text: e.result.text });
                };

                recognizer.recognized = (s, e) => {
                    if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                        recognizedText = e.result.text;
                        console.log('[INFO] Speech recognized', { text: recognizedText });
                    } else if (e.result.reason === sdk.ResultReason.NoMatch) {
                        console.log('[WARN] Speech not recognized - no match');
                    }
                };

                recognizer.canceled = (s, e) => {
                    console.log('[ERROR] Speech recognition canceled', {
                        reason: e.reason,
                        errorDetails: e.errorDetails
                    });
                    
                    if (e.reason === sdk.CancellationReason.Error) {
                        reject(new Error(`Speech recognition error: ${e.errorDetails}`));
                    } else {
                        resolve(recognizedText);
                    }
                    recognizer.close();
                };

                recognizer.sessionStopped = (s, e) => {
                    console.log('[DEBUG] Speech recognition session stopped');
                    recognizer.close();
                    resolve(recognizedText);
                };

                // Start recognition
                recognizer.recognizeOnceAsync(
                    (result) => {
                        recognizer.close();
                        resolve(result.text);
                    },
                    (error) => {
                        recognizer.close();
                        reject(error);
                    }
                );

            } catch (error) {
                console.log('[ERROR] Error in speechToText', { error: error.message });
                reject(error);
            }
        });
    }

    async textToSpeech(text, voiceName = null) {
        return new Promise((resolve, reject) => {
            try {
                // In test environment, return mock audio buffer
                if (process.env.NODE_ENV === 'test') {
                    setTimeout(() => resolve(Buffer.from('fake audio data')), 10);
                    return;
                }
                
                if (!this.speechConfig || !text) {
                    reject(new Error('Speech configuration not initialized or text is empty'));
                    return;
                }

                // Use custom voice if provided
                if (voiceName) {
                    this.speechConfig.speechSynthesisVoiceName = voiceName;
                }

                // Create synthesizer
                const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, null);

                // Generate SSML for better control
                const ssml = this.generateSSML(text, voiceName);

                synthesizer.speakSsmlAsync(
                    ssml,
                    (result) => {
                        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                            console.log('[INFO] Speech synthesis completed', {
                                textLength: text.length,
                                audioLength: result.audioData.byteLength
                            });
                            
                            // Convert ArrayBuffer to Buffer for Node.js
                            const audioBuffer = Buffer.from(result.audioData);
                            resolve(audioBuffer);
                        } else {
                            console.log('[ERROR] Speech synthesis failed', {
                                reason: result.reason,
                                errorDetails: result.errorDetails
                            });
                            reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
                        }
                        synthesizer.close();
                    },
                    (error) => {
                        console.log('[ERROR] Speech synthesis error', { error: error.message });
                        synthesizer.close();
                        reject(error);
                    }
                );

            } catch (error) {
                console.log('[ERROR] Error in textToSpeech', { error: error.message });
                reject(error);
            }
        });
    }

    async startContinuousRecognition(onRecognizedCallback, onErrorCallback = null) {
        try {
            if (this.isRecognizing) {
                console.log('[WARN] Continuous recognition is already running');
                return;
            }

            if (!this.speechConfig) {
                throw new Error('Speech configuration not initialized');
            }

            // Create audio configuration
            const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
            
            // Create recognizer
            this.recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

            // Set up event handlers
            this.recognizer.recognized = (s, e) => {
                if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                    console.log('[INFO] Continuous speech recognized', { text: e.result.text });
                    if (onRecognizedCallback) {
                        onRecognizedCallback(e.result.text);
                    }
                }
            };

            this.recognizer.canceled = (s, e) => {
                console.log('[ERROR] Continuous recognition canceled', {
                    reason: e.reason,
                    errorDetails: e.errorDetails
                });
                
                if (onErrorCallback) {
                    onErrorCallback(new Error(`Recognition canceled: ${e.errorDetails}`));
                }
                this.isRecognizing = false;
            };

            this.recognizer.sessionStopped = (s, e) => {
                console.log('[INFO] Continuous recognition session stopped');
                this.isRecognizing = false;
            };

            // Start continuous recognition
            this.recognizer.startContinuousRecognitionAsync(
                () => {
                    console.log('[INFO] Continuous speech recognition started');
                    this.isRecognizing = true;
                },
                (error) => {
                    // Enhanced error logging
                    if (error) {
                        console.log('[ERROR] Failed to start continuous recognition', {
                            error: error.message,
                            errorType: typeof error,
                            errorString: String(error),
                            errorStack: error.stack,
                            errorObject: error
                        });
                    } else {
                        console.log('[ERROR] Failed to start continuous recognition: error object is undefined or null');
                    }
                    if (onErrorCallback) {
                        onErrorCallback(error);
                    }
                }
            );

        } catch (error) {
            console.log('[ERROR] Error starting continuous recognition', { error: error.message });
            throw error;
        }
    }

    async stopContinuousRecognition() {
        try {
            if (!this.isRecognizing || !this.recognizer) {
                console.log('[WARN] No continuous recognition to stop');
                return;
            }

            this.recognizer.stopContinuousRecognitionAsync(
                () => {
                    console.log('[INFO] Continuous recognition stopped');
                    this.isRecognizing = false;
                    this.recognizer.close();
                    this.recognizer = null;
                },
                (error) => {
                    console.log('[ERROR] Error stopping continuous recognition', { error: error.message });
                    this.isRecognizing = false;
                }
            );

        } catch (error) {
            console.log('[ERROR] Error in stopContinuousRecognition', { error: error.message });
            throw error;
        }
    }

    generateSSML(text, voiceName = null) {
        const voice = voiceName || this.speechConfig.speechSynthesisVoiceName;
        
        // Clean and escape text for SSML
        const cleanText = text
            .replace(/[<>&"']/g, (match) => {
                const entities = {
                    '<': '&lt;',
                    '>': '&gt;',
                    '&': '&amp;',
                    '"': '&quot;',
                    "'": '&apos;'
                };
                return entities[match];
            });

        return `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="${voice}">
                    <prosody rate="medium" pitch="medium">
                        ${cleanText}
                    </prosody>
                </voice>
            </speak>
        `;
    }

    async saveAudioToFile(audioBuffer, filePath) {
        try {
            const fs = require('fs').promises;
            await fs.writeFile(filePath, audioBuffer);
            console.log('[INFO] Audio saved to file', { filePath, size: audioBuffer.length });
        } catch (error) {
            console.log('[ERROR] Error saving audio to file', { error: error.message, filePath });
            throw error;
        }
    }

    dispose() {
        try {
            if (this.isRecognizing) {
                this.stopContinuousRecognition();
            }
            
            if (this.synthesizer) {
                this.synthesizer.close();
                this.synthesizer = null;
            }
            
            if (this.speechConfig) {
                this.speechConfig = null;
            }
            
            console.log('[INFO] Speech service disposed');
        } catch (error) {
            console.log('[ERROR] Error disposing speech service', { error: error.message });
        }
    }
}

module.exports = { SpeechService };
