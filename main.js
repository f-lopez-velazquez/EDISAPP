// ===== 1. Inicialización y Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtShAFym0sPrrkocsY48oAB2W4wbUD9ZY",
  authDomain: "edisapp-54c5c.firebaseapp.com",
  projectId: "edisapp-54c5c",
  storageBucket: "edisapp-54c5c.appspot.com",
  messagingSenderId: "1022245708836",
  appId: "1:1022245708836:web:5031161ed56f7d162524b1"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const ADMIN_MAIL = "edis.ugto@gmail.com";
let currentUser = null; // Null = sin login
let adminMode = false;

// Simula login básico para el admin
function renderLoginBox() {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:98vh;background:#191919">
      <div style="background:#fff;border-radius:13px;box-shadow:0 2px 22px #0003;padding:2.7em 2.5em;max-width:340px;">
        <img src="https://i.imgur.com/N6rdt5B.png" style="display:block;margin:0 auto 20px auto;height:60px;">
        <h2 style="text-align:center;color:#243857;margin-bottom:24px;">Acceso EDIS</h2>
        <form id="loginform">
          <input type="email" id="login-mail" placeholder="Correo" style="width:100%;margin-bottom:12px;padding:11px;font-size:1.1em;border-radius:7px;border:1px solid #aaa;">
          <input type="password" id="login-pass" placeholder="Contraseña" style="width:100%;margin-bottom:12px;padding:11px;font-size:1.1em;border-radius:7px;border:1px solid #aaa;">
          <button style="width:100%;background:#243857;color:#fff;padding:11px;border:none;border-radius:7px;font-size:1.1em;cursor:pointer;">Entrar</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById("loginform").onsubmit = e => {
    e.preventDefault();
    const mail = document.getElementById("login-mail").value.trim();
    const pass = document.getElementById("login-pass").value;
    if (mail === ADMIN_MAIL && pass === "jijijija55") {
      adminMode = true;
      currentUser = {email: ADMIN_MAIL};
      location.reload();
    } else {
      alert("Usuario/contraseña incorrectos");
    }
  }
}
function setupAdminUI() {
  const ui = document.getElementById("user-info");
  if (!ui) return;
  if (adminMode) {
    ui.innerHTML = `<span style="font-weight:bold;color:#ffe082;">Administrador</span> 
    <button style="margin-left:20px;background:#ffe082;color:#29244b;padding:7px 19px;border:none;border-radius:8px;font-size:1em;cursor:pointer;" id="logoutBtn">Salir</button>`;
    document.getElementById("logoutBtn").onclick = ()=>{
      adminMode = false;
      currentUser = null;
      location.reload();
    }
  } else {
    ui.innerHTML = `<span style="color:#eee;">Modo visualización</span>`;
  }
}
// ====== FIN LOGIN/ADMIN =====

// ==== Variables principales ====
const INSTRUMENTS = {
  guitarra: 6, laud: 6, bandurria: 6, mandolina: 4, tricordio: 4, contrabajo: 4, guitarron: 6
};
const VOICES = {
  guitarra: ["Principal"],
  laud: ["1ra", "2da", "3ra", "arreglos"],
  bandurria: ["1ra", "2da", "3ra", "arreglos"],
  mandolina: ["1ra", "2da", "3ra", "arreglos"],
  tricordio: ["1ra", "2da", "3ra", "arreglos"],
  contrabajo: ["Principal"],
  guitarron: ["Principal"]
};
const DEFAULT_BEATS = 16;

let songList = [];
let currentSong = null;
let isNew = false;

let tabData = {}; // {voz: matriz}
let letraOriginal = "";
let acordesArriba = {};
let rasgueoArr = [];
let currentVoice = "Principal";
let currentInstrument = "guitarra";
let lastSavedData = "";

