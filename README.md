# Harry Bella Fashion

Tailoring studio app for **Harry Bella Fashion** - We Sew, We Train, We Create Excellence.
Android app (Capacitor + vanilla JS), built for Android 15, runs on Android 5.1 and newer.

## What it does

- **Gallery** - finished looks, client references and AI drafts, with photo upload from camera or album and filters by source.
- **Client design library** - every look can be assigned to a client, and her card shows her own design board.
- **Tailoring guide** - fabric yardage, a piece-by-piece cut list and numbered construction steps, adjusted by the client's measurements.
- **Clients and measurements** - bust, waist, hips, shoulder, sleeve, lengths.
- **Jobs** - seven stages from consultation to delivered.
- **Money** - deposits, balances, who has paid and who still owes.
- **Deliveries** - pickups and drops, with rider notes.
- **Training** - NTSC camp batches, trainee fees and payments.
- **Payments** - bank transfer details print on receipts and WhatsApp payment messages.
- **Owner login** - a PIN gate. The owner PIN opens everything; a staff PIN opens jobs, clients, designs and deliveries only, with no money screens and no settings.

## Privacy

All data stays on the device in local storage. Nothing is uploaded. Settings has a JSON backup export.
The owner PIN is stored as a salted hash, never as plain text.

## Install

Download the APK from the latest release and open it on the phone. Allow install from that source when prompted.

## Build from source

Requirements: JDK 17, Android SDK with platform 35 and build tools 35, Node 18+.

```bash
npm install
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

For a release build, generate a keystore and configure signing in `android/app/build.gradle`:

```bash
keytool -genkey -v -keystore harrybella.jks -keyalg RSA -keysize 2048 -validity 10000 -alias harrybella
```

## Layout

- `www/index.html`, `www/app.js` - the whole app
- `www/request.html` - standalone client request form
- `android/` - Capacitor Android wrapper (compileSdk 35, targetSdk 35, minSdk 22)

## Version

1.3.0 - owner PIN login and staff role.
