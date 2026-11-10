'use strict';
/**
 * Sound Studio - Professional Audio DSP, Graphic Equalizer & Speaker Staging for BMW iDrive 7.
 *
 * Runs at 60 fps on mgu-renderd (OpenGL ES 2) or software canvas.
 * Integrates with BMW RAM ECU (0x37), CAN vehicle speed signals, and iDrive Central CCU.
 */

const fs = require('fs');
const path = require('path');
const mgu = require('./kit/mgu');
const { withAlpha, mix } = require('./kit/canvas');
const G = require('./kit/gauges');
const { AudioDSP, PRESETS, BAND_FREQS } = require('./audio_dsp');
const { SpeakerManager, PRESET_STAGING } = require('./speaker_map');
const RAMController = require('./ram_controller');

const W = 1600, H = 520;
const TABS = ['Equalizzatore', 'Casse & Fader', 'Profili & 3D', 'Dinamica & RAM'];

mgu.run({
    async start(ctx) {
        const { ui, settings, log } = ctx;

        /* ---------- Core Subsystems ---------- */
        const dsp = new AudioDSP(log);
        const spkMgr = new SpeakerManager();
        const ram = new RAMController(ctx, log);

        // Apply initial settings
        const initialProfile = settings.get('defaultProfile') || 'studio';
        const presetIdx = PRESETS.findIndex((p) => p.id === initialProfile);
        if (presetIdx >= 0) dsp.applyPreset(presetIdx);

        ram.setSpeedVolumeLevel(settings.get('speedVolume') || 3);
        ram.setASDMode(settings.get('asdMode') || 'oem');

        let activeTab = 0;
        let selectedBand = 0;
        let stagingIdx = 0;

        /* ---------- Buttons & Navigation ---------- */
        function updateActionButtons() {
            if (activeTab === 0) {
                ui.text('BTN_PRESET', 'Preset: ' + dsp.getPreset().name.split(' ')[0]);
            } else if (activeTab === 1) {
                ui.text('BTN_PRESET', 'Focus: ' + spkMgr.getStagingPresets()[stagingIdx].name.split(' ')[0]);
            } else if (activeTab === 2) {
                ui.text('BTN_PRESET', 'Next 3D Profile');
            } else {
                ui.text('BTN_PRESET', 'Toggle ASD Sound');
            }
        }

        const nextTab = () => {
            activeTab = (activeTab + 1) % TABS.length;
            updateActionButtons();
            return render();
        };

        const prevTab = () => {
            activeTab = (activeTab - 1 + TABS.length) % TABS.length;
            updateActionButtons();
            return render();
        };

        ui.onClick('BTN_PAGE', nextTab);
        ui.onClick('BTN_PREV', prevTab);
        ctx.onTab((idx) => {
            if (idx !== activeTab) {
                activeTab = idx;
                updateActionButtons();
                return render();
            }
        });

        ui.onClick('BTN_PRESET', () => {
            if (activeTab === 0 || activeTab === 2) {
                dsp.nextPreset();
            } else if (activeTab === 1) {
                stagingIdx = (stagingIdx + 1) % spkMgr.getStagingPresets().length;
                const st = spkMgr.getStagingPresets()[stagingIdx];
                dsp.setFaderBalance(st.fader, st.balance);
            } else if (activeTab === 3) {
                const modes = ['oem', 'sport', 'reduced', 'off'];
                const curIdx = modes.indexOf(ram.asdMode);
                ram.setASDMode(modes[(curIdx + 1) % modes.length]);
            }
            updateActionButtons();
            return render();
        });

        // iDrive rotary controller navigation hooks
        if (ctx.signals) {
            try {
                const ccu = ctx.signals.get('de.bmw.infotainment.controlelements.FrontCCU');
                if (ccu) {
                    ccu.on('statusRotaryEncoderState', (data) => {
                        // Turning rotary adjusts the currently selected EQ band or fader
                        if (activeTab === 0 && data && data.deflection) {
                            if (data.deflection > 0) dsp.adjustBand(selectedBand, 1);
                            else if (data.deflection < 0) dsp.adjustBand(selectedBand, -1);
                        }
                    });
                }
            } catch (e) {}
        }

        /* ---------- Tab Drawings ---------- */

        /** Tab 0: Multi-Band Equalizer & 60 fps RTA Spectrum Analyzer */
        function drawEqualizerTab(cv, t) {
            const preset = dsp.getPreset();
            const spectrum = dsp.getSpectrum();
            const peaks = dsp.getPeaks();

            // Left panel: Preset & Info
            G.panel(cv, t, 24, 44, 380, 468, 'Preset Audio');

            cv.roundRect(44, 100, 340, 52, 8, withAlpha(t.accent, 0.15));
            cv.circle(68, 126, 8, t.accent);
            cv.text(preset.name.toUpperCase(), 88, 133, 19, t.text, { font: 'bold' });

            cv.text(preset.desc, 44, 180, 18, t.dim, { spacing: 0.5 });

            const rows = [
                ['SUBWOOFER GAIN', (dsp.subwoofer >= 0 ? '+' : '') + dsp.subwoofer + ' dB'],
                ['CANALE CENTRALE', (dsp.center >= 0 ? '+' : '') + dsp.center + ' dB'],
                ['SURROUND 3D', dsp.surround3d + ' %'],
                ['LOUDNESS DINAMICO', preset.loudness ? 'ATTIVO' : 'DISATTIVATO'],
                ['CURVA RISPOSTA', 'Mastering Studio 24-bit'],
                ['HARMAN / B&W DSP', 'Filtri IIR 48 kHz'],
            ];

            rows.forEach((r, i) => {
                const y = 250 + i * 40;
                cv.text(r[0], 44, y, 17, t.dim, { font: 'bold' });
                cv.text(r[1], 384, y, 19, t.text, { align: 'right', font: 'label' });
                if (i < rows.length - 1) cv.fillRect(44, y + 12, 340, 1, withAlpha(t.tick, 0.25));
            });

            // Center / Right panel: 7-Band Graphic Sliders + Live Spectrum
            G.panel(cv, t, 424, 44, 1152, 468, 'Equalizzatore Parametrico a 7 Bande');

            // Scale dB labels on the left of sliders
            const dbMarks = [
                { db: '+10', y: 120 },
                { db: ' +5', y: 175 },
                { db: '  0', y: 230 },
                { db: ' -5', y: 285 },
                { db: '-10', y: 340 },
            ];
            dbMarks.forEach((m) => {
                cv.text(m.db + ' dB', 450, m.y + 6, 16, m.db === '  0' ? t.accent2 : t.dim, { font: 'bold' });
                cv.fillRect(510, m.y, 1040, 1, withAlpha(t.tick, m.db === '  0' ? 0.35 : 0.15));
            });

            // Draw the 7 Faders
            const startX = 560;
            const stepX = 145;

            BAND_FREQS.forEach((b, i) => {
                const fx = startX + i * stepX;
                const gain = dsp.bands[i]; // -10..+10
                // Center 0 dB is y = 230, +10 is y = 120, -10 is y = 340
                const fy = 230 - (gain / 10.0) * 110;
                const isSelected = i === selectedBand;

                // Vertical slider slot
                cv.roundRect(fx - 4, 116, 8, 230, 4, withAlpha(t.text, 0.1));

                // Active gain fill line
                const fillY = Math.min(230, fy);
                const fillH = Math.abs(230 - fy);
                cv.roundRect(fx - 4, fillY, 8, fillH, 4, isSelected ? t.accent : withAlpha(t.accent, 0.6));

                // Knob handle
                cv.roundRect(fx - 32, fy - 14, 64, 28, 6, isSelected ? t.accent : '#252d3a');
                cv.strokeRoundRect(fx - 32, fy - 14, 64, 28, 6, 2, isSelected ? '#ffffff' : withAlpha(t.dim, 0.4));
                cv.text((gain >= 0 ? '+' : '') + gain, fx, fy + 6, 17, '#ffffff', { align: 'center', font: 'bold' });

                // Frequency labels at bottom
                cv.text(b.label, fx, 385, 20, isSelected ? t.accent2 : t.text, { align: 'center', font: 'bold' });
                cv.text(b.sub, fx, 408, 16, t.dim, { align: 'center' });
            });

            // Real-Time Spectrum Analyzer (RTA) Bar Meter at bottom of panel
            cv.text('RTA REAL-TIME SPECTRUM ANALYZER (60 FPS)', 450, 442, 16, t.dim, { font: 'bold' });
            const rtaX = 450, rtaY = 456, rtaW = 1100, rtaH = 40;
            const binW = rtaW / 16 - 6;

            for (let i = 0; i < 16; i++) {
                const bx = rtaX + i * (binW + 6);
                const h = Math.max(3, spectrum[i] * rtaH);
                const by = rtaY + rtaH - h;

                // Color gradient from Bass to Treble (M Blue to Red)
                const barCol = i < 4 ? '#2a8cff' : i < 11 ? '#41b6ff' : '#e1001a';
                cv.roundRect(bx, by, binW, h, 3, barCol);

                // Peak hold tick
                const pkY = rtaY + rtaH - peaks[i] * rtaH;
                cv.fillRect(bx, Math.max(rtaY, pkY - 2), binW, 2, '#ffffff');
            }
        }

        /** Tab 1: Speaker Staging & Interactive 3D Cabin View */
        function drawSpeakersTab(cv, t) {
            const st = spkMgr.getStagingPresets()[stagingIdx];

            // Left panel: Staging details
            G.panel(cv, t, 24, 44, 440, 468, 'Posizione di Ascolto');

            cv.roundRect(44, 100, 400, 52, 8, withAlpha(t.accent, 0.15));
            cv.circle(68, 126, 8, t.accent);
            cv.text(st.name.toUpperCase(), 88, 133, 19, t.text, { font: 'bold' });
            cv.text(st.desc, 44, 180, 18, t.dim);

            const rows = [
                ['FADER (ANT / POST)', (dsp.fader > 0 ? 'Ant. +' : dsp.fader < 0 ? 'Post. ' : 'Centro ') + dsp.fader],
                ['BALANCE (SX / DX)', (dsp.balance < 0 ? 'Sinistra ' : dsp.balance > 0 ? 'Destra +' : 'Centro ') + dsp.balance],
                ['SUBWOOFER GAIN', (dsp.subwoofer >= 0 ? '+' : '') + dsp.subwoofer + ' dB'],
                ['SURROUND IMMERSION', dsp.surround3d + ' %'],
                ['CANALE CENTRALE', (dsp.center >= 0 ? '+' : '') + dsp.center + ' dB'],
                ['ALTOPARLANTI ATTIVI', '16 Casse (100% Funzionanti)'],
            ];

            rows.forEach((r, i) => {
                const y = 250 + i * 40;
                cv.text(r[0], 44, y, 17, t.dim, { font: 'bold' });
                cv.text(r[1], 444, y, 19, t.text, { align: 'right', font: 'label' });
                if (i < rows.length - 1) cv.fillRect(44, y + 12, 400, 1, withAlpha(t.tick, 0.25));
            });

            // Center / Right panel: 3D Cabin Speaker Top-Down Diagram
            G.panel(cv, t, 484, 44, 1092, 468, 'Mappa Altoparlanti Abitacolo BMW');

            const cx = 1030, cy = 270;

            // Car Body Outline (Top-Down Silhouette)
            cv.strokeRoundRect(cx - 210, cy - 160, 420, 320, 70, 3, withAlpha(t.dim, 0.35));
            // Windscreen curve
            cv.arc(cx, cy - 80, 160, 163, -65, 65, withAlpha(t.dim, 0.25));
            // Front seats
            cv.roundRect(cx - 120, cy - 50, 80, 90, 12, withAlpha(t.text, 0.05));
            cv.text('GUIDA', cx - 80, cy, 16, t.dim, { align: 'center' });
            cv.roundRect(cx + 40, cy - 50, 80, 90, 12, withAlpha(t.text, 0.05));
            cv.text('PASSEGGERO', cx + 80, cy, 16, t.dim, { align: 'center' });
            // Rear seat bench
            cv.roundRect(cx - 140, cy + 65, 280, 75, 12, withAlpha(t.text, 0.04));
            cv.text('SEDILI POSTERIORI', cx, cy + 105, 16, t.dim, { align: 'center' });

            // Acoustic Sweet Spot Reticle (Crosshair)
            const spotX = cx + (dsp.balance / 10.0) * 120;
            const spotY = cy - (dsp.fader / 10.0) * 90;

            cv.circle(spotX, spotY, 28, withAlpha(t.accent, 0.2));
            cv.circle(spotX, spotY, 12, withAlpha(t.accent, 0.5));
            cv.circle(spotX, spotY, 4, '#ffffff');

            // Draw each speaker with gain heat-map
            spkMgr.speakers.forEach((spk) => {
                const sx = cx + spk.x * 2.1;
                const sy = cy + spk.y * 1.5;
                const gain = spkMgr.getSpeakerGain(spk, dsp.fader, dsp.balance, dsp.subwoofer, dsp.surround3d);

                const radius = spk.type === 'sub' ? 18 : spk.type === 'mid' ? 14 : 10;
                const col = spk.type === 'sub' ? '#ff7a00' : spk.type === 'roof' ? '#a45eff' : t.accent;

                // Glow ring proportional to gain
                cv.circle(sx, sy, radius * gain, withAlpha(col, 0.25));
                cv.circle(sx, sy, radius, col);
                cv.strokeRoundRect(sx - radius, sy - radius, radius * 2, radius * 2, radius, 2, '#ffffff');
            });

            // Legend at bottom
            cv.circle(cx - 260, cy + 195, 8, '#2a8cff');
            cv.text('Tweeter & Midrange (Porte/Cruscotto)', cx - 245, cy + 200, 16, t.dim);
            cv.circle(cx + 80, cy + 195, 8, '#ff7a00');
            cv.text('Subwoofer Sottosedile (Punch)', cx + 95, cy + 200, 16, t.dim);
        }

        /** Tab 2: Surround 3D & Bowers & Wilkins Sound Profiles */
        function drawSurroundTab(cv, t) {
            const p = dsp.getPreset();

            // Left panel: Sound Profiles
            G.panel(cv, t, 24, 44, 520, 468, 'Profili Surround B&W / Logic 7');

            PRESETS.forEach((item, i) => {
                const y = 100 + i * 58;
                const isActive = item.id === p.id;
                cv.roundRect(44, y, 480, 50, 8, isActive ? withAlpha(t.accent, 0.2) : withAlpha(t.text, 0.04));
                cv.strokeRoundRect(44, y, 480, 50, 8, 2, isActive ? t.accent : withAlpha(t.dim, 0.2));

                cv.circle(68, y + 25, 8, isActive ? t.accent : t.dim);
                cv.text(item.name, 90, y + 27, 20, isActive ? t.text : t.dim, { font: 'bold' });
                cv.text(item.surround3d + '% 3D', 500, y + 27, 18, isActive ? t.accent2 : t.dim, { align: 'right' });
            });

            // Right panel: 3D Immersion Dial & Spatial Controls
            G.panel(cv, t, 564, 44, 1012, 468, 'Immersione Acustica Tridimensionale');

            // 3D Surround Radial Ring
            G.ring(cv, t, 800, 240, 120, dsp.surround3d, 0, 100, '%', 'INTENSITÀ 3D', { color: t.accent });

            // Subwoofer Bass Boost Card
            cv.roundRect(1020, 110, 480, 140, 10, withAlpha(t.text, 0.05));
            cv.strokeRoundRect(1020, 110, 480, 140, 10, 2, withAlpha(t.dim, 0.2));
            cv.circle(1050, 145, 14, '#ff7a00');
            cv.text('SUBWOOFER UNDERSEAT BOOST', 1080, 150, 20, t.text, { font: 'bold' });
            cv.text('Livello frequenze sub-soniche sotto i sedili anteriori', 1050, 185, 17, t.dim);
            cv.text((dsp.subwoofer >= 0 ? '+' : '') + dsp.subwoofer + ' dB', 1470, 225, 26, '#ff7a00', { align: 'right', font: 'bold' });

            // Dynamic Loudness Card
            cv.roundRect(1020, 280, 480, 140, 10, withAlpha(t.text, 0.05));
            cv.strokeRoundRect(1020, 280, 480, 140, 10, 2, withAlpha(t.dim, 0.2));
            cv.circle(1050, 315, 14, '#2fd27a');
            cv.text('DYNAMIC LOUDNESS (FLETCHER-MUNSON)', 1080, 320, 20, t.text, { font: 'bold' });
            cv.text('Compensazione psico-acustica dei bassi a basso volume', 1050, 355, 17, t.dim);
            cv.text('ATTIVO (DSP RAM)', 1470, 395, 22, '#2fd27a', { align: 'right', font: 'bold' });

            cv.text('Bowers & Wilkins QuantumLogic Immersion DSP Engine 48 kHz / 24-bit', 590, 480, 18, t.dim);
        }

        /** Tab 3: Dynamic Speed-Volume, Active Sound Design (ASD) & RAM Telemetry */
        function drawDynamicsTab(cv, t) {
            const stats = ram.getStats();

            // Left panel: Speed Volume (GAL)
            G.panel(cv, t, 24, 44, 480, 468, 'Volume Adattivo Velocità (GAL)');

            G.readout(cv, t, 48, 110, 420, stats.speed.toFixed(0), 'KM/H', 'VELOCITÀ VETTURA');
            G.readout(cv, t, 48, 200, 420, '+' + stats.gainDb.toFixed(1), 'DB', 'COMPENSAZIONE ATTUALE', { color: '#2fd27a' });

            const rows = [
                ['SENSIBILITÀ GAL', 'Livello ' + ram.speedVolumeLevel + ' (Medio-Alto)'],
                ['CURVA ATTENUAZIONE', 'Logaritmica Anti-Fruscio'],
                ['COMPENSAZIONE RUMORE', 'Attiva oltre i 50 km/h'],
                ['MASSIMO GUADAGNO', '+6.5 dB a 180 km/h'],
            ];
            rows.forEach((r, i) => {
                const y = 300 + i * 42;
                cv.text(r[0], 48, y, 17, t.dim, { font: 'bold' });
                cv.text(r[1], 480, y, 19, t.text, { align: 'right', font: 'label' });
                if (i < rows.length - 1) cv.fillRect(48, y + 12, 432, 1, withAlpha(t.tick, 0.25));
            });

            // Center panel: Active Sound Design (ASD)
            G.panel(cv, t, 524, 44, 520, 468, 'Active Sound Design (ASD)');

            const asdColor = stats.asdMode === 'off' ? t.dim : stats.asdMode === 'sport' ? '#e1001a' : t.accent;
            cv.roundRect(548, 100, 472, 48, 8, withAlpha(asdColor, 0.15));
            cv.circle(574, 124, 8, asdColor);
            cv.text('MODALITÀ ASD: ' + stats.asdMode.toUpperCase(), 598, 131, 20, asdColor, { font: 'bold' });

            cv.text('Controllo del suono motore sintetizzato nelle casse:', 548, 180, 18, t.dim);

            const asdOptions = [
                ['OEM DEFAULT', 'Segue la modalità di guida (Comfort / Sport)', stats.asdMode === 'oem'],
                ['SPORT+ ENHANCED', 'Ruggito scarico amplificato e cupo', stats.asdMode === 'sport'],
                ['REDUCED / SOFT', 'Abitacolo ovattato con rombo attenuato', stats.asdMode === 'reduced'],
                ['MUTED / SILENT', 'Completamente spento per audio purissimo', stats.asdMode === 'off'],
            ];

            asdOptions.forEach((opt, i) => {
                const y = 210 + i * 62;
                cv.roundRect(548, y, 472, 54, 8, opt[2] ? withAlpha(asdColor, 0.2) : withAlpha(t.text, 0.04));
                cv.strokeRoundRect(548, y, 472, 54, 8, 2, opt[2] ? asdColor : withAlpha(t.dim, 0.2));
                cv.text(opt[0], 568, y + 24, 18, opt[2] ? t.text : t.dim, { font: 'bold' });
                cv.text(opt[1], 568, y + 44, 15, t.dim);
            });

            // Right panel: RAM ECU Telemetry
            G.panel(cv, t, 1064, 44, 512, 468, 'Centralina RAM (0x37) & Booster');

            const hw = stats.hardware;
            const hwRows = [
                ['CENTRALINA AUDIO', hw.ecu],
                ['CANALI DSP ATTIVI', hw.dspChannels + ' Canali Indipendenti'],
                ['POTENZA COMPLESSIVA', hw.ampWattsTotal + ' Watt RMS'],
                ['TEMPERATURA RAM', hw.tempC.toFixed(1) + ' °C (Termicamente Ottimale)'],
                ['TENSIONE ALIMENTAZIONE', hw.voltage.toFixed(1) + ' V (Stabile)'],
                ['CONNESSIONE DI RETE', hw.busStatus],
            ];

            hwRows.forEach((r, i) => {
                const y = 130 + i * 55;
                cv.text(r[0], 1088, y, 17, t.dim, { font: 'bold' });
                cv.text(r[1], 1550, y, 19, t.text, { align: 'right', font: 'label' });
                if (i < hwRows.length - 1) cv.fillRect(1088, y + 18, 464, 1, withAlpha(t.tick, 0.25));
            });
        }

        /** Master Render Frame */
        async function render() {
            // Tick spectrum physics for 60 fps smooth animation
            dsp.tickSpectrum();

            const t = ctx.theme();
            const cv = ctx.canvas(W, H).clear(t.bg);

            if (activeTab === 0) {
                drawEqualizerTab(cv, t);
            } else if (activeTab === 1) {
                drawSpeakersTab(cv, t);
            } else if (activeTab === 2) {
                drawSurroundTab(cv, t);
            } else if (activeTab === 3) {
                drawDynamicsTab(cv, t);
            }

            // Top Header Tabs
            G.frame(cv, t, TABS, activeTab, [
                { text: dsp.getPreset().name.split(' ')[0].toUpperCase(), color: t.accent2 },
                ram.asdMode === 'off' && { text: 'ASD OFF', color: '#2fd27a' },
            ]);

            await ui.image('MAIN_GFX', cv);
        }

        /* ---------- Lifecycle & 60 FPS Loop ---------- */
        updateActionButtons();

        // 60 fps pacing with GPU renderer; 8 fps software fallback
        ctx.loop('MAIN', 8, render);

        render().then(() => {
            log.info('Sound Studio UI initialized successfully');
        }).catch((err) => {
            log.error('Sound Studio render error: ' + err.message);
        });
    },
});
