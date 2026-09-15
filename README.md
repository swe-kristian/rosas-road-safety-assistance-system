# RoSAS — Road Safety and Assistance System

RoSAS is a browser-based road-safety prototype that explores how a phone could detect possible vehicle crashes by combining several signals instead of relying on a single sensor. The prototype uses the phone camera, browser motion and orientation sensors, GPS speed data, and TensorFlow.js object detection to build crash evidence. When the evidence score reaches the configured threshold, it displays a 10-second driver-response countdown and then attempts to start a phone call to a configured emergency contact.

> **Prototype and safety notice:** RoSAS is an experimental proof of concept. It is not a certified emergency-response system, medical device, automotive safety system, or replacement for emergency services. Its sensor readings, crash scoring, location handling, service directory, and call behavior have not been validated for real-world use. Do not rely on this project to detect an accident or request help.

## What the prototype does

After the page is opened in a compatible mobile browser, RoSAS requests camera, motion, orientation, and geolocation access. It then:

- Displays the rear-camera feed as the application background.
- Shows live GPS-derived speed and an impact estimate based on acceleration including gravity.
- Checks whether the camera view appears clear, dark, or blocked.
- Runs the COCO-SSD model through TensorFlow.js and draws boxes around supported objects such as people, cars, trucks, buses, motorcycles, bicycles, dogs, and cats.
- Tracks recent acceleration, speed changes, vehicle stops, and phone orientation.
- Adds weighted evidence for sudden movement, severe acceleration, rapid deceleration, near-instant stops, abnormal orientation, and combined motion-impact events.
- Treats a combined score of **45 or higher** as a suspected crash.
- Gives the user 10 seconds to tap the warning and cancel the response.
- Attempts to launch a `tel:` link for the first configured emergency service if the countdown expires.

The object detections are currently displayed for situational awareness. They are not part of the crash score in the current implementation.

## Detection concept

The project follows a multi-signal approach described in the original design notes:

```text
New sensor data
      |
      v
Evidence scoring
  - speed drop
  - acceleration / impact
  - phone orientation
      |
      v
Total crash score >= 45?
   no             yes
   |               |
continue       10-second response countdown
                         |
                no cancellation -> phone call attempt
```

This approach is intended to reduce false alarms compared with a single-sensor trigger. It remains a heuristic prototype: the thresholds are hand-tuned, the sensors can be noisy, and the code does not establish that a real collision occurred.

## Running locally

This is a static web application and has no build step or package manager configuration.

1. Clone the repository.
2. Serve the repository directory from a local HTTPS web server. Camera, motion, and geolocation APIs are commonly restricted to secure contexts such as HTTPS or `localhost`.
3. Open `index.html` in a compatible mobile browser.
4. Grant camera, motion/orientation, and location permissions when prompted.
5. Mount the phone securely and test only in a controlled, non-driving environment.

For a quick local server with Python:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. On a physical phone, use a properly configured HTTPS host; do not expose the prototype publicly without reviewing the security and privacy implications.

The application loads TensorFlow.js and COCO-SSD from jsDelivr at runtime, so an internet connection is required unless those dependencies are self-hosted.

## Browser permissions and compatibility

RoSAS depends on APIs that vary by browser and device:

- `navigator.mediaDevices.getUserMedia()` for camera access.
- `DeviceMotionEvent` and `deviceorientation` for motion and orientation data.
- `navigator.geolocation.watchPosition()` for speed data supplied by the device GPS.
- WebGL through TensorFlow.js for model inference.
- The `tel:` URL scheme for the emergency-call attempt.

The application is designed around a modern mobile browser. Desktop browsers may not provide meaningful speed, motion, or orientation data. Some browsers require a user gesture before motion permission can be requested, which the current prototype does not provide as a dedicated setup screen.

## Emergency-service behavior

The emergency directory in `sub elements/main.js` is sample data for Goa, Camarines Sur, Philippines. The entries and phone numbers are hard-coded, and the comment in the source identifies the directory as a mock. The current code does not perform a real nearest-service lookup, send a location payload, confirm that a call connected, or provide a dispatcher workflow.

Before any real-world use, this behavior would require substantial review, including verified service numbers, explicit user consent, reliable location sharing, duplicate-call prevention, offline handling, local legal requirements, and a tested human escalation process.

## Repository structure

```text
.
├── index.html                         Main application page
├── sub elements/
│   ├── main.js                        Sensor collection, scoring, detection, and call flow
│   └── style.css                      Full-screen camera view and heads-up display styles
├── stockpile of the abyss/
│   └── idea.txt                       Original brainstorming notes
└── licenses.md                        MIT license text supplied with the project
```

## Known limitations

This repository preserves the original prototype behavior, including several limitations that are important to understand:

- Crash detection is heuristic and has not been calibrated or validated against crash data.
- GPS speed may be unavailable, delayed, or inaccurate, especially indoors or at low speed.
- Motion and orientation values depend on phone placement and browser sensor behavior.
- A phone drop, pothole, hard brake, or aggressive maneuver could create false positives.
- A genuine crash could be missed if permissions are denied, the browser is suspended, the phone is damaged, the camera is blocked, or sensor data is unavailable.
- The current countdown is canceled by clicking the warning, but there is no separate confirmation screen or accessibility-focused interaction.
- The code attempts to call a hard-coded service and does not verify whether the call was placed or answered.
- The application does not transmit an emergency message, coordinates, vehicle details, or medical information.
- TensorFlow.js and COCO-SSD are loaded from a third-party CDN at runtime.
- The model is loaded twice during initialization in the current source and should be cleaned up in a future revision.
- Privacy controls, data retention rules, authentication, audit logging, and secure deployment are not implemented.

## Possible next steps

A future version could separate the prototype into a permission and calibration flow, replace hard-coded service data with a verified configurable directory, add explicit location-sharing consent, use a more rigorously evaluated sensor-fusion model, record test telemetry locally for analysis, improve accessibility and multilingual messaging, and add automated tests for the evidence-scoring logic.

## License

The project is distributed under the MIT License. See [`licenses.md`](licenses.md).

## Original project context

The source archive was named `DICTPSC2025Project(2)`. The included brainstorming notes describe a crash-detection and emergency-response concept and propose combining speed drop, impact, and phone tilt as evidence. This README documents the behavior that is actually present in the code rather than treating the brainstorming notes as implemented functionality.

<!-- Repository metadata suggestion: browser-based crash-detection and emergency-response prototype using camera, GPS, motion sensors, orientation, and TensorFlow.js. -->
