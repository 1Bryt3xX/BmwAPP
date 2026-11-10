# Sound Studio (BMW Audio DSP & Speaker Staging)

Applicazione nativa professionale per **BMW iDrive 7 (MGU)** dedicata alla gestione avanzata del sistema audio, altoparlanti, equalizzazione parametrica delle frequenze (bassi, medi, alti), staging acustico e profili surround per impianti **Hi-Fi (205 W)**, **Harman Kardon (Logic 7)** e **Bowers & Wilkins (Diamond Surround Sound)**.

---

## 🎛️ Funzionalità Principali

### 1. Equalizzatore Parametrico a 7 Bande & Analizzatore di Spettro RTA
- **Controllo Frequenze ad Alta Precisione**:
  - **40 Hz (Sub-Bassi)**: Gestione delle frequenze sub-soniche profonde e vibrazione controllata.
  - **100 Hz (Bassi)**: Punch della cassa della batteria e corposità dei bassi senza risonanze nell'abitacolo.
  - **250 Hz (Medio-Bassi)**: Calore acustico e pienezza degli strumenti a corda.
  - **1 kHz (Medi)**: Presenza, chiarezza della voce umana e comprensibilità nei dialoghi.
  - **4 kHz (Medio-Alti)**: Attacco delle percussioni e definizione dei dettagli.
  - **10 kHz (Alti)**: Brillantezza, piatti della batteria e dettaglio stereo.
  - **16 kHz (Aria)**: Apertura della scena acustica ad altissima fedeltà.
- **RTA Real-Time Analyzer a 60 fps**:
  - Spettrogramma audio a 16 barre animate a 60 fps sincronizzate in tempo reale con indicatore di picco (Peak Hold).
- **Preset di Mastering Audiophile**:
  - **B&W Studio Mastering**: Curva di riferimento neutra ad altissima fedeltà.
  - **Concert Hall Immersion**: Riverbero spaziale vivo per concerti e musica classica.
  - **Club & Bass Boost**: Enfasi sui subwoofer sottosedile per musica dance/elettronica.
  - **Vocal & Podcast Clarity**: Ottimizzazione del parlato e dialoghi radio.
  - **Rock & Live Stage**: Curva a V energica con chitarre e percussioni in risalto.
  - **Acoustic Lounge**: Timbro vellutato e morbido per i lunghi viaggi.

---

### 2. Gestione Casse & Staging Acustico (Mappa 3D dell'Abitacolo)
- **Mappa Interattiva 3D**:
  - Rappresentazione grafica dall'alto del telaio e dell'abitacolo con la disposizione di tutti gli altoparlanti:
    - Canale centrale cruscotto (Center)
    - Tweeter montanti A (destra e sinistra)
    - Midrange nelle portiere anteriori
    - Subwoofer giganti sottosedile (guidatore e passeggero)
    - Altoparlanti portiere posteriori
    - Surround su cappelliera e montanti posteriori
    - Diffusori a soffitto 3D (B&W)
- **Regolazione Fader & Balance con Mirino Acustico**:
  - Sweet-spot sonoro regolabile con cursore a mirino a due assi (Fronte/Retro e Sinistra/Destra).
  - Profili rapidi di focalizzazione:
    - *Guidatore Esclusivo* (centrato al 100% sulla testa del guidatore).
    - *Passeggeri Anteriori* (fronte sonoro bilanciato tra i due sedili anteriori).
    - *Tutti i Passeggeri* (distribuzione omogenea per tutti e 5 i posti).
    - *Focus Posteriore / Bimbi* (attenua il fronte per non disturbare chi guida).

---

### 3. Profili Surround 3D & Immersione Acustica
- **Bowers & Wilkins QuantumLogic 3D**:
  - Cursore dell'intensità di immersione tridimensionale (0% stereo puro fino a 100% cupola 3D completa).
- **Dynamic Loudness (Compensazione Fletcher-Munson)**:
  - Adattamento psico-acustico che rinforza automaticamente le frequenze basse e alte quando il volume di ascolto è moderato.
- **Subwoofer Underseat Boost**:
  - Controllo dedicato indipendente del guadagno (-10 dB a +10 dB) per i soli woofer sotto i sedili.

---

### 4. Dinamica di Guida, Compensazione Velocità & ASD
- **Volume Adattivo in Base alla Velocità (GAL)**:
  - Lettura in tempo reale della velocità dalle centraline CAN (`Vehicle2.statusCarSpeed2`).
  - Curva logaritmica che compensa fruscii aerodinamici e rotolamento pneumatici aumentando gradualmente il volume (+0 dB da fermo fino a +6.5 dB a velocità autostradali).
- **Active Sound Design (ASD)**:
  - Gestione del suono sintetico del motore negli altoparlanti:
    - *OEM*: Segue la modalità di guida (Comfort / Sport).
    - *Sport+*: Rombo amplificato.
    - *Muted / Off*: Disattiva il rumore finto del motore per godersi la musica nella massima purezza e silenzio.
- **Telemetria Centralina RAM (0x37)**:
  - Monitoraggio temperatura del modulo RAM, canali DSP attivi e potenza complessiva in Watt RMS.

---

## 🚀 Installazione sulla Vettura (iDrive 7)

Dalla cartella principale del progetto `idrive7-apps-main`:

### 1. Test di anteprima (offline)
```powershell
python kit/tools/build.py --preview-only sound_studio
```

### 2. Caricamento sull'unità MGU della vettura
Con cavo Ethernet ENET / OBD collegato:
```powershell
.\deploy\push-to-car.ps1 -CarIp 192.168.143.1 sound_studio
```
*(Sostituisci `192.168.143.1` con l'IP della tua interfaccia di rete MGU se personalizzato).*

L'applicazione **Sound Studio** comparirà immediatamente nell'elenco delle applicazioni dell'iDrive 7!
