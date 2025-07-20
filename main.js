// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDtShAFym0sPrrkocsY48oAB2W4wbUD9ZY",
  authDomain: "edisapp-54c5c.firebaseapp.com",
  projectId: "edisapp-54c5c",
  storageBucket: "edisapp-54c5c.firebasestorage.app",
  messagingSenderId: "1022245708836",
  appId: "1:1022245708836:web:5031161ed56f7d162524b1"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// === MOCK DATA EJEMPLO ===
const canciones = [
  {
    id: 'aires-vascos',
    titulo: "Aires Vascos",
    letra: "Viva la gente del pueblo...",
    letraMapeada: [
      // ejemplo: [{acorde: "C", pos: 0}, ...] (pos = índice de letra donde poner acorde arriba)
    ],
    instrumentos: {
      guitarra: {
        rasgueo: [ "↓", "↑", "X", "↓", "↑" ],
        tablatura: [
          // 6 cuerdas, n filas
          [ "", 3, 2, 0, 1, 0 ],
        ],
      },
      contrabajo: {
        tablatura: [
          [ "", 2, 4, "" ],
        ]
      },
      mandolina: {
        voz: {
          "1ra": { tablatura: [[0,2,2,0]], arreglos: [] },
          "2da": { tablatura: [[0,2,1,0]], arreglos: [] },
          "3ra": { tablatura: [[2,1,0,0]], arreglos: [] }
        }
      },
      // laud, bandurria igual estructura
    },
    audioUrl: ""
  }
];
// =========================

// DOM
const songListElem = document.getElementById("song-list");
const songTitle = document.getElementById("song-title");
const instrumentTabs = document.getElementById("instrument-tabs");
const instrumentContent = document.getElementById("instrument-content");
const audioBtn = document.getElementById("audio-btn");
const audioUpload = document.getElementById("audio-upload");
const audioPlayer = document.getElementById("audio-player");
const lyricsEditor = document.getElementById("lyrics-editor");
const saveBtn = document.getElementById("save-btn");
const modal = document.getElementById("modal");

// Estado actual
let currentSong = canciones[0];
let currentInstrument = "guitarra";
let currentVoz = "1ra";
let tablatureEditData = [];
let rasgueoEditData = [];
let letraChunks = [];
let acordesArriba = [];

// --- Render Listado ---
function renderSongList() {
  songListElem.innerHTML = "";
  canciones.forEach((song, idx) => {
    const li = document.createElement("li");
    li.textContent = song.titulo;
    li.classList.toggle("selected", currentSong === song);
    li.onclick = () => {
      selectSong(idx);
    };
    songListElem.appendChild(li);
  });
}
function selectSong(idx) {
  currentSong = canciones[idx];
  songTitle.textContent = currentSong.titulo;
  renderAudioSection();
  renderInstrumentTabs();
  renderLyricsEditor();
}
renderSongList();
selectSong(0);

// ---- AUDIO UPLOAD Y PLAYER ----
function renderAudioSection() {
  if (currentSong.audioUrl) {
    audioPlayer.src = currentSong.audioUrl;
    audioPlayer.style.display = "";
  } else {
    audioPlayer.style.display = "none";
  }
  audioBtn.onclick = () => audioUpload.click();
  audioUpload.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showModal("Subiendo audio...");
    const audioRef = ref(storage, `audios/${currentSong.id}/${file.name}`);
    await uploadBytes(audioRef, file);
    const url = await getDownloadURL(audioRef);
    currentSong.audioUrl = url;
    audioPlayer.src = url;
    audioPlayer.style.display = "";
    hideModal();
    // Aquí deberías guardar el nuevo url en firestore
  };
}

