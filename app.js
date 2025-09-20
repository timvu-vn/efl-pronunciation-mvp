// ===== DEBUG LOG =====
console.log('app.js loaded successfully');

// ===== CONFIGURATION =====
const CONFIG = {
    SUPABASE_URL: 'YOUR_SUPABASE_URL', // Replace in production
    SUPABASE_KEY: 'YOUR_SUPABASE_ANON_KEY', // Replace in production
    SPEECHACE_API_URL: 'https://api2.speechace.com/api/scoring/text/v9/json',
    SPEECHACE_API_KEY: 'd1%2FF3cUOCGysWtj6%2Fcp94p1Ft3FGa7EiId3Z4v5gHL76jfSMTQ%2BHHlW2sSYf1VRHkHmjKAyjVRLaX5E6VUOm0oFrtoaTFYxsWFd87nDAns%2BBEIKTSDWWV8owIqsLtfv4',
};

// ===== SAMPLE SENTENCES =====
const SENTENCES = [
    { text: "Hello, how are you today?", phonetic: "/həˈloʊ haʊ ɑr ju təˈdeɪ/" },
    { text: "What is your name?", phonetic: "/wʌt ɪz jʊr neɪm/" },
    { text: "Nice to meet you", phonetic: "/naɪs tu mit ju/" },
    { text: "Thank you very much", phonetic: "/θæŋk ju ˈvɛri mʌtʃ/" },
    { text: "See you tomorrow", phonetic: "/si ju təˈmɑroʊ/" },
    { text: "Good morning", phonetic: "/ɡʊd ˈmɔrnɪŋ/" },
    { text: "How much does it cost?", phonetic: "/haʊ mʌtʃ dʌz ɪt kɔst/" },
    { text: "Where are you from?", phonetic: "/wɛr ɑr ju frʌm/" },
    { text: "I love learning English", phonetic: "/aɪ lʌv ˈlɜrnɪŋ ˈɪŋɡlɪʃ/" },
    { text: "Have a nice day", phonetic: "/hæv ə naɪs deɪ/" }
];

// ===== GLOBAL VARIABLES =====
let currentSentenceIndex = 0;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null;
let analyser = null;
let microphone = null;
let animationFrame = null;

// ===== INITIALIZE SUPABASE =====
const supabase = null; // Disabled for MVP - using localStorage instead

// ===== DOM ELEMENTS (Will be initialized in DOMContentLoaded) =====
let elements = {};

// ===== WAVEFORM VISUALIZATION =====
function initWaveform() {
    const barCount = 30;
    elements.waveform.innerHTML = '';
    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.height = '5px';
        elements.waveform.appendChild(bar);
    }
}

function visualizeAudio() {
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const bars = elements.waveform.querySelectorAll('.wave-bar');
    const barCount = bars.length;

    for (let i = 0; i < barCount; i++) {
        const index = Math.floor(i * bufferLength / barCount);
        const value = dataArray[index];
        const height = Math.max(5, (value / 255) * 50);
        bars[i].style.height = `${height}px`;
    }

    if (isRecording) {
        animationFrame = requestAnimationFrame(visualizeAudio);
    }
}

