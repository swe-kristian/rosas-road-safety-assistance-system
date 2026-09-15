const video=document.querySelector("#video");
const canvas=document.querySelector("#canvas");
const ctx=canvas.getContext("2d",{alpha:true});

const warning=document.querySelector("#warning");
const speedEl=document.querySelector("#speed");
const impactEl=document.querySelector("#impact");
const objectEl=document.querySelector("#objects");
const camEl=document.querySelector("#cam");

let model;

let speed=0;
let lastSpeed=0;
let impact=0;
let beta=0;
let gamma=0;

let lastGPS=0;
let detecting=false;
let crashActive=false;

let peakAcceleration=0;
let peakDeceleration=0;
let lastAcceleration=0;
let motionBurst=false;
let lastMotionTime=0;

let detectionResults=[];
let lastDetectionTime=0;

const speedHistory=[];
const motionHistory=[];

const SUPPORTED_CLASSES=new Set([
  "person",
  "car",
  "truck",
  "bus",
  "motorcycle",
  "bicycle",
  "dog",
  "cat"
]);

const scanCanvas=document.createElement("canvas");
scanCanvas.width=scanCanvas.height=64;
const scanCtx=scanCanvas.getContext("2d");

function warn(t){
  warning.textContent=t;
}

async function camera(){

  const stream=
    await navigator.mediaDevices.getUserMedia({
      video:{
        facingMode:{ideal:"environment"},
        width:{ideal:1920},
        height:{ideal:1080},
        frameRate:{ideal:30}
      },
      audio:false
    });

  video.srcObject=stream;

  return new Promise(resolve=>{
    video.onloadedmetadata=resolve;
  });
}

async function sensors(){

  if(
    typeof DeviceMotionEvent!=="undefined" &&
    DeviceMotionEvent.requestPermission
  ){

    try{
      await DeviceMotionEvent.requestPermission();
    }catch(e){
      console.warn(
        "Motion permission:",
        e
      );
    }
  }

  window.addEventListener(
    "devicemotion",
    e=>{

      const a=e.acceleration;
      const g=e.accelerationIncludingGravity;

      if(!g)return;

      const gx=g.x||0;
      const gy=g.y||0;
      const gz=g.z||0;

      impact = Math.sqrt(
        gx * gx +
        gy * gy +
        gz * gz
      );
      
      const impactPercentage = Math.round((impact / 9.81) * 100);
      impactEl.textContent = `${impactPercentage}%`;
      
      if(a){

        const ax=a.x||0;
        const ay=a.y||0;
        const az=a.z||0;

        const linear=Math.sqrt(
          ax*ax+
          ay*ay+
          az*az
        );

        peakAcceleration=
          Math.max(
            peakAcceleration,
            linear
          );

        if(linear>=5){

          motionBurst=true;
          lastMotionTime=
            performance.now();
        }

        motionHistory.push({
          t:performance.now(),
          a:linear
        });

        while(
          motionHistory.length &&
          performance.now()-
          motionHistory[0].t>2500
        ){
          motionHistory.shift();
        }

        lastAcceleration=linear;
      }
    }
  );

  window.addEventListener(
    "deviceorientation",
    e=>{
      beta=e.beta||0;
      gamma=e.gamma||0;
    }
  );
}

function gps(){

  navigator.geolocation?.watchPosition(

    position=>{

      const now=
        performance.now();

      const gpsSpeed=
        position.coords.speed;

      if(
        gpsSpeed==null ||
        !isFinite(gpsSpeed)
      )return;

      const kmh=
        Math.max(
          0,
          gpsSpeed*3.6
        );

      if(lastGPS){

        const dt=
          Math.max(
            0.05,
            (now-lastGPS)/1000
          );

        lastSpeed=speed;
        speed=kmh;

        const decel=
          Math.max(
            0,
            (lastSpeed-speed)/dt
          );

        peakDeceleration=
          Math.max(
            peakDeceleration,
            decel
          );

        speedHistory.push({
          t:now,
          speed,
          decel
        });

        while(
          speedHistory.length &&
          now-
          speedHistory[0].t>3000
        ){
          speedHistory.shift();
        }

      }else{

        speed=kmh;
        lastSpeed=kmh;
      }

      lastGPS=now;

      speedEl.textContent=
        speed.toFixed(0);
    },

    e=>console.warn(
      "GPS:",
      e
    ),

    {
      enableHighAccuracy:true,
      maximumAge:250,
      timeout:3000
    }
  );
}

function cameraCheck(){

  if(!video.videoWidth)return;

  scanCtx.drawImage(
    video,
    0,
    0,
    64,
    64
  );

  const data=
    scanCtx.getImageData(
      0,
      0,
      64,
      64
    ).data;

  let brightness=0;

  for(
    let i=0;
    i<data.length;
    i+=4
  ){

    brightness+=
      (
        data[i]+
        data[i+1]+
        data[i+2]
      )/3;
  }

  brightness/=4096;

  if(brightness<18){

    camEl.textContent="Blocked";

    warn(
      "Camera blocked"
    );

  }else if(brightness<40){

    camEl.textContent="Dark";

  }else{

    camEl.textContent="Clear";
  }
}

