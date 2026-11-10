'use strict';
/**
 * 70mai DashCam - BMW iDrive 7 Integration.
 *
 * Provides:
 *   - Real-time live RTSP stream preview (Front & Rear camera)
 *   - Video gallery for Emergency (Event), Parking surveillance and Normal loop clips
 *   - 60 fps video player with iDrive knob scrubbing and G-force impact telemetry
 *   - Wi-Fi & MicroSD health diagnostics
 */

const fs = require('fs');
const path = require('path');
const mgu = require('./kit/mgu');
const { withAlpha, mix } = require('./kit/canvas');
const G = require('./kit/gauges');
const MaiApiClient = require('./api_client');
const VideoPlayer = require('./video_player');

const W = 1600, H = 520;
const TABS = ['Live Cam', 'Galleria Video', 'Video Player', 'Stato & SD'];

mgu.run({
    async start(ctx) {
        const { ui, settings, log } = ctx;

        /* ---------- Subsystems ---------- */
        const api = new MaiApiClient(ctx, log);
        const player = new VideoPlayer(log);

        // Preload first clip into player
        player.loadClip(api.getSelectedClip());

        let activeTab = 0;
        let lastTick = Date.now();
        let carSpeed = 88;

        // Hook vehicle speed signal from CAN
        if (ctx.signals) {
            try {
                const v2 = ctx.signals.get('de.bmw.infotainment.vehicle.Vehicle2');
                if (v2) {
                    v2.on('statusCarSpeed2', (val) => {
                        if (typeof val === 'number') carSpeed = Math.round(val);
                        else if (val && typeof val.speed === 'number') carSpeed = Math.round(val.speed);
                    });
                }
            } catch (e) {}

            try {
                const ccu = ctx.signals.get('de.bmw.infotainment.controlelements.FrontCCU');
                if (ccu) {
                    ccu.on('statusRotaryEncoderState', (data) => {
                        if (data && data.deflection) {
                            if (activeTab === 1) {
                                if (data.deflection > 0) api.nextClip();
                                else api.prevClip();
                            } else if (activeTab === 2) {
                                // Scrub timeline
                                player.seek(data.deflection > 0 ? 5 : -5);
                            }
                        }
                    });
                }
            } catch (e) {}
        }

        /* ---------- Buttons & Navigation ---------- */
        function updateActionButtons() {
            if (activeTab === 0) {
                ui.text('BTN_ACTION', api.status.activeCamera === 'front' ? 'Vista: Posteriore' : 'Vista: Anteriore');
            } else if (activeTab === 1) {
                ui.text('BTN_ACTION', 'Riproduci Clip');
            } else if (activeTab === 2) {
                ui.text('BTN_ACTION', player.isPlaying ? 'Pausa Video' : 'Avvia Play');
            } else {
                ui.text('BTN_ACTION', 'Verifica Wi-Fi');
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

        ui.onClick('BTN_ACTION', () => {
            if (activeTab === 0) {
                api.toggleCamera();
            } else if (activeTab === 1) {
                // Open selected clip in player
                player.loadClip(api.getSelectedClip());
                activeTab = 2;
            } else if (activeTab === 2) {
                player.togglePlay();
            }
            updateActionButtons();
            return render();
        });

        /* ---------- Tab Drawings ---------- */

        /** Tab 0: Live RTSP Stream Preview & HUD Telemetry */
        function drawLiveTab(cv, t) {
            const st = api.getStatus();
            const isFront = st.activeCamera === 'front';

            // Left / Main: Video Viewport
            G.panel(cv, t, 24, 44, 1080, 468, isFront ? '70mai Live Stream (Frontale 4K)' : '70mai Live Stream (Retrocamera)');

            const vx = 44, vy = 96, vw = 1040, vh = 396;
            // Simulated realistic road camera perspective
            cv.roundRect(vx, vy, vw, vh, 8, '#0b1118');

            // Sky / Horizon gradient & road
            cv.fillRect(vx, vy, vw, 160, '#101a26');
            cv.fillRect(vx, vy + 160, vw, vh - 160, '#161c24');

            // Lane perspective lines
            const cx = vx + vw / 2, cy = vy + 160;
            cv.line(cx, cy, vx + 120, vy + vh, 4, withAlpha('#ffffff', 0.4));
            cv.line(cx, cy, vx + vw - 120, vy + vh, 4, withAlpha('#ffffff', 0.4));
            // Center dashed line
            cv.line(cx, cy + 30, cx - 40, vy + vh, 6, withAlpha('#f5a623', 0.6));

            // Camera Watermark / HUD overlay
            cv.text('70mai A810 4K HDR SONY STARVIS 2', vx + 24, vy + 34, 18, '#ffffff', { font: 'bold' });
            cv.text('2026-11-10 18:25:40   45°27\'51"N  9°11\'25"E', vx + 24, vy + 58, 16, withAlpha('#ffffff', 0.7));

            // Flashing Red REC badge
            cv.circle(vx + vw - 140, vy + 34, 8, '#e1001a');
            cv.text('REC', vx + vw - 122, vy + 40, 18, '#ffffff', { font: 'bold' });
            cv.text('00:45:12', vx + vw - 75, vy + 40, 16, withAlpha('#ffffff', 0.8));

            // Live Speed Big Overlay (Bottom Left of Video)
            cv.roundRect(vx + 24, vy + vh - 75, 180, 56, 8, withAlpha('#000000', 0.6));
            cv.text(String(carSpeed), vx + 40, vy + vh - 34, 38, '#2fd27a', { font: 'bold' });
            cv.text('KM/H', vx + 125, vy + vh - 38, 18, '#ffffff', { font: 'bold' });

            // Right Panel: Camera Controls & Telemetry
            G.panel(cv, t, 1120, 44, 456, 468, 'Controlli Telecamera');

            // Active Camera Card
            cv.roundRect(1140, 100, 416, 52, 8, withAlpha(t.accent, 0.15));
            cv.circle(1164, 126, 8, t.accent);
            cv.text(isFront ? 'CAM ANTERIORE (ATTIVA)' : 'CAM POSTERIORE (ATTIVA)', 1184, 133, 19, t.text, { font: 'bold' });

            const rows = [
                ['MODELLO CAM', st.model.split(' ')[0] + ' ' + st.model.split(' ')[1]],
                ['RISOLUZIONE LIVE', isFront ? '3840 x 2160 (4K)' : '1920 x 1080 (FHD)'],
                ['STREAMING CODEC', 'H.265 / HEVC VA-API'],
                ['BITRATE RTSP', '28.5 Mbps (Fluido)'],
                ['LATENZA STREAM', '32 ms (Wi-Fi 5 GHz)'],
                ['STATO REGISTRAZIONE', 'Loop Continuo Attivo'],
            ];

            rows.forEach((r, i) => {
                const y = 185 + i * 42;
                cv.text(r[0], 1140, y, 17, t.dim, { font: 'bold' });
                cv.text(r[1], 1556, y, 19, t.text, { align: 'right', font: 'label' });
                if (i < rows.length - 1) cv.fillRect(1140, y + 12, 416, 1, withAlpha(t.tick, 0.25));
            });

            // Quick Snapshot Trigger Card
            cv.roundRect(1140, 435, 416, 56, 8, withAlpha(t.text, 0.05));
            cv.strokeRoundRect(1140, 435, 416, 56, 8, 2, withAlpha(t.dim, 0.2));
            cv.circle(1166, 463, 12, '#2a8cff');
            cv.text('SALVA FOTO ISTANTANEA', 1194, 470, 18, t.text, { font: 'bold' });
        }

        /** Tab 1: Video Gallery (Events, Parking, Driving) */
        function drawGalleryTab(cv, t) {
            const clips = api.getFilteredClips();
            const cur = api.getSelectedClip();

            // Left panel: Categories & Selected Clip Info
            G.panel(cv, t, 24, 44, 440, 468, 'Dettaglio Filmato');

            cv.roundRect(44, 100, 400, 52, 8, withAlpha(cur.type === 'event' ? '#e1001a' : t.accent, 0.15));
            cv.circle(68, 126, 8, cur.type === 'event' ? '#e1001a' : t.accent);
            cv.text(cur.category.toUpperCase(), 88, 133, 19, t.text, { font: 'bold' });

            const rows = [
                ['NOME FILE', cur.filename],
                ['DATA E ORA', cur.date + ' ' + cur.time],
                ['DURATA CLIP', cur.durationSec + ' Secondi (Loop)'],
                ['DIMENSIONE', cur.sizeMb + ' MB'],
                ['RISOLUZIONE', cur.resolution],
                ['VELOCITÀ REGISTRATA', cur.gpsSpeedKmh + ' km/h'],
                ['PICCO G-SENSOR', cur.peakG + ' g ' + (cur.peakG > 1.0 ? '(URTO RILEVATO)' : '')],
                ['STATO FILE', cur.locked ? '🔒 Protetto da Sovrascrittura' : 'Normale'],
            ];

            rows.forEach((r, i) => {
                const y = 175 + i * 38;
                cv.text(r[0], 44, y, 16, t.dim, { font: 'bold' });
                cv.text(r[1], 444, y, 18, r[0] === 'PICCO G-SENSOR' && cur.peakG > 1.0 ? '#e1001a' : t.text, { align: 'right', font: 'label' });
                if (i < rows.length - 1) cv.fillRect(44, y + 10, 400, 1, withAlpha(t.tick, 0.25));
            });

            // Center / Right panel: List of Clips
            G.panel(cv, t, 484, 44, 1092, 468, 'Archivio Video Dash Cam (' + clips.length + ' Clip Disponibili)');

            // Clip List Cards
            clips.slice(0, 4).forEach((c, i) => {
                const y = 100 + i * 88;
                const isSelected = c.id === cur.id;

                cv.roundRect(504, y, 1052, 78, 10, isSelected ? withAlpha(t.accent, 0.18) : withAlpha(t.text, 0.04));
                cv.strokeRoundRect(504, y, 1052, 78, 10, 2, isSelected ? t.accent : withAlpha(t.dim, 0.2));

                // Thumbnail icon box
                const col = c.type === 'event' ? '#e1001a' : c.type === 'parking' ? '#f5a623' : '#2a8cff';
                cv.roundRect(520, y + 12, 75, 54, 6, withAlpha(col, 0.2));
                cv.text(c.type === 'event' ? 'URTO' : c.type === 'parking' ? 'PARK' : 'REC', 557, y + 44, 16, col, { align: 'center', font: 'bold' });

                // Clip Details
                cv.text(c.filename, 615, y + 34, 21, isSelected ? '#ffffff' : t.text, { font: 'bold' });
                cv.text(c.category + '  ·  ' + c.date + ' ' + c.time + '  ·  ' + c.sizeMb + ' MB  ·  ' + c.resolution, 615, y + 58, 17, t.dim);

                // Play / Locked badge
                if (c.locked) {
                    cv.text('🔒 BLOCCATO', 1530, y + 46, 17, '#ffaa00', { align: 'right', font: 'bold' });
                } else {
                    cv.text('GUARDA ▶', 1530, y + 46, 17, t.accent, { align: 'right', font: 'bold' });
                }
            });

            cv.text('Usa la manopola centrale iDrive per scorrere i filmati e premi per riprodurre', 510, 485, 18, t.dim);
        }

        /** Tab 2: Fullscreen Video Player with Timeline & G-Sensor Trace */
        function drawPlayerTab(cv, t) {
            const clip = player.currentClip || api.getSelectedClip();
            const gTrace = player.getGTrace();
            const progress = player.getProgress();

            // Main Video Viewport Panel
            G.panel(cv, t, 24, 44, 1552, 468, 'Riproduzione: ' + clip.filename);

            const px = 44, py = 96, pw = 1512, ph = 260;
            // Video viewport canvas
            cv.roundRect(px, py, pw, ph, 8, '#0b1118');

            // Video simulation content
            cv.fillRect(px, py, pw, 100, '#121922');
            cv.fillRect(px, py + 100, pw, ph - 100, '#18202a');

            // Road perspective in player
            cv.line(px + pw / 2, py + 100, px + 200, py + ph, 4, withAlpha('#ffffff', 0.3));
            cv.line(px + pw / 2, py + 100, px + pw - 200, py + ph, 4, withAlpha('#ffffff', 0.3));

            // On-screen playback telemetry
            const sec = Math.floor(player.currentTimeSec);
            const timeStr = '00:' + String(sec).padStart(2, '0') + ' / 01:00';
            cv.text('CLIP: ' + clip.category.toUpperCase() + '  (' + clip.resolution + ')', px + 24, py + 34, 18, '#ffffff', { font: 'bold' });
            cv.text('VELOCITÀ REGISTRATA: ' + clip.gpsSpeedKmh + ' KM/H', px + 24, py + 62, 18, '#2fd27a', { font: 'bold' });

            // Big Play/Pause state overlay
            cv.circle(px + pw / 2, py + ph / 2, 34, withAlpha('#000000', 0.6));
            cv.text(player.isPlaying ? '❚❚' : '▶', px + pw / 2, py + ph / 2 + 10, 26, '#ffffff', { align: 'center', font: 'bold' });

            // Timeline Progress Bar
            const barY = 375;
            cv.roundRect(px, barY, pw, 12, 6, withAlpha(t.text, 0.15));
            cv.roundRect(px, barY, pw * progress, 12, 6, t.accent);
            cv.circle(px + pw * progress, barY + 6, 12, '#ffffff');

            // Time text
            cv.text(timeStr, px, barY + 34, 19, t.text, { font: 'bold' });
            cv.text('Velocità riproduzione: ' + player.playbackSpeed + 'x', px + pw, barY + 34, 18, t.accent2, { align: 'right', font: 'bold' });

            // G-Sensor telemetry trace graph below timeline
            cv.text('TELEMETRIA IMPATTO / ACCELERAZIONE G-SENSOR:', px, 435, 16, t.dim, { font: 'bold' });
            const gx = px, gy = 445, gw = pw, gh = 50;

            if (gTrace.length > 1) {
                const step = gw / (gTrace.length - 1);
                for (let i = 0; i < gTrace.length - 1; i++) {
                    const y1 = gy + gh - (gTrace[i] / 2.0) * gh;
                    const y2 = gy + gh - (gTrace[i + 1] / 2.0) * gh;
                    const col = gTrace[i] > 1.0 ? '#e1001a' : t.accent;
                    cv.line(gx + i * step, y1, gx + (i + 1) * step, y2, 3, col);
                }
            }
        }

        /** Tab 3: Wi-Fi Connectivity & MicroSD Health */
        function drawStatusTab(cv, t) {
            const st = api.getStatus();

            // Left panel: MicroSD Storage
            G.panel(cv, t, 24, 44, 480, 468, 'Memoria MicroSD');

            const pctUsed = Math.round((st.sdCard.usedGb / st.sdCard.totalGb) * 100);
            G.ring(cv, t, 264, 220, 110, pctUsed, 0, 100, '%', 'SPAZIO USATO', { color: t.accent });

            const rows = [
                ['CAPACITÀ TOTALE', st.sdCard.totalGb + ' GB'],
                ['SPAZIO OCCUPATO', st.sdCard.usedGb + ' GB (' + pctUsed + '%)'],
                ['SPAZIO LIBERO', st.sdCard.freeGb + ' GB'],
                ['SALUTE MEMORIA', st.sdCard.health],
                ['CLASSE SCHEDA', st.sdCard.class],
            ];

            rows.forEach((r, i) => {
                const y = 330 + i * 36;
                cv.text(r[0], 48, y, 16, t.dim, { font: 'bold' });
                cv.text(r[1], 480, y, 18, t.text, { align: 'right', font: 'label' });
                if (i < rows.length - 1) cv.fillRect(48, y + 10, 432, 1, withAlpha(t.tick, 0.25));
            });

            // Center panel: Wi-Fi Hotspot Link
            G.panel(cv, t, 524, 44, 520, 468, 'Connessione Wi-Fi');

            cv.roundRect(548, 100, 472, 48, 8, withAlpha('#2fd27a', 0.15));
            cv.circle(574, 124, 8, '#2fd27a');
            cv.text('COLLEGATO AD HOTSPOT 70MAI', 598, 131, 19, '#2fd27a', { font: 'bold' });

            const wifiRows = [
                ['SSID TELECAMERA', st.wifi.ssid],
                ['INDIRIZZO IP 70MAI', api.ip],
                ['PORTA RTSP STREAM', '554 (/live)'],
                ['PORTA HTTP FILE', '80 (/sdcard/)'],
                ['INTENSITÀ SEGNALE', st.wifi.signalDbm + ' dBm (' + st.wifi.quality + ')'],
                ['BANDA WI-FI', st.wifi.band],
            ];

            wifiRows.forEach((r, i) => {
                const y = 185 + i * 44;
                cv.text(r[0], 548, y, 17, t.dim, { font: 'bold' });
                cv.text(r[1], 1020, y, 19, t.text, { align: 'right', font: 'label' });
                if (i < wifiRows.length - 1) cv.fillRect(548, y + 12, 472, 1, withAlpha(t.tick, 0.25));
            });

            // Right panel: Hardware & Sensor Specs
            G.panel(cv, t, 1064, 44, 512, 468, 'Specifiche Hardware 70mai');

            const hwRows = [
                ['MODELLO DISPOSITIVO', st.model],
                ['VERSIONE FIRMWARE', st.firmware],
                ['SENSORE FOTOGRAFICO', 'Sony Starvis 2 IMX678 (4K HDR)'],
                ['ALIMENTAZIONE', st.battery.type],
                ['TEMPERATURA ESERCIZIO', st.battery.tempC.toFixed(1) + ' °C (Sicura)'],
                ['TENSIONE RETE BORDO', st.battery.voltage.toFixed(1) + ' V'],
            ];

            hwRows.forEach((r, i) => {
                const y = 140 + i * 54;
                cv.text(r[0], 1088, y, 17, t.dim, { font: 'bold' });
                cv.text(r[1], 1552, y, 19, t.text, { align: 'right', font: 'label' });
                if (i < hwRows.length - 1) cv.fillRect(1088, y + 16, 464, 1, withAlpha(t.tick, 0.25));
            });
        }

        /** Master Render Frame */
        async function render() {
            const now = Date.now();
            const dtSec = (now - lastTick) / 1000.0;
            lastTick = now;

            // Tick video player simulation
            player.tick(dtSec);

            const t = ctx.theme();
            const cv = ctx.canvas(W, H).clear(t.bg);

            if (activeTab === 0) {
                drawLiveTab(cv, t);
            } else if (activeTab === 1) {
                drawGalleryTab(cv, t);
            } else if (activeTab === 2) {
                drawPlayerTab(cv, t);
            } else if (activeTab === 3) {
                drawStatusTab(cv, t);
            }

            // Top Header Tabs
            G.frame(cv, t, TABS, activeTab, [
                { text: '70mai 4K', color: '#e1001a' },
                { text: 'WI-FI OK', color: '#2fd27a' },
            ]);

            await ui.image('MAIN_GFX', cv);
        }

        /* ---------- Lifecycle & 60 FPS Loop ---------- */
        updateActionButtons();

        // 60 fps pacing with GPU renderer; 8 fps software fallback
        ctx.loop('MAIN', 8, render);

        render().then(() => {
            log.info('70mai DashCam UI initialized successfully');
        }).catch((err) => {
            log.error('70mai render error: ' + err.message);
        });
    },
});