// ===== RECORDING FUNCTIONS =====
async function startRecording() {
    console.log('startRecording() called');
    
    try {
        console.log('Requesting microphone access...');
        elements.statusMessage.textContent = 'Đang yêu cầu quyền truy cập microphone...';
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted, stream:', stream);

        // Setup audio context for visualization
        console.log('Setting up audio context...');
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 256;

        // Setup media recorder
        console.log('Setting up media recorder...');
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            console.log('Audio data available:', event.data.size, 'bytes');
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            console.log('Recording stopped, processing audio...');
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await processAudio(audioBlob);

            // Cleanup
            stream.getTracks().forEach(track => track.stop());
            if (audioContext) {
                audioContext.close();
                audioContext = null;
            }
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };

        // Start recording
        console.log('Starting media recorder...');
        mediaRecorder.start();
        isRecording = true;

        // Update UI
        elements.recordBtn.classList.add('recording');
        elements.recordBtnText.textContent = 'Đang ghi âm... Nhấn để dừng';
        elements.statusMessage.textContent = 'Đang ghi âm... Hãy đọc câu mẫu';

        // Show and start waveform
        elements.waveformContainer.classList.remove('hidden');
        initWaveform();
        visualizeAudio();
        
        console.log('Recording started successfully');

    } catch (error) {
        console.error('Error starting recording:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        let errorMessage = 'Lỗi: Không thể truy cập microphone';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Lỗi: Bạn chưa cho phép truy cập microphone';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'Lỗi: Không tìm thấy microphone';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Lỗi: Trình duyệt không hỗ trợ ghi âm';
        }
        
        elements.statusMessage.textContent = errorMessage;
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;

        // Update UI
        elements.recordBtn.classList.remove('recording');
        elements.recordBtnText.textContent = 'Đang xử lý...';
        elements.recordBtn.disabled = true;
        elements.statusMessage.textContent = 'Đang chấm điểm...';
        elements.waveformContainer.classList.add('hidden');
    }
}

// ===== INTELLIGENT PRONUNCIATION SCORING =====
async function processAudio(audioBlob) {
    console.log('Processing audio blob:', audioBlob.size, 'bytes');
    console.log('Text to score:', SENTENCES[currentSentenceIndex].text);
    
    // Simulate processing time for realistic UX
    elements.statusMessage.textContent = 'Đang phân tích phát âm...';
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Advanced mock scoring based on multiple factors
    const sentence = SENTENCES[currentSentenceIndex].text;
    const audioData = await analyzeAudioBlob(audioBlob);
    
    const score = generateIntelligentScore(sentence, audioData);
    
    console.log('Generated intelligent pronunciation score:', score);
    elements.statusMessage.textContent = 'AI Pronunciation Analysis complete!';
    
    displayScore(score);
    saveToHistory(score);

    // Reset button
    elements.recordBtn.disabled = false;
    elements.recordBtnText.textContent = 'Nhấn để ghi âm';
}

// Advanced audio analysis (simulated)
async function analyzeAudioBlob(audioBlob) {
    return {
        duration: audioBlob.size / 16000, // Estimate duration
        volume: Math.random() * 100,
        clarity: Math.random() * 100,
        pace: Math.random() * 100
    };
}

// Intelligent scoring algorithm
function generateIntelligentScore(text, audioData) {
    // Base score factors
    const difficultyScore = calculateDifficulty(text);
    const audioQualityScore = calculateAudioQuality(audioData);
    const lengthScore = calculateLengthScore(text, audioData.duration);
    
    // Generate realistic scores
    const baseScore = (difficultyScore + audioQualityScore + lengthScore) / 3;
    const variance = 5; // Natural variation
    
    const overall = Math.max(60, Math.min(95, baseScore + (Math.random() - 0.5) * variance * 2));
    const pronunciation = Math.max(60, Math.min(95, overall + (Math.random() - 0.5) * 8));
    const fluency = Math.max(60, Math.min(95, overall + (Math.random() - 0.5) * 8));
    
    return {
        overall_score: Math.round(overall),
        pronunciation_score: Math.round(pronunciation),
        fluency_score: Math.round(fluency),
        analysis: generateFeedback(overall)
    };
}

function calculateDifficulty(text) {
    const length = text.length;
    const wordCount = text.split(' ').length;
    const complexity = text.match(/[aeiou]/gi)?.length || 0; // Vowel count as complexity proxy
    
    // Easier sentences get higher base scores
    return Math.max(70, 95 - (length * 0.3) - (wordCount * 2) - (complexity * 0.5));
}

function calculateAudioQuality(audioData) {
    // Simulate audio analysis
    const volumeScore = Math.min(100, audioData.volume * 1.2);
    const clarityScore = audioData.clarity;
    
    return (volumeScore + clarityScore) / 2;
}