function crashEvidence(){

  let score=0;
  const evidence=[];
  const now=performance.now();

  const recentMotion=
    motionHistory.filter(
      x=>now-x.t<1500
    );

  if(recentMotion.length){

    const peak=Math.max(
      ...recentMotion.map(
        x=>x.a
      )
    );

    if(peak>=5){
      score+=20;
      evidence.push(
        "Sudden movement"
      );
    }

    if(peak>=8){
      score+=25;
      evidence.push(
        "Strong acceleration"
      );
    }

    if(peak>=12){
      score+=35;
      evidence.push(
        "Severe acceleration"
      );
    }

    if(peak>=18){
      score+=45;
      evidence.push(
        "Extreme acceleration"
      );
    }
  }

  if(
    motionBurst &&
    now-lastMotionTime<1200
  ){

    score+=20;

    evidence.push(
      "Sudden motion termination"
    );
  }

  const recentSpeed=
    speedHistory.filter(
      x=>now-x.t<2500
    );

  if(recentSpeed.length>=2){

    const first=
      recentSpeed[0];

    const latest=
      recentSpeed[
        recentSpeed.length-1
      ];

    const dt=
      (latest.t-first.t)/1000;

    const drop=
      first.speed-latest.speed;

    if(dt>0){

      const decel=
        drop/dt;

      if(
        first.speed>=15 &&
        drop>=8 &&
        decel>=4
      ){

        score+=20;

        evidence.push(
          "Rapid speed reduction"
        );
      }

      if(
        first.speed>=25 &&
        drop>=12 &&
        decel>=6
      ){

        score+=30;

        evidence.push(
          "Dangerous deceleration"
        );
      }

      if(
        first.speed>=35 &&
        latest.speed<=10 &&
        dt<=3
      ){

        score+=40;

        evidence.push(
          "Near-instant stop"
        );
      }

      if(
        first.speed>=45 &&
        latest.speed<=5 &&
        dt<=3
      ){

        score+=50;

        evidence.push(
          "Extreme vehicle stop"
        );
      }
    }
  }

  if(
    Math.abs(beta)>60 ||
    Math.abs(gamma)>60
  ){

    score+=15;

    evidence.push(
      "Abnormal orientation"
    );
  }

  if(
    Math.abs(beta)>75 ||
    Math.abs(gamma)>75
  ){

    score+=20;

    evidence.push(
      "Extreme orientation"
    );
  }

  if(
    lastSpeed>=20 &&
    speed<=5
  ){

    score+=25;

    evidence.push(
      "Vehicle stopped"
    );
  }

  if(
    motionBurst &&
    peakAcceleration>=8
  ){

    score+=25;

    evidence.push(
      "Motion + impact combination"
    );
  }

  return{
    score,
    evidence
  };
}


function emergencyCountdown(){

  if(crashActive)return;

  crashActive=true;

  let seconds=10;

  warn(
    "HALA CRASH! — OK KA LANG? "+
    seconds
  );

  const timer=
    setInterval(()=>{

      seconds--;

      if(seconds>0){

        warn(
          "HALA CRASH! — OK KA LANG? "+
          seconds
        );

        return;
      }

      clearInterval(timer);

      if(crashActive){

        warn(
          "NO RESPONSE, CONTACTING EMERGENCY SERVICES"
        );

        callEmergency();
      }

    },1000);

  const cancel=()=>{

    crashActive=false;

    clearInterval(timer);

    warn("System Ready");

    warning.style.pointerEvents=
      "none";

    warning.style.cursor="";

    warning.removeEventListener(
      "click",
      cancel
    );
  };

  warning.style.pointerEvents=
    "auto";

  warning.style.cursor=
    "pointer";

  warning.addEventListener(
    "click",
    cancel
  );
}


/* ===========================================
   KUNWARE EMERGENCY SERVICES, MOCK LANG PO ITO
============================================== */

const emergencyServices=[

  {
    name:"Goa MDRRMO",
    type:"Rescue / Ambulance",
    number:"+639126567850",
    lat:13.69,
    lon:123.49
  },

  {
    name:"Goa Municipal Police Station",
    type:"Police",
    number:"+63544530166",
    lat:13.69,
    lon:123.49
  },

  {
    name:"Goa Fire Station",
    type:"Fire / Rescue",
    number:"+639997027195",
    lat:13.69,
    lon:123.49
  },

  {
    name:"St. John Hospital",
    type:"Hospital / Emergency",
    number:"+63544530326",
    lat:13.69,
    lon:123.49
  }
];


