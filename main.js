// --- FIREBASE SDK (usar módulos) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

// --- CONFIGURACIÓN FIREBASE ---
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
const auth = getAuth(app);

// --- ROLES Y ESTADO GLOBAL ---
const ADMIN_EMAIL = "edis.ugto@gmail.com";
let isAdmin = false;
let currentUser = null;

// Instrumentos y especificaciones (nomenclatura estándar, cuerdas, trastes para guitarra)
const INSTRUMENTS = {
  guitarra: { name: "Guitarra", strings: 6, trastes: 12 },
  laud: { name: "Laúd", strings: 6 },
  bandurria: { name: "Bandurria", strings: 6 },
  mandolina_tricordio: { name: "Mandolina/Tricordio", strings: 4 },
  contrabajo: { name: "Contrabajo", strings: 4 },
  guitarron: { name: "Guitarrón", strings: 6 }
};
const DEFAULT_ARREGLOS = ["arreglo 1"];
const DEFAULT_TRATES = 12; // Guitarra usa trastes

// Estado de canción actual y sus partes
let songList = [];
let currentSong = null;
let isNew = false;
let arreglos = [];
let currentArreglo = "arreglo 1";
let tabData = {};
let letraOriginal = "";
let acordesArriba = {};
let rasgueoArr = [];
let currentInstrument = "guitarra";
let lastSavedData = "";
let showLyricsInTab = false;

// DOM ELEMENTS
const songListElem = document.getElementById("song-list");
const songForm = document.getElementById("song-form");
const songTitleInput = document.getElementById("song-title");
const letraInput = document.getElementById("letra-in");
const instrumentoSel = document.getElementById("instrumento");
const tablaturaDiv = document.getElementById("tablatura");
const addColBtn = document.getElementById("add-col");
const delColBtn = document.getElementById("del-col");
const addArrBtn = document.getElementById("add-arreglo");
const delArrBtn = document.getElementById("del-arreglo");
const arreglosList = document.getElementById("arreglos-list");
const letraDiv = document.getElementById("letra");
const rasgueoDiv = document.getElementById("rasgueo");
const audioUpload = document.getElementById("audio-upload");
const audioPlayer = document.getElementById("audio-player");
const saveBtn = document.getElementById("save-song");
const cancelBtn = document.getElementById("cancel-edit");
const newSongBtn = document.getElementById("new-song-btn");
const toast = document.getElementById("toast");
const pdfBtn = document.getElementById("pdf-song");
const lastSavedDiv = document.getElementById("last-saved");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const authUserSpan = document.getElementById("auth-user");
const modalBg = document.getElementById("modal-bg");
const loginModal = document.getElementById("login-modal");
const loginEmail = document.getElementById("login-email");
const loginPass = document.getElementById("login-pass");
const doLoginBtn = document.getElementById("do-login-btn");
const loginError = document.getElementById("login-error");
// Tablatura lyrics toggle
const toggleLyricsBtn = document.getElementById("toggle-lyrics");

// Ensayo en vivo:
const rehearsalBtn = document.getElementById("rehearsal-btn");
const rehearsalModal = document.getElementById("rehearsal-modal");
const rehearsalArea = document.getElementById("rehearsal-area");
const rehearsalModeSel = document.getElementById("rehearsal-mode");
const rehearsalSpeedInput = document.getElementById("rehearsal-speed");
const rehearsalSpeedLabel = document.getElementById("rehearsal-speed-label");
const startRehearsalBtn = document.getElementById("start-rehearsal");
const stopRehearsalBtn = document.getElementById("stop-rehearsal");

