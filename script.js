// Modern Automated Face Attendance System

// Sound System using Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different sounds for different events
    if (type === 'checkin') {
        // Success sound - ascending tones
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
    } else if (type === 'checkout') {
        // Checkout sound - descending tones
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime); // G5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime + 0.2); // C5
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
    } else if (type === 'register') {
        // Registration sound - celebration
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        frequencies.forEach((freq, index) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, audioContext.currentTime + index * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.1 + 0.3);
            osc.start(audioContext.currentTime + index * 0.1);
            osc.stop(audioContext.currentTime + index * 0.1 + 0.3);
        });
    }
}

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const cameraStatus = document.getElementById('cameraStatus');
const modelStatus = document.getElementById('modelStatus');
const detectionInfo = document.getElementById('detectionInfo');
const registrationModal = document.getElementById('registrationModal');
const totalAttendance = document.getElementById('totalAttendance');
const totalCheckout = document.getElementById('totalCheckout');
const adminBtn = document.getElementById('adminBtn');
const manualCheckoutBtn = document.getElementById('manualCheckoutBtn');

// Modal inputs
const modalUserName = document.getElementById('modalUserName');
const modalUserId = document.getElementById('modalUserId');
const modalDepartment = document.getElementById('modalDepartment');
const confirmRegistration = document.getElementById('confirmRegistration');
const cancelRegistration = document.getElementById('cancelRegistration');

// State
let stream = null;
let modelsLoaded = false;
let isProcessing = false;
let detectionInterval = null;
let noFaceTimeout = null;
let tempFaceData = null;
let currentUser = null;

// Data
let attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
let stats = JSON.parse(localStorage.getItem('stats')) || { checkin: 0, checkout: 0 };
let registeredFaces = JSON.parse(localStorage.getItem('registeredFaces')) || {};
let systemSettings = JSON.parse(localStorage.getItem('systemSettings')) || {
    checkinTime: '09:00',
    checkoutTime: '17:00'
};

console.log('✅ System initialized');

// Load face-api.js models
async function loadModels() {
    try {
        console.log('📦 Loading AI models...');
        modelStatus.classList.add('active');
        
        // استخدام CDN أولاً لضمان عمل الموقع أونلاين
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        const BACKUP_URL = '/models'; // نسخة احتياطية محلية
        
        try {
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            console.log('✅ Models loaded from CDN');
        } catch {
            console.log('⚠️ CDN failed, trying local models...');
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(BACKUP_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(BACKUP_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(BACKUP_URL)
            ]);
            console.log('✅ Models loaded from local files');
        }
        
        modelsLoaded = true;
        modelStatus.classList.remove('active');
        return true;
    } catch (error) {
        console.error('❌ Failed to load models:', error);
        modelStatus.innerHTML = '<p>❌ فشل تحميل النماذج</p>';
        return false;
    }
}

// Start camera
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            }
        });
        
        video.srcObject = stream;
        updateCameraStatus('active', 'الكاميرا نشطة - جاري المراقبة...');
        console.log('📹 Camera started');
        
        startAutoDetection();
    } catch (error) {
        console.error('❌ Camera error:', error);
        updateCameraStatus('error', 'فشل تشغيل الكاميرا');
    }
}

// Stop camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        stopAutoDetection();
        updateCameraStatus('inactive', 'الكاميرا متوقفة');
        console.log('⏸️ Camera stopped');
    }
}

// Update camera status
function updateCameraStatus(status, text) {
    const dot = cameraStatus.querySelector('.status-dot');
    const textEl = cameraStatus.querySelector('.status-text');
    
    dot.className = 'status-dot';
    if (status === 'active') dot.classList.add('active');
    if (status === 'detecting') dot.classList.add('detecting');
    
    textEl.textContent = text;
}

// Start automatic detection
function startAutoDetection() {
    if (detectionInterval) clearInterval(detectionInterval);
    
    detectionInterval = setInterval(async () => {
        if (!isProcessing && modelsLoaded && video.readyState === video.HAVE_ENOUGH_DATA) {
            await detectFace();
        }
    }, 1000); // Check every second
}

