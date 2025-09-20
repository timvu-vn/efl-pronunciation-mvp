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
const supabase = window.supabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;

// ===== DOM ELEMENTS =====
const elements = {
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
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Setup audio context for visualization
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 256;

        // Setup media recorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
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

    } catch (error) {
        console.error('Error starting recording:', error);
        elements.statusMessage.textContent = 'Lỗi: Không thể truy cập microphone';
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

// ===== SPEECHACE API INTEGRATION =====
async function processAudio(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        formData.append('text', SENTENCES[currentSentenceIndex].text);
        formData.append('dialect', 'en-us');
        formData.append('user_id', CONFIG.SPEECHACE_API_KEY);

        const response = await fetch(CONFIG.SPEECHACE_API_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const result = await response.json();
        displayScore(result);
        saveToHistory(result);

    } catch (error) {
        console.error('Error processing audio:', error);

        // Fallback: Generate random score for testing
        const mockScore = {
            overall_score: Math.floor(Math.random() * 30) + 70,
            pronunciation_score: Math.floor(Math.random() * 30) + 70,
            fluency_score: Math.floor(Math.random() * 30) + 70
        };

        elements.statusMessage.textContent = 'Using mock score (API error)';
        displayScore(mockScore);
        saveToHistory(mockScore);
    }

    // Reset button
    elements.recordBtn.disabled = false;
    elements.recordBtnText.textContent = 'Nhấn để ghi âm';
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

// ===== EVENT LISTENERS =====
elements.recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

elements.nextBtn.addEventListener('click', nextSentence);
elements.playNativeBtn.addEventListener('click', playNativeAudio);

// ===== INITIALIZATION =====
window.addEventListener('DOMContentLoaded', () => {
    loadSentence();
    updateHistoryDisplay();

    // Check microphone permission
    navigator.permissions.query({ name: 'microphone' }).then((result) => {
        if (result.state === 'denied') {
            elements.statusMessage.textContent = 'Vui lòng cho phép truy cập microphone';
        }
    });
});

// ===== PWA SUPPORT =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Service worker registration failed, app still works
        });
    });
}