function createEmergencyPanel(){

  if(
    document.querySelector(
      "#emergency-services"
    )
  )return;

  const panel=
    document.createElement(
      "div"
    );

  panel.id=
    "emergency-services";

  Object.assign(
    panel.style,
    {
      position:"fixed",
      right:"10px",
      top:"10px",
      zIndex:"8",
      background:"#000c",
      color:"#fff",
      padding:"7px 9px",
      borderRadius:"8px",
      font:"11px Arial",
      minWidth:"175px",
      opacity:"0.88",
      pointerEvents:"none"
    }
  );

  panel.innerHTML=
    "<b>Emergency Services</b><br>"+
    "<span id='service-status'>Detecting nearby services...</span>"+
    "<div id='service-list' style='margin-top:4px'></div>";

  document.body.appendChild(
    panel
  );

  setTimeout(()=>{

    const list=
      document.querySelector(
        "#service-list"
      );

    const status=
      document.querySelector(
        "#service-status"
      );

    status.textContent=
      "Local services detected";

    list.innerHTML=
      emergencyServices
        .map(
          s=>
            "<div>"+
            s.name+
            " — <span style='opacity:.7'>"+
            s.type+
            "</span></div>"
        )
        .join("");

  },1200);
}


function callEmergency(){

  navigator.geolocation?.getCurrentPosition(

    ()=>{
      dialService(
        emergencyServices[0]
      );
    },

    ()=>{
      dialService(
        emergencyServices[0]
      );
    },

    {
      enableHighAccuracy:true,
      timeout:3000,
      maximumAge:10000
    }
  );
}


function dialService(service){

  const a=
    document.createElement("a");

  a.href=
    "tel:09396047110"+service.number;

  a.style.display="none";

  document.body.appendChild(a);

  try{
    a.click();
  }catch(e){
    window.location.href=
      "tel:"+service.number;
  }

  setTimeout(
    ()=>a.remove(),
    1000
  );
}

function crash(){

  if(crashActive)return;

  const result=
    crashEvidence();

  if(result.score>=45){

    console.log(
      "CRASH SUSPECTED",
      result
    );

    emergencyCountdown();
  }

  if(
    performance.now()-
    lastMotionTime>2000
  ){

    motionBurst=false;
    peakAcceleration=0;
    peakDeceleration=0;
  }
}

async function runObjectDetection(){

  if(
    !model||
    detecting||
    video.readyState<2
  ){
    return;
  }

  detecting=true;

  try{

    const results=
      await model.detect(
        video,
        20,
        0.25
      );

    detectionResults=
      results.filter(
        object=>
          SUPPORTED_CLASSES.has(
            object.class
          )
      );

    objectEl.textContent=
      detectionResults.length;

    lastDetectionTime=
      performance.now();

  }catch(error){

    console.error(
      "Detection error:",
      error
    );

  }finally{

    detecting=false;
  }
}

function renderDetection(){

  if(
    video.readyState>=2 &&
    canvas.width &&
    canvas.height
  ){

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    for(
      const object of detectionResults
    ){

      const[
        x,
        y,
        width,
        height
      ]=object.bbox;

      ctx.strokeStyle="red";
      ctx.lineWidth=3;

      ctx.strokeRect(
        x,
        y,
        width,
        height
      );

      const label=
        object.class+
        " "+
        Math.round(
          object.score*100
        )+
        "%";

      ctx.font=
        "bold 14px Arial";

      const textWidth=
        ctx.measureText(
          label
        ).width;

      ctx.fillStyle=
        "rgba(0,0,0,.65)";

      ctx.fillRect(
        x,
        Math.max(
          0,
          y-20
        ),
        textWidth+8,
        20
      );

      ctx.fillStyle="#fff";

      ctx.fillText(
        label,
        x+4,
        Math.max(
          14,
          y-6
        )
      );
    }
  }

  requestAnimationFrame(
    renderDetection
  );
}

function detectionLoop(){

  runObjectDetection();

  setTimeout(
    detectionLoop,
    70
  );
}

async function initialize(){

  try{

    createEmergencyPanel();

    await camera();

    canvas.width=
      video.videoWidth;

    canvas.height=
      video.videoHeight;

    await tf.setBackend(
      "webgl"
    );

    await tf.ready();

    warn(
      "wait lang po"
    );

    model=
      await cocoSsd.load({
        base:"mobilenet_v2"
      });

    warn(
      "ok na"
    );
    
    model=
      await cocoSsd.load({
        base:"mobilenet_v2"
      });
      
    warn(
      "Active"
    );

    gps();

    await sensors();

    renderDetection();
    detectionLoop();

    setInterval(
      cameraCheck,
      500
    );

    setInterval(
      crash,
      100
    );

  }catch(error){

    console.error(
      "initialization error:",
      error
    );

    warn(
      "System initialization failed"
    );
  }
}

initialize();