// Stop automatic detection
function stopAutoDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
}

// Detect face
async function detectFace() {
    if (!modelsLoaded) return;
    
    try {
        isProcessing = true;
        
        // Detect face
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (detection) {
            // Face detected
            clearTimeout(noFaceTimeout);
            noFaceTimeout = null;
            updateCameraStatus('detecting', 'تم اكتشاف وجه...');
            overlay.querySelector('.scan-frame').classList.add('active');
            
            await processFace(detection);
        } else {
            // No face detected - stop camera after 5 seconds
            overlay.querySelector('.scan-frame').classList.remove('active', 'new-face');
            
            if (!noFaceTimeout) {
                noFaceTimeout = setTimeout(() => {
                    updateDetectionInfo('لا يوجد وجه - سيتم إيقاف الكاميرا...');
                    setTimeout(() => {
                        stopCamera();
                        updateDetectionInfo('انتظر أمام الكاميرا لإعادة التشغيل...');
                    }, 2000);
                }, 5000);
            }
        }
        
    } catch (error) {
        console.error('Detection error:', error);
    } finally {
        isProcessing = false;
    }
}

// Process detected face
async function processFace(detection) {
    const descriptor = Array.from(detection.descriptor);
    const confidence = detection.detection.score;
    
    console.log(`📊 Detection quality: ${(confidence * 100).toFixed(1)}%`);
    
    // Check for glasses/sunglasses using landmarks
    const landmarks = detection.landmarks;
    const hasGlasses = detectGlasses(landmarks);
    
    if (hasGlasses) {
        overlay.querySelector('.scan-frame').classList.add('new-face');
        updateDetectionInfo('⚠️ يرجى إزالة النظارة للتعرف الدقيق');
        console.log('⚠️ Glasses detected');
        return;
    }
    
    // Find matching user
    const matchedUser = findMatchingUser(descriptor);
    
    if (matchedUser) {
        // Known user - auto attendance
        overlay.querySelector('.scan-frame').classList.remove('new-face');
        overlay.querySelector('.scan-frame').classList.add('active');
        updateDetectionInfo(`مرحباً ${matchedUser.userName}!`);
        
        currentUser = matchedUser;
        showManualCheckoutButton(matchedUser);
        
        await recordAttendance(matchedUser);
    } else {
        // New face - start multi-capture registration
        overlay.querySelector('.scan-frame').classList.add('new-face');
        updateDetectionInfo('وجه جديد - جاري التسجيل...');
        
        await startMultiCapture();
    }
}

// Multi-capture for new user registration
let capturedImages = [];
let capturedDescriptors = [];
let capturedAngles = [];

// Calculate face angle using landmarks
function calculateFaceAngle(landmarks) {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const mouth = landmarks.getMouth();
    
    // Calculate yaw (horizontal rotation) using eye positions
    const leftEyeCenter = {
        x: leftEye.reduce((sum, p) => sum + p.x, 0) / leftEye.length,
        y: leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length
    };
    const rightEyeCenter = {
        x: rightEye.reduce((sum, p) => sum + p.x, 0) / rightEye.length,
        y: rightEye.reduce((sum, p) => sum + p.y, 0) / rightEye.length
    };
    
    const noseTip = nose[3]; // Tip of nose
    const eyesMidpoint = {
        x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
        y: (leftEyeCenter.y + rightEyeCenter.y) / 2
    };
    
    // Yaw angle (left-right rotation)
    const yaw = (noseTip.x - eyesMidpoint.x) / (rightEyeCenter.x - leftEyeCenter.x);
    
    // Pitch angle (up-down rotation) using nose and mouth
    const mouthCenter = {
        x: mouth.reduce((sum, p) => sum + p.x, 0) / mouth.length,
        y: mouth.reduce((sum, p) => sum + p.y, 0) / mouth.length
    };
    
    const faceHeight = mouthCenter.y - eyesMidpoint.y;
    const noseYOffset = noseTip.y - eyesMidpoint.y;
    const pitch = noseYOffset / faceHeight;
    
    return { yaw, pitch };
}

