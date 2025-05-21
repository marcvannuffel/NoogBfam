// Audio-Kontext initialisieren
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Globale Variablen
let isPlaying = false;
let intervalId;
let step = 0;

// Oszillatoren
let osc1 = audioCtx.createOscillator();
let osc2 = audioCtx.createOscillator();

// Gain Nodes für Oszillatoren
let osc1Gain = audioCtx.createGain();
let osc2Gain = audioCtx.createGain();

// Noise Generator
let noiseNode = audioCtx.createBufferSource();
let noiseGain = audioCtx.createGain();

// Mixer Gain Nodes
let mixOsc1Gain = audioCtx.createGain();
let mixOsc2Gain = audioCtx.createGain();
let mixNoiseGain = audioCtx.createGain();

// VCA Gain Node
let vcaGain = audioCtx.createGain();
vcaGain.gain.value = 0.7; // Master Volume auf 1.0 erhöht

// Effekte Toggles
let reverbToggle = false; // Reverb-Modul
let delayToggle = false;
let distortionToggle = false;
let stereoWidenerToggle = false;

// Reverb Nodes
let reverbDelayNode1 = audioCtx.createDelay(2.0); // maxDelayTime auf 2 Sekunden
let reverbFeedbackGain1 = audioCtx.createGain();
reverbFeedbackGain1.gain.value = 0.6; // Feedback auf 0.6 erhöht

let reverbDelayNode2 = audioCtx.createDelay(2.0); // maxDelayTime auf 2 Sekunden
let reverbFeedbackGain2 = audioCtx.createGain();
reverbFeedbackGain2.gain.value = 0.45; // Feedback auf 0.45 erhöht

// Reverb Wet Gain
let reverbWetGain = audioCtx.createGain();
reverbWetGain.gain.value = 0.7; // Reverb Wet Gain auf 0.7 erhöht

// Verbinden der Reverb Nodes
reverbDelayNode1.connect(reverbFeedbackGain1);
reverbFeedbackGain1.connect(reverbDelayNode1);
reverbDelayNode1.connect(reverbWetGain);

reverbDelayNode2.connect(reverbFeedbackGain2);
reverbFeedbackGain2.connect(reverbDelayNode2);
reverbDelayNode2.connect(reverbWetGain);

// Delay Nodes
let delayDelayNode = audioCtx.createDelay(2.0); // maxDelayTime auf 2 Sekunden
let delayFeedbackGain = audioCtx.createGain();
delayFeedbackGain.gain.value = 0.5;

let delayWetGain = audioCtx.createGain();
delayWetGain.gain.value = 0.5; // Delay Wet Gain auf 0.5 erhöht

// Verbinden der Delay Nodes
delayDelayNode.connect(delayFeedbackGain);
delayFeedbackGain.connect(delayDelayNode);
delayDelayNode.connect(delayWetGain);

// Distortion Node
let distortionNode = audioCtx.createWaveShaper();
let distortionWetGain = audioCtx.createGain();
distortionWetGain.gain.value = 1.0;

// Stereo Widener Nodes
let splitter = audioCtx.createChannelSplitter(2);
let merger = audioCtx.createChannelMerger(2);
let stereoPhaseOffsetDelay = audioCtx.createDelay(0.1); // 100ms maxDelayTime
stereoPhaseOffsetDelay.delayTime.value = 0.02; // 20ms Verzögerung

// Filter
let filter = audioCtx.createBiquadFilter();

// Hüllkurven
let envAttack = 0.01;
let envDecay = 0.2;
let envSustain = 0.7;
let envRelease = 0.5;
let filterEnvAmount = 0.5;

// Modulation
let modAmount = 0;
let modSource = 'vco2'; // 'vco2' oder 'env'
let modDestination = 'pitch'; // 'pitch', 'wave', 'filter'

// Modulation Gain Node
let modGain = audioCtx.createGain();
modGain.gain.value = modAmount;

// Synchronisation
let isSyncing = false;

// Sequencer Daten
let tempo = 120;
let sequencerData = [];

// Oszilloskop
let analyser = audioCtx.createAnalyser();
let dataArray;
let bufferLength;

// Oszillator Basisfrequenzen
let osc1BaseFreq = parseFloat(document.getElementById('osc1Freq').value);
let osc2BaseFreq = parseFloat(document.getElementById('osc2Freq').value);

// Initialisierung
function init() {
    // Oszillator 1
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(getExponentialFrequency(osc1BaseFreq), audioCtx.currentTime);
    osc1Gain.gain.setValueAtTime(1, audioCtx.currentTime);
    osc1.connect(osc1Gain);

    // Oszillator 2
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(getExponentialFrequency(osc2BaseFreq), audioCtx.currentTime);
    osc2Gain.gain.setValueAtTime(1, audioCtx.currentTime);
    osc2.connect(osc2Gain);

    // Modulation
    setupModulation();

    // Noise Generator
    noiseNode.buffer = createNoiseBuffer();
    noiseNode.loop = true;
    noiseGain.gain.setValueAtTime(1, audioCtx.currentTime);
    noiseNode.connect(noiseGain);

    // Mixer
    osc1Gain.connect(mixOsc1Gain);
    osc2Gain.connect(mixOsc2Gain);
    noiseGain.connect(mixNoiseGain);

    // Mischen
    mixOsc1Gain.connect(vcaGain);
    mixOsc2Gain.connect(vcaGain);
    mixNoiseGain.connect(vcaGain);

    // Effekte einrichten
    setupEffects();

    // Analyser für das Oszilloskop
    analyser.fftSize = 2048;
    bufferLength = analyser.fftSize;
    dataArray = new Uint8Array(bufferLength);

    // Ausgang
    vcaGain.connect(filter);
    filter.connect(analyser);
    analyser.connect(audioCtx.destination);

    // Starten
    osc1.start();
    osc2.start();
    noiseNode.start();

    // Sequencer initialisieren
    initSequencer();

    // Oszilloskop starten
    drawOscilloscope();

    // Einstellungen laden
    loadSettingsOnStart();
}

