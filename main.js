// FIREBASE: usa tus datos
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtShAFym0sPrrkocsY48oAB2W4wbUD9ZY",
  authDomain: "edisapp-54c5c.firebaseapp.com",
  projectId: "edisapp-54c5c",
  storageBucket: "edisapp-54c5c.appspot.com", // ojo .app**spot**.com
  messagingSenderId: "1022245708836",
  appId: "1:1022245708836:web:5031161ed56f7d162524b1"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const INSTRUMENTS = {
  guitarra: 6,
  laud: 6,
  bandurria: 6,
  mandolina: 4,
  tricordio: 4,
  contrabajo: 4
};

const DEFAULT_BEATS = 16;

let songList = [];
let currentSong = null;
let isNew = false;

// DOM
const songListElem = document.getElementById("song-list");
const songForm = document.getElementById("song-form");
const songTitleInput = document.getElementById("song-title");
const letraInput = document.getElementById("letra-in");
const instrumentoSel = document.getElementById("instrumento");
const instrSpan = document.getElementById("instr-span");
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

let tabData = createEmptyTab("guitarra", DEFAULT_BEATS);
let letraOriginal = "";
let acordesArriba = {};
let rasgueoArr = [];

// ------------ CRUD Firebase ---------------

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

// ------------ Editor y render ---------------

function selectSong(id) {
  currentSong = songList.find(s=>s.id===id);
  isNew = false;
  fillFormFromSong(currentSong);
}

function createEmptyTab(instr, beats) {
  const strings = INSTRUMENTS[instr];
  return Array(strings).fill().map(() => Array(beats).fill(""));
}
function fillFormFromSong(song) {
  songTitleInput.value = song.titulo;
  letraInput.value = song.letra;
  instrumentoSel.value = song.instrumento;
  instrSpan.textContent = getInstrLabel(song.instrumento);
  tabData = song.tablatura || createEmptyTab(song.instrumento, DEFAULT_BEATS);
  letraOriginal = song.letra || "";
  acordesArriba = song.acordesArriba || {};
  rasgueoArr = song.rasgueo || [];
  audioPlayer.style.display = song.audioUrl ? "" : "none";
  audioPlayer.src = song.audioUrl || "";
  renderTablatureEditor();
  renderLetraEditor();
  renderRasgueoEditor();
}

function clearEditor() {
  songTitleInput.value = "";
  letraInput.value = "";
  instrumentoSel.value = "guitarra";
  instrSpan.textContent = getInstrLabel("guitarra");
  tabData = createEmptyTab("guitarra", DEFAULT_BEATS);
  letraOriginal = "";
  acordesArriba = {};
  rasgueoArr = [];
  audioPlayer.src = "";
  audioPlayer.style.display = "none";
  renderTablatureEditor();
  renderLetraEditor();
  renderRasgueoEditor();
}

instrumentoSel.onchange = () => {
  instrSpan.textContent = getInstrLabel(instrumentoSel.value);
  tabData = createEmptyTab(instrumentoSel.value, tabData[0].length);
  renderTablatureEditor();
  renderRasgueoEditor();
};
addColBtn.onclick = () => {
  for (let s = 0; s < tabData.length; s++) tabData[s].push("");
  renderTablatureEditor();
};
delColBtn.onclick = () => {
  if (tabData[0].length > 1) {
    for (let s = 0; s < tabData.length; s++) tabData[s].pop();
    renderTablatureEditor();
  }
};

function renderTablatureEditor() {
  tablaturaDiv.innerHTML = "";
  const numStrings = INSTRUMENTS[instrumentoSel.value];
  const numBeats = tabData[0].length;
  const table = document.createElement("table");
  table.className = "tablature-table";
  for (let s = 0; s < numStrings; s++) {
    const tr = document.createElement("tr");
    for (let b = 0; b < numBeats; b++) {
      const td = document.createElement("td");
      if (tabData[s][b] !== "") {
        const circle = document.createElement("span");
        circle.className = "tablature-fret";
        circle.textContent = tabData[s][b];
        td.appendChild(circle);
      }
      td.onclick = () => {
        td.classList.add("selected");
        td.innerHTML = `<input type="number" min="0" max="24" value="${tabData[s][b]||""}" style="width:27px; font-size:1em;" />`;
        const input = td.querySelector("input");
        input.focus();
        input.onblur = () => {
          tabData[s][b] = input.value || "";
          renderTablatureEditor();
        };
        input.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === "Tab") input.blur();
        };
      };
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  tablaturaDiv.appendChild(table);
}

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

function renderRasgueoEditor() {
  rasgueoDiv.innerHTML = "";
  if (instrumentoSel.value !== "guitarra") {
    rasgueoDiv.innerHTML = `<div style="color:#888;font-size:1em;">(Rasgueo sólo editable en guitarra)</div>`;
    return;
  }
  const seq = document.createElement("div");
  seq.style.display = "flex";
  seq.style.gap = "10px";
  rasgueoArr.forEach((r, idx) => {
    const icon = document.createElement("span");
    icon.className = "rasgueo-icon";
    icon.innerHTML = (r === "↓") ? "&#8595;" : (r === "↑") ? "&#8593;" : (r === "X") ? "✖" : r;
    icon.onclick = () => { rasgueoArr.splice(idx, 1); renderRasgueoEditor(); };
    seq.appendChild(icon);
  });
  rasgueoDiv.appendChild(seq);
  const controls = document.createElement("div");
  ["↓", "↑", "X", "•"].forEach(val => {
    const btn = document.createElement("button");
    btn.textContent = val;
    btn.className = "rasgueo-btn-add";
    btn.onclick = () => { rasgueoArr.push(val); renderRasgueoEditor(); };
    controls.appendChild(btn);
  });
  rasgueoDiv.appendChild(controls);
}

// Audio
audioUpload.onchange = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.style.display = "";
};

// Nueva canción
newSongBtn.onclick = () => {
  isNew = true;
  currentSong = null;
  clearEditor();
  songTitleInput.focus();
};

// Cancelar edición
cancelBtn.onclick = (e) => {
  e.preventDefault();
  if (songList.length && currentSong) fillFormFromSong(currentSong);
  else clearEditor();
};

// Guardar canción
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
};

function getInstrLabel(instr) {
  return `${instr.charAt(0).toUpperCase()+instr.slice(1)} (${INSTRUMENTS[instr]})`;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(()=>toast.classList.remove("visible"), 1800);
}

// --- INICIO ---
instrSpan.textContent = getInstrLabel("guitarra");
loadSongList();
clearEditor();