// Check if angle is different enough from previous captures
function isAngleDifferent(newAngle, targetAngle) {
    // Very lenient thresholds for much easier capture
    const centerTolerance = 0.35;  // Very lenient for center
    const angleTolerance = 0.08;   // Very small requirement for movement
    const crossTolerance = 0.5;    // Very flexible
    
    console.log(`📊 Checking angle: target=${targetAngle}, yaw=${newAngle.yaw.toFixed(2)}, pitch=${newAngle.pitch.toFixed(2)}`);
    
    // For center position - very lenient
    if (targetAngle === 'center') {
        const result = Math.abs(newAngle.yaw) < centerTolerance && Math.abs(newAngle.pitch) < centerTolerance;
        console.log(`  Center check: ${result}`);
        return result;
    }
    // For right turn - just need slightly positive yaw
    if (targetAngle === 'right') {
        const result = newAngle.yaw > angleTolerance && Math.abs(newAngle.pitch) < crossTolerance;
        console.log(`  Right check: ${result} (yaw > ${angleTolerance})`);
        return result;
    }
    // For left turn - just need slightly negative yaw
    if (targetAngle === 'left') {
        const result = newAngle.yaw < -angleTolerance && Math.abs(newAngle.pitch) < crossTolerance;
        console.log(`  Left check: ${result} (yaw < -${angleTolerance})`);
        return result;
    }
    // For up - just need slightly negative pitch
    if (targetAngle === 'up') {
        const result = newAngle.pitch < -angleTolerance && Math.abs(newAngle.yaw) < crossTolerance;
        console.log(`  Up check: ${result} (pitch < -${angleTolerance})`);
        return result;
    }
    // For down - just need slightly positive pitch
    if (targetAngle === 'down') {
        const result = newAngle.pitch > angleTolerance && Math.abs(newAngle.yaw) < crossTolerance;
        console.log(`  Down check: ${result} (pitch > ${angleTolerance})`);
        return result;
    }
    return false;
}