// Funktion zum Begrenzen von Werten
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Exponentielle Frequenzberechnung
function getExponentialFrequency(value) {
    // Mappt den Sliderwert (0-100) auf einen Frequenzbereich von 20 Hz bis 5000 Hz exponentiell
    let minFreq = 20;
    let maxFreq = 5000;
    let expValue = minFreq * Math.pow(maxFreq / minFreq, value / 100);
    return clamp(expValue, minFreq, 24000); // Sicherstellen, dass die Frequenz nicht über 24000 Hz geht
}

// Noise Buffer erstellen
function createNoiseBuffer() {
    let bufferSize = audioCtx.sampleRate;
    let buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    let data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

// Hüllkurve triggern
function triggerEnvelope(velocity) {
    let now = audioCtx.currentTime;

    // VCA Hüllkurve
    vcaGain.gain.cancelScheduledValues(now);
    vcaGain.gain.setValueAtTime(vcaGain.gain.value, now); // Start von aktuellem Wert
    vcaGain.gain.linearRampToValueAtTime(velocity * document.getElementById('masterVolume').value, now + envAttack);
    vcaGain.gain.linearRampToValueAtTime(envSustain * velocity * document.getElementById('masterVolume').value, now + envAttack + envDecay);
    vcaGain.gain.linearRampToValueAtTime(0.001, now + envAttack + envDecay + envRelease);

    // VCF Hüllkurve
    filter.frequency.cancelScheduledValues(now);
    let cutoff = parseFloat(document.getElementById('filterCutoff').value);
    let maxCutoff = 24000; // Maximalwert gemäß BiquadFilter
    let envAmount = filterEnvAmount * maxCutoff;

    let modulatedCutoff = cutoff + envAmount;
    modulatedCutoff = clamp(modulatedCutoff, 20, 24000); // Sicherstellen, dass Cutoff innerhalb des Bereichs bleibt

    filter.frequency.setValueAtTime(filter.frequency.value, now); // Start von aktuellem Wert
    filter.frequency.linearRampToValueAtTime(modulatedCutoff, now + envAttack);
    filter.frequency.linearRampToValueAtTime(cutoff, now + envAttack + envDecay + envRelease);

    // Modulation Envelope (wenn Modulationsquelle 'env' ist und Destination 'pitch')
    if (modSource === 'env' && modDestination === 'pitch') {
        osc1.frequency.cancelScheduledValues(now);
        osc1.frequency.setValueAtTime(osc1.frequency.value, now); // Start von aktuellem Wert
        let targetFreq = getExponentialFrequency(osc1BaseFreq) + modAmount;
        targetFreq = clamp(targetFreq, 20, 24000); // Sicherstellen, dass die Frequenz innerhalb des Bereichs bleibt
        osc1.frequency.linearRampToValueAtTime(targetFreq, now + envAttack);
        osc1.frequency.linearRampToValueAtTime(getExponentialFrequency(osc1BaseFreq), now + envAttack + envDecay + envRelease);
    }
}

// Sequencer abspielen
function playSequence() {
    let interval = (60 / tempo) * 1000; // Berechnung für Millisekunden

    intervalId = setInterval(() => {
        let stepData = sequencerData[step % sequencerData.length];
        let pitchOffset = stepData.pitch;
        let velocity = stepData.velocity;

        // Oszillator-Frequenzen setzen
        // Pitch in Halbtönen umrechnen
        let osc1Freq = getExponentialFrequency(osc1BaseFreq) * Math.pow(2, pitchOffset / 12);
        let osc2Freq = getExponentialFrequency(osc2BaseFreq) * Math.pow(2, pitchOffset / 12);

        osc1Freq = clamp(osc1Freq, 20, 24000);
        osc2Freq = clamp(osc2Freq, 20, 24000);

        osc1.frequency.setValueAtTime(osc1Freq, audioCtx.currentTime);
        osc2.frequency.setValueAtTime(osc2Freq, audioCtx.currentTime);

        // Hüllkurven triggern
        triggerEnvelope(velocity);

        // Sequencer LEDs aktualisieren
        updateSequencerLEDs(step % sequencerData.length);

        step++;
    }, interval);
}

// Sequencer LEDs aktualisieren
function updateSequencerLEDs(currentStep) {
    for (let i = 0; i < sequencerData.length; i++) {
        let led = document.querySelector(`.sequencer-step[data-step="${i}"] .sequencer-led`);
        if (led) { // Überprüfen, ob das Element existiert
            if (i === currentStep) {
                led.style.backgroundColor = '#f00'; // Aktiver Schritt
            } else {
                led.style.backgroundColor = '#400'; // Inaktiver Schritt
            }
        }
    }
}

// Event Listener hinzufügen
function addEventListeners() {
    // Modulation
    document.getElementById('modAmount').addEventListener('input', (event) => {
        modAmount = parseFloat(event.target.value);
        modGain.gain.setValueAtTime(modAmount, audioCtx.currentTime);
    });
    document.getElementById('modSource').addEventListener('change', (event) => {
        modSource = event.target.value;
        setupModulation();
    });
    document.getElementById('modDestination').addEventListener('change', (event) => {
        modDestination = event.target.value;
        setupModulation();
    });

    // Sync Toggle
    document.getElementById('syncToggle').addEventListener('change', (event) => {
        isSyncing = event.target.checked;
        if (isSyncing) {
            // Start einer periodischen Funktion zur Synchronisation
            if (!syncIntervalId) {
                syncIntervalId = setInterval(() => {
                    osc2.frequency.setValueAtTime(osc1.frequency.value, audioCtx.currentTime);
                }, 50); // Alle 50ms aktualisieren
            }
        } else {
            // Stoppen der periodischen Synchronisation
            if (syncIntervalId) {
                clearInterval(syncIntervalId);
                syncIntervalId = null;
            }
            // Osc2 Frequenz zurücksetzen
            osc2.frequency.setValueAtTime(getExponentialFrequency(osc2BaseFreq), audioCtx.currentTime);
        }
    });

    // Oszillator 1
    document.getElementById('osc1Freq').addEventListener('input', (event) => {
        osc1BaseFreq = parseFloat(event.target.value);
        osc1.frequency.setValueAtTime(getExponentialFrequency(osc1BaseFreq), audioCtx.currentTime);
    });
    document.getElementById('osc1Wave').addEventListener('change', (event) => {
        osc1.type = event.target.value;
    });

    // Oszillator 2
    document.getElementById('osc2Freq').addEventListener('input', (event) => {
        osc2BaseFreq = parseFloat(event.target.value);
        osc2.frequency.setValueAtTime(getExponentialFrequency(osc2BaseFreq), audioCtx.currentTime);
    });
    document.getElementById('osc2Wave').addEventListener('change', (event) => {
        osc2.type = event.target.value;
    });

    // Mixer Levels
    document.getElementById('mixOsc1').addEventListener('input', (event) => {
        mixOsc1Gain.gain.setValueAtTime(event.target.value, audioCtx.currentTime);
    });
    document.getElementById('mixOsc2').addEventListener('input', (event) => {
        mixOsc2Gain.gain.setValueAtTime(event.target.value, audioCtx.currentTime);
    });
    document.getElementById('mixNoise').addEventListener('input', (event) => {
        mixNoiseGain.gain.setValueAtTime(event.target.value, audioCtx.currentTime);
    });

    // Master Volume
    document.getElementById('masterVolume').addEventListener('input', (event) => {
        vcaGain.gain.setValueAtTime(event.target.value, audioCtx.currentTime);
    });

    // Effekt Toggles im VCA
    document.getElementById('reverbToggleVCA').addEventListener('change', (event) => {
        reverbToggle = event.target.checked;
        updateEffectChain();
        updateIndicator('reverbIndicatorVCA', reverbToggle);
    });
    document.getElementById('delayToggleVCA').addEventListener('change', (event) => {
        delayToggle = event.target.checked;
        updateEffectChain();
        updateIndicator('delayIndicatorVCA', delayToggle);
    });
    document.getElementById('distortionToggleVCA').addEventListener('change', (event) => {
        distortionToggle = event.target.checked;
        updateEffectChain();
        updateIndicator('distortionIndicatorVCA', distortionToggle);
    });
    document.getElementById('stereoWidenerToggleVCA').addEventListener('change', (event) => {
        stereoWidenerToggle = event.target.checked;
        updateEffectChain();
        updateIndicator('stereoWidenerIndicatorVCA', stereoWidenerToggle);
    });

    // Effekt Parameter
    // Reverb (ehemals Echo)
    document.getElementById('reverbTime').addEventListener('input', (event) => {
        let newDelayTime = clamp(parseFloat(event.target.value), 0.1, 2.0); // Angepasst auf max 2.0
        reverbDelayNode1.delayTime.setValueAtTime(newDelayTime, audioCtx.currentTime);
        reverbDelayNode2.delayTime.setValueAtTime(newDelayTime * 0.6, audioCtx.currentTime); // Unterschiedliche Delay-Zeiten für Reverb
    });
    document.getElementById('reverbFeedback').addEventListener('input', (event) => {
        let newFeedback = clamp(parseFloat(event.target.value), 0, 0.9);
        reverbFeedbackGain1.gain.setValueAtTime(newFeedback, audioCtx.currentTime);
        reverbFeedbackGain2.gain.setValueAtTime(newFeedback * 0.75, audioCtx.currentTime); // Unterschiedliches Feedback
    });

    // Delay
    document.getElementById('delayTime').addEventListener('input', (event) => {
        let newDelayTime = clamp(parseFloat(event.target.value), 0.1, 2.0); // Angepasst auf max 2.0
        delayDelayNode.delayTime.setValueAtTime(newDelayTime, audioCtx.currentTime);
    });
    document.getElementById('delayFeedback').addEventListener('input', (event) => {
        delayFeedbackGain.gain.setValueAtTime(clamp(parseFloat(event.target.value), 0, 0.9), audioCtx.currentTime);
    });

    // Distortion
    document.getElementById('distortionAmount').addEventListener('input', (event) => {
        distortionNode.curve = makeDistortionCurve(clamp(parseFloat(event.target.value), 0, 1000));
    });
    document.getElementById('distortionOversample').addEventListener('change', (event) => {
        distortionNode.oversample = event.target.value;
    });

    // Stereo Widener
    document.getElementById('stereoWidth').addEventListener('input', (event) => {
        let width = clamp(parseFloat(event.target.value), 0, 2);
        stereoPhaseOffsetDelay.delayTime.setValueAtTime(width * 0.02, audioCtx.currentTime); // Max 20ms
    });
    document.getElementById('stereoPhase').addEventListener('input', (event) => {
        // Optional: Weitere Anpassungen für den Phasenoffset können hier vorgenommen werden
        // Momentan wird der Phasenoffset durch stereoPhaseOffsetDelay.delayTime gesteuert
    });

    // Filter
    document.getElementById('filterType').addEventListener('change', (event) => {
        filter.type = event.target.value;
    });
    document.getElementById('filterCutoff').addEventListener('input', (event) => {
        let cutoff = clamp(parseFloat(event.target.value), 20, 24000);
        filter.frequency.linearRampToValueAtTime(cutoff, audioCtx.currentTime + 0.01); // Sanfte Übergänge
    });
    document.getElementById('filterResonance').addEventListener('input', (event) => {
        filter.Q.setValueAtTime(parseFloat(event.target.value), audioCtx.currentTime);
    });
    document.getElementById('filterEnvAmount').addEventListener('input', (event) => {
        filterEnvAmount = parseFloat(event.target.value);
    });

    // Envelope
    document.getElementById('envAttack').addEventListener('input', (event) => {
        envAttack = parseFloat(event.target.value);
    });
    document.getElementById('envDecay').addEventListener('input', (event) => {
        envDecay = parseFloat(event.target.value);
    });
    document.getElementById('envSustain').addEventListener('input', (event) => {
        envSustain = parseFloat(event.target.value);
    });
    document.getElementById('envRelease').addEventListener('input', (event) => {
        envRelease = parseFloat(event.target.value);
    });

    // Tempo
    document.getElementById('tempo').addEventListener('input', (event) => {
        tempo = parseInt(event.target.value);
        if (isPlaying) {
            clearInterval(intervalId);
            playSequence();
        }
    });

    // Start/Stopp
    document.getElementById('startButton').addEventListener('click', () => {
        if (!isPlaying) {
            audioCtx.resume().then(() => {
                isPlaying = true;
                playSequence();
            });
        }
    });

    document.getElementById('stopButton').addEventListener('click', () => {
        if (isPlaying) {
            isPlaying = false;
            clearInterval(intervalId);
            vcaGain.gain.cancelScheduledValues(audioCtx.currentTime);
            vcaGain.gain.setValueAtTime(0, audioCtx.currentTime);
            // LEDs zurücksetzen
            updateSequencerLEDs(-1);
        }
    });

    // Randomization Buttons
    document.getElementById('randomizePitchButton').addEventListener('click', () => {
        randomizePitch();
    });
    document.getElementById('randomizeVelocityButton').addEventListener('click', () => {
        randomizeVelocity();
    });

    // Settings Overlay
    document.getElementById('settingsButton').addEventListener('click', () => {
        document.getElementById('settingsOverlay').style.display = 'block';
        updateLoadSelect();
    });

    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsOverlay').style.display = 'none';
    });

    // Preset speichern und laden
    document.getElementById('saveButton').addEventListener('click', () => {
        saveSettings();
    });
    document.getElementById('loadButton').addEventListener('click', () => {
        loadSettings();
    });

    // Share Button
    document.getElementById('shareButton').addEventListener('click', () => {
        shareSettings();
    });

    // Hinzufügen der Step-Buttons für alle Slider
    addStepButtons('modAmount');
    addStepButtons('osc1Freq');
    addStepButtons('osc2Freq');
    addStepButtons('filterCutoff');
    addStepButtons('filterResonance');
    addStepButtons('filterEnvAmount');
    addStepButtons('envAttack');
    addStepButtons('envDecay');
    addStepButtons('envSustain');
    addStepButtons('envRelease');
    addStepButtons('mixOsc1');
    addStepButtons('mixOsc2');
    addStepButtons('mixNoise');
    addStepButtons('masterVolume');
    addStepButtons('reverbTime'); // Umbenannt von 'echoTime' zu 'reverbTime'
    addStepButtons('reverbFeedback'); // Umbenannt von 'echoFeedback' zu 'reverbFeedback'
    addStepButtons('delayTime');
    addStepButtons('delayFeedback');
    addStepButtons('distortionAmount');
    addStepButtons('stereoWidth');
    addStepButtons('stereoPhase');
}