// ---- INSTRUMENTOS & TABS ----
function renderInstrumentTabs() {
  instrumentTabs.innerHTML = "";
  const instrumentos = Object.keys(currentSong.instrumentos || {});
  instrumentos.forEach(name => {
    const btn = document.createElement("button");
    btn.textContent = name[0].toUpperCase() + name.slice(1);
    btn.classList.toggle("active", name === currentInstrument);
    btn.onclick = () => {
      currentInstrument = name;
      currentVoz = "1ra";
      renderInstrumentEditor();
      renderInstrumentTabs();
    };
    instrumentTabs.appendChild(btn);
  });
  renderInstrumentEditor();
}

// --- TABLATURE & RASGUEO EDITOR ---
function renderInstrumentEditor() {
  instrumentContent.innerHTML = "";
  const instr = currentSong.instrumentos[currentInstrument];
  // Si el instrumento tiene voces
  if (instr.voz) {
    const vozTabs = document.createElement("div");
    vozTabs.className = "tablature-controls";
    ["1ra", "2da", "3ra"].forEach(vz => {
      const vbtn = document.createElement("button");
      vbtn.textContent = vz;
      vbtn.classList.toggle("active", vz === currentVoz);
      vbtn.onclick = () => { currentVoz = vz; renderInstrumentEditor(); };
      vozTabs.appendChild(vbtn);
    });
    instrumentContent.appendChild(vozTabs);
    tablatureEditData = JSON.parse(JSON.stringify(instr.voz[currentVoz].tablatura || [[]]));
    instrumentContent.appendChild(tabEditComponent(tablatureEditData, getNumStrings(currentInstrument)));
  } else {
    tablatureEditData = JSON.parse(JSON.stringify(instr.tablatura || [[]]));
    if (currentInstrument === "guitarra") {
      // Editor de rasgueo
      rasgueoEditData = [...(instr.rasgueo || [])];
      instrumentContent.appendChild(rasgueoEditComponent(rasgueoEditData));
    }
    instrumentContent.appendChild(tabEditComponent(tablatureEditData, getNumStrings(currentInstrument)));
  }
}
// Get strings per instrument
function getNumStrings(instr) {
  if (instr === "guitarra") return 6;
  if (instr === "contrabajo") return 4;
  if (instr === "mandolina" || instr === "tricordio" || instr === "laud" || instr === "bandurria") return 8;
  return 6;
}

