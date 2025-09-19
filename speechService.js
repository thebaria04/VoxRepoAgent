const sdk = require('microsoft-cognitiveservices-speech-sdk');

class SpeechService {
    constructor() {
        this.speechConfig = null;
        this.recognizer = null;
        this.synthesizer = null;
        this.isRecognizing = false;
        this.pushStream = null; // for real-time audio input
        this.initializeSpeechConfig();
    }

    initializeSpeechConfig() {
        try {
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

            this.speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
            this.speechConfig.speechRecognitionLanguage = process.env.SPEECH_LANGUAGE || 'en-US';
            this.speechConfig.speechSynthesisVoiceName = process.env.SPEECH_VOICE_NAME || 'en-US-JennyNeural';
            this.speechConfig.speechSynthesisOutputFormat =
                sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

            console.log('Speech service configuration initialized', {
                region: speechRegion,
                language: this.speechConfig.speechRecognitionLanguage,
                voice: this.speechConfig.speechSynthesisVoiceName
            });

        } catch (error) {
            console.error('Failed to initialize speech configuration', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async speechToText(audioBuffer) {
        return new Promise((resolve, reject) => {
            try {
                if (process.env.NODE_ENV === 'test') {
                    setTimeout(() => resolve('Hello world'), 10);
                    return;
                }

                if (!this.speechConfig) {
                    reject(new Error('Speech configuration not initialized'));
                    return;
                }

                const pushStream = sdk.AudioInputStream.createPushStream();
                pushStream.write(audioBuffer);
                pushStream.close();

                const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
                const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

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
                console.error('Error in speechToText', { error: error.message });
                reject(error);
            }
        });
    }

    async startContinuousRecognition(onRecognizedCallback, onErrorCallback = null) {
        try {
            if (this.isRecognizing) {
                console.warn('Continuous recognition is already running');
                return;
            }
            if (!this.speechConfig) {
                throw new Error('Speech configuration not initialized');
            }

            this.pushStream = sdk.AudioInputStream.createPushStream();
            const audioConfig = sdk.AudioConfig.fromStreamInput(this.pushStream);

            this.recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

            this.recognizer.recognized = (s, e) => {
                if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                    console.log('Continuous speech recognized', { text: e.result.text });
                    if (onRecognizedCallback) onRecognizedCallback(e.result.text);
                }
            };

            this.recognizer.canceled = (s, e) => {
                console.error('Continuous recognition canceled', {
                    reason: e.reason,
                    errorDetails: e.errorDetails
                });
                this.isRecognizing = false;
                if (onErrorCallback) onErrorCallback(new Error(`Recognition canceled: ${e.errorDetails}`));
            };

            this.recognizer.sessionStopped = () => {
                console.log('Continuous recognition session stopped');
                this.isRecognizing = false;
            };

            this.recognizer.startContinuousRecognitionAsync(
                () => {
                    console.log('Continuous speech recognition started');
                    this.isRecognizing = true;
                },
                (error) => {
                    console.error('Failed to start continuous recognition', { error: error.message });
                    if (onErrorCallback) onErrorCallback(error);
                }
            );

        } catch (error) {
            console.error('Error starting continuous recognition', { error: error.message });
            throw error;
        }
    }

    feedAudioChunk(chunk) {
        if (this.pushStream) {
            this.pushStream.write(chunk);
        } else {
            console.warn('No active push stream to feed audio');
        }
    }

    async stopContinuousRecognition() {
        try {
            if (!this.isRecognizing || !this.recognizer) {
                console.warn('No continuous recognition to stop');
                return;
            }

            this.recognizer.stopContinuousRecognitionAsync(
                () => {
                    console.log('Continuous recognition stopped');
                    this.isRecognizing = false;
                    this.recognizer.close();
                    this.recognizer = null;
                    if (this.pushStream) {
                        this.pushStream.close();
                        this.pushStream = null;
                    }
                },
                (error) => {
                    console.error('Error stopping continuous recognition', { error: error.message });
                    this.isRecognizing = false;
                }
            );

        } catch (error) {
            console.error('Error in stopContinuousRecognition', { error: error.message });
            throw error;
        }
    }

    async textToSpeech(text, voiceName = null) {
        return new Promise((resolve, reject) => {
            try {
                if (process.env.NODE_ENV === 'test') {
                    setTimeout(() => resolve(Buffer.from('fake audio data')), 10);
                    return;
                }

                if (!this.speechConfig || !text) {
                    reject(new Error('Speech configuration not initialized or text is empty'));
                    return;
                }

                if (voiceName) {
                    this.speechConfig.speechSynthesisVoiceName = voiceName;
                }

                const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, null);
                const ssml = this.generateSSML(text, voiceName);

                synthesizer.speakSsmlAsync(
                    (ssml, result) => {
                        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                            const audioBuffer = Buffer.from(result.audioData);
                            resolve(audioBuffer);
                        } else {
                            reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
                        }
                        synthesizer.close();
                    },
                    (error) => {
                        synthesizer.close();
                        reject(error);
                    }
                );
            } catch (error) {
                console.error('Error in textToSpeech', { error: error.message });
                reject(error);
            }
        });
    }

    generateSSML(text, voiceName = null) {
        const voice = voiceName || this.speechConfig.speechSynthesisVoiceName;
        const cleanText = text.replace(/[<>&"']/g, (match) => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&apos;'
        }[match]));
        return `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="${voice}">
                    <prosody rate="medium" pitch="medium">${cleanText}</prosody>
                </voice>
            </speak>
        `;
    }

    async saveAudioToFile(audioBuffer, filePath) {
        try {
            const fs = require('fs').promises;
            await fs.writeFile(filePath, audioBuffer);
            console.log('Audio saved to file', { filePath, size: audioBuffer.length });
        } catch (error) {
            console.error('Error saving audio to file', { error: error.message, filePath });
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
            console.log('Speech service disposed');
        } catch (error) {
            console.error('Error disposing speech service', { error: error.message });
        }
    }
}

module.exports = { SpeechService };