// Hinzufügen der Step-Buttons Funktion
function addStepButtons(id) {
    const decreaseButton = document.getElementById(`${id}Decrease`);
    const increaseButton = document.getElementById(`${id}Increase`);
    const slider = document.getElementById(id);

    decreaseButton.addEventListener('click', () => {
        let newValue = parseFloat(slider.value) - parseFloat(slider.step);
        newValue = clamp(newValue, parseFloat(slider.min), parseFloat(slider.max));
        slider.value = newValue;
        slider.dispatchEvent(new Event('input'));
    });

    increaseButton.addEventListener('click', () => {
        let newValue = parseFloat(slider.value) + parseFloat(slider.step);
        newValue = clamp(newValue, parseFloat(slider.min), parseFloat(slider.max));
        slider.value = newValue;
        slider.dispatchEvent(new Event('input'));
    });
}

// Modulation einrichten
function setupModulation() {
    // Vorherige Modulationsverbindungen trennen
    modGain.disconnect();
    osc2.disconnect();
    osc2.connect(osc2Gain);

    modGain.gain.setValueAtTime(modAmount, audioCtx.currentTime);

    if (modSource === 'vco2') {
        // Use osc2 as modulation source
        osc2.connect(modGain);
    }

    if (modDestination === 'pitch') {
        // Connect modulation to osc1 frequency
        modGain.connect(osc1.frequency);
    } else if (modDestination === 'wave') {
        // Modulation der Wellenform könnte komplexer sein
        // Hier könnte man beispielsweise den Typ ändern oder einen weiteren Oszillator hinzufügen
        // Für die Nachbildung begrenzen wir uns auf Pitch und Filter
    } else if (modDestination === 'filter') {
        // Modulation des Filter-Cutoffs
        modGain.connect(filter.frequency);
    }
}