const songListElem = document.getElementById("song-list");
const songForm = document.getElementById("song-form");
const songTitleInput = document.getElementById("song-title");
const letraInput = document.getElementById("letra-in");
const instrumentoSel = document.getElementById("instrumento");
const instrSpan = document.getElementById("tabs-voz");
const tablaturaDiv = document.getElementById("tablatura");
const addColBtn = document.getElementById("add-col");
const delColBtn = document.getElementById("del-col");
const letraDiv = document.getElementById("letra");
const rasgueoDiv = document.getElementById("rasgueo");
const audioUpload = document.getElementById("audio-upload");
const audioPlayer = document.getElementById("audio-player");
const saveBtn = document.getElementById("save-song");
const cancelBtn = document.getElementById("cancel-edit");
const newSongBtn = document.getElementById("new-song-btn");
const toast = document.getElementById("toast");
const tabsVozBtns = document.getElementById("tabs-voz-btns");
const pdfBtn = document.getElementById("pdf-song");
const lastSavedDiv = document.getElementById("last-saved");
const ensayoBtn = document.getElementById("ensayo-song");
const ensayoVivoDiv = document.getElementById("ensayo-vivo");

// ========= FUNCIONES CRUD ===========

async function loadSongList() {
  songList = [];
  songListElem.innerHTML = `<li style="color:#fff;padding:1.1em;text-align:center;">Cargando...</li>`;
  const snap = await getDocs(collection(db, "canciones"));
  snap.forEach(doc => songList.push({id:doc.id, ...doc.data()}));
  renderSongList();
}
function renderSongList() {
  songListElem.innerHTML = "";
  songList.sort((a,b)=>a.titulo.localeCompare(b.titulo));
  for (const song of songList) {
    const li = document.createElement("li");
    li.textContent = song.titulo;
    li.onclick = () => selectSong(song.id);
    if (currentSong && song.id === currentSong.id) li.classList.add("selected");
    songListElem.appendChild(li);
  }
}
function selectSong(id) {
  currentSong = songList.find(s=>s.id===id);
  isNew = false;
  fillFormFromSong(currentSong);
}
function getInstrLabel(instr) {
  return `${instr.charAt(0).toUpperCase()+instr.slice(1)} (${INSTRUMENTS[instr]})`;
}
function clearEditor() {
  songTitleInput.value = "";
  letraInput.value = "";
  instrumentoSel.value = "guitarra";
  instrSpan.textContent = "";
  tabData = {};
  currentVoice = VOICES["guitarra"][0];
  ["guitarra","laud","bandurria","mandolina","tricordio","contrabajo","guitarron"].forEach(instr=>{
    for(const voz of VOICES[instr]) {
      if(!tabData[voz]) tabData[voz] = createEmptyTab(instr, DEFAULT_BEATS);
    }
  });
  letraOriginal = "";
  acordesArriba = {};
  rasgueoArr = [];
  audioPlayer.src = "";
  audioPlayer.style.display = "none";
  renderTabsVozBtns("guitarra");
  renderTablatureEditorSVG();
  renderLetraEditor();
  renderRasgueoEditor();
  ensayoVivoDiv.innerHTML = "";
}
function fillFormFromSong(song) {
  songTitleInput.value = song.titulo;
  letraInput.value = song.letra;
  instrumentoSel.value = song.instrumento;
  currentInstrument = song.instrumento;
  instrSpan.textContent = "";
  tabData = song.tablatura || {};
  if(!tabData) tabData = {};
  for(const voz of (VOICES[song.instrumento]||["Principal"])) {
    if(!tabData[voz]) tabData[voz] = createEmptyTab(song.instrumento, DEFAULT_BEATS);
  }
  currentVoice = (VOICES[song.instrumento]||["Principal"])[0];
  letraOriginal = song.letra || "";
  acordesArriba = song.acordesArriba || {};
  rasgueoArr = song.rasgueo || [];
  audioPlayer.style.display = song.audioUrl ? "" : "none";
  audioPlayer.src = song.audioUrl || "";
  renderTabsVozBtns(song.instrumento);
  renderTablatureEditorSVG();
  renderLetraEditor();
  renderRasgueoEditor();
  ensayoVivoDiv.innerHTML = "";
}
function createEmptyTab(instr, beats) {
  const strings = INSTRUMENTS[instr];
  return Array(strings).fill().map(() => Array(beats).fill(""));
}
// ============ 2. Tablatura multi-voz + SVG PRO =============
instrumentoSel.onchange = () => {
  currentInstrument = instrumentoSel.value;
  currentVoice = (VOICES[currentInstrument]||["Principal"])[0];
  if(!tabData) tabData = {};
  for(const voz of (VOICES[currentInstrument]||["Principal"])) {
    if(!tabData[voz]) tabData[voz] = createEmptyTab(currentInstrument, DEFAULT_BEATS);
  }
  renderTabsVozBtns(currentInstrument);
  renderTablatureEditorSVG();
  renderRasgueoEditor();
};
function renderTabsVozBtns(instr) {
  const voces = VOICES[instr] || ["Principal"];
  tabsVozBtns.innerHTML = "";
  voces.forEach(vz => {
    const btn = document.createElement("button");
    btn.textContent = vz;
    btn.className = "voz-btn";
    if (vz === currentVoice) btn.classList.add("active");
    btn.onclick = (e)=>{ e.preventDefault(); currentVoice = vz; renderTablatureEditorSVG(); };
    tabsVozBtns.appendChild(btn);
  });
}
addColBtn.onclick = () => {
  let t = tabData[currentVoice];
  for (let s = 0; s < t.length; s++) t[s].push("");
  renderTablatureEditorSVG();
};
delColBtn.onclick = () => {
  let t = tabData[currentVoice];
  if (t[0].length > 1) {
    for (let s = 0; s < t.length; s++) t[s].pop();
    renderTablatureEditorSVG();
  }
};
// ======= SVG Tablatura PRO (círculo sobre cuerda, trino, etc) ==========
function renderTablatureEditorSVG() {
  tablaturaDiv.innerHTML = "";
  const t = tabData[currentVoice];
  if (!t) { tablaturaDiv.textContent = "No hay tablatura."; return; }
  const numStrings = t.length;
  const numBeats = t[0].length;
  const width = 48 * numBeats + 10;
  const height = 30 * (numStrings-1) + 30;

  let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.style.background = "#fafafc";
  svg.style.borderRadius = "10px";
  svg.style.boxShadow = "0 2px 10px #0001";

  // Cuerdas
  for (let s = 0; s < numStrings; s++) {
    let y = 15 + s*30;
    let line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1", 0);
    line.setAttribute("y1", y);
    line.setAttribute("x2", width);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#bbb");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
  }
  // Líneas verticales tenues
  for (let b = 0; b < numBeats; b++) {
    let x = 24 + b*48;
    let vline = document.createElementNS("http://www.w3.org/2000/svg","line");
    vline.setAttribute("x1", x);
    vline.setAttribute("y1", 10);
    vline.setAttribute("x2", x);
    vline.setAttribute("y2", height-10);
    vline.setAttribute("stroke", "#e0deee");
    vline.setAttribute("stroke-width", "1");
    svg.appendChild(vline);
  }
  // Números/círculos
  for (let s = 0; s < numStrings; s++) {
    let y = 15 + s*30;
    for (let b = 0; b < numBeats; b++) {
      let valObj = t[s][b];
      let val = "", trino = false;
      if(typeof valObj === "object" && valObj) {
        val = valObj.val;
        trino = !!valObj.trino;
      } else {
        val = valObj;
      }
      if(val) {
        let x = 24 + b*48;
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.style.cursor = adminMode ? "pointer" : "default";
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", 13);
        circle.setAttribute("fill", "#3b306c");
        circle.setAttribute("stroke", "#e7e5f1");
        circle.setAttribute("stroke-width", "2");
        g.appendChild(circle);

        let txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", x);
        txt.setAttribute("y", y+5);
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("fill", "#fff");
        txt.setAttribute("font-size", "17");
        txt.setAttribute("font-weight", "bold");
        txt.textContent = val;
        g.appendChild(txt);

        if(trino) {
          let trinoTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          trinoTxt.setAttribute("x", x);
          trinoTxt.setAttribute("y", y-15);
          trinoTxt.setAttribute("text-anchor", "middle");
          trinoTxt.setAttribute("fill", "#eb9b00");
          trinoTxt.setAttribute("font-size", "22");
          trinoTxt.setAttribute("font-weight", "bold");
          trinoTxt.textContent = "~";
          g.appendChild(trinoTxt);
        }
        if (adminMode) {
          g.onclick = (e) => {
            e.stopPropagation();
            let nuevo = prompt("Número de dedo/traste (vacío para quitar):", val);
            if(nuevo!==null && nuevo!=="") {
              let setTrino = confirm("¿Agregar trino? (Aceptar=Sí, Cancelar=No)");
              t[s][b] = setTrino ? {val: nuevo, trino:true} : nuevo;
            } else if(nuevo==="") {
              t[s][b] = "";
            }
            renderTablatureEditorSVG();
          };
        }
        svg.appendChild(g);
      } else {
        // Click sobre la cuerda vacía
        let x = 24 + b*48;
        if (adminMode) {
          let clickArea = document.createElementNS("http://www.w3.org/2000/svg","rect");
          clickArea.setAttribute("x", x-13);
          clickArea.setAttribute("y", y-13);
          clickArea.setAttribute("width", 26);
          clickArea.setAttribute("height", 26);
          clickArea.setAttribute("fill", "rgba(255,255,255,0)");
          clickArea.style.cursor = "pointer";
          clickArea.onclick = (e) => {
            e.stopPropagation();
            let nuevo = prompt("Número de dedo/traste (vacío para quitar):", "");
            if(nuevo!==null && nuevo!=="") {
              let setTrino = confirm("¿Agregar trino? (Aceptar=Sí, Cancelar=No)");
              t[s][b] = setTrino ? {val: nuevo, trino:true} : nuevo;
            }
            renderTablatureEditorSVG();
          };
          svg.appendChild(clickArea);
        }
      }
    }
  }
  tablaturaDiv.appendChild(svg);
}