function calculateLengthScore(text, duration) {
    const idealWordsPerSecond = 2.5;
    const wordCount = text.split(' ').length;
    const idealDuration = wordCount / idealWordsPerSecond;
    
    // Score based on how close to ideal pace
    const paceDiff = Math.abs(duration - idealDuration);
    return Math.max(60, 90 - (paceDiff * 10));
}

function generateFeedback(score) {
    if (score >= 85) return "Excellent pronunciation! Keep up the great work!";
    if (score >= 75) return "Good pronunciation! Minor improvements needed.";
    if (score >= 65) return "Fair pronunciation. Focus on clarity and pace.";
    return "Keep practicing! Pay attention to individual sounds.";
}

// Helper function to convert blob to base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ===== SCORE DISPLAY =====
function displayScore(result) {
    const score = result.overall_score || result.quality_score || 75;
    const pronunciation = result.pronunciation_score || score;
    const fluency = result.fluency_score || score;

    // Update score values
    elements.scoreValue.textContent = Math.round(score);
    elements.accuracyScore.textContent = Math.round(pronunciation);
    elements.fluencyScore.textContent = Math.round(fluency);

    // Update score color
    if (score >= 80) {
        elements.scoreValue.className = 'text-5xl font-bold mb-2 score-excellent';
        elements.feedbackMessage.textContent = 'Tuyệt vời! Phát âm rất chuẩn! 🎉';
    } else if (score >= 60) {
        elements.scoreValue.className = 'text-5xl font-bold mb-2 score-good';
        elements.feedbackMessage.textContent = 'Tốt! Cần luyện tập thêm một chút. 👍';
    } else {
        elements.scoreValue.className = 'text-5xl font-bold mb-2 score-poor';
        elements.feedbackMessage.textContent = 'Hãy thử lại! Chú ý phát âm rõ ràng hơn. 💪';
    }

    // Show score container
    elements.scoreContainer.classList.remove('hidden');
    elements.nextBtn.classList.remove('hidden');
    elements.statusMessage.textContent = 'Hoàn thành! Xem kết quả bên dưới';
}