// Componente de edición de tablatura
function tabEditComponent(tab, numStrings=6) {
  const wrap = document.createElement("div");
  wrap.className = "tablature-edit";
  // Controles
  const controls = document.createElement("div");
  controls.className = "tablature-controls";
  const addRow = document.createElement("button");
  addRow.textContent = "+ Compás";
  addRow.className = "tablature-btn-add";
  addRow.onclick = () => { tab.push(Array(numStrings).fill("")); rerender(); };
  controls.appendChild(addRow);
  if (tab.length) {
    const delRow = document.createElement("button");
    delRow.textContent = "- Compás";
    delRow.className = "tablature-btn-del";
    delRow.onclick = () => { tab.pop(); rerender(); };
    controls.appendChild(delRow);
  }
  wrap.appendChild(controls);
  // Tabla de cuerdas/trastes
  const table = document.createElement("table");
  table.className = "tablature-table";
  for (let row = 0; row < tab.length; row++) {
    const tr = document.createElement("tr");
    for (let s = 0; s < numStrings; s++) {
      const td = document.createElement("td");
      // Input de traste
      const val = tab[row][s];
      if (val === "") {
        td.innerHTML = `<span style="color:#bbb;">—</span>`;
      } else {
        td.innerHTML = `<span class="tablature-fret">${val}</span>`;
      }
      // Click: edita
      td.onclick = () => {
        showModal(`<input class="lyric-input" type="number" min="0" max="24" value="${val || ""}" id="inp-fret"/> 
          <button onclick="window.setFretValue()">Ok</button> 
          <button onclick="window.hideModal()">Cancelar</button>`);
        window.setFretValue = () => {
          tab[row][s] = document.getElementById("inp-fret").value;
          hideModal();
          rerender();
        };
      };
      // Botón de trino
      if (val !== "") {
        const trinoBtn = document.createElement("button");
        trinoBtn.textContent = "Trino";
        trinoBtn.className = "tablature-btn-add";
        trinoBtn.onclick = (e) => {
          e.stopPropagation();
          td.firstChild.classList.toggle("trino");
        };
        td.appendChild(trinoBtn);
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  wrap.appendChild(table);
  // Función para rerender
  function rerender() {
    instrumentContent.innerHTML = "";
    instrumentContent.appendChild(tabEditComponent(tab, numStrings));
  }
  return wrap;
}

// Componente de edición de rasgueo
function rasgueoEditComponent(rasgueoArr) {
  const wrap = document.createElement("div");
  wrap.className = "rasgueo-edit";
  const seq = document.createElement("div");
  seq.className = "rasgueo-sequence";
  rasgueoArr.forEach((r, idx) => {
    const icon = document.createElement("span");
    icon.className = "rasgueo-icon";
    icon.innerHTML = (r === "↓") ? "&#8595;" : (r === "↑") ? "&#8593;" : (r === "X") ? "✖" : r;
    icon.onclick = () => { rasgueoArr.splice(idx, 1); rerender(); };
    seq.appendChild(icon);
  });
  wrap.appendChild(seq);
  // Controles
  const controls = document.createElement("div");
  controls.className = "rasgueo-controls";
  ["↓", "↑", "X", "•"].forEach(val => {
    const btn = document.createElement("button");
    btn.textContent = val;
    btn.className = "rasgueo-btn-add";
    btn.onclick = () => { rasgueoArr.push(val); rerender(); };
    controls.appendChild(btn);
  });
  wrap.appendChild(controls);
  function rerender() {
    instrumentContent.innerHTML = "";
    instrumentContent.appendChild(rasgueoEditComponent(rasgueoArr));
    instrumentContent.appendChild(tabEditComponent(tablatureEditData, 6));
  }
  return wrap;
}

// --- EDITOR DE LETRA Y ACORDES ---
function renderLyricsEditor() {
  lyricsEditor.innerHTML = "";
  letraChunks = currentSong.letra.split("").map(l => ({ letra: l, acorde: "" }));
  acordesArriba = []; // {pos, acorde}
  letraChunks.forEach((chunk, i) => {
    const span = document.createElement("span");
    span.className = "lyric-chunk";
    span.textContent = chunk.letra;
    span.onclick = (e) => {
      showModal(`<input class="lyric-input" type="text" maxlength="6" placeholder="Acorde" id="acorde-edit"/> 
        <button onclick="window.setChordAt(${i})">Ok</button> 
        <button onclick="window.hideModal()">Cancelar</button>`);
      window.setChordAt = (idx) => {
        acordesArriba = acordesArriba.filter(a => a.pos !== idx);
        const val = document.getElementById("acorde-edit").value;
        if (val) acordesArriba.push({ pos: idx, acorde: val });
        hideModal();
        renderLyricsEditor();
      };
    };
    // Render acorde si existe en esa pos
    const match = acordesArriba.find(a => a.pos === i);
    if (match) {
      const chordSpan = document.createElement("span");
      chordSpan.className = "chord-above";
      chordSpan.textContent = match.acorde;
      span.prepend(chordSpan);
    }
    lyricsEditor.appendChild(span);
  });
}

// --- MODAL SIMPLE ---
function showModal(html) {
  modal.innerHTML = `<div id="modal-content">${html}</div>`;
  modal.classList.remove("hidden");
}
function hideModal() {
  modal.innerHTML = "";
  modal.classList.add("hidden");
}
window.hideModal = hideModal;

// --- GUARDAR EN FIREBASE (demo) ---
saveBtn.onclick = async () => {
  showModal("Guardando...");
  // Debes construir la estructura real de datos aquí según los editores
  // y subirla a Firestore
  // Ejemplo:
  // await setDoc(doc(db, "canciones", currentSong.id), { ... });
  hideModal();
};

