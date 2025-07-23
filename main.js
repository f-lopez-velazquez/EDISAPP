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

const ADMIN_EMAIL = "edis.ugto@gmail.com";
let isAdmin = false;
let currentUser = null;

const INSTRUMENTS = {
  guitarra: { name: "Guitarra", strings: 6, trastes: 12 },
  laud: { name: "Laúd", strings: 6 },
  bandurria: { name: "Bandurria", strings: 6 },
  mandolina_tricordio: { name: "Mandolina/Tricordio", strings: 4 },
  contrabajo: { name: "Contrabajo", strings: 4 },
  guitarron: { name: "Guitarrón", strings: 6 }
};
const DEFAULT_ARREGLOS = ["arreglo 1"];
const DEFAULT_TRATES = 12;

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
const toggleLyricsBtn = document.getElementById("toggle-lyrics");
const rehearsalBtn = document.getElementById("rehearsal-btn");
const rehearsalModal = document.getElementById("rehearsal-modal");
const rehearsalArea = document.getElementById("rehearsal-area");
const rehearsalModeSel = document.getElementById("rehearsal-mode");
const rehearsalSpeedInput = document.getElementById("rehearsal-speed");
const rehearsalSpeedLabel = document.getElementById("rehearsal-speed-label");
const startRehearsalBtn = document.getElementById("start-rehearsal");
const stopRehearsalBtn = document.getElementById("stop-rehearsal");

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