// Effekte einrichten
function setupEffects() {
    // Filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(clamp(parseFloat(document.getElementById('filterCutoff').value), 20, 24000), audioCtx.currentTime);
    filter.Q.setValueAtTime(parseFloat(document.getElementById('filterResonance').value), audioCtx.currentTime);

    // Effekt-Kette
    vcaGain.connect(filter);
    updateEffectChain();
}

// Effektkette aktualisieren
// Effektkette aktualisieren
function updateEffectChain() {
    console.log("Updating effect chain...");
    
    // Trennen aller Verbindungen
    filter.disconnect();
    reverbDelayNode1.disconnect();
    reverbFeedbackGain1.disconnect();
    reverbDelayNode2.disconnect();
    reverbFeedbackGain2.disconnect();
    delayDelayNode.disconnect();
    delayFeedbackGain.disconnect();
    distortionNode.disconnect();
    distortionWetGain.disconnect();
    splitter.disconnect();
    merger.disconnect();
    stereoPhaseOffsetDelay.disconnect();
    reverbWetGain.disconnect();
    delayWetGain.disconnect();

    // Hauptsignalweg wieder verbinden
    vcaGain.connect(filter);
    filter.connect(analyser);
    analyser.connect(audioCtx.destination);
    console.log("Hauptsignalweg verbunden: vcaGain -> filter -> analyser -> destination");

    // Effekte hinzufügen
    // Distortion
    if (distortionToggle) {
        console.log("Distortion aktiviert");
        filter.connect(distortionNode);
        distortionNode.connect(distortionWetGain);
        distortionWetGain.connect(audioCtx.destination);
        console.log("Distortion verbunden: filter -> distortionNode -> distortionWetGain -> destination");
    }

    // Reverb
    if (reverbToggle) {
        console.log("Reverb aktiviert");
        filter.connect(reverbDelayNode1);
        filter.connect(reverbDelayNode2);
        reverbDelayNode1.connect(reverbFeedbackGain1);
        reverbFeedbackGain1.connect(reverbDelayNode1);
        reverbDelayNode2.connect(reverbFeedbackGain2);
        reverbFeedbackGain2.connect(reverbDelayNode2);
        reverbDelayNode1.connect(reverbWetGain);
        reverbDelayNode2.connect(reverbWetGain);
        reverbWetGain.connect(audioCtx.destination);
        console.log("Reverb verbunden: filter -> reverbDelayNodes -> reverbFeedbackGains -> reverbWetGain -> destination");
    }

    // Delay
    if (delayToggle) {
        console.log("Delay aktiviert");
        filter.connect(delayDelayNode);
        delayDelayNode.connect(delayFeedbackGain);
        delayFeedbackGain.connect(delayDelayNode);
        delayDelayNode.connect(delayWetGain);
        delayWetGain.connect(audioCtx.destination);
        console.log("Delay verbunden: filter -> delayDelayNode -> delayFeedbackGain -> delayWetGain -> destination");
    }

    // Stereo Widener
    if (stereoWidenerToggle) {
        console.log("Stereo Widener aktiviert");
        // Sicherstellen, dass das Signal stereo ist
        let stereoNode = audioCtx.createStereoPanner(); // StereoPannerNode hinzufügen
        filter.connect(stereoNode);
        stereoNode.connect(splitter);
        splitter.connect(merger, 0, 0); // Linker Kanal direkt an Merger Eingang 0
        splitter.connect(stereoPhaseOffsetDelay, 1, 0); // Korrigiert: Ausgang 1 des Splitters zu Eingang 0 des Delay Nodes
        stereoPhaseOffsetDelay.connect(merger, 0, 1); // Korrigiert: Ausgang 0 des Delay Nodes zu Eingang 1 des Mergers
        merger.connect(audioCtx.destination);
        console.log("Stereo Widener verbunden: filter -> stereoPanner -> splitter -> merger -> destination");
    }

    // Wenn keine Effekte aktiv sind, bleibt der Hauptsignalweg verbunden
    if (!distortionToggle && !reverbToggle && !delayToggle && !stereoWidenerToggle) {
        console.log("Keine Effekte aktiv, Hauptsignalweg bleibt verbunden.");
    }
}