// Helpers para arrays/objetos para firestore
function serializeTab(tabMatriz) {
  const obj = {};
  for(let i=0; i<tabMatriz.length; i++) obj[i] = tabMatriz[i];
  return obj;
}
function deserializeTab(tabObj) {
  if (Array.isArray(tabObj)) return tabObj;
  if (!tabObj) return [];
  return Object.keys(tabObj).sort((a,b)=>a-b).map(k => tabObj[k]);
}
// --- AUTENTICACIÓN Y PERMISOS ---
function updateAuthUI() {
  if (isAdmin) {
    authUserSpan.textContent = "Editor: " + currentUser.email;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "";
    enableEditor(true);
  } else if (currentUser) {
    authUserSpan.textContent = "Solo lectura";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "";
    enableEditor(false);
  } else {
    authUserSpan.textContent = "";
    loginBtn.style.display = "";
    logoutBtn.style.display = "none";
    enableEditor(false);
  }
}
function enableEditor(edit) {
  [
    songTitleInput, letraInput, instrumentoSel, audioUpload,
    addColBtn, delColBtn, addArrBtn, delArrBtn, saveBtn, cancelBtn, toggleLyricsBtn
  ].forEach(el=> el.disabled = !edit);
  if (edit) {
    document.querySelectorAll(".arreglo-btn").forEach(b=>b.disabled=false);
    letraDiv.classList.remove("readonly");
  } else {
    document.querySelectorAll(".arreglo-btn").forEach(b=>b.disabled=true);
    letraDiv.classList.add("readonly");
  }
}

// --- UI: LOGIN/LOGOUT/MODAL ---
loginBtn.onclick = ()=>{
  loginError.textContent = "";
  loginEmail.value = "";
  loginPass.value = "";
  modalBg.style.display = "";
  loginEmail.focus();
};
logoutBtn.onclick = async ()=>{
  await signOut(auth);
};
modalBg.onclick = (e)=>{
  if (e.target===modalBg) modalBg.style.display = "none";
};
doLoginBtn.onclick = async ()=>{
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPass.value);
    modalBg.style.display = "none";
  } catch (e) {
    loginError.textContent = "Error de inicio de sesión";
  }
};
onAuthStateChanged(auth, user=>{
  currentUser = user;
  isAdmin = (user && user.email===ADMIN_EMAIL);
  updateAuthUI();
});

// --- RESPONSIVE CORRECCIONES ---
window.addEventListener('resize', ()=>{
  // Opcional: adaptar tamaño de SVG o contenedores si es necesario
});
// --- CRUD FIRESTORE, LISTA Y CARGA DE CANCIÓN ---

// Sincroniza en tiempo real todas las canciones
onSnapshot(collection(db, "canciones"), (snap) => {
  songList = [];
  snap.forEach(doc => songList.push({id:doc.id, ...doc.data()}));
  renderSongList();
  // Si había una canción seleccionada, recargar sus datos
  if (currentSong) {
    let refreshed = songList.find(s=>s.id===currentSong.id);
    if (refreshed) fillFormFromSong(refreshed);
  }
});

// Renderiza lista en el sidebar
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

// Selecciona y carga una canción por su ID
function selectSong(id) {
  currentSong = songList.find(s=>s.id===id);
  isNew = false;
  fillFormFromSong(currentSong);
}

// Limpia y resetea el editor (para canción nueva)
function clearEditor() {
  songTitleInput.value = "";
  letraInput.value = "";
  instrumentoSel.value = "guitarra";
  arreglos = [...DEFAULT_ARREGLOS];
  currentArreglo = arreglos[0];
  tabData = {};
  Object.keys(INSTRUMENTS).forEach(instr=>{
    arreglos.forEach(ar=>{
      let key = `${instr}_${ar}`;
      tabData[key] = createEmptyTab(instr, 8);
    });
  });
  letraOriginal = "";
  acordesArriba = {};
  rasgueoArr = [];
  audioPlayer.src = "";
  audioPlayer.style.display = "none";
  renderArreglosBtns();
  renderTablatureEditorSVG();
  renderLetraEditor();
  renderRasgueoEditor();
}

// Llena el editor a partir de la canción seleccionada
function fillFormFromSong(song) {
  if(!song) return;
  songTitleInput.value = song.titulo || "";
  letraInput.value = song.letra || "";
  instrumentoSel.value = song.instrumento || "guitarra";
  currentInstrument = song.instrumento || "guitarra";
  arreglos = song.arreglos && song.arreglos.length>0 ? [...song.arreglos] : [...DEFAULT_ARREGLOS];
  currentArreglo = arreglos[0];
  tabData = {};
  if(song.tablatura) {
    for(const ar of arreglos) {
      let key = `${currentInstrument}_${ar}`;
      tabData[key] = song.tablatura[ar] ? deserializeTab(song.tablatura[ar]) : createEmptyTab(currentInstrument, 8);
    }
  } else {
    for(const ar of arreglos) {
      let key = `${currentInstrument}_${ar}`;
      tabData[key] = createEmptyTab(currentInstrument, 8);
    }
  }
  letraOriginal = song.letra || "";
  acordesArriba = song.acordesArriba || {};
  rasgueoArr = song.rasgueo || [];
  audioPlayer.style.display = song.audioUrl ? "" : "none";
  audioPlayer.src = song.audioUrl || "";
  renderArreglosBtns();
  renderTablatureEditorSVG();
  renderLetraEditor();
  renderRasgueoEditor();
}