async function startMultiCapture() {
    capturedImages = [];
    capturedDescriptors = [];
    capturedAngles = [];
    
    // Stop auto detection during capture
    stopAutoDetection();
    
    // Show modal with progress
    registrationModal.style.display = 'flex';
    document.getElementById('captureProgress').style.display = 'block';
    document.getElementById('modalBody').style.display = 'none';
    
    // Connect video to modal
    const modalVideo = document.getElementById('modalVideo');
    if (stream && video.srcObject) {
        modalVideo.srcObject = video.srcObject;
    }
    
    const captureRequirements = [
        { angle: 'center', instruction: 'انظر مباشرة للكاميرا' },
        { angle: 'right', instruction: 'حرك رأسك لليمين' },
        { angle: 'left', instruction: 'حرك رأسك لليسار' },
        { angle: 'up', instruction: 'ارفع رأسك لأعلى' },
        { angle: 'down', instruction: 'اخفض رأسك لأسفل' }
    ];
    
    for (let i = 0; i < captureRequirements.length; i++) {
        const requirement = captureRequirements[i];
        let attempts = 0;
        let captured = false;
        
        // Reset instruction text at start of each angle
        document.getElementById('captureInstructionTitle').textContent = requirement.instruction;
        document.getElementById('captureInstructionText').textContent = `سيتم التقاط ${5 - i} صور من زوايا مختلفة`;
        
        console.log(`📸 Starting capture for: ${requirement.angle}`);
        
        while (!captured && attempts < 30) {  // Increased from 20 to 30
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, attempts === 0 ? 1500 : 400));  // Faster checks
            
            // After 15 failed attempts, just capture any face (fallback)
            let captureResult;
            if (attempts >= 15) {
                console.warn(`⚠️ Auto-capturing after ${attempts} attempts (fallback mode)`);
                document.getElementById('captureInstructionText').textContent = '⏳ التقاط تلقائي...';
                captureResult = await captureFrame(); // Capture without angle check
            } else {
                // Try to capture with angle verification
                captureResult = await captureFrameWithAngle(requirement.angle);
            }
            
            if (captureResult) {
                capturedImages.push(captureResult.imageData);
                capturedDescriptors.push(captureResult.descriptor);
                capturedAngles.push(captureResult.angle);
                
                // Update progress
                document.getElementById('captureCount').textContent = i + 1;
                document.getElementById('progressFill').style.width = `${((i + 1) / 5) * 100}%`;
                
                // Show preview
                const preview = document.createElement('img');
                preview.src = captureResult.imageData;
                preview.className = 'capture-preview';
                document.getElementById('capturePreviews').appendChild(preview);
                
                // Flash effect
                overlay.style.background = 'rgba(16, 185, 129, 0.3)';
                setTimeout(() => overlay.style.background = '', 150);
                
                // Success feedback
                document.getElementById('captureInstructionText').textContent = '✅ تم الالتقاط بنجاح';
                await new Promise(resolve => setTimeout(resolve, 500));
                document.getElementById('captureInstructionText').textContent = `سيتم التقاط ${5 - (i + 1)} صور من زوايا مختلفة`;
                
                captured = true;
            } else {
                attempts++;
                // Show more frequent feedback
                if (attempts % 2 === 0) {  // Every 2 attempts instead of 3
                    document.getElementById('captureInstructionText').textContent = `⚠️ ${requirement.instruction} - حاولة ${attempts}/30`;
                }
            }
        }
        
        if (!captured) {
            // Failed to capture required angle
            alert('فشل التقاط صور من جميع الزوايا. يرجى المحاولة مرة أخرى.');
            hideRegistrationModal();
            return;
        }
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Hide progress, show form
    document.getElementById('captureProgress').style.display = 'none';
    document.getElementById('modalBody').style.display = 'block';
    document.getElementById('modalDescription').textContent = '✅ تم التقاط 5 صور من زوايا مختلفة! الآن أدخل بياناتك';
    
    // Store data temporarily
    tempFaceData = {
        images: capturedImages,
        descriptors: capturedDescriptors,
        mainImage: capturedImages[0]
    };
}

async function captureFrameWithAngle(targetAngle) {
    try {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (!detection) return null;
        
        // Calculate face angle
        const angle = calculateFaceAngle(detection.landmarks);
        
        // Check if angle matches requirement
        if (!isAngleDifferent(angle, targetAngle)) {
            return null;
        }
        
        // Capture image
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        console.log(`✅ Captured ${targetAngle}: yaw=${angle.yaw.toFixed(2)}, pitch=${angle.pitch.toFixed(2)}`);
        
        return {
            imageData: canvas.toDataURL('image/jpeg', 0.9),
            descriptor: Array.from(detection.descriptor),
            angle: angle
        };
    } catch (error) {
        console.error('❌ Capture failed:', error);
        return null;
    }
}

async function captureFrame() {
    try {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (!detection) return null;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        console.log('✅ Captured (no angle check)');
        
        return {
            imageData: canvas.toDataURL('image/jpeg', 0.9),
            descriptor: Array.from(detection.descriptor),
            angle: { yaw: 0, pitch: 0 } // Dummy angle for fallback captures
        };
    } catch (error) {
        console.error('❌ Capture failed:', error);
        return null;
    }
}