// Indikator aktualisieren
function updateIndicator(indicatorId, isActive) {
    let indicator = document.getElementById(indicatorId);
    if (indicator) { // Überprüfen, ob das Element existiert
        if (isActive) {
            indicator.style.backgroundColor = '#f00'; // Leuchtendes Rot für aktiv
        } else {
            indicator.style.backgroundColor = '#400'; // Dunkles Rot für inaktiv
        }
    }
}

// Distortion Kurve erstellen
function makeDistortionCurve(amount) {
    let n_samples = 44100;
    let curve = new Float32Array(n_samples);
    let deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        let x = (i * 2) / n_samples - 1;
        curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

// Sequencer initialisieren
function initSequencer() {
    let sequencerSteps = document.getElementById('sequencerSteps');
    for (let i = 0; i < 8; i++) {
        let stepDiv = document.createElement('div');
        stepDiv.className = 'sequencer-step';
        stepDiv.dataset.step = i;

        // Sequencer LED
        let led = document.createElement('div');
        led.className = 'sequencer-led';
        stepDiv.appendChild(led);

        // Pitch
        let pitchLabel = document.createElement('label');
        pitchLabel.innerText = `Pitch ${i + 1}`;
        let pitchInput = document.createElement('input');
        pitchInput.type = 'range';
        pitchInput.min = '-24'; // -2 Oktaven
        pitchInput.max = '24';  // +2 Oktaven
        pitchInput.step = '1';  // Finer steps
        pitchInput.value = '0';
        pitchInput.dataset.index = i;

        // Velocity
        let velLabel = document.createElement('label');
        velLabel.innerText = `Velocity ${i + 1}`;
        let velInput = document.createElement('input');
        velInput.type = 'range';
        velInput.min = '0';
        velInput.max = '1';
        velInput.step = '0.01';
        velInput.value = '1';
        velInput.dataset.index = i;

        // Event Listener
        pitchInput.addEventListener('input', (event) => {
            let index = event.target.dataset.index;
            sequencerData[index].pitch = parseFloat(event.target.value);
        });
        velInput.addEventListener('input', (event) => {
            let index = event.target.dataset.index;
            sequencerData[index].velocity = parseFloat(event.target.value);
        });

        // Sequencer Daten initialisieren
        sequencerData.push({
            pitch: parseFloat(pitchInput.value),
            velocity: parseFloat(velInput.value),
        });

        // Elemente hinzufügen
        stepDiv.appendChild(pitchLabel);
        stepDiv.appendChild(pitchInput);
        stepDiv.appendChild(velLabel);
        stepDiv.appendChild(velInput);
        sequencerSteps.appendChild(stepDiv);
    }
}

// Randomisierung der Pitch-Werte nach harmonischen Regeln
function randomizePitch() {
    const scales = [0, 2, 4, 5, 7, 9, 11]; // Dur-Tonleiterintervalle
    for (let i = 0; i < sequencerData.length; i++) {
        let randomNote = scales[Math.floor(Math.random() * scales.length)];
        sequencerData[i].pitch = randomNote;
        let pitchInput = document.querySelector(`input[type="range"][data-index="${i}"]`);
        if (pitchInput) {
            pitchInput.value = randomNote;
        }
    }
}

// Randomisierung der Velocity-Werte
function randomizeVelocity() {
    for (let i = 0; i < sequencerData.length; i++) {
        let randomVelocity = (Math.random()).toFixed(2);
        sequencerData[i].velocity = parseFloat(randomVelocity);
        let velInput = document.querySelectorAll(`input[type="range"][data-index="${i}"]`)[1];
        if (velInput) {
            velInput.value = randomVelocity;
        }
    }
}

// Einstellungen speichern
function saveSettings() {
    let saveName = document.getElementById('saveName').value.trim() || 'Default';
    if (!saveName) {
        alert('Bitte geben Sie einen gültigen Preset-Namen ein.');
        return;
    }

    let settings = collectSettings();

    localStorage.setItem(saveName, JSON.stringify(settings));
    updateLoadSelect();
    // Speichern des letzten gespeicherten Namens
    localStorage.setItem('lastSaveName', saveName);
    alert(`Preset "${saveName}" wurde erfolgreich gespeichert.`);
}

// Einstellungen teilen
function shareSettings() {
    let settings = collectSettings();
    let settingsString = encodeURIComponent(JSON.stringify(settings));
    let url = `${window.location.origin}${window.location.pathname}?settings=${settingsString}`;
    prompt('Teilen Sie diesen Link:', url);
}

// Einstellungen sammeln
function collectSettings() {
    return {
        osc1Freq: osc1BaseFreq,
        osc1Wave: osc1.type,
        osc2Freq: osc2BaseFreq,
        osc2Wave: osc2.type,
        mixOsc1: document.getElementById('mixOsc1').value,
        mixOsc2: document.getElementById('mixOsc2').value,
        mixNoise: document.getElementById('mixNoise').value,
        filterType: filter.type,
        filterCutoff: parseFloat(document.getElementById('filterCutoff').value),
        filterResonance: parseFloat(document.getElementById('filterResonance').value),
        filterEnvAmount: filterEnvAmount,
        envAttack: envAttack,
        envDecay: envDecay,
        envSustain: envSustain,
        envRelease: envRelease,
        modAmount: modAmount,
        modSource: modSource,
        modDestination: modDestination,
        isSyncing: isSyncing,
        tempo: tempo,
        sequencerData: sequencerData,
        // Effekte hinzufügen
        reverbTime: parseFloat(document.getElementById('reverbTime').value),
        reverbFeedback: parseFloat(document.getElementById('reverbFeedback').value),
        delayTime: parseFloat(document.getElementById('delayTime').value),
        delayFeedback: parseFloat(document.getElementById('delayFeedback').value),
        distortionAmount: parseFloat(document.getElementById('distortionAmount').value),
        stereoWidth: parseFloat(document.getElementById('stereoWidth').value),
        stereoPhase: parseFloat(document.getElementById('stereoPhase').value)
    };
}

// Einstellungen laden
function loadSettings() {
    let loadSelect = document.getElementById('loadSelect');
    let selectedPreset = loadSelect.value;
    let settings = JSON.parse(localStorage.getItem(selectedPreset));

    if (settings) {
        applySettings(settings);
        alert(`Preset "${selectedPreset}" wurde erfolgreich geladen.`);
    }
}

// Einstellungen anwenden
function applySettings(settings) {
    console.log("Anwenden der Einstellungen:", settings);

    // Oszillator 1
    osc1BaseFreq = settings.osc1Freq;
    document.getElementById('osc1Freq').value = osc1BaseFreq;
    osc1.frequency.setValueAtTime(getExponentialFrequency(osc1BaseFreq), audioCtx.currentTime);
    osc1.type = settings.osc1Wave;
    document.getElementById('osc1Wave').value = settings.osc1Wave;

    // Oszillator 2
    osc2BaseFreq = settings.osc2Freq;
    document.getElementById('osc2Freq').value = osc2BaseFreq;
    osc2.frequency.setValueAtTime(getExponentialFrequency(osc2BaseFreq), audioCtx.currentTime);
    osc2.type = settings.osc2Wave;
    document.getElementById('osc2Wave').value = settings.osc2Wave;

    // Mixer
    document.getElementById('mixOsc1').value = settings.mixOsc1;
    mixOsc1Gain.gain.setValueAtTime(parseFloat(settings.mixOsc1), audioCtx.currentTime);
    document.getElementById('mixOsc2').value = settings.mixOsc2;
    mixOsc2Gain.gain.setValueAtTime(parseFloat(settings.mixOsc2), audioCtx.currentTime);
    document.getElementById('mixNoise').value = settings.mixNoise;
    mixNoiseGain.gain.setValueAtTime(parseFloat(settings.mixNoise), audioCtx.currentTime);

    // Filter
    filter.type = settings.filterType;
    document.getElementById('filterType').value = settings.filterType;
    document.getElementById('filterCutoff').value = settings.filterCutoff;
    filter.frequency.setValueAtTime(clamp(settings.filterCutoff, 20, 24000), audioCtx.currentTime);
    document.getElementById('filterResonance').value = settings.filterResonance;
    filter.Q.setValueAtTime(settings.filterResonance, audioCtx.currentTime);
    filterEnvAmount = settings.filterEnvAmount;
    document.getElementById('filterEnvAmount').value = settings.filterEnvAmount;

    // Envelope
    envAttack = settings.envAttack;
    document.getElementById('envAttack').value = settings.envAttack;
    envDecay = settings.envDecay;
    document.getElementById('envDecay').value = settings.envDecay;
    envSustain = settings.envSustain;
    document.getElementById('envSustain').value = settings.envSustain;
    envRelease = settings.envRelease;
    document.getElementById('envRelease').value = settings.envRelease;

    // Modulation
    modAmount = settings.modAmount;
    document.getElementById('modAmount').value = settings.modAmount;
    modGain.gain.setValueAtTime(modAmount, audioCtx.currentTime);
    modSource = settings.modSource;
    document.getElementById('modSource').value = settings.modSource;
    modDestination = settings.modDestination;
    document.getElementById('modDestination').value = settings.modDestination;
    setupModulation();

    // Sync
    isSyncing = settings.isSyncing;
    document.getElementById('syncToggle').checked = isSyncing;
    if (isSyncing) {
        // Start der periodischen Synchronisation
        if (!syncIntervalId) {
            syncIntervalId = setInterval(() => {
                osc2.frequency.setValueAtTime(osc1.frequency.value, audioCtx.currentTime);
            }, 50); // Alle 50ms aktualisieren
        }
    } else {
        // Stoppen der periodischen Synchronisation
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
            syncIntervalId = null;
        }
        // Osc2 Frequenz zurücksetzen
        osc2.frequency.setValueAtTime(getExponentialFrequency(osc2BaseFreq), audioCtx.currentTime);
    }

    // Tempo
    tempo = settings.tempo;
    document.getElementById('tempo').value = settings.tempo;

    // Sequencer
    sequencerData = settings.sequencerData;
    for (let i = 0; i < sequencerData.length; i++) {
        let pitchInput = document.querySelector(`input[type="range"][data-index="${i}"]`);
        let velInput = document.querySelectorAll(`input[type="range"][data-index="${i}"]`)[1];
        if (pitchInput) {
            pitchInput.value = sequencerData[i].pitch;
        }
        if (velInput) {
            velInput.value = sequencerData[i].velocity;
        }
    }

    // Reverb Einstellungen
    let reverbTime = settings.reverbTime !== undefined ? settings.reverbTime : (settings.echoTime !== undefined ? settings.echoTime : 0.7);
    document.getElementById('reverbTime').value = reverbTime;
    if (isFinite(reverbTime)) {
        reverbDelayNode1.delayTime.setValueAtTime(reverbTime, audioCtx.currentTime);
        reverbDelayNode2.delayTime.setValueAtTime(reverbTime * 0.6, audioCtx.currentTime);
    } else {
        console.warn("Ungültiger Wert für reverbTime:", reverbTime);
        reverbDelayNode1.delayTime.setValueAtTime(0.7, audioCtx.currentTime);
        reverbDelayNode2.delayTime.setValueAtTime(0.42, audioCtx.currentTime);
    }

    let reverbFeedback = settings.reverbFeedback !== undefined ? settings.reverbFeedback : (settings.echoFeedback !== undefined ? settings.echoFeedback : 0.6);
    document.getElementById('reverbFeedback').value = reverbFeedback;
    if (isFinite(reverbFeedback)) {
        reverbFeedbackGain1.gain.setValueAtTime(reverbFeedback, audioCtx.currentTime);
        reverbFeedbackGain2.gain.setValueAtTime(reverbFeedback * 0.75, audioCtx.currentTime);
    } else {
        console.warn("Ungültiger Wert für reverbFeedback:", reverbFeedback);
        reverbFeedbackGain1.gain.setValueAtTime(0.6, audioCtx.currentTime);
        reverbFeedbackGain2.gain.setValueAtTime(0.45, audioCtx.currentTime);
    }

    // Delay Einstellungen
    let delayTime = settings.delayTime !== undefined ? settings.delayTime : 0.5;
    document.getElementById('delayTime').value = delayTime;
    if (isFinite(delayTime)) {
        delayDelayNode.delayTime.setValueAtTime(delayTime, audioCtx.currentTime);
    } else {
        console.warn("Ungültiger Wert für delayTime:", delayTime);
        delayDelayNode.delayTime.setValueAtTime(0.5, audioCtx.currentTime);
    }

    let delayFeedback = settings.delayFeedback !== undefined ? settings.delayFeedback : 0.5;
    document.getElementById('delayFeedback').value = delayFeedback;
    if (isFinite(delayFeedback)) {
        delayFeedbackGain.gain.setValueAtTime(delayFeedback, audioCtx.currentTime);
    } else {
        console.warn("Ungültiger Wert für delayFeedback:", delayFeedback);
        delayFeedbackGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    }

    // Distortion Einstellungen
    let distortionAmount = settings.distortionAmount !== undefined ? settings.distortionAmount : 600;
    document.getElementById('distortionAmount').value = distortionAmount;
    if (isFinite(distortionAmount)) {
        distortionNode.curve = makeDistortionCurve(clamp(distortionAmount, 0, 1000));
    } else {
        console.warn("Ungültiger Wert für distortionAmount:", distortionAmount);
        distortionNode.curve = makeDistortionCurve(600);
    }
    document.getElementById('distortionOversample').value = 'none'; // Standardwert setzen

    // Stereo Widener Einstellungen
    let stereoWidth = settings.stereoWidth !== undefined ? settings.stereoWidth : 0.8;
    document.getElementById('stereoWidth').value = stereoWidth;
    if (isFinite(stereoWidth)) {
        stereoPhaseOffsetDelay.delayTime.setValueAtTime(stereoWidth * 0.02, audioCtx.currentTime);
    } else {
        console.warn("Ungültiger Wert für stereoWidth:", stereoWidth);
        stereoPhaseOffsetDelay.delayTime.setValueAtTime(0.8 * 0.02, audioCtx.currentTime);
    }
    let stereoPhase = settings.stereoPhase !== undefined ? settings.stereoPhase : 90;
    document.getElementById('stereoPhase').value = stereoPhase;
    if (isFinite(stereoPhase)) {
        // Optional: Weitere Anpassungen für stereoPhase, falls nötig
    } else {
        console.warn("Ungültiger Wert für stereoPhase:", stereoPhase);
    }

    // Aktualisiere Effektkette nach Einstellungen
    updateEffectChain();
}