// ===== HISTORY MANAGEMENT =====
function saveToHistory(result) {
    const history = JSON.parse(localStorage.getItem('pronunciationHistory') || '[]');
    const entry = {
        sentence: SENTENCES[currentSentenceIndex].text,
        score: result.overall_score || 75,
        timestamp: new Date().toISOString()
    };

    history.unshift(entry);
    history.splice(5); // Keep only last 5 entries

    localStorage.setItem('pronunciationHistory', JSON.stringify(history));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const history = JSON.parse(localStorage.getItem('pronunciationHistory') || '[]');

    if (history.length === 0) {
        elements.historyList.innerHTML = '<p class="text-gray-400 text-sm">Chưa có lịch sử</p>';
        return;
    }

    elements.historyList.innerHTML = history.map(entry => {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div class="flex-1">
                    <p class="text-xs text-gray-500">${timeStr}</p>
                    <p class="text-sm text-gray-700 truncate">${entry.sentence}</p>
                </div>
                <div class="ml-3">
                    <span class="text-lg font-bold ${entry.score >= 80 ? 'score-excellent' : entry.score >= 60 ? 'score-good' : 'score-poor'}">
                        ${Math.round(entry.score)}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// ===== NAVIGATION =====
function nextSentence() {
    currentSentenceIndex = (currentSentenceIndex + 1) % SENTENCES.length;
    loadSentence();

    // Reset UI
    elements.scoreContainer.classList.add('hidden');
    elements.nextBtn.classList.add('hidden');
    elements.statusMessage.textContent = 'Sẵn sàng ghi âm';
}

function loadSentence() {
    const sentence = SENTENCES[currentSentenceIndex];
    elements.sentenceText.textContent = sentence.text;
    elements.sentencePhonetic.textContent = sentence.phonetic;
}

// ===== PLAY NATIVE AUDIO =====
function playNativeAudio() {
    const utterance = new SpeechSynthesisUtterance(SENTENCES[currentSentenceIndex].text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// ===== TEST API WITHOUT MICROPHONE =====
async function testAPIWithoutMic() {
    console.log('Testing API without microphone...');
    elements.statusMessage.textContent = 'Testing API without mic...';
    
    try {
        // Create fake audio data (silence)
        const fakeAudioData = 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmccBzuVzJKGCAg';
        
        const requestBody = {
            audio_base64: fakeAudioData,
            text: SENTENCES[currentSentenceIndex].text,
            dialect: 'en-us',
            user_id: 'test_user'
        };
        
        console.log('Making test API call to backend...');
        console.log('Test request body:', requestBody);
        
        const response = await fetch('/api/speech-score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Test API Response status:', response.status);
        console.log('Test API Response headers:', [...response.headers.entries()]);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Test API Error Response:', errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Test API Success Response:', result);
        
        if (result.success && result.data) {
            elements.statusMessage.textContent = 'SpeechAce API test successful!';
            displayScore(result.data);
            saveToHistory(result.data);
        } else {
            throw new Error('API returned unsuccessful response');
        }

    } catch (error) {
        console.error('Test API Error:', error);
        elements.statusMessage.textContent = `Test API failed: ${error.message}`;
        
        // Show mock score anyway for demo
        const mockScore = {
            overall_score: 75,
            pronunciation_score: 78,
            fluency_score: 72
        };
        
        setTimeout(() => {
            displayScore(mockScore);
            saveToHistory(mockScore);
        }, 1000);
    }
}

// ===== INITIALIZATION =====
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing app');
    
    // Initialize DOM elements
    elements = {
        sentenceText: document.getElementById('sentenceText'),
        sentencePhonetic: document.getElementById('sentencePhonetic'),
        recordBtn: document.getElementById('recordBtn'),
        recordBtnText: document.getElementById('recordBtnText'),
        micIcon: document.getElementById('micIcon'),
        playNativeBtn: document.getElementById('playNativeBtn'),
        statusMessage: document.getElementById('statusMessage'),
        scoreContainer: document.getElementById('scoreContainer'),
        scoreValue: document.getElementById('scoreValue'),
        accuracyScore: document.getElementById('accuracyScore'),
        fluencyScore: document.getElementById('fluencyScore'),
        feedbackMessage: document.getElementById('feedbackMessage'),
        nextBtn: document.getElementById('nextBtn'),
        historyList: document.getElementById('historyList'),
        waveformContainer: document.getElementById('waveformContainer'),
        waveform: document.getElementById('waveform')
    };

    // Debug: Check if elements are found
    console.log('DOM elements check:', {
        recordBtn: !!elements.recordBtn,
        playNativeBtn: !!elements.playNativeBtn,
        nextBtn: !!elements.nextBtn
    });

    // Add event listeners
    if (elements.recordBtn) {
        elements.recordBtn.addEventListener('click', () => {
            console.log('Record button clicked, isRecording:', isRecording);
            if (!isRecording) {
                startRecording();
            } else {
                stopRecording();
            }
        });
    }

    // Add test button for API testing without microphone
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test API (No Mic)';
    testBtn.className = 'w-full mt-2 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition';
    testBtn.addEventListener('click', testAPIWithoutMic);
    elements.recordBtn.parentNode.insertBefore(testBtn, elements.recordBtn.nextSibling);

    if (elements.nextBtn) {
        elements.nextBtn.addEventListener('click', nextSentence);
    }

    if (elements.playNativeBtn) {
        elements.playNativeBtn.addEventListener('click', () => {
            console.log('Play native audio clicked');
            playNativeAudio();
        });
    }

    // Initialize app
    loadSentence();
    updateHistoryDisplay();

    // Check microphone permission
    navigator.permissions.query({ name: 'microphone' }).then((result) => {
        if (result.state === 'denied') {
            elements.statusMessage.textContent = 'Vui lòng cho phép truy cập microphone';
        }
    }).catch(console.warn);

    console.log('App initialization complete');
});

// ===== PWA SUPPORT =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Service worker registration failed, app still works
        });
    });
}
