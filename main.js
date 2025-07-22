import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
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

// INSTRUMENTOS y VOCES
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

// Escucha en tiempo real
onSnapshot(collection(db, "canciones"), (snap) => {
  songList = [];
  snap.forEach(doc => songList.push({id:doc.id, ...doc.data()}));
  renderSongList();
});

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
function clearEditor() {
  songTitleInput.value = "";
  letraInput.value = "";
  instrumentoSel.value = "guitarra";
  instrSpan.textContent = "";
  tabData = {};
  currentVoice = VOICES["guitarra"][0];
  Object.keys(INSTRUMENTS).forEach(instr=>{
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
}
function fillFormFromSong(song) {
  if(!song) return;
  songTitleInput.value = song.titulo || "";
  letraInput.value = song.letra || "";
  instrumentoSel.value = song.instrumento || "guitarra";
  currentInstrument = song.instrumento || "guitarra";
  instrSpan.textContent = "";
  tabData = song.tablatura || {};
  if(!tabData) tabData = {};
  for(const voz of (VOICES[currentInstrument]||["Principal"])) {
    if(!tabData[voz]) tabData[voz] = createEmptyTab(currentInstrument, DEFAULT_BEATS);
  }
  currentVoice = (VOICES[currentInstrument]||["Principal"])[0];
  letraOriginal = song.letra || "";
  acordesArriba = song.acordesArriba || {};
  rasgueoArr = song.rasgueo || [];
  audioPlayer.style.display = song.audioUrl ? "" : "none";
  audioPlayer.src = song.audioUrl || "";
  renderTabsVozBtns(currentInstrument);
  renderTablatureEditorSVG();
  renderLetraEditor();
  renderRasgueoEditor();
}
function createEmptyTab(instr, beats) {
  const strings = INSTRUMENTS[instr];
  return Array(strings).fill().map(() => Array(beats).fill(""));
}
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
        g.style.cursor = "pointer";
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
          trinoTxt.setAttribute("y", y-18);
          trinoTxt.setAttribute("text-anchor", "middle");
          trinoTxt.setAttribute("fill", "#e39d1b");
          trinoTxt.setAttribute("font-size", "18");
          trinoTxt.setAttribute("font-weight", "bold");
          trinoTxt.textContent = "tr~";
          g.appendChild(trinoTxt);
        }
        g.onclick = (e) => {
          e.stopPropagation();
          let actualObj = t[s][b];
          let prevVal = (typeof actualObj === "object" && actualObj) ? actualObj.val : actualObj;
          let prevTrino = (typeof actualObj === "object" && actualObj) ? actualObj.trino : false;
          let nuevo = prompt("Número de dedo/traste (vacío para quitar):", prevVal);
          if(nuevo!==null && nuevo!=="") {
            let setTrino = confirm("¿Agregar trino? (Aceptar=Sí, Cancelar=No)");
            t[s][b] = {val: nuevo, trino:setTrino};
          } else {
            t[s][b] = "";
          }
          renderTablatureEditorSVG();
        };
        svg.appendChild(g);
      } else {
        let x = 24 + b*48;
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
            t[s][b] = {val: nuevo, trino:setTrino};
          }
          renderTablatureEditorSVG();
        };
        svg.appendChild(clickArea);
      }
    }
  }
  tablaturaDiv.appendChild(svg);
}
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
    let icon = document.createElement("span");
    icon.className = "rasgueo-icon";
    if (r.type==="bajo") {
      let bajoNum = r.str;
      icon = document.createElement("span");
      icon.className = "rasgueo-bajo rasgueo-icon";
      icon.textContent = String.fromCharCode(9311+parseInt(bajoNum)); // Unicode ④, ⑤, ⑥
    }
    else if (r.type==="flecha-chica-abajo") icon.innerHTML = `<span style="font-size:1.1em;opacity:.5;">&#8595;</span>`;
    else if (r.type==="flecha-chica-arriba") icon.innerHTML = `<span style="font-size:1.1em;opacity:.5;">&#8593;</span>`;
    else if (r.type==="flecha-arriba") icon.innerHTML = `<span style="font-size:1.5em;">&#8593;</span>`;
    else if (r.type==="flecha-abajo") icon.innerHTML = `<span style="font-size:1.5em;">&#8595;</span>`;
    else if (r.type==="muteo") icon.innerHTML = `<b style="font-size:1.12em;color:#888;">X</b>`;
    else icon.innerHTML = r.symb||"•";
    icon.onclick = () => { rasgueoArr.splice(idx, 1); renderRasgueoEditor(); };
    seq.appendChild(icon);
  });
  rasgueoDiv.appendChild(seq);
  const controls = document.createElement("div");
  let btn = document.createElement("button");
  btn.innerHTML = "↓";
  btn.onclick = ()=>{ rasgueoArr.push({type:"flecha-abajo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = "↑";
  btn.onclick = ()=>{ rasgueoArr.push({type:"flecha-arriba"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = `<span style="font-size:1.1em;opacity:.6;">↓</span>`;
  btn.onclick = ()=>{ rasgueoArr.push({type:"flecha-chica-abajo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = `<span style="font-size:1.1em;opacity:.6;">↑</span>`;
  btn.onclick = ()=>{ rasgueoArr.push({type:"flecha-chica-arriba"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  [4,5,6].forEach(str=>{
    let bbtn = document.createElement("button");
    bbtn.innerHTML = String.fromCharCode(9311+str);
    bbtn.onclick = ()=>{ rasgueoArr.push({type:"bajo",str}); renderRasgueoEditor(); };
    controls.appendChild(bbtn);
  });
  btn = document.createElement("button");
  btn.textContent = "X";
  btn.onclick = ()=>{ rasgueoArr.push({type:"muteo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  rasgueoDiv.appendChild(controls);
}

audioUpload.onchange = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.style.display = "";
};
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
  lastSavedData = JSON.stringify(data);
};
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
    let data = getCurrentSongData();
    if (currentSong && currentSong.id) {
      await setDoc(doc(db,"canciones",currentSong.id), data);
      showToast("Autoguardado");
    }
    lastSavedData = nowData;
    lastSavedDiv.textContent = "Autoguardado: "+(new Date()).toLocaleTimeString();
  }
}, 15000);

pdfBtn.onclick = ()=>{
  let seccion = document.getElementById("song-editor-section");
  html2pdf().from(seccion).save((songTitleInput.value||"cancion")+".pdf");
};
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(()=>toast.classList.remove("visible"), 1700);
}
instrSpan.textContent = "";
clearEditor();