// Beim Start Einstellungen laden
function loadSettingsOnStart() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('settings')) {
        let settingsString = decodeURIComponent(urlParams.get('settings'));
        let settings = JSON.parse(settingsString);
        applySettings(settings);
        alert('Einstellungen aus dem Link wurden geladen.');
    } else {
        let lastSaveName = localStorage.getItem('lastSaveName');
        if (lastSaveName && localStorage.getItem(lastSaveName)) {
            document.getElementById('loadSelect').value = lastSaveName;
            loadSettings();
        }
        updateLoadSelect();
    }
}

// Load Select aktualisieren
function updateLoadSelect() {
    let loadSelect = document.getElementById('loadSelect');
    loadSelect.innerHTML = '';
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        if (key !== 'lastSaveName') {
            let option = document.createElement('option');
            option.value = key;
            option.text = key;
            loadSelect.appendChild(option);
        }
    }
    // Letzten gespeicherten Namen setzen
    let saveName = document.getElementById('saveName').value.trim() || 'Default';
    localStorage.setItem('lastSaveName', saveName);
}

// Oszilloskop zeichnen
function drawOscilloscope() {
    let canvas = document.getElementById('oscilloscope');
    let canvasCtx = canvas.getContext('2d');

    function draw() {
        requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = '#000';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#0f0';

        canvasCtx.beginPath();

        let sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            let v = dataArray[i] / 128.0;
            let y = v * canvas.height / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

    draw();
}

// Anwendung initialisieren
window.onload = () => {
    init();
    addEventListeners();
};

// Variable für die Synchronisations-Interval
let syncIntervalId = null;