// --- CRUD FIRESTORE, LISTA Y CARGA DE CANCIÓN ---
onSnapshot(collection(db, "canciones"), (snap) => {
  songList = [];
  snap.forEach(doc => songList.push({id:doc.id, ...doc.data()}));
  renderSongList();
  if (currentSong) {
    let refreshed = songList.find(s=>s.id===currentSong.id);
    if (refreshed) fillFormFromSong(refreshed);
  }
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
  currentInstrument = "guitarra";
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
function createEmptyTab(instr, beats) {
  const strings = INSTRUMENTS[instr].strings;
  return Array(strings).fill().map(() => Array(beats).fill(""));
}
function getTabCols() {
  return (currentInstrument==="guitarra") ? INSTRUMENTS.guitarra.trastes : 8;
}

// === CAMBIO DE INSTRUMENTO (FIX REACTIVO Y ROBUSTO) ===
instrumentoSel.onchange = function () {
  const newInstr = instrumentoSel.value;
  if (currentInstrument === newInstr) return;
  currentInstrument = newInstr;

  // Si no es guitarra, limpia el rasgueo (solo guitarra lo usa)
  if (newInstr !== "guitarra") rasgueoArr = [];

  // Actualiza tabData para todos los arreglos activos de este instrumento
  const newTabData = {};
  arreglos.forEach(ar => {
    let key = `${newInstr}_${ar}`;
    // Si ya hay una tabla para este arreglo/instrumento, la conserva
    newTabData[key] = tabData[key] || createEmptyTab(newInstr, getTabCols());
  });
  tabData = newTabData;

  renderArreglosBtns();
  renderTablatureEditorSVG();
  renderRasgueoEditor();
};
// === FIN FIX CAMBIO INSTRUMENTO ===

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
toggleLyricsBtn.onclick = () => {
  showLyricsInTab = !showLyricsInTab;
  renderTablatureEditorSVG();
};

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
  btn.innerHTML = "x";
  btn.onclick = (e)=>{e.preventDefault(); rasgueoArr.push({type:"muteo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  btn = document.createElement("button");
  btn.innerHTML = "B";
  btn.onclick = (e)=>{e.preventDefault(); rasgueoArr.push({type:"bajo"}); renderRasgueoEditor(); };
  controls.appendChild(btn);
  rasgueoDiv.appendChild(controls);
}

function renderTablatureEditorSVG() {
  const tab = tabData[`${currentInstrument}_${currentArreglo}`];
  if (!tab) { tablaturaDiv.innerHTML = "(Sin datos de tablatura)"; return; }
  const strings = INSTRUMENTS[currentInstrument].strings;
  const cols = tab[0].length;
  let html = `<div style="overflow-x:auto;"><svg width="${cols*44+60}" height="${strings*32+32}">
    <g>`;
  for (let s=0; s<strings; s++) {
    html += `<line x1="40" y1="${s*32+24}" x2="${cols*44+40}" y2="${s*32+24}" stroke="#888" stroke-width="2"/>`;
    html += `<text x="18" y="${s*32+30}" font-size="15" fill="#5534c4">S${s+1}</text>`;
  }
  for (let c=0; c<cols; c++) {
    html += `<line x1="${c*44+40}" y1="24" x2="${c*44+40}" y2="${strings*32+24}" stroke="#bbb" stroke-width="1"/>`;
  }
  for (let s=0; s<strings; s++) {
    for (let c=0; c<cols; c++) {
      let val = tab[s][c];
      html += `<text x="${c*44+60}" y="${s*32+44}" font-size="16" fill="#222" text-anchor="middle" style="cursor:pointer;" onclick="window.__editTabCell&&window.__editTabCell(${s},${c})">${val||''}</text>`;
    }
  }
  html += `</g></svg></div>`;
  tablaturaDiv.innerHTML = html;

  window.__editTabCell = function(s,c){
    if (!isAdmin) return;
    let val = prompt("Número/fret/nota (vacío para borrar):", tab[s][c]||"");
    tab[s][c] = (val||"").trim();
    renderTablatureEditorSVG();
  };
}

audioUpload.onchange = function(){
  const file = audioUpload.files[0];
  if(!file) return;
  const refUp = ref(storage, 'audios/'+file.name);
  uploadBytes(refUp, file).then(()=>getDownloadURL(refUp)).then(url=>{
    audioPlayer.src = url;
    audioPlayer.style.display = "";
    showToast("Audio subido correctamente.");
  });
};

songForm.onsubmit = async function(e){
  e.preventDefault();
  if (!isAdmin) return false;
  const titulo = songTitleInput.value.trim();
  if (!titulo) return showToast("Pon un título");
  const letra = letraInput.value;
  const instrumento = instrumentoSel.value;
  const arreglosToSave = [...arreglos];
  const tablaturaToSave = {};
  arreglosToSave.forEach(ar=>{
    let key = `${instrumento}_${ar}`;
    tablaturaToSave[ar] = serializeTab(tabData[key]);
  });
  let songData = {
    titulo, letra, instrumento, arreglos: arreglosToSave,
    tablatura: tablaturaToSave, acordesArriba, rasgueo: rasgueoArr,
    audioUrl: audioPlayer.src || ""
  };
  if(isNew){
    await addDoc(collection(db,"canciones"), songData);
    showToast("Canción agregada.");
    isNew = false;
  } else {
    await setDoc(doc(db,"canciones",currentSong.id), songData);
    showToast("Canción guardada.");
  }
  lastSavedData = JSON.stringify(songData);
  lastSavedDiv.textContent = "Última vez guardado: " + (new Date()).toLocaleString();
  return false;
};
newSongBtn.onclick = ()=>{
  isNew = true;
  currentSong = null;
  clearEditor();
  showToast("Editor limpio, puedes crear una nueva canción.");
};
cancelBtn.onclick = ()=>{
  if (currentSong) fillFormFromSong(currentSong);
  else clearEditor();
};

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(()=>toast.classList.remove("visible"),1800);
}
pdfBtn.onclick = ()=>{
  let el = songForm;
  html2pdf().from(el).set({filename: songTitleInput.value+".pdf"}).save();
};
rehearsalBtn.onclick = ()=>rehearsalModal.style.display="";
stopRehearsalBtn.onclick = ()=>rehearsalModal.style.display="none";
rehearsalSpeedInput.oninput = ()=>rehearsalSpeedLabel.textContent = rehearsalSpeedInput.value==="1"?"Normal":rehearsalSpeedInput.value+"x";
startRehearsalBtn.onclick = ()=>{
  let idx = 0;
  rehearsalArea.innerHTML = "";
  function next(){
    renderLetraEditor(idx);
    idx++;
    if(idx<=letraOriginal.length)
      setTimeout(next,900/rehearsalSpeedInput.value);
    else rehearsalArea.innerHTML = "<b>¡Listo!</b>";
  }
  next();
};

clearEditor();