// Crea una tablatura vacía para el instrumento y beats especificados
function createEmptyTab(instr, beats) {
  const strings = INSTRUMENTS[instr].strings;
  return Array(strings).fill().map(() => Array(beats).fill(""));
}
// ---- ARREGLOS: añadir, eliminar, cambiar ----
function renderArreglosBtns() {
  arreglosList.innerHTML = "";
  arreglos.forEach(ar=>{
    const btn = document.createElement("button");
    btn.textContent = ar;
    btn.className = "arreglo-btn" + (ar===currentArreglo ? " active" : "");
    btn.disabled = !isAdmin;
    btn.onclick = (e)=>{
      e.preventDefault();
      currentArreglo = ar;
      renderArreglosBtns();
      renderTablatureEditorSVG();
    };
    arreglosList.appendChild(btn);
  });
}
addArrBtn.onclick = ()=>{
  if (!isAdmin) return;
  let next = arreglos.length+1;
  let nuevo = `arreglo ${next}`;
  arreglos.push(nuevo);
  let key = `${currentInstrument}_${nuevo}`;
  tabData[key] = createEmptyTab(currentInstrument, getTabCols());
  currentArreglo = nuevo;
  renderArreglosBtns();
  renderTablatureEditorSVG();
};
delArrBtn.onclick = ()=>{
  if (!isAdmin) return;
  if(arreglos.length<=1) return;
  let idx = arreglos.indexOf(currentArreglo);
  arreglos.splice(idx,1);
  let key = `${currentInstrument}_${currentArreglo}`;
  delete tabData[key];
  currentArreglo = arreglos[0];
  renderArreglosBtns();
  renderTablatureEditorSVG();
};

// --- AGREGAR/QUITAR TIEMPOS/COLUMNAS (trastes para guitarra) ---
function getTabCols() {
  // Guitarra: trastes, otros: tiempos
  return (currentInstrument==="guitarra") ? INSTRUMENTS.guitarra.trastes : 8;
}
addColBtn.onclick = () => {
  if (!isAdmin) return;
  let t = tabData[`${currentInstrument}_${currentArreglo}`];
  for (let s = 0; s < t.length; s++) t[s].push("");
  renderTablatureEditorSVG();
};
delColBtn.onclick = () => {
  if (!isAdmin) return;
  let t = tabData[`${currentInstrument}_${currentArreglo}`];
  if (t[0].length > 1) {
    for (let s = 0; s < t.length; s++) t[s].pop();
    renderTablatureEditorSVG();
  }
};

// --- MOSTRAR/OCULTAR LETRA EN TABLATURA ---
toggleLyricsBtn.onclick = () => {
  showLyricsInTab = !showLyricsInTab;
  renderTablatureEditorSVG();
};