// Find matching user
function findMatchingUser(descriptor) {
    const users = Object.values(registeredFaces);
    let bestMatch = null;
    let bestDistance = Infinity;
    
    const EXCELLENT_THRESHOLD = 0.4;
    const GOOD_THRESHOLD = 0.5;
    const ACCEPTABLE_THRESHOLD = 0.6;
    
    for (let user of users) {
        // Support both old single descriptor and new multiple descriptors
        const descriptors = user.faceDescriptors || [user.faceDescriptor];
        if (!descriptors || descriptors.length === 0) continue;
        
        // Compare with all stored descriptors and use the best match
        for (let storedDescriptor of descriptors) {
            if (!storedDescriptor) continue;
            
            const distance = euclideanDistance(descriptor, storedDescriptor);
            
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = user;
            }
        }
    }
    
    if (bestMatch && bestDistance < ACCEPTABLE_THRESHOLD) {
        const confidence = bestDistance < EXCELLENT_THRESHOLD ? 'ممتاز' :
                          bestDistance < GOOD_THRESHOLD ? 'جيد' : 'مقبول';
        console.log(`✅ Match found: ${bestMatch.userId} | Distance: ${bestDistance.toFixed(3)} | Confidence: ${confidence}`);
        return bestMatch;
    }
    
    console.log(`❌ No match (best distance: ${bestDistance.toFixed(3)})`);
    return null;
}

// Detect glasses using facial landmarks
function detectGlasses(landmarks) {
    // Get eye landmarks
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    // Calculate eye region heights
    const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
    const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
    
    // If eyes are too small or partially occluded, likely wearing glasses
    const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
    
    // Threshold for glasses detection (adjust as needed)
    // Smaller values indicate potential occlusion
    if (avgEyeHeight < 5) {
        return true;
    }
    
    return false;
}

