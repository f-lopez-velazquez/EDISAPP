// ========== 1. LOGIN, ROLES, ADMIN, MENSAJE WOW =============
const ADMIN_MAIL = "edis.ugto@gmail.com";
let adminMode = false;
let currentUser = null;

if (localStorage.getItem("edis_adminMode") === "true") {
  adminMode = true;
  currentUser = {email: ADMIN_MAIL};
} else {
  adminMode = false;
  currentUser = null;
}
function bienvenida(mode) {
  let msg = "";
  if (mode === "admin") {
    msg = "¡Bienvenido, administrador! Tienes acceso total para crear, editar y gestionar canciones.";
  } else {
    msg = "¡Bienvenido! Estás en modo usuario. Puedes ver y ensayar canciones.";
  }
  showToast(msg, 2000);
}
function renderLoginBox() {
  document.body.innerHTML = `
    <div class="wow-login-bg"></div>
    <div style="display:flex;align-items:center;justify-content:center;min-height:99vh;position:relative;z-index:2;">
      <div class="glass-main" style="max-width:340px;min-width:0;padding:2.2em 2.2em;">
        <img src="https://i.imgur.com/sRgWLhM.png" style="display:block;margin:0 auto 20px auto;height:70px;">
        <h2 style="text-align:center;color:#243857;margin-bottom:24px;font-weight:900;">Acceso EDIS</h2>
        <form id="loginform">
          <input type="email" id="login-mail" placeholder="Correo" style="width:100%;margin-bottom:12px;padding:11px;font-size:1.1em;border-radius:7px;border:1px solid #aaa;">
          <input type="password" id="login-pass" placeholder="Contraseña" style="width:100%;margin-bottom:12px;padding:11px;font-size:1.1em;border-radius:7px;border:1px solid #aaa;">
          <button class="btn-glass blue" style="width:100%;">Entrar</button>
        </form>
        <button id="entrar-solo-usuario" class="btn-glass grey" style="width:100%;margin-top:13px;">
          Solo ver como usuario
        </button>
      </div>
    </div>
  `;
  document.body.style.background = "linear-gradient(120deg,#21294c 0%, #496bff 100%)";
  document.getElementById("loginform").onsubmit = e => {
    e.preventDefault();
    const mail = document.getElementById("login-mail").value.trim();
    const pass = document.getElementById("login-pass").value;
    if (mail === ADMIN_MAIL && pass === "jijijija55") {
      localStorage.setItem("edis_adminMode", "true");
      bienvenida("admin");
      setTimeout(()=>location.reload(), 800);
    } else {
      showToast("Usuario/contraseña incorrectos");
    }
  };
  document.getElementById("entrar-solo-usuario").onclick = ()=>{
    localStorage.setItem("edis_adminMode", "false");
    bienvenida("usuario");
    setTimeout(()=>location.reload(), 800);
  }
}
function setupAdminUI() {
  const ui = document.getElementById("user-info");
  if (!ui) return;
  if (adminMode) {
    ui.innerHTML = `
      <span style="font-weight:bold;color:#ffe082;">Administrador</span>
      <button class="btn-glass gold" id="logoutBtn" style="margin-left:16px;">Salir</button>
      <button class="btn-glass blue" id="verSoloBtn" style="margin-left:13px;">Ver como usuario</button>
    `;
    document.getElementById("logoutBtn").onclick = ()=>{
      localStorage.setItem("edis_adminMode", "false");
      bienvenida("usuario");
      setTimeout(()=>location.reload(), 900);
    };
    document.getElementById("verSoloBtn").onclick = ()=>{
      localStorage.setItem("edis_adminMode", "false");
      bienvenida("usuario");
      setTimeout(()=>location.reload(), 900);
    };
  } else {
    ui.innerHTML = `
      <span style="color:#fff;text-shadow:0 1px 6px #0003;">Modo usuario</span>
      <button class="btn-glass blue" id="loginBtn" style="margin-left:16px;">Admin</button>
    `;
    document.getElementById("loginBtn").onclick = ()=>{
      renderLoginBox();
    };
  }
}

// ========== 2. FIREBASE INIT ==========
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