// === RENDER TABLATURA SVG CON TRATES, CUERDAS Y LETRA INTEGRADA ===
function renderTablatureEditorSVG() {
  tablaturaDiv.innerHTML = "";
  let t = tabData[`${currentInstrument}_${currentArreglo}`];
  if (!t) { tablaturaDiv.textContent = "No hay tablatura."; return; }
  const numStrings = t.length;
  const numBeats = t[0].length;
  const width = 60 * (numBeats+1);
  const height = 40 * (numStrings+2);
  let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.style.background = "#fafafc";
  svg.style.borderRadius = "10px";
  svg.style.boxShadow = "0 2px 10px #0001";
  svg.style.maxWidth = "100%";

  // Numeración de trastes/tiempos (top)
  for (let b = 0; b < numBeats; b++) {
    let x = 45 + b*60;
    let topText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    topText.setAttribute("x", x);
    topText.setAttribute("y", 20);
    topText.setAttribute("text-anchor", "middle");
    topText.setAttribute("fill", "#9e7e2c");
    topText.setAttribute("font-size", "14");
    topText.setAttribute("font-weight", "bold");
    if(currentInstrument==="guitarra")
      topText.textContent = `t${b+1}`;
    else
      topText.textContent = (b+1);
    svg.appendChild(topText);
  }

  // Numeración de cuerdas (izquierda)
  for (let s = 0; s < numStrings; s++) {
    let y = 50 + s*40;
    let numText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    numText.setAttribute("x", 15);
    numText.setAttribute("y", y+5);
    numText.setAttribute("fill", "#2c3559");
    numText.setAttribute("font-size", "15");
    numText.setAttribute("font-weight", "bold");
    numText.textContent = `${s+1}`;
    svg.appendChild(numText);
  }

  // Líneas de cuerdas (horizontal)
  for (let s = 0; s < numStrings; s++) {
    let y = 50 + s*40;
    let line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1", 35);
    line.setAttribute("y1", y);
    line.setAttribute("x2", width-10);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#b9b5d0");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
  }

  // Líneas de trastes/tiempos (vertical)
  for (let b = 0; b < numBeats; b++) {
    let x = 45 + b*60;
    let vline = document.createElementNS("http://www.w3.org/2000/svg","line");
    vline.setAttribute("x1", x);
    vline.setAttribute("y1", 50);
    vline.setAttribute("x2", x);
    vline.setAttribute("y2", height-35);
    vline.setAttribute("stroke", "#e0deee");
    vline.setAttribute("stroke-width", "1.6");
    svg.appendChild(vline);
  }

  // NOTAS (editor ágil: click para poner/quitar nota, doble click trino)
  for (let s = 0; s < numStrings; s++) {
    let y = 50 + s*40;
    for (let b = 0; b < numBeats; b++) {
      let valObj = t[s][b];
      let val = "", trino = false;
      if(typeof valObj === "object" && valObj) {
        val = valObj.val;
        trino = !!valObj.trino;
      } else {
        val = valObj;
      }
      let x = 45 + b*60;
      if(val) {
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.style.cursor = isAdmin?"pointer":"default";
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", 15);
        circle.setAttribute("fill", "#3b306c");
        circle.setAttribute("stroke", "#e7e5f1");
        circle.setAttribute("stroke-width", "2");
        g.appendChild(circle);
        let txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", x);
        txt.setAttribute("y", y+6);
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("fill", "#fff");
        txt.setAttribute("font-size", "18");
        txt.setAttribute("font-weight", "bold");
        txt.textContent = val;
        g.appendChild(txt);
        if(trino) {
          let trinoTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          trinoTxt.setAttribute("x", x);
          trinoTxt.setAttribute("y", y-20);
          trinoTxt.setAttribute("text-anchor", "middle");
          trinoTxt.setAttribute("fill", "#e39d1b");
          trinoTxt.setAttribute("font-size", "16");
          trinoTxt.setAttribute("font-weight", "bold");
          trinoTxt.textContent = "tr~";
          g.appendChild(trinoTxt);
        }
        // Edición rápida: click para editar/quitar, doble click para trino
        if(isAdmin) {
          g.onclick = (e) => {
            e.stopPropagation();
            let nuevo = prompt("Número de dedo/traste (vacío para quitar):", val||"");
            if(nuevo!==null && nuevo!=="") {
              t[s][b] = {val: nuevo, trino: trino};
            } else {
              t[s][b] = "";
            }
            renderTablatureEditorSVG();
          };
          g.ondblclick = (e) => {
            e.stopPropagation();
            if(typeof t[s][b] === "object" && t[s][b]) t[s][b].trino = !t[s][b].trino;
            else if(val) t[s][b] = {val: val, trino: true};
            renderTablatureEditorSVG();
          };
        }
        svg.appendChild(g);
      } else {
        // Celdas clickables para agregar nota
        let clickArea = document.createElementNS("http://www.w3.org/2000/svg","rect");
        clickArea.setAttribute("x", x-18);
        clickArea.setAttribute("y", y-18);
        clickArea.setAttribute("width", 36);
        clickArea.setAttribute("height", 36);
        clickArea.setAttribute("fill", "rgba(255,255,255,0)");
        clickArea.style.cursor = isAdmin?"pointer":"default";
        if(isAdmin) {
          clickArea.onclick = (e) => {
            e.stopPropagation();
            let nuevo = prompt("Número de dedo/traste:", "");
            if(nuevo!==null && nuevo!=="") {
              t[s][b] = {val: nuevo, trino:false};
            }
            renderTablatureEditorSVG();
          };
        }
        svg.appendChild(clickArea);
      }
    }
  }

  // LETRA INTEGRADA BAJO TABLATURA (opcional)
  if (showLyricsInTab && letraOriginal && numBeats>0) {
    let letraRow = document.createElementNS("http://www.w3.org/2000/svg", "g");
    let chunkPorCol = Math.max(1, Math.floor(letraOriginal.length/numBeats));
    let lIdx = 0;
    for(let b=0; b<numBeats; b++) {
      let x = 45 + b*60;
      let letraTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      letraTxt.setAttribute("x", x);
      letraTxt.setAttribute("y", height-15);
      letraTxt.setAttribute("text-anchor", "middle");
      letraTxt.setAttribute("fill", "#3b306c");
      letraTxt.setAttribute("font-size", "15");
      letraTxt.setAttribute("font-family", "Menlo, monospace");
      letraTxt.textContent = letraOriginal.substr(lIdx, chunkPorCol);
      lIdx += chunkPorCol;
      letraRow.appendChild(letraTxt);
    }
    svg.appendChild(letraRow);
  }
  tablaturaDiv.appendChild(svg);
}
// LETRA Y ACORDES
function renderLetraEditor(karaokeIdx = -1) {
  letraDiv.innerHTML = "";
  for (let i = 0; i < letraOriginal.length; i++) {
    const span = document.createElement("span");
    span.className = "lyric-chunk";
    span.textContent = letraOriginal[i];
    if (acordesArriba[i]) {
      const chord = document.createElement("span");
      chord.className = "chord-above";
      chord.textContent = acordesArriba[i];
      span.appendChild(chord);
    }
    if (karaokeIdx === i) {
      span.classList.add("karaoke-active");
    }
    if (isAdmin) {
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

// RASGUEO (SOLO GUITARRA)
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
    if (r.type==="bajo") icon = Object.assign(document.createElement("span"), {className:"rasgueo-bajo rasgueo-icon",textContent:"B"});
    else if (r.type==="flecha-chica-abajo") icon.innerHTML = `<span style="font-size:1.1em;opacity:.5;">&#8595;</span>`;
    else if (r.type==="flecha-chica-arriba") icon.innerHTML = `<span style="font-size:1.1em;opacity:.5;">&#8593;</span>`;
    else if (r.type==="flecha-arriba") icon.innerHTML = `<span style="font-size:1.5em;">&#8593;</span>`;
    else if (r.type==="flecha-abajo") icon.innerHTML = `<span style="font-size:1.5em;">&#8595;</span>`;
    else if (r.type==="muteo") icon.innerHTML = `<b style="font-size:1.12em;color:#888;">X</b>`;
    else icon.innerHTML = r.symb||"•";
    if (isAdmin) icon.onclick = () => { rasgueoArr.splice(idx, 1); renderRasgueoEditor(); };
    seq.appendChild(icon);
  });
  rasgueoDiv.appendChild(seq);
  if (!isAdmin) return;
  const controls = document.createElement("div");
  let btn = document.createElement("button");
  btn.innerHTML = "↓";
  btn.onclick = (e)=>{e.preventDefault(); rasgueoArr.push({type:"flecha-abajo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = "↑";
  btn.onclick = (e)=>{e.preventDefault(); rasgueoArr.push({type:"flecha-arriba"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = `<span style="font-size:1.1em;opacity:.6;">↓</span>`;
  btn.onclick = (e)=>{e.preventDefault(); rasgueoArr.push({type:"flecha-chica-abajo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = `<span style="font-size:1.1em;opacity:.6;">↑</span>`;
  btn.onclick = (e)=>{e.preventDefault(); rasgueoArr.push({type:"flecha-chica-arriba"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  let bbtn = document.createElement("button");
  bbtn.innerHTML = "B";
  bbtn.onclick = (e)=>{e.preventDefault(); rasgueoArr.push({type:"bajo"}); renderRasgueoEditor(); };
  controls.appendChild(bbtn);
  btn = document.createElement("button");
  btn.textContent = "X";
  btn.onclick = (e)=>{e.preventDefault(); rasgueoArr.push({type:"muteo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  rasgueoDiv.appendChild(controls);
}

// AUDIO
audioUpload.onchange = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.style.display = "";
};

// NUEVA CANCIÓN
newSongBtn.onclick = () => {
  if (!isAdmin) return;
  isNew = true;
  currentSong = null;
  clearEditor();
  songTitleInput.focus();
};

// CANCELAR
cancelBtn.onclick = (e) => {
  e.preventDefault();
  if (songList.length && currentSong) fillFormFromSong(currentSong);
  else clearEditor();
};

// GUARDADO EN FIRESTORE
songForm.onsubmit = async function(e) {
  e.preventDefault();
  if (!isAdmin) return;
  let audioUrl = currentSong ? currentSong.audioUrl : "";
  if (audioUpload.files[0]) {
    showToast("Subiendo audio...");
    const file = audioUpload.files[0];
    const storageRef = ref(storage, "audios/"+songTitleInput.value+"-"+Date.now());
    await uploadBytes(storageRef, file);
    audioUrl = await getDownloadURL(storageRef);
    audioPlayer.src = audioUrl;
  }
  // Serializa la tablatura según los arreglos
  const tablaturaObj = {};
  for(const ar of arreglos) {
    tablaturaObj[ar] = serializeTab(tabData[`${currentInstrument}_${ar}`]);
  }
  const data = {
    titulo: songTitleInput.value,
    letra: letraInput.value,
    instrumento: instrumentoSel.value,
    arreglos: [...arreglos],
    tablatura: tablaturaObj,
    acordesArriba,
    rasgueo: instrumentoSel.value==="guitarra"?rasgueoArr:[],
    audioUrl
  };
  if (isNew) {
    const newRef = await addDoc(collection(db,"canciones"), data);
    showToast("Canción agregada");
    currentSong = {id:newRef.id,...data};
    isNew = false;
  } else if (currentSong) {
    await setDoc(doc(db,"canciones",currentSong.id), data);
    showToast("Canción actualizada");
    currentSong = {...data, id:currentSong.id};
  }
  lastSavedData = JSON.stringify(data);
};

// AUTOGUARDADO (cada 15s)
function getCurrentSongData() {
  const tablaturaObj = {};
  for(const ar of arreglos) {
    tablaturaObj[ar] = serializeTab(tabData[`${currentInstrument}_${ar}`]);
  }
  return {
    titulo: songTitleInput.value,
    letra: letraInput.value,
    instrumento: instrumentoSel.value,
    arreglos: [...arreglos],
    tablatura: tablaturaObj,
    acordesArriba,
    rasgueo: instrumentoSel.value==="guitarra"?rasgueoArr:[],
    audioUrl: currentSong ? currentSong.audioUrl : ""
  };
}
setInterval(async ()=>{
  if (!isAdmin) return;
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

// PDF EXPORT (profesional, adaptado para impresión)
pdfBtn.onclick = ()=>{
  let node = document.getElementById("song-editor-section").cloneNode(true);
  Array.from(node.querySelectorAll('button, input[type="file"], #last-saved, #toast, .editor-group>h3')).forEach(e=>e.remove());
  Array.from(node.querySelectorAll('textarea, select')).forEach(e=>{
    let span = document.createElement("div");
    span.textContent = e.value;
    span.style.fontSize = "1.05em";
    span.style.padding = "4px";
    e.replaceWith(span);
  });
  html2pdf().set({
    margin: 10,
    filename: (songTitleInput.value||"cancion") + ".pdf",
    jsPDF: {format: 'a4', orientation: 'portrait'},
    image: { type: 'jpeg', quality: 0.99 }
  }).from(node).save();
};
// === ENSAYO EN VIVO ===
let rehearsalRunning = false, rehearsalTimeout = null, karaokeCurrent = -1;
let rehearsalAudioObj = null;

rehearsalBtn.onclick = ()=>{
  rehearsalModal.style.display = "";
  rehearsalArea.innerHTML = "";
  rehearsalModeSel.value = "letra";
  rehearsalSpeedInput.value = 1;
  rehearsalSpeedLabel.textContent = "Normal";
};
stopRehearsalBtn.onclick = stopRehearsal;
rehearsalModal.onclick = (e)=>{
  if (e.target === rehearsalModal) stopRehearsal();
};
rehearsalSpeedInput.oninput = ()=>{
  let v = Number(rehearsalSpeedInput.value);
  if (v < 0.75) rehearsalSpeedLabel.textContent = "Lento";
  else if (v < 1.1) rehearsalSpeedLabel.textContent = "Normal";
  else rehearsalSpeedLabel.textContent = v+"x";
};

// START ENSAYO
startRehearsalBtn.onclick = ()=>{
  let mode = rehearsalModeSel.value;
  let speed = Number(rehearsalSpeedInput.value);
  stopRehearsal();
  rehearsalArea.innerHTML = "";
  if (mode==="letra") startKaraoke(speed);
  else if (mode==="tablatura") startTablatureScroll(speed);
  else if (mode==="sincronizar") startAudioKaraokeSync(speed);
  rehearsalRunning = true;
};

// --- KARAOKE LETRA + ACORDES (scroll animado) ---
function startKaraoke(speed=1) {
  if (!letraOriginal) { rehearsalArea.textContent="No hay letra."; return; }
  let chunks = [];
  rehearsalArea.innerHTML = "";
  for (let i=0;i<letraOriginal.length;i++) {
    const span = document.createElement("span");
    span.className = "lyric-chunk";
    span.textContent = letraOriginal[i];
    span.style.transition = "background 0.12s";
    if (acordesArriba[i]) {
      const chord = document.createElement("span");
      chord.className = "chord-above";
      chord.textContent = acordesArriba[i];
      span.appendChild(chord);
    }
    rehearsalArea.appendChild(span);
    chunks.push(span);
  }
  let idx = 0;
  function next() {
    if (!rehearsalRunning) return;
    if (idx > 0) chunks[idx-1].classList.remove("karaoke-active");
    if (idx < chunks.length) {
      chunks[idx].classList.add("karaoke-active");
      let rect = chunks[idx].getBoundingClientRect();
      let areaRect = rehearsalArea.getBoundingClientRect();
      if (rect.bottom > areaRect.bottom || rect.top < areaRect.top)
        chunks[idx].scrollIntoView({behavior:'smooth', block:'center'});
      idx++;
      rehearsalTimeout = setTimeout(next, 200/speed); // ajusta velocidad aquí
    } else {
      rehearsalRunning = false;
      rehearsalTimeout = null;
    }
  }
  next();
}

// --- TABLATURA: scroll por beats (fácil de expandir) ---
function startTablatureScroll(speed=1) {
  let t = tabData[`${currentInstrument}_${currentArreglo}`];
  if (!t) { rehearsalArea.textContent="No hay tablatura."; return; }
  const numStrings = t.length;
  const numBeats = t[0].length;
  const width = 60 * (numBeats+1);
  const height = 40 * (numStrings+2);
  let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height+40);
  svg.style.background = "#fafafc";
  svg.style.borderRadius = "10px";
  svg.style.boxShadow = "0 2px 10px #0001";
  for (let s = 0; s < numStrings; s++) {
    let y = 50 + s*40;
    let line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1", 35);
    line.setAttribute("y1", y);
    line.setAttribute("x2", width-10);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#b9b5d0");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
  }
  for (let b = 0; b < numBeats; b++) {
    let x = 45 + b*60;
    let vline = document.createElementNS("http://www.w3.org/2000/svg","line");
    vline.setAttribute("x1", x);
    vline.setAttribute("y1", 50);
    vline.setAttribute("x2", x);
    vline.setAttribute("y2", height-35);
    vline.setAttribute("stroke", "#e0deee");
    vline.setAttribute("stroke-width", "1.6");
    svg.appendChild(vline);
  }
  let beatMarkers = [];
  for (let b=0; b<numBeats; b++) {
    let x = 45 + b*60;
    let marker = document.createElementNS("http://www.w3.org/2000/svg","rect");
    marker.setAttribute("x", x-24); marker.setAttribute("y", 40);
    marker.setAttribute("width", 48); marker.setAttribute("height", height-55);
    marker.setAttribute("fill", "#ffe082");
    marker.setAttribute("opacity", "0");
    svg.appendChild(marker);
    beatMarkers.push(marker);
    for (let s=0;s<numStrings;s++) {
      let valObj = t[s][b];
      let val = "", trino = false;
      if(typeof valObj === "object" && valObj) {
        val = valObj.val; trino = !!valObj.trino;
      } else val = valObj;
      if(val) {
        let y = 50 + s*40;
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", 15);
        circle.setAttribute("fill", "#3b306c");
        circle.setAttribute("stroke", "#e7e5f1");
        circle.setAttribute("stroke-width", "2");
        g.appendChild(circle);
        let txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", x);
        txt.setAttribute("y", y+6);
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("fill", "#fff");
        txt.setAttribute("font-size", "18");
        txt.setAttribute("font-weight", "bold");
        txt.textContent = val;
        g.appendChild(txt);
        if(trino) {
          let trinoTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          trinoTxt.setAttribute("x", x);
          trinoTxt.setAttribute("y", y-20);
          trinoTxt.setAttribute("text-anchor", "middle");
          trinoTxt.setAttribute("fill", "#e39d1b");
          trinoTxt.setAttribute("font-size", "16");
          trinoTxt.setAttribute("font-weight", "bold");
          trinoTxt.textContent = "tr~";
          g.appendChild(trinoTxt);
        }
        svg.appendChild(g);
      }
    }
  }
  rehearsalArea.appendChild(svg);
  let idx=0;
  function nextBeat() {
    if (!rehearsalRunning) return;
    if (idx>0) beatMarkers[idx-1].setAttribute("opacity","0");
    if (idx<numBeats) {
      beatMarkers[idx].setAttribute("opacity","0.34");
      svg.scrollLeft = Math.max(0, 45+idx*60-150);
      idx++;
      rehearsalTimeout = setTimeout(nextBeat, 350/speed);
    } else {
      rehearsalRunning = false; rehearsalTimeout = null;
    }
  }
  nextBeat();
}

// --- KARAOKE sincronizado con AUDIO ---
function startAudioKaraokeSync(speed=1) {
  if (!audioPlayer.src || audioPlayer.src==="" || audioPlayer.src.startsWith("blob:")) {
    rehearsalArea.innerHTML = "<div style='color:#b00'>No hay audio cargado para esta canción.</div>"; return;
  }
  let chunks = [];
  rehearsalArea.innerHTML = "";
  for (let i=0;i<letraOriginal.length;i++) {
    const span = document.createElement("span");
    span.className = "lyric-chunk";
    span.textContent = letraOriginal[i];
    span.style.transition = "background 0.12s";
    if (acordesArriba[i]) {
      const chord = document.createElement("span");
      chord.className = "chord-above";
      chord.textContent = acordesArriba[i];
      span.appendChild(chord);
    }
    rehearsalArea.appendChild(span);
    chunks.push(span);
  }
  const audio = new Audio(audioPlayer.src);
  rehearsalAudioObj = audio;
  let duration = 0;
  audio.onloadedmetadata = ()=>{
    duration = audio.duration / speed;
    let msPerChunk = duration*1000 / chunks.length;
    let idx = 0;
    function next() {
      if (!rehearsalRunning) return;
      if (idx > 0) chunks[idx-1].classList.remove("karaoke-active");
      if (idx < chunks.length) {
        chunks[idx].classList.add("karaoke-active");
        let rect = chunks[idx].getBoundingClientRect();
        let areaRect = rehearsalArea.getBoundingClientRect();
        if (rect.bottom > areaRect.bottom || rect.top < areaRect.top)
          chunks[idx].scrollIntoView({behavior:'smooth', block:'center'});
        idx++;
        rehearsalTimeout = setTimeout(next, msPerChunk);
      } else {
        rehearsalRunning = false; rehearsalTimeout = null;
        audio.pause();
      }
    }
    rehearsalRunning = true;
    audio.playbackRate = speed;
    audio.play();
    next();
  };
  audio.load();
}

function stopRehearsal() {
  rehearsalRunning = false;
  rehearsalTimeout && clearTimeout(rehearsalTimeout);
  rehearsalTimeout = null;
  if (rehearsalAudioObj) { rehearsalAudioObj.pause(); rehearsalAudioObj = null; }
  rehearsalModal.style.display = "none";
  karaokeCurrent = -1;
}
// TOAST (notificaciones rápidas)
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(()=>toast.classList.remove("visible"), 1700);
}

// --- ARRANQUE: inicializa editor vacío en primera carga
clearEditor();