// Calculate euclidean distance
function euclideanDistance(desc1, desc2) {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
    
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
        const diff = desc1[i] - desc2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

// Record attendance
async function recordAttendance(user) {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const today = currentTime.toLocaleDateString('ar-EG');
    
    // Check if already recorded today
    const todayRecords = attendanceRecords.filter(r => {
        const recordDate = new Date(r.timestamp).toLocaleDateString('ar-EG');
        return r.userId === user.userId && recordDate === today;
    });
    
    // Determine type (checkin/checkout)
    const [checkinHour] = systemSettings.checkinTime.split(':').map(Number);
    const [checkoutHour] = systemSettings.checkoutTime.split(':').map(Number);
    
    // Check existing records for today
    const hasCheckin = todayRecords.some(r => r.type === 'checkin');
    const hasCheckout = todayRecords.some(r => r.type === 'checkout');
    
    // Determine type based on time and existing records
    let type = 'checkin';
    
    // If already has checkin, check if can register checkout
    if (hasCheckin && !hasCheckout) {
        // Must be after checkout time
        if (currentHour >= checkoutHour) {
            type = 'checkout';
        } else {
            const message = `⚠️ لا يمكن تسجيل الانصراف قبل الساعة ${systemSettings.checkoutTime} - ${user.userName}`;
            updateDetectionInfo(message);
            console.log(message);
            
            // Stop detection for 3 seconds
            stopAutoDetection();
            setTimeout(() => startAutoDetection(), 3000);
            return;
        }
    } else if (hasCheckin && hasCheckout) {
        // Already has both
        const message = `⚠️ تم تسجيل الحضور والانصراف مسبقاً اليوم - ${user.userName}`;
        updateDetectionInfo(message);
        console.log(message);
        
        // Stop detection for 3 seconds
        stopAutoDetection();
        setTimeout(() => startAutoDetection(), 3000);
        return;
    }
    
    // Create record
    const record = {
        id: Date.now(),
        userId: user.userId,
        userName: user.userName,
        department: user.department || '',
        type: type,
        timestamp: currentTime.toISOString(),
        time: currentTime.toLocaleString('ar-EG')
    };
    
    attendanceRecords.unshift(record);
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
    
    stats[type]++;
    localStorage.setItem('stats', JSON.stringify(stats));
    updateStats();
    
    const message = type === 'checkin' 
        ? `✅ تم تسجيل الحضور - ${user.userName}`
        : `🚪 تم تسجيل الانصراف - ${user.userName}`;
    
    updateDetectionInfo(message);
    console.log(message);
        // Play sound based on type
    playSound(type);
        // Stop detection for 3 seconds
    stopAutoDetection();
    setTimeout(() => startAutoDetection(), 3000);
}

// Show registration modal
function showRegistrationModal() {
    registrationModal.style.display = 'flex';
    modalUserName.value = '';
    modalUserId.value = '';
    modalDepartment.value = '';
    modalUserName.focus();
    
    stopAutoDetection();
}

// Hide registration modal
function hideRegistrationModal() {
    registrationModal.style.display = 'none';
    tempFaceData = null;
    startAutoDetection();
}

// Confirm registration
confirmRegistration.addEventListener('click', async () => {
    const userName = modalUserName.value.trim();
    const userId = modalUserId.value.trim();
    const department = modalDepartment.value.trim();
    
    if (!userName || !userId) {
        alert('يرجى إدخال الاسم والرقم الوظيفي');
        return;
    }
    
    if (registeredFaces[userId]) {
        alert('هذا الرقم الوظيفي مسجل مسبقاً');
        return;
    }
    
    // Register user with multiple descriptors
    registeredFaces[userId] = {
        userId: userId,
        userName: userName,
        department: department,
        faceImage: tempFaceData.mainImage || tempFaceData.imageData,
        faceDescriptors: tempFaceData.descriptors || [tempFaceData.descriptor],
        registeredAt: new Date().toISOString()
    };
    
    localStorage.setItem('registeredFaces', JSON.stringify(registeredFaces));
    
    console.log(`✅ Registered: ${userName} (${userId}) with ${tempFaceData.descriptors ? tempFaceData.descriptors.length : 1} face descriptors`);
    
    // Play registration success sound
    playSound('register');
    
    hideRegistrationModal();
    
    // Auto record first attendance only during work hours
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const [checkinHour] = systemSettings.checkinTime.split(':').map(Number);
    const [checkoutHour] = systemSettings.checkoutTime.split(':').map(Number);
    
    // Check if current time is within work hours
    if (currentHour >= checkinHour && currentHour < checkoutHour + 2) {
        await recordAttendance(registeredFaces[userId]);
    } else {
        updateDetectionInfo(`تم تسجيل ${userName} بنجاح! (خارج ساعات العمل - لم يتم تسجيل حضور)`);
        console.log(`📝 Employee registered outside work hours - no attendance recorded`);
        
        // Resume auto detection after 3 seconds
        setTimeout(() => startAutoDetection(), 3000);
    }
});

// Cancel registration
cancelRegistration.addEventListener('click', () => {
    hideRegistrationModal();
});

// Update detection info
function updateDetectionInfo(text) {
    detectionInfo.querySelector('p').textContent = text;
}

// Show/hide manual checkout button
function showManualCheckoutButton(user) {
    const today = new Date().toLocaleDateString('ar-EG');
    const todayRecords = attendanceRecords.filter(r => {
        const recordDate = new Date(r.timestamp).toLocaleDateString('ar-EG');
        return r.userId === user.userId && recordDate === today;
    });
    
    const hasCheckin = todayRecords.some(r => r.type === 'checkin');
    const hasCheckout = todayRecords.some(r => r.type === 'checkout');
    
    // Show button only if has checkin but no checkout
    if (hasCheckin && !hasCheckout) {
        manualCheckoutBtn.style.display = 'flex';
        setTimeout(() => {
            manualCheckoutBtn.style.display = 'none';
        }, 5000); // Hide after 5 seconds
    } else {
        manualCheckoutBtn.style.display = 'none';
    }
}

// Manual checkout button
manualCheckoutBtn.addEventListener('click', async () => {
    if (currentUser) {
        await forceCheckout(currentUser);
        manualCheckoutBtn.style.display = 'none';
    }
});

// Force checkout (manual)
async function forceCheckout(user) {
    const currentTime = new Date();
    const today = currentTime.toLocaleDateString('ar-EG');
    
    const todayRecords = attendanceRecords.filter(r => {
        const recordDate = new Date(r.timestamp).toLocaleDateString('ar-EG');
        return r.userId === user.userId && recordDate === today;
    });
    
    const hasCheckout = todayRecords.some(r => r.type === 'checkout');
    
    if (hasCheckout) {
        updateDetectionInfo('⚠️ تم تسجيل الانصراف مسبقاً اليوم');
        return;
    }
    
    // Create checkout record
    const record = {
        id: Date.now(),
        userId: user.userId,
        userName: user.userName,
        department: user.department || '',
        type: 'checkout',
        timestamp: currentTime.toISOString(),
        time: currentTime.toLocaleString('ar-EG')
    };
    
    attendanceRecords.unshift(record);
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
    
    stats.checkout++;
    localStorage.setItem('stats', JSON.stringify(stats));
    updateStats();
    
    updateDetectionInfo(`🚪 تم تسجيل الانصراف اليدوي - ${user.userName}`);
    console.log(`🚪 Manual checkout: ${user.userName}`);
    
    // Stop detection for 3 seconds
    stopAutoDetection();
    setTimeout(() => startAutoDetection(), 3000);
}

// Update stats
function updateStats() {
    totalAttendance.textContent = stats.checkin;
    totalCheckout.textContent = stats.checkout;
}

// Admin button
adminBtn.addEventListener('click', () => {
    window.location.href = 'login.html';
});

// Initialize on load
window.addEventListener('load', async () => {
    // Check if face-api.js loaded
    if (typeof faceapi === 'undefined') {
        console.error('❌ face-api.js not loaded');
        modelStatus.innerHTML = '<p>❌ فشل تحميل المكتبة</p>';
        return;
    }
    
    console.log('✅ face-api.js loaded');
    
    // Load models
    await loadModels();
    
    // Start camera
    setTimeout(() => {
        startCamera();
    }, 500);
    
    // Start motion detection
    startMotionDetection();
    
    // Update stats
    updateStats();
});

// Auto-start camera when page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !stream) {
        startCamera();
    }
});

