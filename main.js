// ===== 1. Inicialización y Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";

// ---- Firebase Config ----
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

// ---- Instrumentos y voces ----
const INSTRUMENTS = {
  guitarra: 6,
  laud: 6,
  bandurria: 6,
  mandolina: 4,
  tricordio: 4,
  contrabajo: 4,
  guitarron: 6
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
  renderTablatureEditor();
  renderLetraEditor();
  renderRasgueoEditor();
}
function fillFormFromSong(song) {
  songTitleInput.value = song.titulo;
  letraInput.value = song.letra;
  instrumentoSel.value = song.instrumento;
  currentInstrument = song.instrumento;
  instrSpan.textContent = "";
  tabData = song.tablatura || {};
  if(!tabData) tabData = {};
  // Para instrumentos sin voces, setea "Principal"
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
  renderTablatureEditor();
  renderLetraEditor();
  renderRasgueoEditor();
}
function createEmptyTab(instr, beats) {
  const strings = INSTRUMENTS[instr];
  return Array(strings).fill().map(() => Array(beats).fill(""));
}
// ============ 2. Tablatura multi-voz + editor =============
instrumentoSel.onchange = () => {
  currentInstrument = instrumentoSel.value;
  // Cambia a primer voz siempre
  currentVoice = (VOICES[currentInstrument]||["Principal"])[0];
  if(!tabData) tabData = {};
  for(const voz of (VOICES[currentInstrument]||["Principal"])) {
    if(!tabData[voz]) tabData[voz] = createEmptyTab(currentInstrument, DEFAULT_BEATS);
  }
  renderTabsVozBtns(currentInstrument);
  renderTablatureEditor();
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
    btn.onclick = (e)=>{ e.preventDefault(); currentVoice = vz; renderTablatureEditor(); };
    tabsVozBtns.appendChild(btn);
  });
}

addColBtn.onclick = () => {
  let t = tabData[currentVoice];
  for (let s = 0; s < t.length; s++) t[s].push("");
  renderTablatureEditor();
};
delColBtn.onclick = () => {
  let t = tabData[currentVoice];
  if (t[0].length > 1) {
    for (let s = 0; s < t.length; s++) t[s].pop();
    renderTablatureEditor();
  }
};

function renderTablatureEditor() {
  tablaturaDiv.innerHTML = "";
  let t = tabData[currentVoice];
  if (!t) { tablaturaDiv.textContent = "No hay tablatura."; return; }
  const numStrings = t.length;
  const numBeats = t[0].length;
  const table = document.createElement("table");
  table.className = "tablature-table";
  for (let s = 0; s < numStrings; s++) {
    const tr = document.createElement("tr");
    for (let b = 0; b < numBeats; b++) {
      const td = document.createElement("td");
      // Vertical tenue con border-right en CSS
      // Render círculo si existe valor
      if (t[s][b] !== "") {
        const circle = document.createElement("span");
        circle.className = "tablature-fret";
        if (typeof t[s][b] === "object" && t[s][b].val !== undefined) {
          circle.textContent = t[s][b].val;
          if (t[s][b].trino) circle.classList.add("trino");
        } else {
          circle.textContent = t[s][b];
        }
        td.appendChild(circle);
      }
      td.onclick = () => {
        td.classList.add("selected");
        let val = (typeof t[s][b] === "object") ? t[s][b].val : t[s][b];
        let trino = (typeof t[s][b] === "object") ? !!t[s][b].trino : false;
        td.innerHTML = `<input type="number" min="0" max="24" value="${val||""}" style="width:27px; font-size:1em;" />
        <button style="margin-left:5px;" id="trino-btn" ${trino?'data-on="1"':''}>~</button>`;
        const input = td.querySelector("input");
        const trinoBtn = td.querySelector("#trino-btn");
        input.focus();
        input.onblur = () => {
          let valNum = input.value || "";
          if (trinoBtn && trinoBtn.dataset.on==="1" && valNum) {
            t[s][b] = {val: valNum, trino: true};
          } else if (valNum) {
            t[s][b] = valNum;
          } else t[s][b] = "";
          renderTablatureEditor();
        };
        input.onkeydown = (e) => { if (e.key === "Enter" || e.key === "Tab") input.blur(); };
        if (trinoBtn) {
          trinoBtn.onclick = (e)=>{
            e.preventDefault(); e.stopPropagation();
            if (trinoBtn.dataset.on==="1") {
              trinoBtn.dataset.on="0";
              trinoBtn.style.background="#eee";
            } else {
              trinoBtn.dataset.on="1";
              trinoBtn.style.background="#ffe082";
            }
            input.focus();
          };
        }
      };
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  tablaturaDiv.appendChild(table);
}
// ========== 3. Letra y acordes =============
function renderLetraEditor() {
  letraDiv.innerHTML = "";
  for (let i = 0; i < letraOriginal.length; i++) {
    const span = document.createElement("span");
    span.className = "lyric-chunk";
    span.textContent = letraOriginal[i];
    // Acorde arriba
    if (acordesArriba[i]) {
      const chord = document.createElement("span");
      chord.className = "chord-above";
      chord.textContent = acordesArriba[i];
      span.prepend(chord);
    }
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
    icon.onclick = () => { rasgueoArr.splice(idx, 1); renderRasgueoEditor(); };
    seq.appendChild(icon);
  });
  rasgueoDiv.appendChild(seq);
  // controles avanzados
  const controls = document.createElement("div");
  let btn = document.createElement("button");
  btn.textContent = "↓";
  btn.onclick = ()=>{ rasgueoArr.push({type:"flecha"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = `<span style="font-size:1.1em;">↓</span><span style="font-size:.68em;position:relative;top:6px;">(ch)</span>`;
  btn.onclick = ()=>{ rasgueoArr.push({type:"flecha-chica"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  [6,5,4].forEach(str=>{
    let bbtn = document.createElement("button");
    bbtn.innerHTML = `${str}↓`;
    bbtn.onclick = ()=>{ rasgueoArr.push({type:"bajeo",str}); renderRasgueoEditor(); };
    controls.appendChild(bbtn);
  });
  btn = document.createElement("button");
  btn.textContent = "X";
  btn.onclick = ()=>{ rasgueoArr.push({type:"muteo"}); renderRasgueoEditor(); };
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

// ========== 7. GUARDAR EN FIREBASE ==========
songForm.onsubmit = async function(e) {
  e.preventDefault();
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
  const nowData = JSON.stringify(getCurrentSongData());
  if (nowData !== lastSavedData && songTitleInput.value.trim()) {
    // Simula "modificado"
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

// ========== 11. INICIO ==========
instrSpan.textContent = "";
loadSongList();
clearEditor();