// ========== 3. Letra y acordes =============
function renderLetraEditor() {
  letraDiv.innerHTML = "";
  for (let i = 0; i < letraOriginal.length; i++) {
    const span = document.createElement("span");
    span.className = "lyric-chunk";
    span.textContent = letraOriginal[i];
    if (acordesArriba[i]) {
      const chord = document.createElement("span");
      chord.className = "chord-above";
      chord.textContent = acordesArriba[i];
      span.prepend(chord);
    }
    if(adminMode) {
      span.onclick = (e) => {
        e.stopPropagation();
        let val = prompt("Acorde (ejemplo: G, Dm, C7, etc):", acordesArriba[i] || "");
        if (val === null) return;
        val = val.trim();
        if (val) {
          acordesArriba[i] = val;
        } else {
          delete acordesArriba[i];
        }
        renderLetraEditor();
      };
    }
    letraDiv.appendChild(span);
  }
}
letraInput.oninput = ()=>{
  letraOriginal = letraInput.value;
  acordesArriba = {};
  renderLetraEditor();
};
// ========== 4. Rasgueo avanzado ==========
function renderRasgueoEditor() {
  rasgueoDiv.innerHTML = "";
  if (instrumentoSel.value !== "guitarra") {
    rasgueoDiv.innerHTML = `<div style="color:#888;font-size:1em;">(Rasgueo sólo editable en guitarra)</div>`;
    return;
  }
  const seq = document.createElement("div");
  seq.style.display = "flex";
  seq.style.gap = "9px";
  rasgueoArr.forEach((r, idx) => {
    const icon = document.createElement("span");
    icon.className = "rasgueo-icon";
    if (r.type==="bajeo") icon.innerHTML = `<span style="font-size:.8em">${r.str}</span><span style="font-size:1.1em;">&#8595;</span>`;
    else if (r.type==="flecha-chica") icon.innerHTML = `<span style="font-size:1.17em;opacity:.7;">&#8595;</span>`;
    else if (r.type==="flecha") icon.innerHTML = "&#8595;";
    else icon.innerHTML = r.symb||"•";
    if(adminMode) {
      icon.onclick = () => { rasgueoArr.splice(idx, 1); renderRasgueoEditor(); };
    }
    seq.appendChild(icon);
  });
  rasgueoDiv.appendChild(seq);
  if(!adminMode) return;
  const controls = document.createElement("div");
  let btn = document.createElement("button");
  btn.textContent = "↓";
  btn.onclick = (e)=>{ e.preventDefault(); rasgueoArr.push({type:"flecha"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = `<span style="font-size:1.1em;">↓</span><span style="font-size:.68em;position:relative;top:6px;">(ch)</span>`;
  btn.onclick = (e)=>{ e.preventDefault(); rasgueoArr.push({type:"flecha-chica"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  [6,5,4].forEach(str=>{
    let bbtn = document.createElement("button");
    bbtn.innerHTML = `${str}↓`;
    bbtn.onclick = (e)=>{ e.preventDefault(); rasgueoArr.push({type:"bajeo",str}); renderRasgueoEditor(); };
    controls.appendChild(bbtn);
  });
  btn = document.createElement("button");
  btn.textContent = "X";
  btn.onclick = (e)=>{ e.preventDefault(); rasgueoArr.push({type:"muteo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  rasgueoDiv.appendChild(controls);
}

// ========== 5. AUDIO ==========
audioUpload.onchange = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.style.display = "";
};

// ========== 6. NUEVA, CANCELAR, GUARDAR ==========
newSongBtn.onclick = () => {
  if (!adminMode) {
    showToast("Sólo el admin puede crear canciones");
    return;
  }
  isNew = true;
  currentSong = null;
  clearEditor();
  songTitleInput.focus();
};
cancelBtn.onclick = (e) => {
  e.preventDefault();
  if (songList.length && currentSong) fillFormFromSong(currentSong);
  else clearEditor();
};
saveBtn.onclick = (e)=>{
  if(!adminMode) {
    e.preventDefault();
    showToast("Sólo el admin puede guardar cambios");
    return false;
  }
};

// ========== 7. GUARDAR EN FIREBASE ==========
songForm.onsubmit = async function(e) {
  e.preventDefault();
  if(!adminMode) {
    showToast("Sólo el admin puede guardar cambios");
    return;
  }
  let audioUrl = currentSong ? currentSong.audioUrl : "";
  if (audioUpload.files[0]) {
    showToast("Subiendo audio...");
    const file = audioUpload.files[0];
    const storageRef = ref(storage, "audios/"+songTitleInput.value+"-"+Date.now());
    await uploadBytes(storageRef, file);
    audioUrl = await getDownloadURL(storageRef);
    audioPlayer.src = audioUrl;
  }
  const data = {
    titulo: songTitleInput.value,
    letra: letraInput.value,
    instrumento: instrumentoSel.value,
    tablatura: tabData,
    acordesArriba,
    rasgueo: instrumentoSel.value==="guitarra"?rasgueoArr:[],
    audioUrl
  };
  if (isNew) {
    const newRef = await addDoc(collection(db,"canciones"), data);
    showToast("Canción agregada");
    currentSong = {id:newRef.id,...data};
  } else if (currentSong) {
    await setDoc(doc(db,"canciones",currentSong.id), data);
    showToast("Canción actualizada");
    currentSong = {...data, id:currentSong.id};
  }
  await loadSongList();
  fillFormFromSong(currentSong);
  lastSavedData = JSON.stringify(data);
};

// ========== 8. AUTOGUARDADO ==============
function getCurrentSongData() {
  return {
    titulo: songTitleInput.value,
    letra: letraInput.value,
    instrumento: instrumentoSel.value,
    tablatura: tabData,
    acordesArriba,
    rasgueo: instrumentoSel.value==="guitarra"?rasgueoArr:[],
    audioUrl: currentSong ? currentSong.audioUrl : ""
  };
}
setInterval(async ()=>{
  if (!adminMode) return;
  const nowData = JSON.stringify(getCurrentSongData());
  if (nowData !== lastSavedData && songTitleInput.value.trim()) {
    let data = getCurrentSongData();
    if (currentSong && currentSong.id) {
      await setDoc(doc(db,"canciones",currentSong.id), data);
      showToast("Autoguardado");
    }
    lastSavedData = nowData;
    lastSavedDiv.textContent = "Autoguardado: "+(new Date()).toLocaleTimeString();
  }
}, 15000);

// ========== 9. PDF ===============
pdfBtn.onclick = ()=>{
  let seccion = document.getElementById("song-editor-section");
  html2pdf().from(seccion).save((songTitleInput.value||"cancion")+".pdf");
};

// ========== 10. TOAST =============
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(()=>toast.classList.remove("visible"), 1700);
}
// ========== 11. ENSAYO EN VIVO ============
ensayoBtn.onclick = ()=>{
  ensayoVivoDiv.innerHTML = "";
  if (!letraOriginal || letraOriginal.length === 0) {
    showToast("Agrega una letra para ensayar en vivo");
    return;
  }
  // Opciones: velocidad, iniciar/pausar, resalta letra y acorde actuales
  let velocidad = 500;
  let corriendo = false;
  let idx = 0;

  ensayoVivoDiv.innerHTML = `
    <div style="margin:1em 0;">
      <label>Velocidad: <input id="vel-ensayo" type="range" min="100" max="1500" step="50" value="${velocidad}"/> <span id="vel-label">${velocidad} ms</span></label>
      <button id="btn-iniciar-ensayo" style="margin-left:10px;">Iniciar</button>
      <button id="btn-pausar-ensayo" style="margin-left:5px;">Pausar</button>
      <button id="btn-reset-ensayo" style="margin-left:5px;">Reiniciar</button>
    </div>
    <div id="letra-ensayo" style="font-family:'Menlo',monospace;font-size:1.22em;background:#fff;padding:1.5em;border-radius:8px;min-height:80px;word-break:break-all;"></div>
  `;
  const letraEnsayoDiv = document.getElementById("letra-ensayo");
  const velSlider = document.getElementById("vel-ensayo");
  const velLabel = document.getElementById("vel-label");
  velSlider.oninput = ()=>{ velocidad = velSlider.value; velLabel.textContent = velocidad+" ms"; };

  function renderLetraEnsayo(i) {
    letraEnsayoDiv.innerHTML = "";
    for (let j = 0; j < letraOriginal.length; j++) {
      const span = document.createElement("span");
      span.className = "lyric-chunk";
      span.textContent = letraOriginal[j];
      if (acordesArriba[j]) {
        const chord = document.createElement("span");
        chord.className = "chord-above";
        chord.textContent = acordesArriba[j];
        span.prepend(chord);
      }
      if (j === i) {
        span.style.background = "#ffe082";
        span.style.color = "#29244b";
      }
      letraEnsayoDiv.appendChild(span);
    }
  }

  let timer = null;
  function correrEnsayo() {
    if (!corriendo) return;
    renderLetraEnsayo(idx);
    idx++;
    if (idx < letraOriginal.length) {
      timer = setTimeout(correrEnsayo, velocidad);
    } else {
      corriendo = false;
      idx = 0;
    }
  }

  document.getElementById("btn-iniciar-ensayo").onclick = ()=>{
    if (corriendo) return;
    corriendo = true;
    correrEnsayo();
  };
  document.getElementById("btn-pausar-ensayo").onclick = ()=>{
    corriendo = false;
    clearTimeout(timer);
  };
  document.getElementById("btn-reset-ensayo").onclick = ()=>{
    corriendo = false;
    idx = 0;
    clearTimeout(timer);
    renderLetraEnsayo(idx);
  };
  renderLetraEnsayo(idx);
};

// ========== 12. INICIO ==========
setupAdminUI();
loadSongList();
clearEditor();