// ========== 3. VARIABLES ==========
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
let tabData = {};
let tabVoices = []; // Para arreglos/voz dinámico, [{nombre, matriz}]
let currentVoice = "Principal";
let currentInstrument = "guitarra";
let letraOriginal = "";
let acordesArriba = {};
let rasgueoArr = [];
let lastSavedData = "";

// ========== 4. ELEMENTOS DOM ==========
const songListElem = document.getElementById("song-list");
const songForm = document.getElementById("song-form");
const songTitleInput = document.getElementById("song-title");
const letraInput = document.getElementById("letra-in");
const instrumentoSel = document.getElementById("instrumento");
const instrSpan = document.getElementById("tabs-voz");
const tablaturaDiv = document.getElementById("tablatura");
const addColBtn = document.getElementById("add-col");
const delColBtn = document.getElementById("del-col");
const addArregloBtn = document.getElementById("add-arreglo");
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

// ========== 5. LISTADO DE CANCIONES ==========
async function loadSongList() {
  songList = [];
  songListElem.innerHTML = `<li style="color:#fff;padding:1.1em;text-align:center;">Cargando...</li>`;
  const snap = await getDocs(collection(db, "canciones"));
  snap.forEach(doc => songList.push({id:doc.id, ...deserializeTabData(doc.data())}));
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
function clearEditor() {
  songTitleInput.value = "";
  letraInput.value = "";
  instrumentoSel.value = "guitarra";
  tabData = {};
  tabVoices = [];
  currentVoice = "Principal";
  ["guitarra","laud","bandurria","mandolina","tricordio","contrabajo","guitarron"].forEach(instr=>{
    for(const voz of VOICES[instr]) {
      if(!tabData[voz]) tabData[voz] = createEmptyTab(instr, DEFAULT_BEATS);
    }
  });
  tabVoices = [{nombre:"Principal", matriz:createEmptyTab("guitarra",DEFAULT_BEATS)}];
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
  tabData = song.tablatura || {};
  tabVoices = deserializeTabVoices(song.tabVoices, song.instrumento) || [{nombre:"Principal", matriz:createEmptyTab(song.instrumento,DEFAULT_BEATS)}];
  currentVoice = tabVoices[0]?.nombre || "Principal";
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
function showToast(msg, dur=1500) {
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(()=>toast.classList.remove("visible"), dur);
}

// SERIALIZACIÓN para evitar nested arrays en Firebase
function serializeTabVoices(tabVoices){
  // tabVoices: [{nombre, matriz: [ [x],[x], ... ]}]
  let obj = {};
  for(const v of tabVoices){
    obj[v.nombre] = {};
    for(let i=0;i<v.matriz.length;i++){
      obj[v.nombre]["s"+i] = v.matriz[i];
    }
  }
  return obj;
}
function deserializeTabVoices(raw, instr){
  if(!raw) return [{nombre:"Principal", matriz:createEmptyTab(instr, DEFAULT_BEATS)}];
  let arr = [];
  for(const [nombre,obj] of Object.entries(raw)){
    let matriz = [];
    let s = 0;
    while(obj["s"+s]!==undefined){
      matriz.push(obj["s"+s]);
      s++;
    }
    arr.push({nombre,matriz});
  }
  return arr;
}
function deserializeTabData(songData){
  if(!songData.tabVoices) return songData;
  let tabVoices = deserializeTabVoices(songData.tabVoices, songData.instrumento);
  songData.tabVoices = tabVoices;
  return songData;
}
// ========== 6. INSTRUMENTO, VOZ/ARREGLO, TABLATURA SVG WOW ===========
instrumentoSel.onchange = () => {
  currentInstrument = instrumentoSel.value;
  tabVoices = [{nombre:"Principal", matriz:createEmptyTab(currentInstrument, DEFAULT_BEATS)}];
  currentVoice = "Principal";
  renderTabsVozBtns();
  renderTablatureEditorSVG();
  renderRasgueoEditor();
};

function renderTabsVozBtns() {
  tabsVozBtns.innerHTML = "";
  tabVoices.forEach(vz => {
    const btn = document.createElement("button");
    btn.textContent = vz.nombre;
    btn.className = "voz-btn";
    if (vz.nombre === currentVoice) btn.classList.add("active");
    btn.onclick = (e)=>{
      e.preventDefault();
      currentVoice = vz.nombre;
      renderTabsVozBtns();
      renderTablatureEditorSVG();
    };
    tabsVozBtns.appendChild(btn);
  });
  // Botón eliminar voz/arreglo (excepto Principal)
  if (tabVoices.length > 1 && adminMode) {
    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑️";
    delBtn.className = "voz-btn";
    delBtn.onclick = ()=>{
      if(currentVoice==="Principal") return;
      tabVoices = tabVoices.filter(v=>v.nombre!==currentVoice);
      currentVoice = tabVoices[0].nombre;
      renderTabsVozBtns();
      renderTablatureEditorSVG();
    };
    tabsVozBtns.appendChild(delBtn);
  }
}

addArregloBtn.onclick = ()=>{
  if(!adminMode) return;
  let nombre = prompt("Nombre de la voz/arreglo:");
  if(!nombre) return;
  if(tabVoices.some(v=>v.nombre===nombre)){
    showToast("¡Ya existe ese nombre de voz/arreglo!");
    return;
  }
  tabVoices.push({nombre, matriz:createEmptyTab(currentInstrument, DEFAULT_BEATS)});
  currentVoice = nombre;
  renderTabsVozBtns();
  renderTablatureEditorSVG();
};

addColBtn.onclick = () => {
  let voz = tabVoices.find(v=>v.nombre===currentVoice);
  if (!voz) return;
  for (let s = 0; s < voz.matriz.length; s++) voz.matriz[s].push("");
  renderTablatureEditorSVG();
};
delColBtn.onclick = () => {
  let voz = tabVoices.find(v=>v.nombre===currentVoice);
  if (!voz) return;
  if (voz.matriz[0].length > 1) {
    for (let s = 0; s < voz.matriz.length; s++) voz.matriz[s].pop();
    renderTablatureEditorSVG();
  }
};

function renderTablatureEditorSVG() {
  tablaturaDiv.innerHTML = "";
  let voz = tabVoices.find(v=>v.nombre===currentVoice);
  if(!voz) { tablaturaDiv.textContent = "No hay tablatura."; return; }
  const t = voz.matriz;
  const numStrings = t.length;
  const numBeats = t[0].length;
  const IS_4C = (numStrings === 4);

  const W = 48 * numBeats + 28;
  const H = 30 * (numStrings-1) + 38;

  let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.style.background = "#fafafc";
  svg.style.borderRadius = "10px";
  svg.style.boxShadow = "0 2px 10px #0001";

  // Cuerdas
  for (let s = 0; s < numStrings; s++) {
    let y = 19 + s*30;
    let line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1", 18);
    line.setAttribute("y1", y);
    line.setAttribute("x2", W-12);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#bbb");
    line.setAttribute("stroke-width", IS_4C ? "2.7" : "2.2");
    svg.appendChild(line);
  }
  // Tiempos/trastes
  for (let b = 0; b <= numBeats; b++) {
    let x = 28 + b*48;
    let vline = document.createElementNS("http://www.w3.org/2000/svg","line");
    vline.setAttribute("x1", x);
    vline.setAttribute("y1", 12);
    vline.setAttribute("x2", x);
    vline.setAttribute("y2", H-18);
    vline.setAttribute("stroke", "#e0deee");
    vline.setAttribute("stroke-width", "1.1");
    svg.appendChild(vline);
  }
  // Números de tiempo/traste
  for (let b = 0; b < numBeats; b++) {
    let x = 28 + b*48 + 24;
    let txt = document.createElementNS("http://www.w3.org/2000/svg","text");
    txt.setAttribute("x", x);
    txt.setAttribute("y", 18);
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("fill", "#bdbdbd");
    txt.setAttribute("font-size", "12");
    txt.textContent = (b+1);
    svg.appendChild(txt);
  }
  // Círculos/símbolos
  for (let s = 0; s < numStrings; s++) {
    let y = 19 + s*30;
    for (let b = 0; b < numBeats; b++) {
      let valObj = t[s][b];
      let val = "", trino = false, tipo = "dot";
      if(typeof valObj === "object" && valObj) {
        val = valObj.val;
        trino = !!valObj.trino;
        tipo = valObj.tipo || "dot";
      } else {
        val = valObj;
      }
      let x = 28 + b*48 + 24;
      if(val) {
        // Símbolos especiales (igual que antes)
        if(val==="↑" || tipo==="flechaU") {
          let flecha = document.createElementNS("http://www.w3.org/2000/svg","text");
          flecha.setAttribute("x", x); flecha.setAttribute("y", y+7);
          flecha.setAttribute("text-anchor","middle");
          flecha.setAttribute("font-size","22");
          flecha.setAttribute("fill","#007aff");
          flecha.textContent = "↑";
          svg.appendChild(flecha);
        } else if(val==="↓" || tipo==="flechaD") {
          let flecha = document.createElementNS("http://www.w3.org/2000/svg","text");
          flecha.setAttribute("x", x); flecha.setAttribute("y", y+10);
          flecha.setAttribute("text-anchor","middle");
          flecha.setAttribute("font-size","22");
          flecha.setAttribute("fill","#d99400");
          flecha.textContent = "↓";
          svg.appendChild(flecha);
        } else if(val==="X" || tipo==="muteo") {
          let muteo = document.createElementNS("http://www.w3.org/2000/svg","text");
          muteo.setAttribute("x", x); muteo.setAttribute("y", y+8);
          muteo.setAttribute("text-anchor","middle");
          muteo.setAttribute("font-size","19");
          muteo.setAttribute("fill","#c91432");
          muteo.setAttribute("font-weight","bold");
          muteo.textContent = "𝄽";
          svg.appendChild(muteo);
        } else if(val==="B" || tipo==="bajeo") {
          let bass = document.createElementNS("http://www.w3.org/2000/svg","text");
          bass.setAttribute("x", x); bass.setAttribute("y", y+9);
          bass.setAttribute("text-anchor","middle");
          bass.setAttribute("font-size","20");
          bass.setAttribute("fill","#44a947");
          bass.setAttribute("font-weight","bold");
          bass.textContent = "B";
          svg.appendChild(bass);
        } else {
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
              let nuevo = prompt(
                "Número de dedo/traste (o símbolos: ↑ = flecha arriba, ↓ = flecha abajo, X = muteo, B = bajeo, ~ = trino)\nVacío para quitar:",
                val
              );
              if(nuevo!==null && nuevo!=="") {
                let setTrino = false, tipo = "dot";
                if (nuevo==="~") { setTrino = true; nuevo = ""; }
                if (nuevo==="↑") tipo="flechaU";
                if (nuevo==="↓") tipo="flechaD";
                if (nuevo==="X") tipo="muteo";
                if (nuevo==="B") tipo="bajeo";
                t[s][b] = {val: nuevo, trino: setTrino, tipo};
              } else if(nuevo==="") {
                t[s][b] = "";
              }
              renderTablatureEditorSVG();
            };
          }
          svg.appendChild(g);
        }
      } else if (adminMode) {
        let clickArea = document.createElementNS("http://www.w3.org/2000/svg","rect");
        clickArea.setAttribute("x", x-13);
        clickArea.setAttribute("y", y-13);
        clickArea.setAttribute("width", 26);
        clickArea.setAttribute("height", 26);
        clickArea.setAttribute("fill", "rgba(255,255,255,0)");
        clickArea.style.cursor = "pointer";
        clickArea.onclick = (e) => {
          e.stopPropagation();
          let nuevo = prompt(
            "Número de dedo/traste (o símbolos: ↑ = flecha arriba, ↓ = flecha abajo, X = muteo, B = bajeo, ~ = trino)\nVacío para quitar:",
            ""
          );
          if(nuevo!==null && nuevo!=="") {
            let setTrino = false, tipo = "dot";
            if (nuevo==="~") { setTrino = true; nuevo = ""; }
            if (nuevo==="↑") tipo="flechaU";
            if (nuevo==="↓") tipo="flechaD";
            if (nuevo==="X") tipo="muteo";
            if (nuevo==="B") tipo="bajeo";
            t[s][b] = {val: nuevo, trino: setTrino, tipo};
          }
          renderTablatureEditorSVG();
        };
        svg.appendChild(clickArea);
      }
    }
  }
  tablaturaDiv.appendChild(svg);
}
// ========== 7. LETRA Y ACORDES =============
function renderLetraEditor() {
  letraDiv.innerHTML = "";
  for (let i = 0; i < letraInput.value.length; i++) {
    const span = document.createElement("span");
    span.className = "lyric-chunk";
    span.textContent = letraInput.value[i];
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

// ========== 8. RASGUEO WOW PRO ===============
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
    // Nomenclatura pro, visual:
    if (r.type==="flechaD") icon.innerHTML = "&#8595;";
    else if (r.type==="flechaU") icon.innerHTML = "&#8593;";
    else if (r.type==="muteo") icon.innerHTML = '<span style="font-size:1.2em;color:#d91432;">𝄽</span>';
    else if (r.type==="bajeo") icon.innerHTML = `<span style="font-weight:bold;color:#4ab849;">B</span>`;
    else icon.innerHTML = r.symb||"•";
    if(adminMode) {
      icon.onclick = () => { rasgueoArr.splice(idx, 1); renderRasgueoEditor(); };
      icon.title = "Eliminar este rasgueo";
    }
    seq.appendChild(icon);
  });
  rasgueoDiv.appendChild(seq);

  // Barra de símbolos abajo (agregar rasgueo, muy pro y clara):
  if(adminMode) {
    let bar = document.createElement("div");
    bar.className = "rasgueo-toolbar";
    [
      {type:"flechaD", icon:"&#8595;", tip:"Rasgueo abajo"},
      {type:"flechaU", icon:"&#8593;", tip:"Rasgueo arriba"},
      {type:"bajeo", icon:"<b>B</b>", tip:"Bajeo"},
      {type:"muteo", icon:"<span style='color:#d91432'>𝄽</span>", tip:"Muteo"},
    ].forEach(item=>{
      let btn = document.createElement("button");
      btn.innerHTML = item.icon;
      btn.title = item.tip;
      btn.onclick = (e)=>{
        e.preventDefault();
        rasgueoArr.push({type:item.type});
        renderRasgueoEditor();
      };
      bar.appendChild(btn);
    });
    rasgueoDiv.appendChild(bar);

    let leyenda = document.createElement("div");
    leyenda.style.fontSize = ".98em";
    leyenda.style.marginTop = "8px";
    leyenda.style.color = "#7e7e7e";
    leyenda.innerHTML = `
      <b>Guía:</b> <b style="color:#007aff;">&#8593;</b>=Arriba, <b style="color:#d99400;">&#8595;</b>=Abajo, <b style="color:#44a947;">B</b>=Bajeo, <b style="color:#d91432;">𝄽</b>=Muteo.
      <span style="margin-left:1.5em;">Haz clic sobre un ícono para quitarlo.</span>
    `;
    rasgueoDiv.appendChild(leyenda);
  }
}