// Motion detection to restart camera
let motionDetectionInterval = null;

function startMotionDetection() {
    if (motionDetectionInterval) return;
    
    console.log('👁️ Motion detection active');
    
    motionDetectionInterval = setInterval(async () => {
        // Only check if camera is not running and models are loaded
        if (!stream && modelsLoaded) {
            try {
                const tempStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' }
                });
                
                const tempVideo = document.createElement('video');
                tempVideo.srcObject = tempStream;
                await tempVideo.play();
                
                // Wait for video to stabilize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check for face
                if (tempVideo.readyState === tempVideo.HAVE_ENOUGH_DATA) {
                    const detection = await faceapi.detectSingleFace(tempVideo, 
                        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
                    );
                    
                    // Stop temp stream
                    tempStream.getTracks().forEach(track => track.stop());
                    
                    if (detection) {
                        console.log('👤 Face detected! Starting camera...');
                        await startCamera();
                    }
                } else {
                    // Stop temp stream if not ready
                    tempStream.getTracks().forEach(track => track.stop());
                }
            } catch (error) {
                console.log('⚠️ Motion check error:', error.message);
            }
        }
    }, 3000);
}

// Show registration modal
function showRegistrationModal() {
    registrationModal.style.display = 'flex';
    document.getElementById('captureProgress').style.display = 'none';
    document.getElementById('modalBody').style.display = 'block';
    document.getElementById('modalDescription').textContent = 'تم اكتشاف وجه جديد، يرجى إدخال البيانات';
    
    // Clear form
    modalUserName.value = '';
    modalUserId.value = '';
    modalDepartment.value = '';
    
    // Clear previews
    document.getElementById('capturePreviews').innerHTML = '';
    document.getElementById('captureCount').textContent = '0';
    document.getElementById('progressFill').style.width = '0%';
}

function hideRegistrationModal() {
    registrationModal.style.display = 'none';
    
    // Clear form
    modalUserName.value = '';
    modalUserId.value = '';
    modalDepartment.value = '';
    
    // Clear previews
    document.getElementById('capturePreviews').innerHTML = '';
    document.getElementById('captureCount').textContent = '0';
    document.getElementById('progressFill').style.width = '0%';
    
    // Resume auto detection
    startAutoDetection();
}

// Start motion detection after models loaded
if (modelsLoaded) {
    startMotionDetection();
}

console.log('🚀 Face Attendance System Ready');