// ========== 9. AUDIO ==========
audioUpload.onchange = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.style.display = "";
};

// ========== 10. NUEVA, CANCELAR, GUARDAR ==========
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

// ========== 11. GUARDAR EN FIREBASE SIN NESTED ARRAYS ==========
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
    tabVoices: serializeTabVoices(tabVoices),
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

// ========== 12. AUTOGUARDADO ==========
function getCurrentSongData() {
  return {
    titulo: songTitleInput.value,
    letra: letraInput.value,
    instrumento: instrumentoSel.value,
    tabVoices: serializeTabVoices(tabVoices),
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

// ========== 13. PDF WOW: SVG como imagen ==============
pdfBtn.onclick = ()=>{
  let seccion = document.getElementById("song-editor-section");
  let svgEl = tablaturaDiv.querySelector("svg");
  if(svgEl){
    let svgData = new XMLSerializer().serializeToString(svgEl);
    let img = new Image();
    let svg64 = btoa(unescape(encodeURIComponent(svgData)));
    let imgSrc = 'data:image/svg+xml;base64,' + svg64;
    img.onload = function() {
      const pdf = new window.jspdf.jsPDF({unit:"pt", format:"a4"});
      let y = 38;
      pdf.setFont("helvetica","bold"); pdf.text(songTitleInput.value||"", 40, y);
      y+=20; pdf.setFont("helvetica","normal");
      pdf.text("Letra:",40,y); y+=18;
      pdf.setFontSize(11); pdf.text((letraInput.value||"").substring(0,1400), 46, y, {maxWidth: 520});
      y += 90;
      pdf.text("Tablatura:",40,y); y+=10;
      pdf.addImage(img, "PNG", 60, y, 420, 80+30*(svgEl.childNodes.length/2));
      y+=110;
      pdf.setFontSize(10);
      pdf.text("Letra y acordes:",40,y); y+=13;
      let letra = letraInput.value||"";
      let acArr = acordesArriba || {};
      let row = "";
      for(let i=0;i<letra.length;i++){
        row += (acArr[i]?`[${acArr[i]}]`:" ")+letra[i];
        if(letra[i]==="\n" || row.length>55) { pdf.text(row,46,y); y+=13; row=""; }
      }
      if(row) pdf.text(row,46,y);
      pdf.save((songTitleInput.value||"cancion")+".pdf");
    };
    img.src = imgSrc;
  } else {
    html2pdf().from(seccion).save((songTitleInput.value||"cancion")+".pdf");
  }
};

// ========== 14. ENSAYO EN VIVO PRO ============
ensayoBtn.onclick = ()=>{
  ensayoVivoDiv.innerHTML = "";
  if (!letraInput.value || letraInput.value.length === 0) {
    showToast("Agrega una letra para ensayar en vivo");
    return;
  }
  let velocidad = 500;
  let corriendo = false;
  let idx = 0;
  ensayoVivoDiv.innerHTML = `
    <div style="margin:1em 0;">
      <label>Velocidad: <input id="vel-ensayo" type="range" min="100" max="1500" step="50" value="${velocidad}"/> <span id="vel-label">${velocidad} ms</span></label>
      <button id="btn-iniciar-ensayo" class="btn-glass blue" style="margin-left:10px;">Iniciar</button>
      <button id="btn-pausar-ensayo" class="btn-glass grey" style="margin-left:5px;">Pausar</button>
      <button id="btn-reset-ensayo" class="btn-glass gold" style="margin-left:5px;">Reiniciar</button>
    </div>
    <div id="letra-ensayo" style="font-family:'Menlo',monospace;font-size:1.22em;background:#fff;padding:1.5em;border-radius:8px;min-height:80px;word-break:break-all;box-shadow:0 2px 16px #ffd20018;"></div>
  `;
  const letraEnsayoDiv = document.getElementById("letra-ensayo");
  const velSlider = document.getElementById("vel-ensayo");
  const velLabel = document.getElementById("vel-label");
  velSlider.oninput = ()=>{ velocidad = velSlider.value; velLabel.textContent = velocidad+" ms"; };

  function renderLetraEnsayo(i) {
    letraEnsayoDiv.innerHTML = "";
    for (let j = 0; j < letraInput.value.length; j++) {
      const span = document.createElement("span");
      span.className = "lyric-chunk";
      span.textContent = letraInput.value[j];
      if (acordesArriba[j]) {
        const chord = document.createElement("span");
        chord.className = "chord-above";
        chord.textContent = acordesArriba[j];
        span.prepend(chord);
      }
      if (j === i) {
        span.style.background = "#ffe082";
        span.style.color = "#29244b";
        span.style.transition = "background .18s, color .17s";
        span.style.boxShadow = "0 2px 18px #ffe08266";
      }
      letraEnsayoDiv.appendChild(span);
    }
  }

  let timer = null;
  function correrEnsayo() {
    if (!corriendo) return;
    renderLetraEnsayo(idx);
    idx++;
    if (idx < letraInput.value.length) {
      timer = setTimeout(correrEnsayo, velocidad);
    } else {
      corriendo = false;
      idx = 0;
      showToast("¡Ensayo finalizado!", 1700);
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

// ========== 15. ARRANQUE ==========
if (!adminMode && !currentUser) {
  renderLoginBox();
} else {
  setupAdminUI();
  loadSongList();
  clearEditor();
}
